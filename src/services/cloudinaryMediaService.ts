import { Platform } from 'react-native';
import type { User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { authenticatedFetch } from './apiClient';

const DEFAULT_VIDEO_TRANSFORMATION = 'sp_auto';
const DEFAULT_POSTER_TRANSFORMATION = 'so_0,w_auto,c_scale,f_auto,q_auto';
const CLOUDINARY_UPLOAD_TIMEOUT_MS = 120000;

/**
 * Sanitizes the resource type to ensure it is one of the allowed Cloudinary resource types.
 * @param resourceType - The resource type to sanitize.
 * @returns The sanitized resource type, defaulting to 'video' if invalid.
 */
type CloudinaryResourceType = 'image' | 'raw' | 'video';
type CloudinaryContextValue = boolean | number | string;
type CloudinaryAsset = {
  base64?: string;
  file?: File;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  name?: string;
  size?: number;
  type?: string;
  uri: string;
};

const sanitizeResourceType = (resourceType: string): CloudinaryResourceType => {
  if (resourceType === 'image' || resourceType === 'raw' || resourceType === 'video') {
    return resourceType;
  }
  return 'video';
};

const resolveCurrentUser = (currentUser?: User | null): User | null => currentUser || auth.currentUser;
const defaultMimeTypeForResource = (resourceType: CloudinaryResourceType): string => (
  resourceType === 'video'
    ? 'video/mp4'
    : resourceType === 'raw'
      ? 'application/pdf'
      : 'image/jpeg'
);
const defaultExtensionForResource = (resourceType: CloudinaryResourceType): string => (
  resourceType === 'video'
    ? 'mp4'
    : resourceType === 'raw'
      ? 'pdf'
      : 'jpg'
);
const isMimeType = (value?: string): value is string => Boolean(value?.includes('/'));
const resolveAssetMimeType = (
  asset: CloudinaryAsset | null,
  resourceType: CloudinaryResourceType
): string => {
  const candidate = [asset?.mimeType, asset?.type, asset?.file?.type].find(isMimeType);
  return candidate || defaultMimeTypeForResource(resourceType);
};
const readFileNameFromUri = (uri: string): string | null => {
  const fileName = uri.split('/').filter(Boolean).pop()?.split('?')[0]?.trim();
  return fileName || null;
};
const resolveAssetFileName = (
  asset: CloudinaryAsset | null,
  assetUri: string,
  resourceType: CloudinaryResourceType
): string => (
  asset?.name?.trim() ||
  asset?.fileName?.trim() ||
  asset?.file?.name?.trim() ||
  readFileNameFromUri(assetUri) ||
  `upload-${Date.now()}.${defaultExtensionForResource(resourceType)}`
);
const fetchCloudinaryWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = CLOUDINARY_UPLOAD_TIMEOUT_MS
): Promise<Response> => {
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The Cloudinary upload timed out. Check your connection and try again.');
    }

    throw new Error('The Cloudinary upload could not reach the network. Check your connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Represents the parameters for requesting a Cloudinary upload signature.
 */
interface RequestCloudinaryUploadSignatureParams {
  currentUser?: User | null;
  folder: string;
  resourceType?: CloudinaryResourceType;
  deliveryType?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  context?: Record<string, CloudinaryContextValue>;
}

/**
 * Represents the response from the Cloudinary signature endpoint.
 */
interface CloudinarySignatureResponse {
  apiKey: string;
  cloudName: string;
  deliveryType: string;
  expiresAt: number;
  resourceType: CloudinaryResourceType;
  signature: string;
  params: Record<string, boolean | number | string>;
  requestId?: string;
  success?: boolean;
  uploadUrl: string;
}

const assertSignaturePayloadIsUsable = (payload: CloudinarySignatureResponse): void => {
  if (!payload.apiKey || !payload.signature || !payload.uploadUrl) {
    throw new Error('The media signer returned an incomplete upload contract.');
  }
};

const dataUriToBlob = (dataUri: string, fallbackMimeType: string): Blob => {
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

const resolveWebUploadFile = async (
  asset: CloudinaryAsset | null,
  assetUri: string,
  mimeType: string
): Promise<File | Blob> => {
  if (asset?.file) return asset.file;
  if (asset?.base64) return dataUriToBlob(asset.base64, mimeType);

  try {
    const response = await fetch(assetUri);
    if (!response.ok) {
      throw new Error(`Selected file could not be read (${response.status}).`);
    }
    return await response.blob();
  } catch {
    throw new Error('The selected document could not be read. Please choose it again.');
  }
};

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
  fileSize,
  context = {},
}: RequestCloudinaryUploadSignatureParams): Promise<CloudinarySignatureResponse> => {
  const user = resolveCurrentUser(currentUser);
  if (!user) {
    throw new Error('A signed-in user is required for Cloudinary uploads.');
  }

  return authenticatedFetch('/api/cloudinary/signature', user, {
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
  }) as Promise<CloudinarySignatureResponse>;
};

/**
 * Represents the parameters for uploading a signed asset to Cloudinary.
 */
interface UploadSignedCloudinaryAssetParams {
  currentUser?: User | null;
  asset: CloudinaryAsset | string;
  folder: string;
  resourceType?: CloudinaryResourceType;
  deliveryType?: string;
  context?: Record<string, CloudinaryContextValue>;
}

/**
 * Represents the Cloudinary upload response.
 */
interface CloudinaryUploadResponse {
  asset_id?: string;
  bytes?: number;
  created_at?: string;
  etag?: string;
  format?: string;
  height?: number;
  original_filename?: string;
  placeholder?: boolean;
  public_id?: string;
  resource_type?: CloudinaryResourceType;
  secure_url?: string;
  signature?: string;
  tags?: string[];
  type?: 'authenticated' | 'fetch' | 'private' | 'upload';
  url?: string;
  version?: number;
  version_id?: string;
  width?: number;
  error?: {
    message?: string;
  };
}

const parseCloudinaryUploadResponse = async (
  response: Response
): Promise<CloudinaryUploadResponse> => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as CloudinaryUploadResponse;
  } catch {
    return {
      error: {
        message: response.ok
          ? 'Cloudinary returned an unreadable upload response.'
          : `Cloudinary upload failed with status ${response.status}.`,
      },
    };
  }
};

export type CloudinaryAssetUploadResult = {
  assetId: string | null;
  bytes: number | null;
  cloudName: string | null;
  deliveryType: string;
  format: string | null;
  height: number | null;
  mimeType: string | null;
  originalFilename: string | null;
  provider: 'cloudinary';
  publicId: string | null;
  raw: CloudinaryUploadResponse;
  resourceType: CloudinaryResourceType | null;
  secureUrl: string;
  signature: string | null;
  url: string;
  version: number | null;
  width: number | null;
};

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
}: UploadSignedCloudinaryAssetParams): Promise<CloudinaryAssetUploadResult> => {
  const user = resolveCurrentUser(currentUser);
  if (!user) {
    throw new Error('A signed-in user is required for Cloudinary uploads.');
  }

  const assetUri = typeof asset === 'string' ? asset : asset.uri;
  if (!assetUri) {
    throw new Error('No media asset was selected.');
  }

  const assetDetails = typeof asset === 'string' ? null : asset;
  const safeResourceType = sanitizeResourceType(resourceType);
  const mimeType = resolveAssetMimeType(assetDetails, safeResourceType);
  const fileName = resolveAssetFileName(assetDetails, assetUri, safeResourceType);

  const signaturePayload = await requestCloudinaryUploadSignature({
    currentUser: user,
    folder,
    resourceType: safeResourceType,
    deliveryType,
    mimeType,
    fileName,
    fileSize: assetDetails?.fileSize || assetDetails?.size || assetDetails?.file?.size,
    context,
  });
  assertSignaturePayloadIsUsable(signaturePayload);
  if (signaturePayload.resourceType !== safeResourceType) {
    throw new Error('The media signer returned the wrong upload resource type.');
  }

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
      const webFile = await resolveWebUploadFile(assetDetails, assetUri, mimeType);
      formData.append('file', webFile, assetDetails?.file?.name || fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown file read error.';
      throw new Error(`Failed to process file for upload: ${message}`);
    }
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

  if (!uploadResponse.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  }

  return {
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
    secureUrl: data.secure_url,
    signature: data.signature || null,
    url: data.url || data.secure_url,
    version: data.version || null,
    width: data.width || null,
  };
};

/**
 * Requests a signed playback URL for a Cloudinary resource.
 */
interface RequestSignedPlaybackUrlParams {
  currentUser?: User | null;
  courseId: string;
  lessonId: string;
  publicId: string;
  transformation?: string;
  format?: string;
  resourceType?: CloudinaryResourceType;
}

type SignedPlaybackResponse = {
  expiresAt: number;
  playbackUrl: string;
  posterUrl: string | null;
  requestId?: string;
  success?: boolean;
  ttl: number;
};

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
}: RequestSignedPlaybackUrlParams): Promise<SignedPlaybackResponse> => {
  const user = resolveCurrentUser(currentUser);
  if (!user) {
    throw new Error('A signed-in user is required for signed playback URLs.');
  }

  return authenticatedFetch('/api/cloudinary/signature', user, {
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
  }) as Promise<SignedPlaybackResponse>;
};

/**
 * Builds an unsigned Cloudinary preview URL.
 */
interface BuildUnsignedCloudinaryPreviewUrlParams {
  cloudName: string;
  publicId: string;
  transformation?: string;
  format?: string;
  resourceType?: CloudinaryResourceType;
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
