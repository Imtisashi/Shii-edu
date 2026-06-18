const {
  admin,
  getAdminServices,
  resolveInstituteDocument,
} = require('./firebaseAdmin');
const {
  FEATURE_DEFINITIONS,
  FEATURE_TIERS,
  assertFeatureEnabled,
  getFeatureLimitForData,
  normalizeFeatureKey,
  normalizeFeatureTier,
  resolveFeatureEntitlements,
} = require('./featureEntitlements');

const AI_USAGE_ERROR_MESSAGE = "Your institute has reached today's AI usage limit. Please contact your administrator or upgrade your plan.";

const normalizeInstituteId = (value) => String(value || '').trim();
const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const getFirestore = (firestore) => firestore || getAdminServices().firestore;

const getInstituteDocument = async ({ firestore, instituteId }) => {
  const resolvedFirestore = getFirestore(firestore);
  const normalizedInstituteId = normalizeInstituteId(instituteId);
  if (!normalizedInstituteId) {
    const error = new Error('Institute ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const institute = await resolveInstituteDocument(resolvedFirestore, normalizedInstituteId);
  if (!institute) {
    const error = new Error('Institute not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    data: institute.snap.data() || {},
    id: institute.snap.id,
    ref: institute.ref,
  };
};

const getPlanFeatures = (planKeyOrPlanId) => {
  const planKey = normalizeFeatureTier(planKeyOrPlanId);
  const plan = FEATURE_TIERS[planKey] || FEATURE_TIERS[normalizeFeatureTier()];
  return {
    features: { ...(plan?.features || {}) },
    key: planKey,
    label: plan?.label || planKey,
    limits: { ...(plan?.limits || {}) },
  };
};

const getInstituteSubscription = async ({ firestore, instituteId }) => {
  const institute = await getInstituteDocument({ firestore, instituteId });
  const data = institute.data;
  const featureAccess = resolveFeatureEntitlements(data);
  const subscription = data.settings?.subscription ||
    data.configuration?.subscription ||
    data.subscription ||
    {};
  const plan = getPlanFeatures(subscription.planKey || subscription.planId || featureAccess.tier);

  return {
    billingCycle: subscription.billingCycle || subscription.billing_cycle || null,
    endsAt: subscription.endsAt || subscription.ends_at || null,
    instituteDocId: institute.id,
    instituteId: data.instituteId || institute.id,
    notes: subscription.notes || null,
    plan,
    planKey: plan.key,
    startsAt: subscription.startsAt || subscription.starts_at || null,
    status: subscription.status || 'active',
  };
};

const getInstituteFeatureAccess = async ({ firestore, instituteId }) => {
  const institute = await getInstituteDocument({ firestore, instituteId });
  const access = resolveFeatureEntitlements(institute.data);
  const subscription = await getInstituteSubscription({ firestore, instituteId });

  return {
    ...access,
    features: FEATURE_DEFINITIONS,
    instituteId: institute.data.instituteId || institute.id,
    limits: subscription.plan.limits,
    subscription,
  };
};

const isFeatureEnabled = async ({ firestore, instituteId, featureKey }) => {
  const institute = await getInstituteDocument({ firestore, instituteId });
  const access = resolveFeatureEntitlements(institute.data);
  return access.enabledFeatures[normalizeFeatureKey(featureKey)] !== false;
};

const getFeatureLimit = async ({ firestore, instituteId, featureKey, limitKey = 'limit' }) => {
  const institute = await getInstituteDocument({ firestore, instituteId });
  return getFeatureLimitForData(institute.data, featureKey, limitKey);
};

const requireFeature = async ({ firestore, instituteId, featureKey }) => (
  assertFeatureEnabled({
    firestore: getFirestore(firestore),
    instituteId,
    featureKey,
  })
);

const createAiLimitError = () => {
  const error = new Error(AI_USAGE_ERROR_MESSAGE);
  error.statusCode = 429;
  error.code = 'AI_DAILY_LIMIT_EXCEEDED';
  return error;
};

const assertAiDailyUsage = async ({
  actor = {},
  featureKey = 'ai_tools',
  firestore,
  instituteId,
  requestCount = 1,
  tokensUsed = null,
}) => {
  const resolvedFirestore = getFirestore(firestore);
  await requireFeature({ firestore: resolvedFirestore, instituteId, featureKey });
  const limit = Number(await getFeatureLimit({
    firestore: resolvedFirestore,
    instituteId,
    featureKey,
    limitKey: 'aiRequestsPerDay',
  }) || 0);

  if (!Number.isFinite(limit) || limit <= 0) {
    const error = new Error('AI tools are not enabled for this institute.');
    error.statusCode = 403;
    error.code = 'AI_DISABLED';
    throw error;
  }

  const count = Math.max(1, Number.parseInt(String(requestCount || 1), 10));
  const day = dateKey();
  const normalizedInstituteId = normalizeInstituteId(instituteId);
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  const counterRef = resolvedFirestore.collection('aiUsageDailyCounters').doc(`${normalizedInstituteId}_${day}`);
  const logRef = resolvedFirestore.collection('aiUsageLogs').doc();

  await resolvedFirestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const data = snapshot.exists ? snapshot.data() || {} : {};
    const currentCount = Number(data.requestCount || 0);
    const nextCount = currentCount + count;
    if (nextCount > limit) throw createAiLimitError();

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(counterRef, {
      day,
      instituteId: normalizedInstituteId,
      requestCount: nextCount,
      updatedAt: timestamp,
    }, { merge: true });
    transaction.set(logRef, {
      actorRole: actor.role || null,
      createdAt: timestamp,
      day,
      featureKey: normalizedFeatureKey,
      instituteId: normalizedInstituteId,
      requestCount: count,
      tokensUsed: Number.isFinite(Number(tokensUsed)) ? Number(tokensUsed) : null,
      userId: actor.uid || actor.profile?.id || null,
    });
  });

  return {
    day,
    featureKey: normalizedFeatureKey,
    limit,
    requestCount: count,
  };
};

module.exports = {
  AI_USAGE_ERROR_MESSAGE,
  assertAiDailyUsage,
  getFeatureLimit,
  getInstituteFeatureAccess,
  getInstituteSubscription,
  getPlanFeatures,
  isFeatureEnabled,
  requireFeature,
};
