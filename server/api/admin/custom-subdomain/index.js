const { z } = require('zod');
const {
  admin,
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  resolveInstituteDocument,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');
const { assertRateLimit } = require('../../_lib/rateLimit');
const { requireFeature } = require('../../_lib/subscriptionEntitlements');

const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'cdn',
  'driver',
  'help',
  'institute',
  'login',
  'mail',
  'parents',
  'roles',
  'shii',
  'shii-edu',
  'shiiedu',
  'smtp',
  'support',
  'www',
]);

const SubdomainRequestSchema = z.object({
  instituteId: z.string().trim().min(1).max(160).optional(),
  subdomain: z.string()
    .trim()
    .min(3, 'Use at least 3 characters for the subdomain.')
    .max(63, 'Use 63 characters or fewer for the subdomain.')
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/i, 'Use letters, numbers, and hyphens only.'),
}).strict();

const parseRequest = (body) => {
  const result = SubdomainRequestSchema.safeParse(body);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
  const error = new Error(`${path}${issue?.message || 'Invalid subdomain request.'}`);
  error.statusCode = 400;
  throw error;
};

const normalizeSubdomain = (value) => String(value || '').trim().toLowerCase();

const assertAllowedSubdomain = (value) => {
  const subdomain = normalizeSubdomain(value);
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    const error = new Error('Choose a different subdomain. This one is reserved by Shii-Edu.');
    error.statusCode = 400;
    throw error;
  }
  return subdomain;
};

const getRootDomain = () => String(
  process.env.CUSTOM_SUBDOMAIN_ROOT_DOMAIN ||
  process.env.SHII_EDU_CUSTOM_SUBDOMAIN_ROOT ||
  ''
).trim().toLowerCase().replace(/^\.+|\.+$/g, '');

const getDnsTarget = () => String(
  process.env.CUSTOM_SUBDOMAIN_CNAME_TARGET ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'shii-edu.vercel.app'
).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const buildSubdomainPayload = ({ actor, instituteId, subdomain }) => {
  const rootDomain = getRootDomain();
  const dnsTarget = getDnsTarget();
  const host = rootDomain ? `${subdomain}.${rootDomain}` : subdomain;
  const providerConfigured = Boolean(rootDomain);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  return {
    dns: {
      cnameTarget: dnsTarget,
      provider: providerConfigured ? 'configured-root-domain' : 'manual-root-domain-required',
      rootDomain: rootDomain || null,
    },
    host,
    instituteId,
    requestedAt: timestamp,
    requestedBy: actor.uid,
    status: providerConfigured ? 'pending_dns_verification' : 'pending_root_domain_configuration',
    subdomain,
    updatedAt: timestamp,
    updatedBy: actor.uid,
  };
};

const resolveActorInstituteId = (actor, requestedInstituteId) => {
  const actorInstituteId = String(actor.profile?.instituteId || '').trim();
  const instituteId = String(requestedInstituteId || actorInstituteId).trim();

  if (!instituteId) {
    const error = new Error('Your profile is not linked to an institute.');
    error.statusCode = 403;
    throw error;
  }

  if (actor.role === 'admin' && instituteId !== actorInstituteId) {
    const error = new Error('Admins can only request a subdomain for their own institute.');
    error.statusCode = 403;
    throw error;
  }

  return instituteId;
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
    await assertRateLimit({ actor, req, scope: 'admin:custom-subdomain', limit: 6, windowMs: 60 * 1000 });
    const { firestore } = getAdminServices();
    const body = req.method === 'POST' ? parseRequest(await getBody(req)) : {};
    const requestUrl = String(req.url || '').startsWith('http')
      ? new URL(req.url)
      : new URL(req.url || '/', 'https://local.test');
    const queryInstituteId = requestUrl.searchParams.get('instituteId');
    const instituteId = resolveActorInstituteId(actor, body.instituteId || queryInstituteId);
    const institute = await resolveInstituteDocument(firestore, instituteId);

    if (!institute) {
      const error = new Error('Institute not found.');
      error.statusCode = 404;
      throw error;
    }

    const instituteData = institute.snap.data() || {};
    const publicInstituteId = instituteData.instituteId || institute.ref.id;
    await requireFeature({ firestore, instituteId: publicInstituteId, featureKey: 'custom_subdomain' });

    if (req.method === 'GET') {
      const current = instituteData.settings?.customSubdomain ||
        instituteData.configuration?.customSubdomain ||
        instituteData.customSubdomain ||
        null;
      res.status(200).json({
        customSubdomain: current,
        instituteId: publicInstituteId,
        requestId,
        success: true,
      });
      return;
    }

    const subdomain = assertAllowedSubdomain(body.subdomain);
    const payload = buildSubdomainPayload({ actor, instituteId: publicInstituteId, subdomain });

    await institute.ref.update({
      customSubdomain: payload,
      'configuration.customSubdomain': payload,
      'settings.customSubdomain': payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });

    res.status(200).json({
      customSubdomain: {
        ...payload,
        requestedAt: null,
        updatedAt: null,
      },
      instituteId: publicInstituteId,
      requestId,
      success: true,
    });
  } catch (error) {
    sendError(res, error, 'Failed to update custom subdomain request.', requestId);
  }
};
