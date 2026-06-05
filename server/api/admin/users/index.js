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
} = require('../../_lib/loginIdentifiers');
const {
  callSupabaseTenantBridge,
  stripInstituteIdForTenantActor,
} = require('../../_lib/supabaseTenantBridge');
const { assertFeatureEnabled } = require('../../_lib/featureEntitlements');
const { assertRateLimit } = require('../../_lib/rateLimit');

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const VALID_ROLES = new Set(['student', 'teacher', 'parent', 'driver']);

module.exports = async (req, res) => {
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
    assertRateLimit({ actor: authContext, req, scope: 'admin:user-create', limit: 24, windowMs: 60 * 1000 });
    const { firestore } = getAdminServices();
    const body = await getBody(req);

    const name = normalizeText(body.name);
    const identifier = assertUserId(body.identifier);
    const loginIdKey = toIdentifierKey(identifier);
    const password = body.password;
    const role = normalizeRole(body.role);
    const primaryTag = normalizeText(body.primaryTag);
    const secondaryTag = normalizeText(body.secondaryTag);
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
    if (role === 'parent' && !primaryTag) {
      res.status(400).json({ success: false, error: 'A linked Student User ID is required for parent accounts.', requestId });
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

    let linkedStudent = null;
    if (role === 'parent') {
      const linkedStudentKey = toIdentifierKey(assertUserId(primaryTag, 'Linked Student User ID'));
      const linkedStudentSnapshot = await usersRef
        .where('instituteId', '==', instituteId)
        .where('loginIdKey', '==', linkedStudentKey)
        .limit(1)
        .get();
      if (linkedStudentSnapshot.empty || normalizeRole(linkedStudentSnapshot.docs[0].data()?.role) !== 'student') {
        res.status(404).json({ success: false, error: 'Linked Student User ID was not found in this institute.', requestId });
        return;
      }
      linkedStudent = {
        uid: linkedStudentSnapshot.docs[0].id,
        ...linkedStudentSnapshot.docs[0].data(),
      };
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
      profile.linkedStudentUid = linkedStudent.uid;
      profile.linkedStudentUserId = linkedStudent.loginId || linkedStudent.uniqueId || primaryTag;
      profile.linkedStudentName = linkedStudent.name || null;
      profile.relationship = secondaryTag || 'Parent / Guardian';
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

    await firestore.collection('users').doc(createdUser.uid).set(profile);
    createdFirestoreProfile = true;
    await callSupabaseTenantBridge({
      action: 'createProfile',
      authorization: req.headers.authorization || '',
      payload: authContext.role === 'superadmin' ? profile : stripInstituteIdForTenantActor(profile),
    });

    res.status(201).json({
      success: true,
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
};
