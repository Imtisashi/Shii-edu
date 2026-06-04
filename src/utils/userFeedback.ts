import { Alert, Platform, ToastAndroid } from 'react-native';

export const getReadableErrorMessage = (
  error: unknown,
  fallbackMessage: string
): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallbackMessage;
};

export const showNativeError = (
  title: string,
  error: unknown,
  fallbackMessage: string
): void => {
  const message = getReadableErrorMessage(error, fallbackMessage);

  if (Platform.OS === 'android') {
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
};

export const showNativeMessage = (
  title: string,
  message: string
): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
};
