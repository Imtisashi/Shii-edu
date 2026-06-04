const {
  admin,
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');
const {
  assertInstituteId,
  assertUserId,
  toIdentifierKey,
  toInstituteAuthEmail,
} = require('../../_lib/loginIdentifiers');
const {
  isInternalTaskExecution,
} = require('../../_lib/backgroundTasks');
const { mirrorProfilesToSupabase } = require('../../_lib/supabaseProfileMirror');
const {
  callSupabaseTenantBridge,
  stripInstituteIdForTenantActor,
} = require('../../_lib/supabaseTenantBridge');

const MAX_IMPORT_ROWS = 500;
const AUTH_CONCURRENCY = 10;
const FIRESTORE_BATCH_SIZE = 400;

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizePhone = (value) => String(value || '').trim().replace(/[^\d+()-]/g, '');

const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const mapWithConcurrency = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

const normalizeRow = (row, index, isSchool) => {
  const rowNumber = index + 2;
  const firstName = normalizeText(row.firstName);
  const lastName = normalizeText(row.lastName);
  const name = normalizeText([firstName, lastName].filter(Boolean).join(' '));
  const userId = assertUserId(row.userId, `Row ${rowNumber} User ID`);
  const password = String(row.password || '');
  const primaryTag = normalizeText(isSchool ? row.standard : row.department);
  const secondaryTag = normalizeText(isSchool ? row.section : row.semester);

  if (!name) {
    throw validationError(`Row ${rowNumber}: firstName is required.`);
  }

  if (password.length < 8) {
    throw validationError(`Row ${rowNumber}: password must be at least 8 characters.`);
  }

  if (!primaryTag || !secondaryTag) {
    throw validationError(
      `Row ${rowNumber}: ${isSchool ? 'standard and section' : 'department and semester'} are required.`
    );
  }

  return {
    index,
    rowNumber,
    firstName,
    lastName,
    name,
    userId,
    loginIdKey: toIdentifierKey(userId),
    password,
    primaryTag,
    secondaryTag,
    parent: {
      name: normalizeText(row.parentName),
      phone: normalizePhone(row.parentPhone),
    },
  };
};

const loadExistingLoginKeys = async (firestore, instituteId) => {
  const snapshot = await firestore
    .collection('users')
    .where('instituteId', '==', instituteId)
    .get();

  const keys = new Set();
  snapshot.docs.forEach((document) => {
    const data = document.data() || {};
    const key = data.loginIdKey || (data.loginId || data.uniqueId ? toIdentifierKey(data.loginId || data.uniqueId) : '');
    if (key) keys.add(key);
  });
  return keys;
};

const loadExistingAuthEmails = async (authEmails) => {
  const existing = new Set();
  for (const chunk of chunkArray(authEmails, 100)) {
    const result = await admin.auth().getUsers(chunk.map((email) => ({ email })));
    result.users.forEach((user) => {
      if (user.email) existing.add(user.email.toLowerCase());
    });
  }
  return existing;
};

const rollbackCreatedUsers = async ({ firestore, createdUsers }) => {
  for (const chunk of chunkArray(createdUsers, FIRESTORE_BATCH_SIZE)) {
    const batch = firestore.batch();
    chunk.forEach(({ uid }) => batch.delete(firestore.collection('users').doc(uid)));
    await batch.commit().catch(() => {});
  }

  for (const chunk of chunkArray(createdUsers.map(({ uid }) => uid), 1000)) {
    await admin.auth().deleteUsers(chunk).catch(() => {});
  }
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  let createdUsers = [];

  try {
    const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
    const { firestore } = getAdminServices();
    const body = await getBody(req);
    const instituteId = assertInstituteId(body.instituteId || actor.profile.instituteId);
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (actor.role === 'admin' && actor.profile.instituteId !== instituteId) {
      const error = new Error('Admins can only import students into their own institute.');
      error.statusCode = 403;
      throw error;
    }

    if (rows.length === 0) {
      throw validationError('The CSV file does not contain any student rows.');
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      throw validationError(`A single import can contain at most ${MAX_IMPORT_ROWS} students.`);
    }

    const instituteSnap = await firestore.collection('institutes').doc(instituteId).get();
    if (!instituteSnap.exists) {
      const error = new Error('Institute not found.');
      error.statusCode = 404;
      throw error;
    }

    const instituteData = instituteSnap.data() || {};
    const institutionType = normalizeText(instituteData.institutionType || instituteData.type || 'SCHOOL').toUpperCase();
    const isSchool = !institutionType.includes('COLLEGE');
    const normalizedRows = [];
    const rowErrors = [];

    rows.forEach((row, index) => {
      try {
        normalizedRows.push(normalizeRow(row || {}, index, isSchool));
      } catch (error) {
        rowErrors.push({
          row: index + 2,
          userId: normalizeText(row?.userId),
          error: error.message,
        });
      }
    });

    const duplicateBatchKeys = new Set();
    normalizedRows.forEach((row) => {
      if (duplicateBatchKeys.has(row.loginIdKey)) {
        rowErrors.push({
          row: row.rowNumber,
          userId: row.userId,
          error: 'This User ID appears more than once in the CSV file.',
        });
      }
      duplicateBatchKeys.add(row.loginIdKey);
    });

    const invalidRows = new Set(rowErrors.map((entry) => entry.row));
    const candidates = normalizedRows.filter((row) => !invalidRows.has(row.rowNumber));
    const existingLoginKeys = await loadExistingLoginKeys(firestore, instituteId);
    const candidatesWithEmail = candidates.map((row) => ({
      ...row,
      authEmail: toInstituteAuthEmail(instituteId, row.userId),
    }));
    const existingAuthEmails = await loadExistingAuthEmails(candidatesWithEmail.map((row) => row.authEmail));
    const importableRows = candidatesWithEmail.filter((row) => {
      if (existingLoginKeys.has(row.loginIdKey) || existingAuthEmails.has(row.authEmail.toLowerCase())) {
        rowErrors.push({
          row: row.rowNumber,
          userId: row.userId,
          error: 'User ID already exists in this institute.',
        });
        return false;
      }
      return true;
    });

    const authResults = await mapWithConcurrency(importableRows, AUTH_CONCURRENCY, async (row) => {
      let authUser = null;
      try {
        authUser = await admin.auth().createUser({
          displayName: row.name,
          email: row.authEmail,
          password: row.password,
        });
        await admin.auth().setCustomUserClaims(authUser.uid, {
          instituteId,
          role: 'student',
          instituteVerified: true,
        });
        return { row, uid: authUser.uid };
      } catch (error) {
        if (authUser?.uid) {
          await admin.auth().deleteUser(authUser.uid).catch(() => {});
        }
        rowErrors.push({
          row: row.rowNumber,
          userId: row.userId,
          error: error.code === 'auth/email-already-exists'
            ? 'User ID already exists in this institute.'
            : 'The authentication account could not be created.',
        });
        return null;
      }
    });
    createdUsers = authResults.filter(Boolean);

    const importRef = firestore.collection('studentImportJobs').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const profiles = createdUsers.map(({ row, uid }) => {
      const profile = {
        uid,
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        email: null,
        authEmail: row.authEmail,
        role: 'student',
        instituteId,
        loginId: row.userId,
        loginIdKey: row.loginIdKey,
        uniqueId: row.userId,
        parentContact: {
          name: row.parent.name || null,
          phone: row.parent.phone || null,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: actor.uid,
        importJobId: importRef.id,
      };

      if (isSchool) {
        profile.class = row.primaryTag;
        profile.standard = row.primaryTag;
        profile.section = row.secondaryTag;
      } else {
        profile.dept = row.primaryTag;
        profile.department = row.primaryTag;
        profile.sem = row.secondaryTag;
        profile.semester = row.secondaryTag;
      }

      return { uid, profile };
    });

    try {
      for (const chunk of chunkArray(profiles, FIRESTORE_BATCH_SIZE)) {
        const batch = firestore.batch();
        chunk.forEach(({ uid, profile }) => {
          batch.set(firestore.collection('users').doc(uid), profile);
        });
        await batch.commit();
      }
    } catch (error) {
      await rollbackCreatedUsers({ firestore, createdUsers });
      createdUsers = [];
      throw error;
    }

    const createdProfiles = profiles.map(({ profile }) => profile);
    if (req.headers.authorization && !isInternalTaskExecution(req)) {
      await callSupabaseTenantBridge({
        action: 'createProfiles',
        authorization: req.headers.authorization,
        payload: {
          profiles: createdProfiles.map((profile) => (
            actor.role === 'superadmin' ? profile : stripInstituteIdForTenantActor(profile)
          )),
        },
      });
    } else {
      await mirrorProfilesToSupabase({
        actor,
        profiles: createdProfiles,
      });
    }

    await importRef.set({
      instituteId,
      institutionType: isSchool ? 'SCHOOL' : 'COLLEGE',
      requestedRows: rows.length,
      createdStudents: profiles.length,
      skippedRows: rowErrors.length,
      errors: rowErrors.slice(0, 100),
      createdAt: now,
      createdBy: actor.uid,
      status: rowErrors.length > 0 ? 'completed_with_errors' : 'completed',
    });

    res.status(200).json({
      success: true,
      importJobId: importRef.id,
      createdStudents: profiles.length,
      skippedRows: rowErrors.length,
      errors: rowErrors,
      requestId,
    });
  } catch (error) {
    if (createdUsers.length > 0) {
      const { firestore } = getAdminServices();
      await rollbackCreatedUsers({ firestore, createdUsers });
    }
    sendError(res, error, 'Student import failed.', requestId);
  }
};
