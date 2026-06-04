import * as ImagePicker from 'expo-image-picker';
import type { User } from 'firebase/auth';
import { pickImageFromLibrary } from './nativePickerService';
import { uploadSignedSupabaseAsset } from './supabaseMediaService';

export const PROFILE_IMAGE_TRANSFORMATION = 'supabase-original';
const MAX_PROFILE_IMAGE_BYTES = 8 * 1024 * 1024;

export type ProfileImageUploadResult = {
  asset: ImagePicker.ImagePickerAsset;
  assetId: string | null;
  bytes: number | null;
  cloudName: string | null;
  format: string | null;
  height: number | null;
  mimeType: string;
  provider: 'supabase';
  publicId: string | null;
  secureUrl: string;
  storageBucket: string | null;
  storagePath: string | null;
  supabasePath: string | null;
  transformation: string;
  uploadResponse: Record<string, unknown>;
  width: number | null;
};

export const pickProfileImageFromLibrary = async (): Promise<ImagePicker.ImagePickerAsset | null> => {
  const asset = await pickImageFromLibrary({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.92,
  });

  if (!asset) return null;

  if (asset.fileSize && asset.fileSize > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error('Profile pictures must be smaller than 8 MB.');
  }

  return asset;
};

export const uploadProfileImageToSupabase = async ({
  asset,
  currentUser,
}: {
  asset: ImagePicker.ImagePickerAsset;
  currentUser: User | null | undefined;
}): Promise<ProfileImageUploadResult> => {
  if (!currentUser?.uid) {
    throw new Error('Sign in before updating your profile picture.');
  }

  const upload = await uploadSignedSupabaseAsset({
    asset,
    context: {
      purpose: 'profile-picture',
      uploadedBy: currentUser.uid,
    },
    currentUser,
    folder: 'profile-pictures',
    resourceType: 'image',
  });

  return {
    asset,
    assetId: upload.assetId,
    bytes: upload.bytes,
    cloudName: upload.cloudName,
    format: upload.format,
    height: upload.height,
    mimeType: upload.mimeType,
    provider: upload.provider,
    publicId: upload.publicId,
    secureUrl: upload.secureUrl,
    storageBucket: upload.storageBucket,
    storagePath: upload.storagePath,
    supabasePath: upload.supabasePath,
    transformation: PROFILE_IMAGE_TRANSFORMATION,
    uploadResponse: upload.raw,
    width: upload.width,
  };
};

export const pickAndUploadProfileImage = async ({
  currentUser,
}: {
  currentUser: User | null | undefined;
}): Promise<ProfileImageUploadResult | null> => {
  const asset = await pickProfileImageFromLibrary();
  if (!asset) return null;

  return uploadProfileImageToSupabase({
    asset,
    currentUser,
  });
};
