import { Platform } from 'react-native';
import { authenticatedFetch } from './apiClient';

const DEFAULT_VIDEO_TRANSFORMATION = 'sp_auto';
const DEFAULT_POSTER_TRANSFORMATION = 'so_0,w_auto,c_scale,f_auto,q_auto';

/**
 * Sanitizes the resource type to ensure it is one of the allowed Cloudinary resource types.
 * @param resourceType - The resource type to sanitize.
 * @returns The sanitized resource type, defaulting to 'video' if invalid.
 */
const sanitizeResourceType = (resourceType: string): 'image' | 'video' | 'raw' | 'auto' => {
  const allowedTypes = ['image', 'video', 'raw', 'auto'] as const;
  return allowedTypes.includes(resourceType as any) ? (resourceType as any) : 'video';
};

/**
 * Represents the parameters for requesting a Cloudinary upload signature.
 */
interface RequestCloudinaryUploadSignatureParams {
  currentUser: any; // Firebase User object
  folder: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  deliveryType?: string;
  mimeType?: string;
  fileName?: string;
  context?: Record<string, any>;
}

/**
 * Represents the response from the Cloudinary signature endpoint.
 */
interface CloudinarySignatureResponse {
  apiKey: string;
  signature: string;
  timestamp: string;
  params: Record<string, any>;
  uploadUrl: string;
}

/**
 * Requests a signed upload signature from the backend for Cloudinary.
 * @param params - The parameters for the signature request.
 * @returns A promise that resolves to the signature response.
 */
export const requestCloudinaryUploadSignature = async ({
  currentUser,
  folder,
  resourceType = 'video',
  deliveryType,
  mimeType,
  fileName,
  context = {},
}: RequestCloudinaryUploadSignatureParams): Promise<CloudinarySignatureResponse> => {
  if (!currentUser) {
    throw new Error('A signed-in user is required for Cloudinary uploads.');
  }

  const response = await authenticatedFetch('/api/cloudinary/signature', currentUser, {
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

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to request Cloudinary upload signature.');
  }

  return response.json();
};

/**
 * Represents the parameters for uploading a signed asset to Cloudinary.
 */
interface UploadSignedCloudinaryAssetParams {
  currentUser: any; // Firebase User object
  asset: { uri: string; name?: string; fileName?: string; mimeType?: string; type?: string; size?: number } | string;
  folder: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  deliveryType?: string;
  context?: Record<string, any>;
}

/**
 * Represents the Cloudinary upload response.
 */
interface CloudinaryUploadResponse {
  asset_id: string;
  public_id: string;
  version: number;
  version_id: string;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: 'image' | 'video' | 'raw';
  created_at: string;
  tags: string[];
  bytes: number;
  type: 'upload' | 'authenticated' | 'private' | 'fetch';
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  original_filename?: string;
}

/**
 * Uploads a pre-signed asset to Cloudinary.
 * @param params - The parameters for the upload.
 * @returns A promise that resolves to the Cloudinary upload response.
 */
export const uploadSignedCloudinaryAsset = async ({
  currentUser,
  asset,
  folder,
  resourceType = 'video',
  deliveryType,
  context = {},
}: UploadSignedCloudinaryAssetParams): Promise<CloudinaryUploadResponse> => {
  if (!currentUser) {
    throw new Error('A signed-in user is required for Cloudinary uploads.');
  }

  const assetUri = typeof asset === 'string' ? asset : asset.uri;
  if (!assetUri) {
    throw new Error('No media asset was selected.');
  }

  // Determine MIME type and file name from the asset
  const mimeType = asset instanceof String ? '' : (asset.mimeType || asset.type || '');
  const fileName = asset instanceof String ? '' : (asset.name || asset.fileName || `upload-${Date.now()}`);

  const signaturePayload = await requestCloudinaryUploadSignature({
    currentUser,
    folder,
    resourceType,
    deliveryType,
    mimeType,
    fileName,
    context,
  });

  const formData = new FormData();

  // Add signature parameters
  Object.entries(signaturePayload.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  formData.append('api_key', signaturePayload.apiKey);
  formData.append('signature', signaturePayload.signature);

  // Handle file upload based on platform
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(assetUri);
      if (!response.ok) {
        throw new Error('Could not read the selected file.');
      }
      const blob = await response.blob();
      const finalFileName = fileName || `upload-${Date.now()}`;
      formData.append('file', blob, finalFileName);
    } catch (error) {
      throw new Error(`Failed to process file for upload: ${error.message}`);
    }
  } else {
    const fallbackExtension =
      resourceType === 'video'
        ? 'mp4'
        : resourceType === 'raw'
          ? 'pdf'
          : 'jpg';
    const finalFileName =
      fileName ||
      `${Date.now()}.${fallbackExtension}`;
    const assetType =
      asset instanceof String
        ? ''
        : asset.mimeType ||
          asset.type ||
          (resourceType === 'video'
            ? 'video/mp4'
            : resourceType === 'raw'
              ? 'application/pdf'
              : 'image/jpeg');

    formData.append('file', {
      uri: assetUri,
      type: assetType,
      name: finalFileName,
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

/**
 * Requests a signed playback URL for a Cloudinary resource.
 */
interface RequestSignedPlaybackUrlParams {
  currentUser: any; // Firebase User object
  courseId: string;
  lessonId: string;
  publicId: string;
  transformation?: string;
  format?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
}

/**
 * Requests a signed playback URL from the backend for Cloudinary.
 * @param params - The parameters for the playback request.
 * @returns A promise that resolves to the signed URL response.
 */
export const requestSignedPlaybackUrl = async ({
  currentUser,
  courseId,
  lessonId,
  publicId,
  transformation = DEFAULT_VIDEO_TRANSFORMATION,
  format = 'm3u8',
  resourceType = 'video',
}: RequestSignedPlaybackUrlParams): Promise<{ url: string }> => {
  if (!currentUser) {
    throw new Error('A signed-in user is required for signed playback URLs.');
  }

  const response = await authenticatedFetch('/api/cloudinary/signature', currentUser, {
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

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.error?.message || 'Failed to request signed playback URL.');
  }

  return response.json();
};

/**
 * Builds an unsigned Cloudinary preview URL.
 */
interface BuildUnsignedCloudinaryPreviewUrlParams {
  cloudName: string;
  publicId: string;
  transformation?: string;
  format?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  deliveryType?: string;
}

/**
 * Builds an unsigned Cloudinary preview URL for direct access.
 * @param params - The parameters for the URL.
 * @returns The unsigned URL or null if required parameters are missing.
 */
export const buildUnsignedCloudinaryPreviewUrl = ({
  cloudName,
  publicId,
  transformation = DEFAULT_POSTER_TRANSFORMATION,
  format = 'jpg',
  resourceType = 'video',
  deliveryType = 'upload',
}: BuildUnsignedCloudinaryPreviewUrlParams): string | null => {
  if (!cloudName || !publicId) {
    return null;
  }

  const encodedPublicId = String(publicId).replace(/^\/+/, '');
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/${deliveryType}/${transformation}/${encodedPublicId}.${format}`;
};

/**
 * Returns the default video transformation for Cloudinary.
 * @returns The default transformation string.
 */
export const getDefaultVideoTransformation = (): string => DEFAULT_VIDEO_TRANSFORMATION;