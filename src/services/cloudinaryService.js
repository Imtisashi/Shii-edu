import { Platform } from 'react-native';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '../../firebaseConfig';
import { uploadSignedCloudinaryAsset } from './cloudinaryMediaService';

const sanitizePathPart = (value) => String(value || 'general').replace(/[^a-zA-Z0-9/_-]/g, '') || 'general';
const IMAGE_MIME_PREFIX = 'image/';
const PDF_MIME_TYPE = 'application/pdf';

const getAssetMimeType = (asset, blob) => String(asset?.mimeType || asset?.type || blob?.type || '').toLowerCase();
const getAssetFileName = (asset, fallback = 'upload') => asset?.name || asset?.fileName || `${fallback}-${Date.now()}`;
const isPdfAsset = (asset, blob) => {
  const mimeType = getAssetMimeType(asset, blob);
  const fileName = String(getAssetFileName(asset, '')).toLowerCase();
  return mimeType === PDF_MIME_TYPE || fileName.endsWith('.pdf');
};

const resolveResourceType = (asset, blob) => {
  const mimeType = getAssetMimeType(asset, blob);
  if (isPdfAsset(asset, blob)) return 'raw';
  if (mimeType.startsWith('video/')) return 'video';
  return 'image';
};

const assertAllowedUploadAsset = (asset, blob) => {
  const mimeType = getAssetMimeType(asset, blob);
  const fileName = String(getAssetFileName(asset, '')).toLowerCase();
  const isImage = mimeType.startsWith(IMAGE_MIME_PREFIX);
  const isPdf = mimeType === PDF_MIME_TYPE || fileName.endsWith('.pdf');
  const isVideo = mimeType.startsWith('video/');

  if (!isImage && !isPdf && !isVideo) {
    throw new Error('Only image, PDF, and video uploads are supported.');
  }
};

const createUploadName = (asset, blob) => {
  const fileName = getAssetFileName(asset, '');
  const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : '';
  const mimeType = getAssetMimeType(asset, blob) || 'image/png';
  const extension = fileExtension || mimeType.split('/')[1]?.split(';')[0] || 'png';
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
  assertAllowedUploadAsset(asset, blob);
  const uploadRef = ref(storage, `uploads/${sanitizePathPart(folder)}/${createUploadName(asset, blob)}`);
  const metadata = blob?.type ? { contentType: blob.type } : undefined;
  await uploadBytes(uploadRef, blob, metadata);
  const downloadUrl = await getDownloadURL(uploadRef);
  return {
    provider: 'firebase-storage',
    secureUrl: downloadUrl,
    url: downloadUrl,
    resourceType: resolveResourceType(asset, blob),
    mimeType: getAssetMimeType(asset, blob),
    bytes: blob?.size || asset?.size || null,
    originalFilename: getAssetFileName(asset, 'upload'),
  };
};

export const uploadInstitutionAsset = async ({
  asset,
  folder = 'general',
  resourceType,
  deliveryType,
  context = {},
  allowStorageFallback = true,
}) => {
  const assetUri = typeof asset === 'string' ? asset : asset?.uri;
  if (!assetUri) {
    throw new Error('No file was selected for upload.');
  }

  const probeBlob = Platform.OS === 'web' ? await assetToBlob(assetUri) : null;
  assertAllowedUploadAsset(asset, probeBlob);
  const resolvedResourceType = resourceType || resolveResourceType(asset, probeBlob);

  try {
    if (!auth.currentUser) {
      throw new Error('A signed-in user is required for signed Cloudinary uploads.');
    }

    const cloudinaryAsset = await uploadSignedCloudinaryAsset({
      currentUser: auth.currentUser,
      asset,
      folder,
      resourceType: resolvedResourceType,
      deliveryType: deliveryType || (resolvedResourceType === 'video' ? 'authenticated' : 'upload'),
      context: {
        originalFileName: getAssetFileName(asset, 'upload'),
        ...context,
      },
    });

    return {
      provider: 'cloudinary',
      secureUrl: cloudinaryAsset.secure_url,
      url: cloudinaryAsset.secure_url,
      publicId: cloudinaryAsset.public_id,
      assetId: cloudinaryAsset.asset_id,
      resourceType: cloudinaryAsset.resource_type || resolvedResourceType,
      deliveryType: cloudinaryAsset.type,
      format: cloudinaryAsset.format || null,
      bytes: cloudinaryAsset.bytes || probeBlob?.size || asset?.size || null,
      width: cloudinaryAsset.width || null,
      height: cloudinaryAsset.height || null,
      mimeType: getAssetMimeType(asset, probeBlob),
      originalFilename: cloudinaryAsset.original_filename || getAssetFileName(asset, 'upload'),
    };
  } catch (error) {
    console.error('Signed Cloudinary upload error:', error.message);
    if (!allowStorageFallback) throw error;
    return uploadToFirebaseStorage(asset, folder);
  }
};

export const uploadToCloudinary = async (asset, folder = 'general') => {
  try {
    const uploadResult = await uploadInstitutionAsset({ asset, folder });
    return uploadResult.secureUrl;
  } catch (error) {
    console.error('Upload error:', error.message);
    return null;
  }
};
