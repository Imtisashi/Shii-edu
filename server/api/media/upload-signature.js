const crypto = require('crypto');
const { z } = require('zod');
const {
  authenticateUserProfile,
  createRequestId,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');
const { getSupabaseAdmin, getSupabaseAdminConfig } = require('../_lib/supabaseAdmin');

const SAFE_FOLDERS = new Set([
  'assignments',
  'course-media',
  'gallery',
  'institute-branding',
  'profile-pictures',
  'pyqs',
  'syllabi',
]);

const FOLDER_BUCKETS = {
  assignments: 'assets',
  'course-media': 'course-media',
  gallery: 'assets',
  'institute-branding': 'logos',
  'profile-pictures': 'avatars',
  pyqs: 'assets',
  syllabi: 'assets',
};

const FOLDER_ROLES = {
  assignments: new Set(['admin', 'superadmin', 'teacher', 'professor']),
  'course-media': new Set(['admin', 'superadmin', 'teacher', 'professor']),
  gallery: new Set(['admin', 'superadmin']),
  'institute-branding': new Set(['admin', 'superadmin']),
  'profile-pictures': new Set(['admin', 'driver', 'parent', 'professor', 'student', 'superadmin', 'teacher']),
  pyqs: new Set(['admin', 'superadmin', 'teacher', 'professor']),
  syllabi: new Set(['admin', 'superadmin', 'teacher', 'professor']),
};

const MAX_BYTES_BY_FOLDER = {
  assignments: 25 * 1024 * 1024,
  'course-media': 100 * 1024 * 1024,
  gallery: 12 * 1024 * 1024,
  'institute-branding': 8 * 1024 * 1024,
  'profile-pictures': 8 * 1024 * 1024,
  pyqs: 25 * 1024 * 1024,
  syllabi: 25 * 1024 * 1024,
};

const UploadContractSchema = z.object({
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
  fileName: z.string().trim().min(1).max(240),
  fileSize: z.coerce.number().int().nonnegative().optional().default(0),
  folder: z.string().trim().min(1).max(240),
  instituteId: z.string().trim().max(160).optional().default(''),
  mimeType: z.string().trim().min(1).max(120),
  resourceType: z.enum(['image', 'raw', 'video']).optional().default('image'),
}).strict();

const cleanPathPart = (value, fallback = '') => {
  const cleaned = String(value || fallback || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '').trim())
    .filter(Boolean)
    .join('-');

  return cleaned || fallback;
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const parseRequest = (body) => {
  const result = UploadContractSchema.safeParse(body);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
  const error = new Error(`${path}${issue?.message || 'Invalid media upload request.'}`);
  error.statusCode = 400;
  throw error;
};

const resolveFolderKey = (folder) => {
  const segments = String(folder || '')
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);

  const exact = segments.find((segment) => SAFE_FOLDERS.has(segment));
  if (exact) return exact;

  const direct = segments.join('-');
  if (SAFE_FOLDERS.has(direct)) return direct;

  const error = new Error('This upload destination is not allowed.');
  error.statusCode = 400;
  throw error;
};

const assertRoleCanUpload = (role, folderKey) => {
  const allowedRoles = FOLDER_ROLES[folderKey];
  if (allowedRoles?.has(role)) return;

  const error = new Error('You do not have permission to upload media to this area.');
  error.statusCode = 403;
  throw error;
};

const assertMimeTypeIsAllowed = ({ folderKey, mimeType, resourceType }) => {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  const isImage = normalizedMimeType.startsWith('image/');
  const isPdf = normalizedMimeType === 'application/pdf' || normalizedMimeType.endsWith('/pdf');
  const isVideo = normalizedMimeType.startsWith('video/');

  if (['gallery', 'institute-branding', 'profile-pictures'].includes(folderKey)) {
    if (resourceType === 'image' && isImage) return;
  }

  if (['assignments', 'pyqs', 'syllabi'].includes(folderKey)) {
    if (resourceType === 'raw' && isPdf) return;
    if (folderKey === 'assignments' && resourceType === 'image' && isImage) return;
  }

  if (folderKey === 'course-media') {
    if (resourceType === 'video' && isVideo) return;
    if (resourceType === 'raw' && isPdf) return;
    if (resourceType === 'image' && isImage) return;
  }

  const error = new Error('The selected file type is not allowed for this upload.');
  error.statusCode = 400;
  throw error;
};

const assertFileSizeIsAllowed = (folderKey, fileSize) => {
  const maxBytes = MAX_BYTES_BY_FOLDER[folderKey];
  if (!fileSize || fileSize <= maxBytes) return;

  const maxMb = Math.round(maxBytes / (1024 * 1024));
  const error = new Error(`Selected file is too large. The limit is ${maxMb} MB.`);
  error.statusCode = 400;
  throw error;
};

const resolveInstituteId = ({ actor, body, folderKey }) => {
  const actorInstituteId = String(actor.profile?.instituteId || '').trim();
  const requestedInstituteId = String(
    body.instituteId ||
    body.context?.instituteId ||
    actorInstituteId
  ).trim();

  if (actor.role !== 'superadmin' && requestedInstituteId && actorInstituteId && requestedInstituteId !== actorInstituteId) {
    const error = new Error('You can only upload media for your own institute.');
    error.statusCode = 403;
    throw error;
  }

  if (requestedInstituteId) return requestedInstituteId;
  if (folderKey === 'profile-pictures') return `profile-${actor.uid}`;

  const error = new Error('Your profile is not linked to an institute.');
  error.statusCode = 403;
  throw error;
};

const buildStoragePath = ({ fileName, folderKey, instituteId }) => {
  const safeInstituteId = cleanPathPart(instituteId, 'unknown-institute');
  const safeFileName = cleanPathPart(fileName, `upload-${Date.now()}`);
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `${safeInstituteId}/${folderKey}/${Date.now()}-${randomSuffix}-${safeFileName}`;
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
    const actor = await authenticateUserProfile(req);
    const body = parseRequest(await getBody(req));
    const role = normalizeRole(actor.role);
    const folderKey = resolveFolderKey(body.folder);
    const bucket = FOLDER_BUCKETS[folderKey];
    const instituteId = resolveInstituteId({ actor: { ...actor, role }, body, folderKey });
    const path = buildStoragePath({
      fileName: body.fileName,
      folderKey,
      instituteId,
    });
    const maxBytes = MAX_BYTES_BY_FOLDER[folderKey];

    assertRoleCanUpload(role, folderKey);
    assertMimeTypeIsAllowed({
      folderKey,
      mimeType: body.mimeType,
      resourceType: body.resourceType,
    });
    assertFileSizeIsAllowed(folderKey, body.fileSize);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      error.statusCode = 500;
      throw error;
    }

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl || null;
    const { url } = getSupabaseAdminConfig();

    res.status(200).json({
      bucket,
      contentType: body.mimeType,
      deliveryType: 'upload',
      expiresInSeconds: 7200,
      folder: folderKey,
      instituteId,
      maxBytes,
      path,
      provider: 'supabase',
      publicUrl,
      resourceType: body.resourceType,
      signedUrl: data.signedUrl,
      storageUrl: url,
      token: data.token,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Failed to prepare Supabase upload.', requestId);
  }
};
