import { Platform } from 'react-native';
import { authenticatedFetch } from './apiClient';

const DEFAULT_VIDEO_TRANSFORMATION = 'sp_auto';
const DEFAULT_POSTER_TRANSFORMATION = 'so_0,w_auto,c_scale,f_auto,q_auto';

const sanitizeResourceType = (resourceType) => (
  ['image', 'video', 'raw', 'auto'].includes(resourceType) ? resourceType : 'video'
);

export const requestCloudinaryUploadSignature = async ({
  currentUser,
  folder,
  resourceType = 'video',
  deliveryType,
  mimeType,
  fileName,
  context = {},
}) => authenticatedFetch('/api/cloudinary/signature', currentUser, {
  method: 'POST',
  body: {
    action: 'upload',
    folder,
    resourceType: sanitizeResourceType(resourceType),
    deliveryType,
    mimeType,
    fileName,
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

  const signaturePayload = await requestCloudinaryUploadSignature({
    currentUser,
    folder,
    resourceType,
    deliveryType,
    mimeType: asset?.mimeType || asset?.type || '',
    fileName: asset?.name || asset?.fileName || '',
    context,
  });

  const formData = new FormData();
  Object.entries(signaturePayload.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  formData.append('api_key', signaturePayload.apiKey);
  formData.append('signature', signaturePayload.signature);

  if (Platform.OS === 'web') {
    const response = await fetch(assetUri);
    const blob = await response.blob();
    const fileName = asset?.name || asset?.fileName || `upload-${Date.now()}`;
    formData.append('file', blob, fileName);
  } else {
    const fallbackExtension = resourceType === 'video' ? 'mp4' : resourceType === 'raw' ? 'pdf' : 'jpg';
    formData.append('file', {
      uri: assetUri,
      type: asset?.mimeType || asset?.type || (resourceType === 'video' ? 'video/mp4' : resourceType === 'raw' ? 'application/pdf' : 'image/jpeg'),
      name: asset?.name || asset?.fileName || `${Date.now()}.${fallbackExtension}`,
    });
  }

  const uploadResponse = await fetch(signaturePayload.uploadUrl, {
    method: 'POST',
    body: formData,
  });
  const data = await uploadResponse.json();

  if (!uploadResponse.ok) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  }

  return data;
};

export const requestSignedPlaybackUrl = async ({
  currentUser,
  courseId,
  lessonId,
  publicId,
  transformation = DEFAULT_VIDEO_TRANSFORMATION,
  format = 'm3u8',
  resourceType = 'video',
}) => authenticatedFetch('/api/cloudinary/signature', currentUser, {
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
