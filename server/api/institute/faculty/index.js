const {
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const toSafeFacultyProfile = (document) => {
  const data = document.data() || {};
  const loginId = normalizeText(data.loginId || data.teacherCode || data.uniqueId || data.code);

  return {
    id: loginId || document.id,
    name: normalizeText(data.name) || 'Unnamed Faculty',
    loginId: loginId || 'ID pending',
    teacherCode: loginId || 'ID pending',
    department: normalizeText(data.department || data.dept || data.subject) || 'Faculty',
    photoURL: normalizeText(data.photoURL || data.profilePic || data.avatarUrl) || null,
  };
};

module.exports = async function instituteFacultyHandler(req, res) {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const authContext = await authenticateUserProfile(req, ['student', 'teacher', 'admin']);
    const instituteId = normalizeText(authContext.profile.instituteId);

    if (!instituteId) {
      res.status(403).json({ success: false, error: 'Your profile is not assigned to an institute.', requestId });
      return;
    }

    const { firestore } = getAdminServices();
    const snapshot = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .where('role', '==', 'teacher')
      .get();

    const faculty = snapshot.docs
      .map(toSafeFacultyProfile)
      .sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({
      success: true,
      faculty,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Failed to load the faculty directory.', requestId);
  }
};
