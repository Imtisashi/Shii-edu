const buckets = new Map();

const now = () => Date.now();

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown-ip';
};

const actorKey = (actor) => actor?.uid || actor?.profile?.id || actor?.token?.uid || '';

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

const assertRateLimit = ({
  actor,
  limit = 30,
  req,
  scope = 'global',
  windowMs = 60 * 1000,
}) => {
  const timestamp = now();
  const key = buildKey({ actor, req, scope });
  const windowStart = timestamp - windowMs;
  const recentHits = (buckets.get(key) || []).filter((hit) => hit > windowStart);

  if (recentHits.length >= limit) {
    const oldestHit = recentHits[0] || timestamp;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + windowMs - timestamp) / 1000));
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
};
