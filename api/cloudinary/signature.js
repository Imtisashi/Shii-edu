const crypto = require('crypto');
const {
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');

const PLAYBACK_ROLES = new Set(['student', 'teacher', 'professor', 'parent', 'admin', 'superadmin']);
const UPLOAD_ROLES = new Set(['teacher', 'professor', 'admin', 'superadmin']);
const SAFE_RESOURCE_TYPES = new Set(['image', 'video', 'raw', 'auto']);
const SAFE_DELIVERY_TYPES = new Set(['authenticated', 'private', 'upload']);
const SAFE_UPLOAD_MIME_PREFIXES = ['image/'];
const SAFE_UPLOAD_MIME_TYPES = new Set(['application/pdf']);
const SAFE_UPLOAD_FOLDERS = new Set(['gallery', 'pyqs', 'profile-pictures', 'course-media', 'assignments']);
const DEFAULT_PLAYBACK_TTL_SECONDS = 900;

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary signing is not configured.');
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
  if (!cleanMimeType) return;

  const isSafeImage = resourceType === 'image' && SAFE_UPLOAD_MIME_PREFIXES.some((prefix) => cleanMimeType.startsWith(prefix));
  const isSafePdf = resourceType === 'raw' && SAFE_UPLOAD_MIME_TYPES.has(cleanMimeType);
  const isSafeVideo = resourceType === 'video' && cleanMimeType.startsWith('video/');

  if (!isSafeImage && !isSafePdf && !isSafeVideo) {
    const error = new Error('This file type is not allowed for signed upload.');
    error.statusCode = 400;
    throw error;
  }
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

const assertTenantCourseAccess = async ({ firestore, courseId, actor }) => {
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

  const instituteId = actor.profile?.instituteId || body.instituteId || 'platform';
  const folder = normalizeUploadFolder({ rawFolder: body.folder, instituteId });
  const timestamp = Math.floor(Date.now() / 1000);
  const deliveryType = sanitizeDeliveryType(body.deliveryType || (resourceType === 'video' ? 'authenticated' : 'upload'));
  const contextEntries = Object.entries(body.context || {})
    .map(([key, value]) => `${sanitizePathPart(key, 'key')}=${String(value).replace(/[|=]/g, ' ')}`)
    .join('|');

  const params = {
    timestamp,
    folder,
    type: deliveryType,
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
    params,
  };
};

const createPlaybackSignature = async ({ body, actor, firestore, config }) => {
  assertAllowedRole(actor.role, PLAYBACK_ROLES);
  await assertTenantCourseAccess({ firestore, courseId: body.courseId, actor });

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
    const body = await getBody(req);
    const actor = await authenticateUserProfile(req);
    const { firestore } = getAdminServices();
    const config = getCloudinaryConfig();

    if (body.action === 'upload') {
      res.status(200).json(createUploadSignature({ body, actor, config }));
      return;
    }

    if (body.action === 'playback') {
      res.status(200).json(await createPlaybackSignature({ body, actor, firestore, config }));
      return;
    }

    res.status(400).json({ success: false, error: 'Unsupported Cloudinary signing action.', requestId });
  } catch (error) {
    sendError(res, error, 'Cloudinary signing request failed.', requestId);
  }
};
