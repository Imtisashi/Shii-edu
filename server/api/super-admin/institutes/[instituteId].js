const {
  admin,
  authenticateSuperAdmin,
  commitDeleteBatch,
  createRequestId,
  deleteWhere,
  getAdminServices,
  getBody,
  handleOptions,
  resolveInstituteDocument,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');
const { callSupabaseTenantBridge } = require('../../_lib/supabaseTenantBridge');
const {
  buildFeatureSettings,
  normalizeFeatureOverrides,
  normalizeFeatureTier,
  resolveFeatureEntitlements,
} = require('../../_lib/featureEntitlements');

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

const parseFeatureUpdate = (body = {}) => {
  const rawFeatures = body.features && typeof body.features === 'object' ? body.features : body;
  return {
    overrides: normalizeFeatureOverrides(rawFeatures.overrides),
    tier: normalizeFeatureTier(rawFeatures.tier),
  };
};

module.exports = async (req, res) => {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (!['DELETE', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'DELETE, PATCH, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const authContext = await authenticateSuperAdmin(req);
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

    if (req.method === 'PATCH') {
      const body = await getBody(req);
      const requestedFeatures = parseFeatureUpdate(body);
      const previousFeatures = instituteData.settings?.features ||
        instituteData.configuration?.features ||
        instituteData.features ||
        {};
      const featureSettings = buildFeatureSettings({
        actorUid: authContext.uid,
        overrides: requestedFeatures.overrides,
        previous: previousFeatures,
        tier: requestedFeatures.tier,
      });
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      await institute.ref.update({
        features: featureSettings,
        'configuration.features': featureSettings,
        'settings.features': featureSettings,
        updatedAt: timestamp,
        updatedBy: authContext.uid,
      });

      const supabaseMirror = await callSupabaseTenantBridge({
        action: 'saveInstituteFeatures',
        authorization: req.headers.authorization || '',
        payload: {
          features: featureSettings,
          instituteId,
        },
      });

      res.status(200).json({
        success: true,
        features: featureSettings,
        entitlements: resolveFeatureEntitlements({
          ...instituteData,
          features: featureSettings,
          configuration: {
            ...(instituteData.configuration || {}),
            features: featureSettings,
          },
          settings: {
            ...(instituteData.settings || {}),
            features: featureSettings,
          },
        }),
        instituteId,
        supabaseInstituteId: supabaseMirror.institute?.id || null,
        requestId,
      });
      return;
    }

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
