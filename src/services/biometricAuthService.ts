import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricCapability = {
  available: boolean;
  label: 'Biometrics' | 'Face ID' | 'Fingerprint';
  reason: string | null;
};

const unavailableCapability = (reason: string): BiometricCapability => ({
  available: false,
  label: 'Biometrics',
  reason,
});

export const getBiometricCapability = async (): Promise<BiometricCapability> => {
  if (Platform.OS === 'web') {
    return unavailableCapability('Biometric sign-in is available in the installed mobile app.');
  }

  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    if (!hasHardware) {
      return unavailableCapability('This device does not have biometric authentication hardware.');
    }

    if (!isEnrolled) {
      return unavailableCapability('Set up Face ID or fingerprint authentication in your device settings first.');
    }

    const supportsFace = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
    );
    const supportsFingerprint = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT
    );

    return {
      available: true,
      label: supportsFace ? 'Face ID' : supportsFingerprint ? 'Fingerprint' : 'Biometrics',
      reason: null,
    };
  } catch (error) {
    console.warn('Failed to inspect biometric authentication capability.', error);
    return unavailableCapability('Biometric authentication is temporarily unavailable.');
  }
};

export const authenticateInstituteSession = async (
  instituteName: string
): Promise<void> => {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    throw new Error(capability.reason || 'Biometric authentication is unavailable.');
  }

  const result = await LocalAuthentication.authenticateAsync({
    biometricsSecurityLevel: 'strong',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use device passcode',
    promptDescription: `Unlock your secure ${instituteName} session.`,
    promptMessage: `Sign in to ${instituteName}`,
    promptSubtitle: `Use ${capability.label} to continue`,
  });

  if (!result.success) {
    const cancelled = result.error === 'user_cancel' ||
      result.error === 'app_cancel' ||
      result.error === 'system_cancel';
    throw new Error(cancelled
      ? 'Biometric sign-in was cancelled.'
      : 'Biometric authentication failed. Sign in with your password to continue.');
  }
};
