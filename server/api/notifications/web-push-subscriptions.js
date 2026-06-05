const { z } = require('zod');
const {
  admin,
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');
const { assertRateLimit } = require('../_lib/rateLimit');
const {
  WEB_PUSH_COLLECTION,
  getVapidConfig,
  hashEndpoint,
  normalizeWebPushSubscription,
} = require('../_lib/webPush');

const PushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    auth: z.string().trim().min(8).max(512),
    p256dh: z.string().trim().min(20).max(2048),
  }),
});

const RegisterSchema = z.object({
  action: z.literal('register'),
  subscription: PushSubscriptionSchema,
});

const parseWithSchema = (schema, body) => {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const error = new Error(result.error.issues[0]?.message || 'Invalid web push subscription.');
  error.statusCode = 400;
  throw error;
};

const handleConfig = (res) => {
  const config = getVapidConfig();
  res.status(200).json({
    configured: config.configured,
    publicKey: config.publicKey || null,
    success: true,
  });
};

const handleRegister = async (req, res, body) => {
  const actor = await authenticateUserProfile(req, [
    'admin',
    'driver',
    'instituteadmin',
    'parent',
    'professor',
    'student',
    'superadmin',
    'teacher',
  ]);
  assertRateLimit({ actor, req, scope: 'web-push:register', limit: 24, windowMs: 60 * 1000 });

  const config = getVapidConfig();
  if (!config.configured) {
    const error = new Error('Web push is not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  const payload = parseWithSchema(RegisterSchema, body);
  const subscription = normalizeWebPushSubscription(payload.subscription);
  if (!subscription) {
    const error = new Error('Invalid web push subscription.');
    error.statusCode = 400;
    throw error;
  }

  const { firestore } = getAdminServices();
  const endpointHash = hashEndpoint(subscription.endpoint);
  const docRef = firestore.collection(WEB_PUSH_COLLECTION).doc(endpointHash);
  const profile = actor.profile || {};

  await docRef.set({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    endpointHash,
    instituteId: profile.instituteId || null,
    role: actor.role,
    subscription,
    uid: actor.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    userAgent: req.headers['user-agent'] || null,
  }, { merge: true });

  res.status(200).json({ success: true, endpointHash });
};

module.exports = async (req, res) => {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  try {
    if (req.method === 'GET') return handleConfig(res);

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
      return;
    }

    const body = await getBody(req);
    const action = String(body?.action || '').trim();
    if (action === 'register') return await handleRegister(req, res, body);

    res.status(400).json({ success: false, error: 'Unknown web push action.', requestId });
  } catch (error) {
    sendError(res, error, 'Web push request failed.', requestId);
  }
};
