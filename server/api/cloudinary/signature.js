const crypto = require('crypto');
const { z } = require('zod');
const {
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');
const { assertFeatureEnabled } = require('../_lib/featureEntitlements');
const { assertRateLimit } = require('../_lib/rateLimit');

const PLAYBACK_ROLES = new Set(['student', 'teacher', 'professor', 'parent', 'admin', 'superadmin']);
const UPLOAD_ROLES = new Set(['teacher', 'professor', 'admin', 'superadmin']);
const PROFILE_UPLOAD_ROLES = new Set(['teacher', 'professor', 'admin', 'superadmin']);
const SAFE_RESOURCE_TYPES = new Set(['image', 'video', 'raw', 'auto']);
const SAFE_DELIVERY_TYPES = new Set(['authenticated', 'private', 'upload']);
const SAFE_UPLOAD_MIME_PREFIXES = ['image/'];
const SAFE_UPLOAD_MIME_TYPES = new Set(['application/pdf']);
const SAFE_UPLOAD_FOLDERS = new Set(['gallery', 'pyqs', 'profile-pictures', 'course-media', 'assignments', 'institute-branding', 'syllabi']);
const SAFE_FORMATS_BY_RESOURCE_TYPE = {
  image: 'avif,heic,heif,jpeg,jpg,png,webp',
  raw: 'pdf',
  video: 'm4v,mov,mp4,webm',
};
const SAFE_RESOURCE_TYPES_BY_FOLDER = {
  assignments: new Set(['image', 'raw']),
  'course-media': new Set(['image', 'raw', 'video']),
  gallery: new Set(['image']),
  'institute-branding': new Set(['image']),
  'profile-pictures': new Set(['image']),
  pyqs: new Set(['raw']),
  syllabi: new Set(['raw']),
};
const FOLDER_FEATURES = {
  assignments: 'assignments',
  'course-media': 'courses',
  gallery: 'media',
  'institute-branding': 'branding',
  'profile-pictures': null,
  pyqs: 'pyq',
  syllabi: 'ai',
};
const DEFAULT_PLAYBACK_TTL_SECONDS = 900;
const MAX_PROFILE_IMAGE_BYTES = 8 * 1024 * 1024;
const PROFILE_IMAGE_TRANSFORMATION = 'c_fill,w_400,h_400,f_auto,q_auto,g_face';
const MAX_CONTEXT_VALUE_LENGTH = 160;
const CLOUDINARY_PLACEHOLDER_PATTERN = /campus_unsigned|change_me|example|placeholder|replace|your[_-]/i;

const ContextValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const UploadRequestSchema = z.object({
  action: z.literal('upload'),
  context: z.record(z.string(), ContextValueSchema).optional().default({}),
  deliveryType: z.enum(['authenticated', 'private', 'upload']).optional(),
  fileName: z.string().trim().max(220).optional().default(''),
  fileSize: z.coerce.number().int().nonnegative().optional(),
  folder: z.string().trim().min(1).max(240),
  instituteId: z.string().trim().min(1).max(160).optional(),
  mimeType: z.string().trim().min(1).max(120),
  resourceType: z.enum(['image', 'raw', 'video']),
}).strict();
const ProfileImageUploadRequestSchema = z.object({
  action: z.literal('profileImageUpload'),
  fileName: z.string().trim().max(220).optional().default(''),
  fileSize: z.coerce.number().int().nonnegative().optional().default(0),
  mimeType: z.string().trim().min(1).max(120),
}).strict();
const PlaybackRequestSchema = z.object({
  action: z.literal('playback'),
  courseId: z.string().trim().min(1).max(180),
  deliveryType: z.enum(['authenticated', 'private', 'upload']).optional(),
  expiresInSeconds: z.coerce.number().int().min(60).max(3600).optional(),
  format: z.string().trim().min(1).max(20).optional(),
  lessonId: z.string().trim().max(180).optional(),
  publicId: z.string().trim().min(1).max(500),
  resourceType: z.enum(['image', 'raw', 'video']).optional(),
  transformation: z.string().trim().max(500).optional(),
}).strict();
const CloudinaryRequestSchema = z.discriminatedUnion('action', [
  UploadRequestSchema,
  ProfileImageUploadRequestSchema,
  PlaybackRequestSchema,
]);

const readCloudinaryConfigValue = (value) => String(value || '').trim();
const isUsableCloudinaryConfigValue = (value) => (
  Boolean(value) &&
  !value.includes('#') &&
  !CLOUDINARY_PLACEHOLDER_PATTERN.test(value)
);

const getCloudinaryConfig = () => {
  const cloudName = readCloudinaryConfigValue(process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME);
  const apiKey = readCloudinaryConfigValue(process.env.CLOUDINARY_API_KEY);
  const apiSecret = readCloudinaryConfigValue(process.env.CLOUDINARY_API_SECRET);

  if (
    !isUsableCloudinaryConfigValue(cloudName) ||
    !isUsableCloudinaryConfigValue(apiKey) ||
    !isUsableCloudinaryConfigValue(apiSecret)
  ) {
    const error = new Error('Cloudinary signing is not configured with valid credentials.');
    error.code = 'CLOUDINARY_CONFIG_INVALID';
    error.name = 'CloudinaryConfigurationError';
    error.statusCode = 503;
    throw error;
  }

  return { cloudName, apiKey, apiSecret };
};

const sanitizePathPart = (value, fallback = 'general') => {
  const clean = String(value || fallback)
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, '').trim())
    .filter(Boolean)
    .join('/');
  return clean || fallback;
};

const sanitizePublicId = (value) => String(value || '')
  .replace(/\\/g, '/')
  .split('/')
  .map((part) => part.replace(/[^a-zA-Z0-9_.-]/g, '').trim())
  .filter(Boolean)
  .join('/');

const sanitizeTransformation = (value, fallback) => {
  const clean = String(value || fallback || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9_,:.-]/g, '').trim())
    .filter(Boolean)
    .join('/');
  return clean || fallback || '';
};

const sanitizeFormat = (value, fallback = 'm3u8') => String(value || fallback)
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase() || fallback;

const sanitizeResourceType = (resourceType) => {
  const clean = String(resourceType || 'video').toLowerCase();
  return SAFE_RESOURCE_TYPES.has(clean) ? clean : 'video';
};

const sanitizeDeliveryType = (deliveryType) => {
  const clean = String(deliveryType || 'authenticated').toLowerCase();
  return SAFE_DELIVERY_TYPES.has(clean) ? clean : 'authenticated';
};

const assertUploadMimeType = (mimeType, resourceType) => {
  const cleanMimeType = String(mimeType || '').toLowerCase();
  if (!cleanMimeType) {
    const error = new Error('A MIME type is required for signed upload.');
    error.statusCode = 400;
    throw error;
  }

  const isSafeImage = resourceType === 'image' && SAFE_UPLOAD_MIME_PREFIXES.some((prefix) => cleanMimeType.startsWith(prefix));
  const isSafePdf = resourceType === 'raw' && SAFE_UPLOAD_MIME_TYPES.has(cleanMimeType);
  const isSafeVideo = resourceType === 'video' && cleanMimeType.startsWith('video/');

  if (!isSafeImage && !isSafePdf && !isSafeVideo) {
    const error = new Error('This file type is not allowed for signed upload.');
    error.statusCode = 400;
    throw error;
  }
};

const getFolderHead = (folder) => {
  const cleanFolder = sanitizePathPart(folder, '');
  const parts = cleanFolder.split('/').filter(Boolean);
  const institutionsIndex = parts.indexOf('institutions');
  if (institutionsIndex >= 0 && parts.length > institutionsIndex + 2) {
    return parts[institutionsIndex + 2];
  }
  return parts[0] || '';
};

const assertFolderResourceType = (folder, resourceType) => {
  const folderHead = getFolderHead(folder);
  const allowedResourceTypes = SAFE_RESOURCE_TYPES_BY_FOLDER[folderHead];

  if (!allowedResourceTypes || !allowedResourceTypes.has(resourceType)) {
    const error = new Error('This media type is not allowed in the requested upload folder.');
    error.statusCode = 400;
    throw error;
  }
};

const resolveUploadInstituteId = ({ actor, requestedInstituteId }) => {
  const actorInstituteId = actor.profile?.instituteId;

  if (actor.role === 'superadmin') {
    return requestedInstituteId || actorInstituteId || 'platform';
  }

  if (!actorInstituteId) {
    const error = new Error('Your profile is not linked to an institute.');
    error.statusCode = 403;
    throw error;
  }

  if (requestedInstituteId && requestedInstituteId !== actorInstituteId) {
    const error = new Error('The requested upload institute does not match your profile.');
    error.statusCode = 403;
    throw error;
  }

  return actorInstituteId;
};

const normalizeUploadFolder = ({ rawFolder, instituteId }) => {
  const cleanInstituteId = sanitizePathPart(instituteId, 'platform');
  const cleanFolder = sanitizePathPart(rawFolder, 'course-media');
  const institutionPrefix = `institutions/${cleanInstituteId}`;

  if (cleanFolder === institutionPrefix || cleanFolder.startsWith(`${institutionPrefix}/`)) {
    return cleanFolder;
  }

  const folderHead = cleanFolder.split('/')[0];
  if (!SAFE_UPLOAD_FOLDERS.has(folderHead)) {
    const error = new Error('Upload folder is not allowed.');
    error.statusCode = 400;
    throw error;
  }

  return `${institutionPrefix}/${cleanFolder}`;
};

const parseCloudinaryRequest = (body) => {
  const result = CloudinaryRequestSchema.safeParse(body);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
  const error = new Error(`${path}${issue?.message || 'Invalid Cloudinary signing request.'}`);
  error.statusCode = 400;
  throw error;
};

const publicIdWithFormat = (publicId, format) => {
  const cleanPublicId = sanitizePublicId(publicId);
  if (!cleanPublicId) {
    const error = new Error('A Cloudinary publicId is required.');
    error.statusCode = 400;
    throw error;
  }

  return cleanPublicId.endsWith(`.${format}`) ? cleanPublicId : `${cleanPublicId}.${format}`;
};

const apiSignature = (params, apiSecret) => {
  const stringToSign = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${stringToSign}${apiSecret}`).digest('hex');
};

const deliverySignature = (pathAfterSignature, apiSecret) => {
  const digest = crypto.createHash('sha1').update(`${pathAfterSignature}${apiSecret}`).digest();
  return digest
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .slice(0, 8);
};

const createSignedDeliveryUrl = ({
  cloudName,
  apiSecret,
  publicId,
  transformation,
  format,
  resourceType,
  deliveryType,
}) => {
  const formattedPublicId = publicIdWithFormat(publicId, format);
  const cleanTransformation = sanitizeTransformation(transformation, '');
  const pathAfterSignature = [cleanTransformation, formattedPublicId].filter(Boolean).join('/');
  const signature = deliverySignature(pathAfterSignature, apiSecret);
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/${deliveryType}/s--${signature}--/${pathAfterSignature}`;
};

const assertAllowedRole = (role, allowedRoles) => {
  if (!allowedRoles.has(role)) {
    const error = new Error('You do not have permission to access this media operation.');
    error.statusCode = 403;
    throw error;
  }
};

const assertInstituteCourseAccess = async ({ firestore, courseId, actor }) => {
  if (!courseId) {
    const error = new Error('courseId is required for signed playback.');
    error.statusCode = 400;
    throw error;
  }

  const courseSnap = await firestore.collection('courses').doc(courseId).get();
  if (!courseSnap.exists) {
    const error = new Error('Course was not found.');
    error.statusCode = 404;
    throw error;
  }

  const course = courseSnap.data();
  const actorInstituteId = actor.profile?.instituteId;
  const courseInstituteId = course.instituteId;

  if (actor.role !== 'superadmin' && actorInstituteId !== courseInstituteId) {
    const error = new Error('Course does not belong to your institution.');
    error.statusCode = 403;
    throw error;
  }

  if (['student', 'parent'].includes(actor.role) && course.published !== true && course.status !== 'published') {
    const error = new Error('Course is not available to learners yet.');
    error.statusCode = 403;
    throw error;
  }

  return course;
};

const createUploadSignature = ({ body, actor, config }) => {
  assertAllowedRole(actor.role, UPLOAD_ROLES);

  const resourceType = sanitizeResourceType(body.resourceType);
  assertUploadMimeType(body.mimeType, resourceType);

  const instituteId = resolveUploadInstituteId({
    actor,
    requestedInstituteId: body.instituteId,
  });
  const folder = normalizeUploadFolder({ rawFolder: body.folder, instituteId });
  assertFolderResourceType(folder, resourceType);
  const timestamp = Math.floor(Date.now() / 1000);
  const deliveryType = sanitizeDeliveryType(body.deliveryType || (resourceType === 'video' ? 'authenticated' : 'upload'));
  const contextEntries = Object.entries(body.context || {})
    .map(([key, value]) => `${sanitizePathPart(key, 'key')}=${String(value).replace(/[|=]/g, ' ').slice(0, MAX_CONTEXT_VALUE_LENGTH)}`)
    .join('|');

  const params = {
    timestamp,
    folder,
    type: deliveryType,
    allowed_formats: SAFE_FORMATS_BY_RESOURCE_TYPE[resourceType],
    unique_filename: true,
    overwrite: false,
  };

  if (resourceType === 'video') {
    params.eager = 'sp_auto';
    params.eager_async = true;
  }

  if (resourceType === 'image') {
    params.eager = 'w_1600,c_limit,q_auto,f_auto';
    params.eager_async = true;
  }

  if (contextEntries) {
    params.context = contextEntries;
  }

  const signature = apiSignature(params, config.apiSecret);

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`,
    signature,
    expiresAt: timestamp + 3600,
    deliveryType,
    resourceType,
    params,
  };
};

const createProfileImageUploadSignature = ({ body, actor, config }) => {
  assertAllowedRole(actor.role, PROFILE_UPLOAD_ROLES);
  assertUploadMimeType(body.mimeType, 'image');

  const fileSize = Number(body.fileSize || 0);
  if (fileSize > MAX_PROFILE_IMAGE_BYTES) {
    const error = new Error('Profile pictures must be smaller than 8 MB.');
    error.statusCode = 400;
    throw error;
  }

  const uid = sanitizePathPart(actor.uid, 'user');
  const actorInstituteId = resolveUploadInstituteId({ actor });
  const instituteId = sanitizePathPart(actorInstituteId, 'platform');
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `institutions/${instituteId}/profile-pictures/${uid}`;
  const contextEntries = {
    app: 'shii-edu',
    instituteId,
    purpose: 'profile-picture',
    role: actor.role,
    uid,
    userId: String(actor.profile?.loginId || actor.profile?.uniqueId || actor.uid).replace(/[|=]/g, ' '),
  };
  const params = {
    timestamp,
    folder,
    type: 'upload',
    public_id: 'avatar',
    unique_filename: false,
    overwrite: true,
    invalidate: true,
    allowed_formats: SAFE_FORMATS_BY_RESOURCE_TYPE.image,
    transformation: PROFILE_IMAGE_TRANSFORMATION,
    context: Object.entries(contextEntries)
      .map(([key, value]) => `${sanitizePathPart(key, 'key')}=${String(value).replace(/[|=]/g, ' ').slice(0, 120)}`)
      .join('|'),
  };
  const signature = apiSignature(params, config.apiSecret);

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    signature,
    expiresAt: timestamp + 600,
    deliveryType: 'upload',
    transformation: PROFILE_IMAGE_TRANSFORMATION,
    maxBytes: MAX_PROFILE_IMAGE_BYTES,
    params,
  };
};

const createPlaybackSignature = async ({ body, actor, firestore, config }) => {
  assertAllowedRole(actor.role, PLAYBACK_ROLES);
  const course = await assertInstituteCourseAccess({ firestore, courseId: body.courseId, actor });
  await assertFeatureEnabled({ firestore, instituteId: course.instituteId, featureKey: 'courses' });

  const resourceType = sanitizeResourceType(body.resourceType || 'video');
  const deliveryType = sanitizeDeliveryType(body.deliveryType || 'authenticated');
  const transformation = sanitizeTransformation(body.transformation, resourceType === 'video' ? 'sp_auto' : 'w_auto,c_scale,f_auto,q_auto');
  const format = sanitizeFormat(body.format, resourceType === 'video' ? 'm3u8' : 'jpg');
  const ttl = Math.min(Math.max(Number(body.expiresInSeconds || DEFAULT_PLAYBACK_TTL_SECONDS), 60), 3600);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const playbackUrl = createSignedDeliveryUrl({
    cloudName: config.cloudName,
    apiSecret: config.apiSecret,
    publicId: body.publicId,
    transformation,
    format,
    resourceType,
    deliveryType,
  });

  const posterUrl = resourceType === 'video'
    ? createSignedDeliveryUrl({
      cloudName: config.cloudName,
      apiSecret: config.apiSecret,
      publicId: body.publicId,
      transformation: 'so_0,w_auto,c_scale,f_auto,q_auto',
      format: 'jpg',
      resourceType,
      deliveryType,
    })
    : null;

  return {
    playbackUrl,
    posterUrl,
    expiresAt,
    ttl,
  };
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);

  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const body = parseCloudinaryRequest(await getBody(req));
    const actor = await authenticateUserProfile(req);
    assertRateLimit({ actor, req, scope: `cloudinary:${body.action}`, limit: 36, windowMs: 60 * 1000 });
    const config = getCloudinaryConfig();

    if (body.action === 'upload') {
      const { firestore } = getAdminServices();
      const signature = createUploadSignature({ body, actor, config });
      const folderHead = getFolderHead(signature.params.folder);
      await assertFeatureEnabled({
        firestore,
        instituteId: resolveUploadInstituteId({ actor, requestedInstituteId: body.instituteId }),
        featureKey: FOLDER_FEATURES[folderHead],
      });
      res.status(200).json({
        success: true,
        requestId,
        ...signature,
      });
      return;
    }

    if (body.action === 'profileImageUpload') {
      res.status(200).json({
        success: true,
        requestId,
        ...createProfileImageUploadSignature({ body, actor, config }),
      });
      return;
    }

    if (body.action === 'playback') {
      const { firestore } = getAdminServices();
      res.status(200).json({
        success: true,
        requestId,
        ...await createPlaybackSignature({ body, actor, firestore, config }),
      });
      return;
    }

    res.status(400).json({ success: false, error: 'Unsupported Cloudinary signing action.', requestId });
  } catch (error) {
    sendError(res, error, 'Cloudinary signing request failed.', requestId);
  }
};
