import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import type { DocumentPickerAsset } from 'expo-document-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabaseClient';

export type SupabaseStorageBucket = 'assets' | 'avatars' | 'course-media' | 'documents' | 'logos';

export type SupabaseUploadAsset = DocumentPickerAsset | ImagePickerAsset | {
  file?: File;
  fileName?: string;
  mimeType?: string;
  name?: string;
  type?: string;
  uri: string;
};

export type SupabaseUploadResult = {
  bucket: SupabaseStorageBucket;
  contentType: string;
  fullPath: string;
  path: string;
  publicUrl: string | null;
};

type UploadSupabaseAssetParams = {
  asset: SupabaseUploadAsset;
  bucket: SupabaseStorageBucket;
  contentType?: string;
  folder: string;
  instituteId: string;
  upsert?: boolean;
};

const MIME_BY_BUCKET: Record<SupabaseStorageBucket, string> = {
  assets: 'application/octet-stream',
  avatars: 'image/jpeg',
  'course-media': 'video/mp4',
  documents: 'application/pdf',
  logos: 'image/png',
};

const cleanPathPart = (value: string, label: string): string => {
  const cleaned = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '').trim())
    .filter(Boolean)
    .join('-');

  if (!cleaned) throw new Error(`${label} is required.`);
  return cleaned;
};

const readFileName = (asset: SupabaseUploadAsset): string => {
  const explicitName = ('name' in asset ? asset.name : '') ||
    ('fileName' in asset ? asset.fileName : '') ||
    asset.file?.name ||
    asset.uri.split('/').filter(Boolean).pop()?.split('?')[0];
  return cleanPathPart(explicitName || `upload-${Date.now()}`, 'File name');
};

const readContentType = (
  asset: SupabaseUploadAsset,
  bucket: SupabaseStorageBucket,
  contentType?: string
): string => {
  const detectedType = contentType ||
    ('mimeType' in asset ? asset.mimeType : '') ||
    ('type' in asset ? asset.type : '') ||
    asset.file?.type ||
    MIME_BY_BUCKET[bucket];

  return String(detectedType || MIME_BY_BUCKET[bucket]).trim();
};

const readAssetArrayBuffer = async (
  asset: SupabaseUploadAsset,
  contentType: string
): Promise<ArrayBuffer | Blob | File> => {
  if (Platform.OS === 'web') {
    if (asset.file) return asset.file;
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('The selected file could not be read.');
    return response.blob();
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
};

export const uploadSupabaseAsset = async ({
  asset,
  bucket,
  contentType,
  folder,
  instituteId,
  upsert = false,
}: UploadSupabaseAssetParams): Promise<SupabaseUploadResult> => {
  try {
    const safeInstituteId = cleanPathPart(instituteId, 'Institute ID');
    const safeFolder = cleanPathPart(folder, 'Upload folder');
    const fileName = readFileName(asset);
    const resolvedContentType = readContentType(asset, bucket, contentType);
    const fileBody = await readAssetArrayBuffer(asset, resolvedContentType);
    const path = `${safeInstituteId}/${safeFolder}/${Date.now()}-${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBody, {
        cacheControl: '3600',
        contentType: resolvedContentType,
        upsert,
      });

    if (error) throw error;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl || null;

    return {
      bucket,
      contentType: resolvedContentType,
      fullPath: data.fullPath || `${bucket}/${data.path}`,
      path: data.path,
      publicUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The file could not be uploaded.';
    throw new Error(`Supabase upload failed: ${message}`);
  }
};

export const createSupabaseSignedUrl = async ({
  bucket,
  path,
  expiresIn = 60 * 15,
}: {
  bucket: SupabaseStorageBucket;
  expiresIn?: number;
  path: string;
}): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
};
