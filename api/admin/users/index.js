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

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizeIdentifier = (value) => String(value || '').trim();
const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const toAuthEmail = (identifier) => {
  const cleaned = normalizeIdentifier(identifier).toLowerCase();
  return cleaned.includes('@') ? cleaned : `${cleaned}@eduhub.local`;
};

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

  try {
    const authContext = await authenticateUserProfile(req, ['admin', 'superadmin']);
    const { firestore } = getAdminServices();
    const body = await getBody(req);

    const name = normalizeText(body.name);
    const identifier = normalizeIdentifier(body.identifier);
    const password = body.password;
    const role = normalizeRole(body.role);
    const primaryTag = normalizeText(body.primaryTag);
    const secondaryTag = normalizeText(body.secondaryTag);
    const instituteId = normalizeIdentifier(body.instituteId || authContext.profile.instituteId);

    if (!instituteId) {
      res.status(400).json({ success: false, error: 'Institute ID is required.', requestId });
      return;
    }

    if (!name || !identifier || !primaryTag) {
      res.status(400).json({ success: false, error: 'Name, ID/email, and class/department are required.', requestId });
      return;
    }

    if (!['student', 'teacher'].includes(role)) {
      res.status(400).json({ success: false, error: 'Role must be student or teacher.', requestId });
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

    const duplicateProfile = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .where('role', '==', role)
      .where('uniqueId', '==', identifier)
      .limit(1)
      .get();

    if (!duplicateProfile.empty) {
      res.status(409).json({ success: false, error: `${role === 'teacher' ? 'Teacher' : 'Student'} ID already exists in this institute.`, requestId });
      return;
    }

    const email = toAuthEmail(identifier);
    await admin.auth().getUserByEmail(email)
      .then(() => {
        const error = new Error('An auth account already exists for this ID/email.');
        error.statusCode = 409;
        throw error;
      })
      .catch((error) => {
        if (error.code === 'auth/user-not-found') return;
        throw error;
      });

    createdUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    const profile = {
      uid: createdUser.uid,
      name,
      email,
      role,
      instituteId,
      uniqueId: identifier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: authContext.uid,
    };

    if (role === 'teacher') {
      profile.teacherCode = identifier;
      profile.degree = '';
      profile.assignedClass = primaryTag;
      profile.assignedSection = secondaryTag;
      profile.assignedDept = primaryTag;
      profile.assignedSem = secondaryTag;
      profile.isClassTeacher = false;
    } else if ((instituteSnap.data().type || 'school').toLowerCase().includes('school')) {
      profile.class = primaryTag;
      profile.section = secondaryTag;
    } else {
      profile.dept = primaryTag;
      profile.sem = secondaryTag;
    }

    await firestore.collection('users').doc(createdUser.uid).set(profile);

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
      await admin.auth().deleteUser(createdUser.uid).catch(() => {});
    }

    if (error.code === 'auth/email-already-exists') {
      error.statusCode = 409;
      error.message = 'An auth account already exists for this ID/email.';
    }

    sendError(res, error, 'Failed to create user.', requestId);
  }
};
