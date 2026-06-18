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
const {
  buildRateLimitSettings,
  normalizeRateLimitSettings,
} = require('../../_lib/rateLimit');

const SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'cancelled', 'expired']);

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

const parseRateLimitUpdate = (body = {}) => {
  const rawRateLimits = body.rateLimits && typeof body.rateLimits === 'object' ? body.rateLimits : null;
  return rawRateLimits ? normalizeRateLimitSettings(rawRateLimits) : null;
};

const buildSubscriptionSettings = ({ actorUid = null, planKey, previous = {}, status = null }) => {
  const normalizedPlanKey = normalizeFeatureTier(planKey || previous.planKey || previous.planId);
  const requestedStatus = String(status || previous.status || '').trim();
  const now = new Date().toISOString();

  return {
    billingCycle: previous.billingCycle || previous.billing_cycle || null,
    endsAt: previous.endsAt || previous.ends_at || null,
    notes: previous.notes || null,
    planId: normalizedPlanKey,
    planKey: normalizedPlanKey,
    startsAt: previous.startsAt || previous.starts_at || now,
    status: SUBSCRIPTION_STATUSES.has(requestedStatus) ? requestedStatus : 'active',
    updatedAt: now,
    updatedBy: actorUid || previous.updatedBy || null,
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
      const requestedRateLimits = parseRateLimitUpdate(body);
      const previousFeatures = instituteData.settings?.features ||
        instituteData.configuration?.features ||
        instituteData.features ||
        {};
      const previousRateLimits = instituteData.settings?.rateLimits ||
        instituteData.configuration?.rateLimits ||
        instituteData.rateLimits ||
        {};
      const previousSubscription = instituteData.settings?.subscription ||
        instituteData.configuration?.subscription ||
        instituteData.subscription ||
        {};
      const featureSettings = buildFeatureSettings({
        actorUid: authContext.uid,
        overrides: requestedFeatures.overrides,
        previous: previousFeatures,
        tier: requestedFeatures.tier,
      });
      const rateLimitSettings = requestedRateLimits
        ? buildRateLimitSettings({
          actorUid: authContext.uid,
          overrides: requestedRateLimits.overrides,
          previous: previousRateLimits,
          tier: requestedRateLimits.tier,
        })
        : previousRateLimits;
      const subscriptionSettings = buildSubscriptionSettings({
        actorUid: authContext.uid,
        planKey: featureSettings.tier,
        previous: previousSubscription,
        status: body.subscription?.status,
      });
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      await institute.ref.update({
        features: featureSettings,
        rateLimits: rateLimitSettings,
        subscription: subscriptionSettings,
        'configuration.features': featureSettings,
        'configuration.rateLimits': rateLimitSettings,
        'configuration.subscription': subscriptionSettings,
        'settings.features': featureSettings,
        'settings.rateLimits': rateLimitSettings,
        'settings.subscription': subscriptionSettings,
        updatedAt: timestamp,
        updatedBy: authContext.uid,
      });

      let supabaseMirror = { institute: null };
      let syncWarning = null;
      try {
        supabaseMirror = await callSupabaseTenantBridge({
          action: 'saveInstituteFeatures',
          authorization: req.headers.authorization || '',
          payload: {
            features: featureSettings,
            instituteId,
            rateLimits: rateLimitSettings,
            subscription: subscriptionSettings,
          },
        });
      } catch (syncError) {
        console.warn('Supabase tenant sync failed. Firestore was updated successfully.', syncError.message);
        syncWarning = syncError.message;
      }

      res.status(200).json({
        success: true,
        features: featureSettings,
        rateLimits: rateLimitSettings,
        subscription: subscriptionSettings,
        entitlements: resolveFeatureEntitlements({
          ...instituteData,
          features: featureSettings,
          rateLimits: rateLimitSettings,
          subscription: subscriptionSettings,
          configuration: {
            ...(instituteData.configuration || {}),
            features: featureSettings,
            rateLimits: rateLimitSettings,
            subscription: subscriptionSettings,
          },
          settings: {
            ...(instituteData.settings || {}),
            features: featureSettings,
            rateLimits: rateLimitSettings,
            subscription: subscriptionSettings,
          },
        }),
        instituteId,
        supabaseInstituteId: supabaseMirror?.institute?.id || null,
        syncWarning,
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
