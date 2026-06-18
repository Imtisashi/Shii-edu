const featureCatalog = require('../../../src/constants/featureCatalog.json');

const DEFAULT_FEATURE_TIER = featureCatalog.defaultTier || 'complete';
const FEATURE_TIERS = featureCatalog.tiers || {};
const FEATURE_DEFINITIONS = featureCatalog.features || [];
const FEATURE_ALIASES = featureCatalog.aliases || {};
const FEATURE_TIER_ALIASES = featureCatalog.tierAliases || {};
const FEATURE_KEYS = new Set(FEATURE_DEFINITIONS.map(({ key }) => key));

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const normalizeFeatureTier = (tier) => {
  const rawKey = String(tier || DEFAULT_FEATURE_TIER).trim().toLowerCase();
  const key = FEATURE_TIER_ALIASES[rawKey] || rawKey;
  return FEATURE_TIERS[key] ? key : DEFAULT_FEATURE_TIER;
};

const normalizeFeatureKey = (featureKey) => {
  const key = String(featureKey || '').trim();
  return FEATURE_ALIASES[key] || key;
};

const normalizeFeatureOverrides = (value) => {
  const overrides = asObject(value);
  return FEATURE_DEFINITIONS.reduce((next, { key }) => {
    const directValue = overrides[key];
    if (directValue === true || directValue === false) {
      next[key] = directValue;
    }
    return next;
  }, Object.entries(overrides).reduce((next, [rawKey, value]) => {
    const key = normalizeFeatureKey(rawKey);
    if (FEATURE_KEYS.has(key) && (value === true || value === false)) next[key] = value;
    return next;
  }, {}));
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

const isFeatureEnabled = (instituteData, featureKey) => {
  if (!featureKey) return true;
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  if (!FEATURE_KEYS.has(normalizedFeatureKey)) return false;
  return resolveFeatureEntitlements(instituteData).enabledFeatures[normalizedFeatureKey] === true;
};

const getFeatureLimitForData = (instituteData = {}, featureKey, limitKey = 'limit') => {
  const settings = getFeatureSettings(instituteData);
  const tier = normalizeFeatureTier(settings.tier);
  const tierLimits = asObject(FEATURE_TIERS[tier]?.limits);
  const globalLimits = asObject(settings.limits);
  const featureLimits = asObject(settings.featureLimits);
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  const scopedLimits = asObject(featureLimits[normalizedFeatureKey]);

  if (scopedLimits[limitKey] !== undefined) return scopedLimits[limitKey];
  if (globalLimits[limitKey] !== undefined) return globalLimits[limitKey];
  if (normalizedFeatureKey === 'ai_tools' && ['limit', 'dailyRequests', 'aiRequestsPerDay'].includes(limitKey)) {
    return tierLimits.aiRequestsPerDay ?? 0;
  }
  if (normalizedFeatureKey === 'ai_lesson_planner' && ['limit', 'dailyRequests', 'aiLessonPlannerRequestsPerDay'].includes(limitKey)) {
    return tierLimits.aiLessonPlannerRequestsPerDay ?? 0;
  }
  if (normalizedFeatureKey === 'ai_automated_grading' && ['limit', 'dailyRequests', 'aiAutomatedGradingRequestsPerDay'].includes(limitKey)) {
    return tierLimits.aiAutomatedGradingRequestsPerDay ?? 0;
  }
  if (normalizedFeatureKey === 'ai_insights' && ['limit', 'dailyRequests', 'aiInsightsRequestsPerDay'].includes(limitKey)) {
    return tierLimits.aiInsightsRequestsPerDay ?? 0;
  }
  if (normalizedFeatureKey === 'storage_quota' && ['limit', 'storageQuotaGB'].includes(limitKey)) {
    return tierLimits.storageQuotaGB ?? 0;
  }
  if (normalizedFeatureKey === 'sms_notifications' && ['limit', 'smsQuotaPerMonth'].includes(limitKey)) {
    return tierLimits.smsQuotaPerMonth ?? 0;
  }
  if (normalizedFeatureKey === 'bus_tracking' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsBusTracking === true;
  }
  if (normalizedFeatureKey === 'custom_subdomain' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsCustomSubdomain === true;
  }
  if (normalizedFeatureKey === 'white_labeling' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsWhiteLabeling === true;
  }
  if (normalizedFeatureKey === 'custom_domain' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsCustomDomain === true;
  }
  if (normalizedFeatureKey === 'custom_ssl' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsCustomSSL === true;
  }
  if (normalizedFeatureKey === 'branded_mobile_apps' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsBrandedMobileApps === true;
  }
  if (normalizedFeatureKey === 'advanced_analytics' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsAdvancedAnalytics === true;
  }
  if (normalizedFeatureKey === 'api_access' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsApiAccess === true;
  }
  if (normalizedFeatureKey === 'marketplace' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsMarketplace === true;
  }
  if (normalizedFeatureKey === 'priority_support' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsPrioritySupport === true;
  }
  if (normalizedFeatureKey === 'dedicated_account_manager' && ['limit', 'enabled'].includes(limitKey)) {
    return tierLimits.supportsDedicatedAccountManager === true;
  }
  return tierLimits[limitKey];
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
  const { resolveInstituteDocument } = require('./firebaseAdmin');
  const institute = await resolveInstituteDocument(firestore, instituteId);
  if (!institute) {
    const error = new Error('Institute not found.');
    error.statusCode = 404;
    throw error;
  }

  if (isFeatureEnabled(institute.snap.data(), featureKey)) return;

  const normalizedFeatureKey = normalizeFeatureKey(featureKey);
  const feature = FEATURE_DEFINITIONS.find((item) => item.key === normalizedFeatureKey);
  const error = new Error(`${feature?.label || 'This feature'} is not enabled for this institute.`);
  error.statusCode = 403;
  error.code = 'FEATURE_DISABLED';
  throw error;
};

module.exports = {
  DEFAULT_FEATURE_TIER,
  FEATURE_ALIASES,
  FEATURE_DEFINITIONS,
  FEATURE_TIERS,
  assertFeatureEnabled,
  buildFeatureSettings,
  getFeatureLimitForData,
  isFeatureEnabled,
  normalizeFeatureKey,
  normalizeFeatureOverrides,
  normalizeFeatureTier,
  resolveFeatureEntitlements,
};
