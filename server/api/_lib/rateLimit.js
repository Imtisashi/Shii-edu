const rateLimitCatalog = require('../../../src/constants/rateLimitCatalog.json');

const buckets = new Map();
const institutePolicyCache = new Map();

const POLICY_CACHE_MS = 60 * 1000;
const DEFAULT_TIER = rateLimitCatalog.defaultTier || 'standard';
const RATE_LIMIT_TIERS = rateLimitCatalog.tiers || {};
const RATE_LIMIT_SCOPES = rateLimitCatalog.scopes || [];
const RATE_LIMIT_TIER_ALIASES = rateLimitCatalog.aliases || {};

const now = () => Date.now();

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown-ip';
};

const actorKey = (actor) => actor?.uid || actor?.profile?.id || actor?.token?.uid || '';

const actorInstituteId = (actor) => String(
  actor?.profile?.instituteId ||
  actor?.instituteId ||
  actor?.profile?.tenantId ||
  ''
).trim();

const buildKey = ({ actor, req, scope }) => [
  scope || 'global',
  actorKey(actor) || getClientIp(req),
].join(':');

const createRateLimitError = (retryAfterSeconds) => {
  const error = new Error('Too many requests. Please wait a moment and try again.');
  error.statusCode = 429;
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeTier = (tier) => {
  const rawKey = String(tier || DEFAULT_TIER).trim().toLowerCase();
  const key = RATE_LIMIT_TIER_ALIASES[rawKey] || rawKey;
  return RATE_LIMIT_TIERS[key] ? key : DEFAULT_TIER;
};

const normalizePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeWindowMs = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback;
};

const normalizeRateLimitOverrides = (overrides = {}) => {
  if (!overrides || typeof overrides !== 'object') return {};

  return Object.entries(overrides).reduce((acc, [key, config]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || !config || typeof config !== 'object') return acc;

    acc[normalizedKey] = {
      limit: normalizePositiveInt(config.limit, undefined),
      windowMs: normalizeWindowMs(config.windowMs, undefined),
    };
    return acc;
  }, {});
};

const normalizeRateLimitSettings = (settings = {}) => ({
  overrides: normalizeRateLimitOverrides(settings.overrides),
  tier: normalizeTier(settings.tier),
});

const buildRateLimitSettings = ({ actorUid = null, previous = {}, tier, overrides = {} }) => ({
  overrides: normalizeRateLimitOverrides(overrides),
  tier: normalizeTier(tier || previous.tier),
  updatedAt: new Date().toISOString(),
  updatedBy: actorUid || previous.updatedBy || null,
});

const scopeMatches = (configuredScope, requestedScope) => {
  if (configuredScope === requestedScope) return true;
  if (!configuredScope.endsWith('*')) return false;
  const prefix = configuredScope.slice(0, -1);
  return requestedScope.startsWith(prefix);
};

const findScopeDefinition = (scope) => (
  RATE_LIMIT_SCOPES.find((definition) => scopeMatches(definition.key, scope)) || null
);

const pickOverride = (overrides, scope) => {
  if (!overrides || typeof overrides !== 'object') return null;
  if (overrides[scope]) return overrides[scope];

  const matchingKey = Object.keys(overrides).find((key) => scopeMatches(key, scope));
  return matchingKey ? overrides[matchingKey] : null;
};

const getInstituteRateLimitSettings = async (instituteId) => {
  if (!instituteId) return null;

  const cached = institutePolicyCache.get(instituteId);
  const timestamp = now();
  if (cached && cached.expiresAt > timestamp) return cached.settings;

  try {
    const { getAdminServices, resolveInstituteDocument } = require('./firebaseAdmin');
    const { firestore } = getAdminServices();
    const institute = await resolveInstituteDocument(firestore, instituteId);
    const data = institute?.snap?.data?.() || {};
    const settings = normalizeRateLimitSettings(
      data.settings?.rateLimits ||
      data.configuration?.rateLimits ||
      data.rateLimits ||
      {}
    );

    institutePolicyCache.set(instituteId, {
      expiresAt: timestamp + POLICY_CACHE_MS,
      settings,
    });
    return settings;
  } catch (error) {
    console.warn('Institute rate limit policy lookup failed:', error?.message || error);
    return null;
  }
};

const resolveEffectiveLimit = async ({ actor, limit, scope, windowMs }) => {
  const instituteId = actorInstituteId(actor);
  if (!instituteId) return { limit, windowMs };

  const settings = await getInstituteRateLimitSettings(instituteId);
  if (!settings) return { limit, windowMs };

  const tier = RATE_LIMIT_TIERS[settings.tier] || RATE_LIMIT_TIERS[DEFAULT_TIER] || { multiplier: 1 };
  const scopeDefinition = findScopeDefinition(scope);
  const override = pickOverride(settings.overrides, scope);
  const baseLimit = normalizePositiveInt(limit, 30);
  const baseWindow = normalizeWindowMs(windowMs, 60 * 1000);
  const scopedMin = normalizePositiveInt(scopeDefinition?.min, 1);
  const scopedMax = normalizePositiveInt(scopeDefinition?.max, Math.max(baseLimit * 4, baseLimit));
  const multipliedLimit = Math.round(baseLimit * Number(tier.multiplier || 1));

  return {
    limit: clamp(normalizePositiveInt(override?.limit, multipliedLimit), scopedMin, scopedMax),
    windowMs: normalizeWindowMs(override?.windowMs, baseWindow),
  };
};

const assertRateLimit = async ({
  actor,
  limit = 30,
  req,
  scope = 'global',
  windowMs = 60 * 1000,
}) => {
  const timestamp = now();
  const effective = await resolveEffectiveLimit({ actor, limit, scope, windowMs });
  const key = buildKey({ actor, req, scope });
  const windowStart = timestamp - effective.windowMs;
  const recentHits = (buckets.get(key) || []).filter((hit) => hit > windowStart);

  if (recentHits.length >= effective.limit) {
    const oldestHit = recentHits[0] || timestamp;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + effective.windowMs - timestamp) / 1000));
    throw createRateLimitError(retryAfterSeconds);
  }

  recentHits.push(timestamp);
  buckets.set(key, recentHits);

  if (buckets.size > 5000) {
    for (const [bucketKey, hits] of buckets.entries()) {
      const freshHits = hits.filter((hit) => hit > windowStart);
      if (freshHits.length) {
        buckets.set(bucketKey, freshHits);
      } else {
        buckets.delete(bucketKey);
      }
    }
  }
};

module.exports = {
  assertRateLimit,
  buildRateLimitSettings,
  normalizeRateLimitSettings,
  RATE_LIMIT_SCOPES,
  RATE_LIMIT_TIERS,
};
