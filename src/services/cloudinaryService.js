import { Platform } from 'react-native';

export const uploadToCloudinary = async (asset, folder = 'general') => {
  try {
    const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    const assetUri = typeof asset === 'string' ? asset : asset?.uri;

    if (!CLOUD_NAME || !UPLOAD_PRESET || !assetUri) {
      throw new Error('Cloudinary upload is not configured correctly.');
    }

    const formData = new FormData();
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('transformation', 'w_800,c_limit,q_auto:good,f_auto');

    if (folder) {
      formData.append('folder', String(folder).replace(/[^a-zA-Z0-9/_-]/g, ''));
    }

    if (Platform.OS === 'web') {
      const res = await fetch(assetUri);
      const blob = await res.blob();
      formData.append('file', blob);
    } else {
      formData.append('file', {
        uri: assetUri,
        type: asset.mimeType || 'image/png',
        name: 'upload.png',
      });
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cloudinary upload failed:', data.error?.message || response.status);
      return null;
    }

    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    return null;
  }
};
