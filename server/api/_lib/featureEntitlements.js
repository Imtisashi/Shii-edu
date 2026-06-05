const featureCatalog = require('../../../src/constants/featureCatalog.json');

const DEFAULT_FEATURE_TIER = featureCatalog.defaultTier || 'complete';
const FEATURE_TIERS = featureCatalog.tiers || {};
const FEATURE_DEFINITIONS = featureCatalog.features || [];

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeFeatureTier = (tier) => {
  const key = String(tier || DEFAULT_FEATURE_TIER).trim().toLowerCase();
  return FEATURE_TIERS[key] ? key : DEFAULT_FEATURE_TIER;
};

const normalizeFeatureOverrides = (value) => {
  const overrides = asObject(value);
  return FEATURE_DEFINITIONS.reduce((next, { key }) => {
    if (overrides[key] === true || overrides[key] === false) {
      next[key] = overrides[key];
    }
    return next;
  }, {});
};

const getFeatureSettings = (instituteData = {}) => {
  const settings = asObject(instituteData.settings);
  const configuration = asObject(instituteData.configuration);
  return asObject(settings.features || configuration.features || instituteData.features);
};

const resolveFeatureEntitlements = (instituteData = {}) => {
  const settings = getFeatureSettings(instituteData);
  const tier = normalizeFeatureTier(settings.tier);
  const tierFeatures = asObject(FEATURE_TIERS[tier]?.features);
  const overrides = normalizeFeatureOverrides(settings.overrides);
  const enabledFeatures = {};

  FEATURE_DEFINITIONS.forEach(({ key }) => {
    const tierValue = tierFeatures[key] !== false;
    enabledFeatures[key] = overrides[key] === undefined ? tierValue : overrides[key] === true;
  });

  return {
    enabledFeatures,
    overrides,
    tier,
    tierLabel: FEATURE_TIERS[tier]?.label || tier,
  };
};

const isFeatureEnabled = (instituteData, featureKey) => {
  if (!featureKey) return true;
  return resolveFeatureEntitlements(instituteData).enabledFeatures[featureKey] !== false;
};

const buildFeatureSettings = ({ previous = {}, tier, overrides = {}, actorUid = null }) => {
  const normalizedTier = normalizeFeatureTier(tier);
  return {
    ...asObject(previous),
    tier: normalizedTier,
    overrides: normalizeFeatureOverrides(overrides),
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };
};

const assertFeatureEnabled = async ({ firestore, instituteId, featureKey }) => {
  if (!featureKey || !instituteId) return;
  const instituteSnap = await firestore.collection('institutes').doc(instituteId).get();
  if (!instituteSnap.exists) {
    const error = new Error('Institute not found.');
    error.statusCode = 404;
    throw error;
  }

  if (isFeatureEnabled(instituteSnap.data(), featureKey)) return;

  const feature = FEATURE_DEFINITIONS.find((item) => item.key === featureKey);
  const error = new Error(`${feature?.label || 'This feature'} is not enabled for this institute.`);
  error.statusCode = 403;
  error.code = 'FEATURE_DISABLED';
  throw error;
};

module.exports = {
  DEFAULT_FEATURE_TIER,
  FEATURE_DEFINITIONS,
  FEATURE_TIERS,
  assertFeatureEnabled,
  buildFeatureSettings,
  isFeatureEnabled,
  normalizeFeatureOverrides,
  normalizeFeatureTier,
  resolveFeatureEntitlements,
};
