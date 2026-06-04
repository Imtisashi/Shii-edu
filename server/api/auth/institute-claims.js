const {
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');

const INSTITUTE_ROLES = new Set(['admin', 'teacher', 'professor', 'student', 'parent', 'driver']);

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req);
    const instituteId = actor.profile?.instituteId;
    if (!instituteId || !INSTITUTE_ROLES.has(actor.role)) {
      const error = new Error('A verified institute profile is required.');
      error.statusCode = 403;
      throw error;
    }

    const { admin } = getAdminServices();
    const userRecord = await admin.auth().getUser(actor.uid);
    const existingClaims = userRecord.customClaims || {};
    const nextClaims = {
      ...existingClaims,
      instituteId,
      role: actor.role,
      instituteVerified: true,
    };

    await admin.auth().setCustomUserClaims(actor.uid, nextClaims);

    res.status(200).json({
      success: true,
      instituteId,
      role: actor.role,
      tokenRefreshRequired: true,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Institute claims could not be synchronized.', requestId);
  }
};
