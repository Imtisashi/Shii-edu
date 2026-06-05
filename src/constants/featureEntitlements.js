import featureCatalog from './featureCatalog.json';

export const DEFAULT_FEATURE_TIER = featureCatalog.defaultTier || 'complete';
export const FEATURE_DEFINITIONS = featureCatalog.features;
export const FEATURE_TIERS = featureCatalog.tiers;

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const getFeatureSettings = (instituteData = {}) => {
  const settings = asObject(instituteData.settings);
  const configuration = asObject(instituteData.configuration);
  return asObject(settings.features || configuration.features || instituteData.features);
};

export const normalizeFeatureTier = (tier) => {
  const key = String(tier || DEFAULT_FEATURE_TIER).trim().toLowerCase();
  return FEATURE_TIERS[key] ? key : DEFAULT_FEATURE_TIER;
};

export const getTierFeatureMap = (tier) => (
  asObject(FEATURE_TIERS[normalizeFeatureTier(tier)]?.features)
);

export const resolveFeatureEntitlements = (instituteData = {}) => {
  const settings = getFeatureSettings(instituteData);
  const tier = normalizeFeatureTier(settings.tier);
  const tierFeatures = getTierFeatureMap(tier);
  const overrides = asObject(settings.overrides);
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

export const isFeatureEnabled = (instituteData, featureKey) => {
  if (!featureKey) return true;
  return resolveFeatureEntitlements(instituteData).enabledFeatures[featureKey] !== false;
};

export const filterByFeatureAccess = (items = [], instituteData) => (
  items.filter((item) => isFeatureEnabled(instituteData, item.featureKey || item.key))
);
