import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import type { User } from 'firebase/auth';
import { authenticatedFetch } from './apiClient';
import { supabase } from './supabaseClient';

type SupabaseResourceType = 'image' | 'raw' | 'video';
type SupabaseContextValue = boolean | number | string;

type UploadableAsset = {
  base64?: string | null;
  file?: File;
  fileName?: string | null;
  fileSize?: number | null;
  height?: number | null;
  mimeType?: string | null;
  name?: string | null;
  size?: number | null;
  type?: string | null;
  uri: string;
  width?: number | null;
};

type SupabaseUploadContract = {
  bucket: 'assets' | 'avatars' | 'course-media' | 'documents' | 'logos';
  contentType: string;
  deliveryType: 'upload';
  expiresInSeconds: number;
  folder: string;
  instituteId: string;
  maxBytes: number;
  path: string;
  provider: 'supabase';
  publicUrl: string | null;
  resourceType: SupabaseResourceType;
  signedUrl: string;
  storageUrl: string;
  token: string;
};

export type SupabaseAssetUploadResult = {
  assetId: string | null;
  bytes: number | null;
  cloudName: string | null;
  deliveryType: 'upload';
  format: string | null;
  height: number | null;
  mimeType: string;
  provider: 'supabase';
  publicId: string;
  raw: Record<string, unknown>;
  resourceType: SupabaseResourceType;
  secureUrl: string;
  signature: null;
  storageBucket: SupabaseUploadContract['bucket'];
  storagePath: string;
  supabasePath: string;
  url: string;
  version: null;
  width: number | null;
};

type UploadSignedSupabaseAssetParams = {
  asset: UploadableAsset | string;
  context?: Record<string, SupabaseContextValue>;
  currentUser?: User | null;
  deliveryType?: 'upload' | 'authenticated' | 'private';
  folder: string;
  instituteId?: string;
  resourceType?: SupabaseResourceType;
};

const DEFAULT_UPLOAD_TIMEOUT_MS = 120000;

const getSupabaseMediaFunctionUrl = (): string => {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!url) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required for Supabase media uploads.');
  }
  return `${url}/functions/v1/media-upload-signature`;
};

const sanitizeResourceType = (resourceType?: string): SupabaseResourceType => (
  resourceType === 'raw' || resourceType === 'video' ? resourceType : 'image'
);

const defaultMimeTypeForResource = (resourceType: SupabaseResourceType): string => {
  if (resourceType === 'raw') return 'application/pdf';
  if (resourceType === 'video') return 'video/mp4';
  return 'image/jpeg';
};

const defaultExtensionForResource = (resourceType: SupabaseResourceType): string => {
  if (resourceType === 'raw') return 'pdf';
  if (resourceType === 'video') return 'mp4';
  return 'jpg';
};

const isMimeType = (value: unknown): value is string => (
  typeof value === 'string' && value.includes('/')
);

const readFileNameFromUri = (uri: string): string | null => (
  uri.split('/').filter(Boolean).pop()?.split('?')[0]?.trim() || null
);

const resolveAssetMimeType = (
  asset: UploadableAsset | null,
  resourceType: SupabaseResourceType
): string => (
  [asset?.mimeType, asset?.type, asset?.file?.type].find(isMimeType) ||
  defaultMimeTypeForResource(resourceType)
);

const resolveAssetFileName = (
  asset: UploadableAsset | null,
  assetUri: string,
  resourceType: SupabaseResourceType
): string => (
  asset?.name?.trim() ||
  asset?.fileName?.trim() ||
  asset?.file?.name?.trim() ||
  readFileNameFromUri(assetUri) ||
  `upload-${Date.now()}.${defaultExtensionForResource(resourceType)}`
);

const dataUriToBlob = (dataUri: string, fallbackMimeType: string): Blob => {
  const match = dataUri.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    throw new Error('The selected file could not be decoded.');
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

const readWebUploadBody = async (
  asset: UploadableAsset | null,
  assetUri: string,
  mimeType: string
): Promise<Blob | File> => {
  if (asset?.file) return asset.file;
  if (asset?.base64) return dataUriToBlob(asset.base64, mimeType);

  const response = await fetch(assetUri);
  if (!response.ok) {
    throw new Error('The selected file could not be read. Please choose it again.');
  }

  return response.blob();
};

const readUploadBody = async (
  asset: UploadableAsset | null,
  assetUri: string,
  mimeType: string
): Promise<ArrayBuffer | Blob | File> => {
  if (Platform.OS === 'web') {
    return readWebUploadBody(asset, assetUri, mimeType);
  }

  const base64 = await FileSystem.readAsStringAsync(assetUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
};

const withTimeout = async <T,>(
  operation: Promise<T>,
  message: string,
  timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS
): Promise<T> => {
  if (typeof AbortController === 'undefined') return operation;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const requestSupabaseUploadContract = async ({
  context = {},
  currentUser,
  fileName,
  fileSize,
  folder,
  instituteId,
  mimeType,
  resourceType,
}: {
  context?: Record<string, SupabaseContextValue>;
  currentUser?: User | null;
  fileName: string;
  fileSize?: number;
  folder: string;
  instituteId?: string;
  mimeType: string;
  resourceType: SupabaseResourceType;
}): Promise<SupabaseUploadContract> => {
  if (!currentUser) {
    throw new Error('A signed-in user is required for Supabase uploads.');
  }

  const requestBody = {
    context,
    fileName,
    fileSize,
    folder,
    instituteId,
    mimeType,
    resourceType,
  };
  const firebaseToken = await currentUser.getIdToken();

  try {
    const edgeResponse = await fetch(getSupabaseMediaFunctionUrl(), {
      body: JSON.stringify(requestBody),
      headers: {
        Authorization: `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const text = await edgeResponse.text();
    const data = text ? JSON.parse(text) : {};

    if (edgeResponse.ok) {
      return data as SupabaseUploadContract;
    }

    if (edgeResponse.status !== 404) {
      throw new Error(data.error || `Supabase upload signer failed with status ${edgeResponse.status}.`);
    }
  } catch (error) {
    if (error instanceof Error && !/404|not found/i.test(error.message)) {
      throw error;
    }
  }

  return authenticatedFetch('/api/media/upload-signature', currentUser, {
    body: requestBody,
    method: 'POST',
    timeoutMs: 30000,
  }) as Promise<SupabaseUploadContract>;
};

export const uploadSignedSupabaseAsset = async ({
  asset,
  context = {},
  currentUser,
  deliveryType: _deliveryType = 'upload',
  folder,
  instituteId,
  resourceType = 'image',
}: UploadSignedSupabaseAssetParams): Promise<SupabaseAssetUploadResult> => {
  const normalizedAsset = typeof asset === 'string' ? null : asset;
  const assetUri = typeof asset === 'string' ? asset : asset?.uri;
  if (!assetUri) {
    throw new Error('No media asset was selected.');
  }

  const safeResourceType = sanitizeResourceType(resourceType);
  const mimeType = resolveAssetMimeType(normalizedAsset, safeResourceType);
  const fileName = resolveAssetFileName(normalizedAsset, assetUri, safeResourceType);
  const fileSize = normalizedAsset?.fileSize || normalizedAsset?.size || normalizedAsset?.file?.size || undefined;

  const contract = await requestSupabaseUploadContract({
    context,
    currentUser,
    fileName,
    fileSize,
    folder,
    instituteId,
    mimeType,
    resourceType: safeResourceType,
  });

  if (!contract.bucket || !contract.path || !contract.token) {
    throw new Error('The Supabase upload signer returned an incomplete upload contract.');
  }

  if (contract.resourceType !== safeResourceType) {
    throw new Error('The Supabase upload signer returned the wrong resource type.');
  }

  if (fileSize && contract.maxBytes && fileSize > contract.maxBytes) {
    throw new Error('The selected file is larger than the allowed upload limit.');
  }

  const uploadBody = await readUploadBody(normalizedAsset, assetUri, mimeType);
  const uploadOperation = supabase.storage
    .from(contract.bucket)
    .uploadToSignedUrl(contract.path, contract.token, uploadBody, {
      cacheControl: '31536000',
      contentType: mimeType,
      upsert: false,
    });
  const { data, error } = await withTimeout(
    uploadOperation,
    'The Supabase upload timed out. Check your connection and try again.'
  );

  if (error) {
    throw new Error(error.message || 'Supabase rejected the upload.');
  }

  const secureUrl = contract.publicUrl || supabase.storage.from(contract.bucket).getPublicUrl(contract.path).data.publicUrl;
  if (!secureUrl) {
    throw new Error('Supabase upload completed without a readable URL.');
  }

  return {
    assetId: null,
    bytes: fileSize || null,
    cloudName: null,
    deliveryType: 'upload',
    format: fileName.split('.').pop()?.toLowerCase() || null,
    height: normalizedAsset?.height || null,
    mimeType,
    provider: 'supabase',
    publicId: contract.path,
    raw: {
      ...data,
      bucket: contract.bucket,
      path: contract.path,
    },
    resourceType: safeResourceType,
    secureUrl,
    signature: null,
    storageBucket: contract.bucket,
    storagePath: contract.path,
    supabasePath: contract.path,
    url: secureUrl,
    version: null,
    width: normalizedAsset?.width || null,
  };
};

export const uploadInstitutionAsset = uploadSignedSupabaseAsset;
