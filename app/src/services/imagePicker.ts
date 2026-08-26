import * as ImagePicker from 'expo-image-picker';

/** Shape `api.postForm`/`putForm` append to a React Native FormData. */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

const toFile = (asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickedFile => {
  const extension = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName || `${fallbackName}.${extension}`,
    type: asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
  };
};

/**
 * Deposit slips and KYC photos are read by a human on the other end, so they
 * are compressed but not downscaled to thumbnails. Returns null when the user
 * cancels or denies the permission — callers treat both as "no file".
 */
export const pickImage = async (
  source: 'library' | 'camera',
  fallbackName = 'upload'
): Promise<PickedFile | null> => {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: source === 'library',
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) return null;
  return toFile(result.assets[0], fallbackName);
};
