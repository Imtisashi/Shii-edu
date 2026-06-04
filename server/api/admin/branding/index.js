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
} = require('../../_lib/firebaseAdmin');
const {
  INSTITUTION_BRANDING_PALETTES,
  createBrandingPayload,
  normalizeInstitutionType,
} = require('../../_lib/institutionBranding');

const BrandingRequestSchema = z.object({
  instituteId: z.string().trim().min(1).max(160).optional(),
  logoUrl: z.string().trim().url().nullable().optional(),
  paletteId: z.string().trim().min(1).max(80),
}).strict();

const parseRequest = (body) => {
  const result = BrandingRequestSchema.safeParse(body);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
  const error = new Error(`${path}${issue?.message || 'Invalid branding request.'}`);
  error.statusCode = 400;
  throw error;
};

const assertApprovedPalette = (paletteId) => {
  const normalized = String(paletteId || '').trim().toLowerCase();
  if (INSTITUTION_BRANDING_PALETTES[normalized]) return normalized;

  const error = new Error('Select an approved institute color palette.');
  error.statusCode = 400;
  throw error;
};

const assertApprovedLogoUrl = (logoUrl) => {
  if (!logoUrl) return null;

  let parsed;
  try {
    parsed = new URL(logoUrl);
  } catch (_error) {
    const error = new Error('The institute logo URL is invalid.');
    error.statusCode = 400;
    throw error;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  let supabaseHost = '';
  try {
    supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : '';
  } catch (_error) {
    supabaseHost = '';
  }

  const isLegacyCloudinaryLogo = parsed.hostname === 'res.cloudinary.com';
  const isSupabaseLogo = Boolean(supabaseHost) &&
    parsed.hostname === supabaseHost &&
    parsed.pathname.includes('/storage/v1/object/public/logos/');

  if (parsed.protocol !== 'https:' || (!isLegacyCloudinaryLogo && !isSupabaseLogo)) {
    const error = new Error('Institute logos must be uploaded through Cloudinary.');
    error.message = 'Institute logos must be uploaded through the approved Supabase media pipeline.';
    error.statusCode = 400;
    throw error;
  }

  return parsed.toString();
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
    const { firestore } = getAdminServices();
    const body = parseRequest(await getBody(req));
    const actorInstituteId = String(actor.profile?.instituteId || '').trim();
    const instituteId = String(body.instituteId || actorInstituteId).trim();

    if (!instituteId) {
      const error = new Error('Your profile is not linked to an institute.');
      error.statusCode = 403;
      throw error;
    }

    if (actor.role === 'admin' && instituteId !== actorInstituteId) {
      const error = new Error('Admins can only update branding for their own institute.');
      error.statusCode = 403;
      throw error;
    }

    const instituteRef = firestore.collection('institutes').doc(instituteId);
    const instituteSnap = await instituteRef.get();

    if (!instituteSnap.exists) {
      const error = new Error('Institute not found.');
      error.statusCode = 404;
      throw error;
    }

    const instituteData = instituteSnap.data() || {};
    const institutionType = normalizeInstitutionType(
      instituteData.institutionType || instituteData.type
    );
    const paletteId = assertApprovedPalette(body.paletteId);
    const existingBranding = instituteData.branding || {};
    const logoUrl = body.logoUrl === undefined
      ? existingBranding.logoUrl || instituteData.logoUrl || null
      : assertApprovedLogoUrl(body.logoUrl);
    const branding = {
      ...createBrandingPayload({
        institutionType,
        logoUrl,
        paletteId,
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    };

    await instituteRef.update({
      branding,
      logoUrl,
      'settings.branding': branding,
      'settings.theme': 'white-label',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });

    res.status(200).json({
      success: true,
      branding: {
        ...branding,
        updatedAt: null,
      },
      instituteId,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Failed to update institute branding.', requestId);
  }
};
