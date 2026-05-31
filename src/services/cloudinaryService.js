import { Platform } from 'react-native';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebaseConfig';

const sanitizePathPart = (value) => String(value || 'general').replace(/[^a-zA-Z0-9/_-]/g, '') || 'general';
const createUploadName = (asset, blob) => {
  const mimeType = asset?.mimeType || blob?.type || 'image/png';
  const extension = mimeType.split('/')[1]?.split(';')[0] || 'png';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
};

const assetToBlob = async (assetUri) => {
  const response = await fetch(assetUri);
  if (!response.ok && Platform.OS === 'web') {
    throw new Error('Could not read the selected file.');
  }

  return response.blob();
};

const uploadToFirebaseStorage = async (asset, folder) => {
  const assetUri = typeof asset === 'string' ? asset : asset?.uri;
  if (!assetUri) {
    throw new Error('No file was selected for upload.');
  }

  const blob = await assetToBlob(assetUri);
  const uploadRef = ref(storage, `uploads/${sanitizePathPart(folder)}/${createUploadName(asset, blob)}`);
  const metadata = blob?.type ? { contentType: blob.type } : undefined;
  await uploadBytes(uploadRef, blob, metadata);
  return getDownloadURL(uploadRef);
};

export const uploadToCloudinary = async (asset, folder = 'general') => {
  try {
    const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    const assetUri = typeof asset === 'string' ? asset : asset?.uri;

    if (!assetUri) {
      throw new Error('No file was selected for upload.');
    }

    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return uploadToFirebaseStorage(asset, folder);
    }

    const formData = new FormData();
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('transformation', 'w_800,c_limit,q_auto:good,f_auto');

    if (folder) {
      formData.append('folder', sanitizePathPart(folder));
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
      return uploadToFirebaseStorage(asset, folder);
    }

    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    return null;
  }
};
