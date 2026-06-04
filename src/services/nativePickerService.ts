import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export type ImageLibrarySelectionOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

export type DocumentSelectionOptions = {
  mimeTypes: string | string[];
};

const asError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error && error.message.trim()) return error;
  return new Error(fallbackMessage);
};

const permissionIsGranted = (
  permission: ImagePicker.MediaLibraryPermissionResponse
): boolean => (
  permission.granted === true ||
  permission.status === ImagePicker.PermissionStatus.GRANTED
);

export const pickImageFromLibrary = async ({
  allowsEditing = false,
  aspect,
  quality = 0.9,
}: ImageLibrarySelectionOptions = {}): Promise<ImagePicker.ImagePickerAsset | null> => {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionIsGranted(permission)) {
        throw new Error('Gallery access is required to choose an image.');
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing,
      aspect,
      base64: false,
      exif: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality,
    });

    if (result.canceled) return null;

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      throw new Error('The image picker did not return a readable file.');
    }

    return asset;
  } catch (error) {
    throw asError(error, 'The image picker could not be opened. Please try again.');
  }
};

export const pickSingleDocument = async ({
  mimeTypes,
}: DocumentSelectionOptions): Promise<DocumentPicker.DocumentPickerAsset | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      base64: Platform.OS === 'web',
      copyToCacheDirectory: true,
      multiple: false,
      type: mimeTypes,
    });

    if (result.canceled) return null;

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      throw new Error('The document picker did not return a readable file.');
    }

    return asset;
  } catch (error) {
    throw asError(error, 'The document picker could not be opened. Please try again.');
  }
};
