const {
  admin,
  authenticateSuperAdmin,
  commitDeleteBatch,
  createRequestId,
  deleteWhere,
  getAdminServices,
  handleOptions,
  resolveInstituteDocument,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');

const INSTITUTE_SCOPED_COLLECTIONS = [
  'notices',
  'routines',
  'assignments',
  'grades',
  'attendance',
  'gallery',
  'pyqs',
  'paymentOrders',
  'payments',
];

const getInstituteIdFromRequest = (req) => {
  if (req.query?.instituteId) return String(req.query.instituteId).trim();

  const pathParts = String(req.url || '').split('?')[0].split('/').filter(Boolean);
  return decodeURIComponent(pathParts[pathParts.length - 1] || '').trim();
};

module.exports = async (req, res) => {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }

  try {
    await authenticateSuperAdmin(req);
    const { firestore } = getAdminServices();
    const requestedInstituteId = getInstituteIdFromRequest(req);

    if (!requestedInstituteId) {
      res.status(400).json({ success: false, error: 'Institute ID is required.' });
      return;
    }

    const institute = await resolveInstituteDocument(firestore, requestedInstituteId);
    if (!institute) {
      res.status(404).json({ success: false, error: 'Institute not found.' });
      return;
    }

    const instituteData = institute.snap.data();
    const instituteId = instituteData.instituteId || institute.snap.id;
    const usersSnapshot = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .get();
    const userIds = usersSnapshot.docs.map((userDoc) => userDoc.id);

    const deleted = {
      users: await commitDeleteBatch(firestore, usersSnapshot.docs),
      institutes: 1,
      authUsers: 0,
    };

    for (const collectionName of INSTITUTE_SCOPED_COLLECTIONS) {
      deleted[collectionName] = await deleteWhere(firestore, collectionName, 'instituteId', instituteId);
    }

    await institute.ref.delete();

    for (const chunk of Array.from({ length: Math.ceil(userIds.length / 1000) }, (_, index) => userIds.slice(index * 1000, index * 1000 + 1000))) {
      if (!chunk.length) continue;
      const result = await admin.auth().deleteUsers(chunk);
      deleted.authUsers += result.successCount;
      if (result.failureCount > 0) {
        console.warn('Some institute auth users could not be deleted:', result.errors.map((entry) => entry.error.message));
      }
    }

    res.json({ success: true, deleted, instituteId, requestId });
  } catch (error) {
    sendError(res, error, 'Failed to delete institute.', requestId);
  }
};
