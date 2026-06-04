import { Platform } from 'react-native';
import { authenticatedFetch } from './apiClient';
import { uploadSignedSupabaseAsset } from './supabaseMediaService';
import { pickImageFromLibrary } from './nativePickerService';
import { saveSupabaseBranding } from './supabaseTenantDataService';

const MAX_LOGO_BYTES = 8 * 1024 * 1024;

export const pickInstituteLogo = async () => {
  const asset = await pickImageFromLibrary({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.92,
  });

  if (!asset) return null;

  if (asset.fileSize && asset.fileSize > MAX_LOGO_BYTES) {
    throw new Error('Institute logos must be smaller than 8 MB.');
  }

  return asset;
};

export const uploadInstituteLogo = async ({ currentUser, instituteId, asset }) => {
  if (!currentUser) {
    throw new Error('Sign in before uploading an institute logo.');
  }

  if (!instituteId) {
    throw new Error('Your profile is not linked to an institute.');
  }

  return uploadSignedSupabaseAsset({
    currentUser,
    asset,
    folder: 'institute-branding',
    instituteId,
    resourceType: 'image',
    context: {
      instituteId,
      platform: Platform.OS,
      purpose: 'institute-logo',
    },
  });
};

export const saveInstituteBranding = async ({
  currentUser,
  instituteId,
  logoUrl,
  paletteId,
}) => {
  const body = {
    instituteId,
    logoUrl: logoUrl || null,
    paletteId,
  };

  const [firebaseResult, supabaseResult] = await Promise.all([
    authenticatedFetch('/api/admin/branding', currentUser, {
      method: 'POST',
      body,
    }),
    saveSupabaseBranding(currentUser, body),
  ]);

  return {
    ...firebaseResult,
    supabase: supabaseResult,
  };
};
