const {
  admin,
  assertPassword,
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
  toLegacyAuthEmail,
} = require('../../_lib/loginIdentifiers');
const {
  syncProfilesToSupabaseResilient,
  toFirestoreSyncState,
  toResponseState,
} = require('../../_lib/supabaseUserSync');
const { assertFeatureEnabled } = require('../../_lib/featureEntitlements');
const { assertRateLimit } = require('../../_lib/rateLimit');

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const VALID_ROLES = new Set(['student', 'teacher', 'parent', 'driver']);
const STUDENT_ID_FIELDS = ['loginId', 'uniqueId', 'userId', 'studentId'];
const MAX_LINKED_STUDENTS_PER_PARENT = 8;

const hasMatchingStudentIdentifier = (profile, linkedStudentKey, linkedStudentId = '') => {
  if (!profile || normalizeRole(profile.role) !== 'student') return false;
  if (profile.uid === linkedStudentId || profile.id === linkedStudentId) return true;
  if (toIdentifierKey(profile.loginIdKey) === linkedStudentKey) return true;
  return STUDENT_ID_FIELDS.some((field) => (
    profile[field] && toIdentifierKey(profile[field]) === linkedStudentKey
  ));
};

const findLinkedStudentProfile = async ({ firestore, instituteId, linkedStudentId }) => {
  const usersRef = firestore.collection('users');
  const linkedStudentKey = toIdentifierKey(linkedStudentId);
  const exactStudentIds = [...new Set([linkedStudentId, linkedStudentKey])];
  const snapshots = await Promise.all([
    usersRef
      .where('instituteId', '==', instituteId)
      .where('loginIdKey', '==', linkedStudentKey)
      .limit(1)
      .get(),
    ...STUDENT_ID_FIELDS.flatMap((field) => exactStudentIds.map((candidate) => (
      usersRef
        .where('instituteId', '==', instituteId)
        .where(field, '==', candidate)
        .limit(1)
        .get()
    ))),
  ]);

  const directMatch = snapshots
    .flatMap((snapshot) => snapshot.docs)
    .map((document) => ({ id: document.id, uid: document.id, ...document.data() }))
    .find((profile) => (
      profile.instituteId === instituteId &&
      hasMatchingStudentIdentifier(profile, linkedStudentKey, linkedStudentId)
    ));
  if (directMatch) return directMatch;

  const uidSnap = await usersRef.doc(linkedStudentId).get();
  if (uidSnap.exists) {
    const profile = { id: uidSnap.id, uid: uidSnap.id, ...uidSnap.data() };
    if (
      profile.instituteId === instituteId &&
      hasMatchingStudentIdentifier(profile, linkedStudentKey, linkedStudentId)
    ) {
      return profile;
    }
  }

  const authEmails = [toInstituteAuthEmail(instituteId, linkedStudentId), toLegacyAuthEmail(linkedStudentId)];
  for (const email of [...new Set(authEmails)]) {
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      const userSnap = await usersRef.doc(userRecord.uid).get();
      if (!userSnap.exists) continue;

      const profile = { id: userSnap.id, uid: userSnap.id, ...userSnap.data() };
      if (
        profile.instituteId === instituteId &&
        hasMatchingStudentIdentifier(profile, linkedStudentKey, linkedStudentId)
      ) {
        return profile;
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }

  const instituteUsersSnapshot = await usersRef
    .where('instituteId', '==', instituteId)
    .get();
  const normalizedLegacyMatch = instituteUsersSnapshot.docs
    .map((document) => ({ id: document.id, uid: document.id, ...document.data() }))
    .find((profile) => (
      profile.instituteId === instituteId &&
      hasMatchingStudentIdentifier(profile, linkedStudentKey, linkedStudentId)
    ));
  if (normalizedLegacyMatch) return normalizedLegacyMatch;

  return null;
};

const parseLinkedStudentIds = (body = {}) => {
  const rawValues = [
    body.primaryTag,
    body.linkedStudentId,
    ...(Array.isArray(body.linkedStudentIds) ? body.linkedStudentIds : []),
  ];
  const ids = rawValues
    .flatMap((value) => String(value || '').split(/[,\n\r;|]+/))
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return [...new Set(ids)].slice(0, MAX_LINKED_STUDENTS_PER_PARENT);
};

const getStudentVisibleId = (student = {}) => (
  student.loginId ||
  student.uniqueId ||
  student.studentId ||
  student.userId ||
  student.uid ||
  student.id ||
  ''
);

const buildParentLinkFields = (linkedStudents = [], relationship = '') => {
  const students = linkedStudents
    .filter(Boolean)
    .map((student) => ({
      name: student.name || null,
      uid: student.uid || student.id,
      userId: getStudentVisibleId(student),
    }))
    .filter((student) => student.uid);
  const firstStudent = students[0] || {};

  return {
    childUids: students.map((student) => student.uid),
    linkedStudentName: firstStudent.name || null,
    linkedStudentUid: firstStudent.uid || null,
    linkedStudentUserId: firstStudent.userId || null,
    linkedStudents: students,
    relationship: relationship || 'Parent / Guardian',
  };
};

const findLinkedStudentProfiles = async ({ firestore, instituteId, linkedStudentIds }) => {
  const linkedStudents = [];

  for (const linkedStudentId of linkedStudentIds) {
    const normalizedLinkedStudentId = assertUserId(linkedStudentId, 'Linked Student User ID');
    const linkedStudent = await findLinkedStudentProfile({
      firestore,
      instituteId,
      linkedStudentId: normalizedLinkedStudentId,
    });

    if (!linkedStudent) {
      const error = new Error(`Linked Student User ID ${normalizedLinkedStudentId} was not found in this institute.`);
      error.statusCode = 404;
      throw error;
    }

    if (!linkedStudents.some((student) => (student.uid || student.id) === (linkedStudent.uid || linkedStudent.id))) {
      linkedStudents.push(linkedStudent);
    }
  }

  return linkedStudents;
};

async function handler(req, res) {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  let createdUser = null;
  let createdFirestoreProfile = false;

  try {
    const authContext = await authenticateUserProfile(req, ['admin', 'superadmin']);
    await assertRateLimit({ actor: authContext, req, scope: 'admin:user-create', limit: 24, windowMs: 60 * 1000 });
    const { firestore } = getAdminServices();
    const body = await getBody(req);

    const name = normalizeText(body.name);
    const identifier = assertUserId(body.identifier);
    const loginIdKey = toIdentifierKey(identifier);
    const password = body.password;
    const role = normalizeRole(body.role);
    const primaryTag = normalizeText(body.primaryTag);
    const secondaryTag = normalizeText(body.secondaryTag);
    const linkedStudentIds = role === 'parent' ? parseLinkedStudentIds(body) : [];
    const instituteId = assertInstituteId(body.instituteId || authContext.profile.instituteId);

    if (!VALID_ROLES.has(role)) {
      res.status(400).json({ success: false, error: 'Role must be student, teacher, parent, or driver.', requestId });
      return;
    }

    if (!name) {
      res.status(400).json({ success: false, error: 'Name and User ID are required.', requestId });
      return;
    }

    if (role === 'student' && (!primaryTag || !secondaryTag)) {
      res.status(400).json({ success: false, error: 'Student class/section or department/semester is required.', requestId });
      return;
    }
    if (role === 'parent' && linkedStudentIds.length === 0) {
      res.status(400).json({ success: false, error: 'At least one linked Student User ID is required for parent accounts.', requestId });
      return;
    }
    if (role === 'driver' && !primaryTag) {
      res.status(400).json({ success: false, error: 'A Vehicle ID is required for driver accounts.', requestId });
      return;
    }

    assertPassword(password);

    if (authContext.role === 'admin' && authContext.profile.instituteId !== instituteId) {
      res.status(403).json({ success: false, error: 'Admins can only create users inside their own institute.', requestId });
      return;
    }

    const instituteSnap = await firestore.collection('institutes').doc(instituteId).get();
    if (!instituteSnap.exists) {
      res.status(404).json({ success: false, error: 'Institute not found.', requestId });
      return;
    }
    await assertFeatureEnabled({ firestore, instituteId, featureKey: 'people' });

    const instituteData = instituteSnap.data() || {};
    const instituteProfile = {
      id: instituteSnap.id,
      instituteId,
      ...instituteData,
    };
    const rawInstitutionType = normalizeText(instituteData.institutionType || instituteData.type || 'SCHOOL').toUpperCase();
    const isSchoolInstitute = !rawInstitutionType.includes('COLLEGE');

    const usersRef = firestore.collection('users');
    const [duplicateProfile, legacyDuplicateProfile] = await Promise.all([
      usersRef
        .where('instituteId', '==', instituteId)
        .where('loginIdKey', '==', loginIdKey)
        .limit(1)
        .get(),
      usersRef
        .where('instituteId', '==', instituteId)
        .where('uniqueId', '==', identifier)
        .limit(1)
        .get(),
    ]);

    if (!duplicateProfile.empty || !legacyDuplicateProfile.empty) {
      res.status(409).json({ success: false, error: 'User ID already exists in this institute.', requestId });
      return;
    }

    let linkedStudents = [];
    if (role === 'parent') {
      linkedStudents = await findLinkedStudentProfiles({ firestore, instituteId, linkedStudentIds });
    }

    if (role === 'driver') {
      const duplicateVehicle = await usersRef
        .where('instituteId', '==', instituteId)
        .where('vehicleId', '==', primaryTag)
        .limit(1)
        .get();
      if (!duplicateVehicle.empty) {
        res.status(409).json({ success: false, error: 'Vehicle ID is already assigned to another driver.', requestId });
        return;
      }
    }

    const authEmail = toInstituteAuthEmail(instituteId, identifier);
    await admin.auth().getUserByEmail(authEmail)
      .then(() => {
        const error = new Error('An auth account already exists for this User ID in this institute.');
        error.statusCode = 409;
        throw error;
      })
      .catch((error) => {
        if (error.code === 'auth/user-not-found') return;
        throw error;
      });

    createdUser = await admin.auth().createUser({
      email: authEmail,
      password,
      displayName: name,
    });
    await admin.auth().setCustomUserClaims(createdUser.uid, {
      instituteId,
      role,
      instituteVerified: true,
    });

    const profile = {
      uid: createdUser.uid,
      name,
      email: null,
      authEmail,
      role,
      instituteId,
      loginId: identifier,
      loginIdKey,
      uniqueId: identifier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: authContext.uid,
    };

    if (role === 'teacher') {
      profile.teacherCode = identifier;
      profile.degree = '';
      profile.assignedClass = null;
      profile.assignedSection = null;
      profile.assignedDept = null;
      profile.assignedSem = null;
      profile.isClassTeacher = false;
      profile.teachingScope = {
        classes: isSchoolInstitute && primaryTag ? [primaryTag] : [],
        sections: isSchoolInstitute && secondaryTag ? [secondaryTag] : [],
        departments: !isSchoolInstitute && primaryTag ? [primaryTag] : [],
        semesters: !isSchoolInstitute && secondaryTag ? [secondaryTag] : [],
      };
      profile.assignmentStatus = 'unassigned';
    } else if (role === 'parent') {
      Object.assign(profile, buildParentLinkFields(linkedStudents, secondaryTag));
    } else if (role === 'driver') {
      profile.vehicleId = primaryTag;
      profile.routeName = secondaryTag || null;
      profile.fleetStatus = 'offline';
    } else if (isSchoolInstitute) {
      profile.class = primaryTag;
      profile.section = secondaryTag;
    } else {
      profile.dept = primaryTag;
      profile.sem = secondaryTag;
    }

    const userRef = firestore.collection('users').doc(createdUser.uid);
    await userRef.set(profile);
    createdFirestoreProfile = true;

    const supabaseSync = await syncProfilesToSupabaseResilient({
      action: 'createProfile',
      actor: authContext,
      authorization: req.headers.authorization || '',
      institute: instituteProfile,
      profiles: [profile],
      requestId,
    });
    await userRef.update({
      supabaseSync: toFirestoreSyncState(supabaseSync),
    }).catch((error) => {
      console.warn(JSON.stringify({
        level: 'warn',
        requestId,
        message: error.message,
        syncStateWriteFailed: true,
      }));
    });

    res.status(201).json({
      success: true,
      supabaseSync: toResponseState(supabaseSync),
      uid: createdUser.uid,
      user: {
        uid: createdUser.uid,
        name,
        role,
        instituteId,
        uniqueId: identifier,
      },
      requestId,
    });
  } catch (error) {
    if (createdUser?.uid) {
      if (createdFirestoreProfile) {
        await getAdminServices().firestore.collection('users').doc(createdUser.uid).delete().catch(() => {});
      }
      await admin.auth().deleteUser(createdUser.uid).catch(() => {});
    }

    if (error.code === 'auth/email-already-exists') {
      error.statusCode = 409;
      error.message = 'An auth account already exists for this User ID in this institute.';
    }

    sendError(res, error, 'Failed to create user.', requestId);
  }
}

module.exports = handler;
module.exports.__test = {
  buildParentLinkFields,
  parseLinkedStudentIds,
};
