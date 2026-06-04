import { Platform } from 'react-native';
import { auth } from '../../firebaseConfig';
import { authenticatedFetch } from './apiClient';

const DEFAULT_VIDEO_TRANSFORMATION = 'sp_auto';
const DEFAULT_POSTER_TRANSFORMATION = 'so_0,w_auto,c_scale,f_auto,q_auto';
const CLOUDINARY_UPLOAD_TIMEOUT_MS = 120000;

const sanitizeResourceType = (resourceType) => (
  ['image', 'video', 'raw'].includes(resourceType) ? resourceType : 'video'
);

const resolveCurrentUser = (currentUser) => currentUser || auth.currentUser;
const defaultMimeTypeForResource = (resourceType) => (
  resourceType === 'video'
    ? 'video/mp4'
    : resourceType === 'raw'
      ? 'application/pdf'
      : 'image/jpeg'
);
const defaultExtensionForResource = (resourceType) => (
  resourceType === 'video'
    ? 'mp4'
    : resourceType === 'raw'
      ? 'pdf'
      : 'jpg'
);
const isMimeType = (value) => typeof value === 'string' && value.includes('/');
const resolveAssetMimeType = (asset, resourceType) => (
  [asset?.mimeType, asset?.type, asset?.file?.type].find(isMimeType) || defaultMimeTypeForResource(resourceType)
);
const readFileNameFromUri = (uri) => (
  uri.split('/').filter(Boolean).pop()?.split('?')[0]?.trim() || null
);
const resolveAssetFileName = (asset, assetUri, resourceType) => (
  asset?.name?.trim() ||
  asset?.fileName?.trim() ||
  asset?.file?.name?.trim() ||
  readFileNameFromUri(assetUri) ||
  `upload-${Date.now()}.${defaultExtensionForResource(resourceType)}`
);
const dataUriToBlob = (dataUri, fallbackMimeType) => {
  const match = dataUri.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    throw new Error('The selected document could not be decoded.');
  }

  const mimeType = match[1] || fallbackMimeType;
  const encodedBody = match[3] || '';
  const binary = match[2] ? atob(encodedBody) : decodeURIComponent(encodedBody);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};
const resolveWebUploadFile = async (asset, assetUri, mimeType) => {
  if (asset?.file) return asset.file;
  if (asset?.base64) return dataUriToBlob(asset.base64, mimeType);

  try {
    const response = await fetch(assetUri);
    if (!response.ok) {
      throw new Error(`Selected file could not be read (${response.status}).`);
    }
    return await response.blob();
  } catch (_error) {
    throw new Error('The selected document could not be read. Please choose it again.');
  }
};
const fetchCloudinaryWithTimeout = async (url, options, timeoutMs = CLOUDINARY_UPLOAD_TIMEOUT_MS) => {
  if (typeof AbortController === 'undefined') {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The Cloudinary upload timed out. Check your connection and try again.');
    }

    throw new Error('The Cloudinary upload could not reach the network. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }
};
const parseCloudinaryUploadResponse = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return {
      error: {
        message: response.ok
          ? 'Cloudinary returned an unreadable upload response.'
          : `Cloudinary upload failed with status ${response.status}.`,
      },
    };
  }
};
const assertSignaturePayloadIsUsable = (payload) => {
  if (!payload?.apiKey || !payload?.signature || !payload?.uploadUrl) {
    throw new Error('The media signer returned an incomplete upload contract.');
  }
};

const normalizeUploadResult = (data, signaturePayload, mimeType) => ({
  assetId: data.asset_id || null,
  bytes: data.bytes || null,
  cloudName: signaturePayload.cloudName || null,
  deliveryType: data.type || signaturePayload.deliveryType || 'upload',
  format: data.format || null,
  height: data.height || null,
  mimeType: mimeType || null,
  originalFilename: data.original_filename || null,
  provider: 'cloudinary',
  publicId: data.public_id || null,
  raw: data,
  resourceType: data.resource_type || null,
  secureUrl: data.secure_url || null,
  signature: data.signature || null,
  url: data.url || data.secure_url || null,
  version: data.version || null,
  width: data.width || null,
});

export const requestCloudinaryUploadSignature = async ({
  currentUser,
  folder,
  resourceType = 'video',
  deliveryType,
  mimeType,
  fileName,
  fileSize,
  context = {},
}) => authenticatedFetch('/api/cloudinary/signature', resolveCurrentUser(currentUser), {
  method: 'POST',
  body: {
    action: 'upload',
    folder,
    resourceType: sanitizeResourceType(resourceType),
    deliveryType,
    mimeType,
    fileName,
    fileSize,
    context,
  },
});

export const uploadSignedCloudinaryAsset = async ({
  currentUser,
  asset,
  folder,
  resourceType = 'video',
  deliveryType,
  context = {},
}) => {
  const assetUri = typeof asset === 'string' ? asset : asset?.uri;
  if (!assetUri) {
    throw new Error('No media asset was selected.');
  }

  const safeResourceType = sanitizeResourceType(resourceType);
  const mimeType = resolveAssetMimeType(asset, safeResourceType);
  const fileName = resolveAssetFileName(asset, assetUri, safeResourceType);
  const signaturePayload = await requestCloudinaryUploadSignature({
    currentUser,
    folder,
    resourceType: safeResourceType,
    deliveryType,
    mimeType,
    fileName,
    fileSize: asset?.fileSize || asset?.size || asset?.file?.size,
    context,
  });
  assertSignaturePayloadIsUsable(signaturePayload);
  if (signaturePayload.resourceType !== safeResourceType) {
    throw new Error('The media signer returned the wrong upload resource type.');
  }

  const formData = new FormData();
  Object.entries(signaturePayload.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  formData.append('api_key', signaturePayload.apiKey);
  formData.append('signature', signaturePayload.signature);

  if (Platform.OS === 'web') {
    const webFile = await resolveWebUploadFile(asset, assetUri, mimeType);
    formData.append('file', webFile, asset?.file?.name || fileName);
  } else {
    formData.append('file', {
      uri: assetUri,
      name: fileName,
      type: mimeType,
    });
  }

  const uploadResponse = await fetchCloudinaryWithTimeout(signaturePayload.uploadUrl, {
    method: 'POST',
    body: formData,
  });
  const data = await parseCloudinaryUploadResponse(uploadResponse);

  if (!uploadResponse.ok) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  }

  if (!data?.secure_url) {
    throw new Error('Cloudinary upload completed without a secure URL.');
  }

  return normalizeUploadResult(
    data,
    signaturePayload,
    mimeType
  );
};

export const requestSignedPlaybackUrl = async ({
  currentUser,
  courseId,
  lessonId,
  publicId,
  transformation = DEFAULT_VIDEO_TRANSFORMATION,
  format = 'm3u8',
  resourceType = 'video',
}) => authenticatedFetch('/api/cloudinary/signature', resolveCurrentUser(currentUser), {
  method: 'POST',
  body: {
    action: 'playback',
    courseId,
    lessonId,
    publicId,
    transformation,
    format,
    resourceType: sanitizeResourceType(resourceType),
  },
});

export const buildUnsignedCloudinaryPreviewUrl = ({
  cloudName,
  publicId,
  transformation = DEFAULT_POSTER_TRANSFORMATION,
  format = 'jpg',
  resourceType = 'video',
  deliveryType = 'upload',
}) => {
  if (!cloudName || !publicId) return null;
  const encodedPublicId = String(publicId).replace(/^\/+/, '');
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/${deliveryType}/${transformation}/${encodedPublicId}.${format}`;
};

export const getDefaultVideoTransformation = () => DEFAULT_VIDEO_TRANSFORMATION;
