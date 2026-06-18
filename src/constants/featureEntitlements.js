import featureCatalog from './featureCatalog.json';

export const DEFAULT_FEATURE_TIER = featureCatalog.defaultTier || 'complete';
export const FEATURE_DEFINITIONS = featureCatalog.features;
export const FEATURE_TIERS = featureCatalog.tiers;
export const FEATURE_ALIASES = featureCatalog.aliases || {};
export const FEATURE_TIER_ALIASES = featureCatalog.tierAliases || {};
const FEATURE_KEYS = new Set(FEATURE_DEFINITIONS.map(({ key }) => key));

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const getFeatureSettings = (instituteData = {}) => {
  const settings = asObject(instituteData.settings);
  const configuration = asObject(instituteData.configuration);
  return asObject(settings.features || configuration.features || instituteData.features);
};

export const normalizeFeatureTier = (tier) => {
  const rawKey = String(tier || DEFAULT_FEATURE_TIER).trim().toLowerCase();
  const key = FEATURE_TIER_ALIASES[rawKey] || rawKey;
  return FEATURE_TIERS[key] ? key : DEFAULT_FEATURE_TIER;
};

export const normalizeFeatureKey = (featureKey) => {
  const key = String(featureKey || '').trim();
  return FEATURE_ALIASES[key] || key;
};

export const getTierFeatureMap = (tier) => (
  asObject(FEATURE_TIERS[normalizeFeatureTier(tier)]?.features)
);

export const resolveFeatureEntitlements = (instituteData = {}) => {
  const settings = getFeatureSettings(instituteData);
  const tier = normalizeFeatureTier(settings.tier);
  const tierFeatures = getTierFeatureMap(tier);
  const rawOverrides = asObject(settings.overrides);
  const overrides = Object.entries(rawOverrides).reduce((next, [key, value]) => {
    const normalizedKey = normalizeFeatureKey(key);
    if (FEATURE_KEYS.has(normalizedKey) && (value === true || value === false)) next[normalizedKey] = value;
    return next;
  }, {});
  const enabledFeatures = {};
  const featureSources = {};

  FEATURE_DEFINITIONS.forEach(({ key }) => {
    const tierValue = tierFeatures[key] !== false;
    const isOverride = overrides[key] !== undefined;
    const enabled = isOverride ? overrides[key] === true : tierValue;
    enabledFeatures[key] = enabled;
    featureSources[key] = {
      enabled,
      source: isOverride ? 'override' : 'plan',
      tier,
    };
  });

  return {
    enabledFeatures,
    featureSources,
    overrides,
    tier,
    tierLabel: FEATURE_TIERS[tier]?.label || tier,
  };
};

export const isFeatureEnabled = (instituteData, featureKey) => {
  if (!featureKey) return true;
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  if (!FEATURE_KEYS.has(normalizedFeatureKey)) return false;
  return resolveFeatureEntitlements(instituteData).enabledFeatures[normalizedFeatureKey] === true;
};

export const getFeatureLimit = (instituteData, featureKey, limitKey = 'limit') => {
  const settings = getFeatureSettings(instituteData);
  const tier = normalizeFeatureTier(settings.tier);
  const tierLimits = asObject(FEATURE_TIERS[tier]?.limits);
  const limits = asObject(settings.limits);
  const featureLimits = asObject(settings.featureLimits);
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  const scopedLimits = asObject(featureLimits[normalizedFeatureKey]);

  if (scopedLimits[limitKey] !== undefined) return scopedLimits[limitKey];
  if (limits[limitKey] !== undefined) return limits[limitKey];
  if (normalizedFeatureKey === 'ai_tools' && ['limit', 'dailyRequests', 'aiRequestsPerDay'].includes(limitKey)) {
    return tierLimits.aiRequestsPerDay ?? 0;
  }
  if (normalizedFeatureKey === 'bus_tracking' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsBusTracking === true;
  }
  if (normalizedFeatureKey === 'custom_subdomain' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsCustomSubdomain === true;
  }
  return tierLimits[limitKey];
};

export const filterByFeatureAccess = (items = [], instituteData) => (
  items.filter((item) => isFeatureEnabled(instituteData, item.featureKey || item.key))
);
