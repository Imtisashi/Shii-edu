/* eslint-disable react-hooks/immutability */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { pickAndUploadProfileImage, ProfileImageUploadResult } from '../../services/profileImageUpload';
import { updateSupabaseProfileMedia } from '../../services/supabaseTenantDataService';
import { showNativeError } from '../../utils/userFeedback';

type EditableProfileAvatarProps = {
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type AuthUserData = {
  email?: string;
  name?: string;
  photoURL?: string;
  photoUrl?: string;
  profilePic?: string;
  role?: string;
  uid?: string;
};

const pressTiming = {
  duration: 110,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
};

const extractInitials = (name?: string, email?: string): string => {
  const source = (name || email || 'Edu Hub').trim();
  const words = source
    .replace(/@.*/, '')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 1).toUpperCase() || 'E';
};

const getReadableError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'The profile picture could not be updated. Please try again.';
};

const buildFirestoreProfilePayload = (upload: ProfileImageUploadResult) => ({
  photoURL: upload.secureUrl,
  profilePic: upload.secureUrl,
  profileUpdatedAt: serverTimestamp(),
  supabaseProfileImage: {
    assetId: upload.assetId,
    bytes: upload.bytes,
    format: upload.format,
    height: upload.height,
    provider: upload.provider,
    publicId: upload.publicId,
    storageBucket: upload.storageBucket,
    storagePath: upload.storagePath,
    supabasePath: upload.supabasePath,
    transformation: upload.transformation,
    updatedAt: serverTimestamp(),
    width: upload.width,
  },
  updatedAt: serverTimestamp(),
});

const buildSupabaseProfileMediaPayload = (upload: ProfileImageUploadResult) => ({
  assetId: upload.assetId,
  bytes: upload.bytes,
  format: upload.format,
  height: upload.height,
  mimeType: upload.mimeType,
  provider: upload.provider,
  publicId: upload.publicId,
  secureUrl: upload.secureUrl,
  storageBucket: upload.storageBucket,
  storagePath: upload.storagePath,
  supabasePath: upload.supabasePath,
  transformation: upload.transformation,
  width: upload.width,
});

export default function EditableProfileAvatar({
  disabled = false,
  size = 72,
  style,
}: EditableProfileAvatarProps) {
  const { currentUser, userData } = useAuth() as {
    currentUser: User | null;
    userData: AuthUserData | null;
  };
  const { colors, radii } = useRootLayout();
  const [uploading, setUploading] = useState(false);
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null);
  const press = useSharedValue(0);
  const normalizedRole = String(userData?.role || '').trim().toLowerCase();
  const canEdit = !disabled && ['admin', 'teacher', 'professor', 'superadmin'].includes(normalizedRole);

  const profileImageUrl = optimisticUrl || userData?.photoURL || userData?.photoUrl || userData?.profilePic || null;
  const initials = useMemo(
    () => extractInitials(userData?.name, userData?.email),
    [userData?.email, userData?.name]
  );
  const radius = size / 2;
  const badgeSize = Math.max(26, Math.round(size * 0.34));
  const iconSize = Math.max(14, Math.round(size * 0.17));

  useEffect(() => {
    const latestUrl = userData?.photoURL || userData?.photoUrl || userData?.profilePic || null;
    if (latestUrl && latestUrl === optimisticUrl) {
      setOptimisticUrl(null);
    }
  }, [optimisticUrl, userData?.photoURL, userData?.photoUrl, userData?.profilePic]);

  const shellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(press.value, [0, 1], [1, 0.985]),
      },
    ],
  }));

  const updateProfilePicture = async () => {
    if (uploading || !canEdit) return;

    const previousUrl = profileImageUrl;

    try {
      setUploading(true);

      const upload = await pickAndUploadProfileImage({
        currentUser,
      });

      if (!upload) {
        setUploading(false);
        return;
      }

      setOptimisticUrl(upload.secureUrl);

      if (!currentUser?.uid) {
        throw new Error('Your session expired before the profile could be saved.');
      }

      await Promise.all([
        updateSupabaseProfileMedia(currentUser, buildSupabaseProfileMediaPayload(upload)),
        updateDoc(doc(db, 'users', currentUser.uid), buildFirestoreProfilePayload(upload)),
      ]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Profile updated', 'Your profile picture has been saved.');
    } catch (error) {
      setOptimisticUrl(previousUrl || null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showNativeError('Upload failed', error, getReadableError(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Pressable
      accessibilityHint={canEdit ? 'Opens your gallery and uploads a new profile picture.' : undefined}
      accessibilityLabel={canEdit ? 'Edit profile picture' : 'Profile picture'}
      accessibilityRole={canEdit ? 'button' : 'image'}
      disabled={!canEdit || uploading}
      onPress={updateProfilePicture}
      onPressIn={() => {
        press.value = withTiming(1, pressTiming);
      }}
      onPressOut={() => {
        press.value = withTiming(0, pressTiming);
      }}
      style={[{ height: size, width: size }, style]}
    >
      <Animated.View style={[styles.shell, { borderRadius: radius }, shellAnimatedStyle]}>
        <View
          style={[
            styles.avatarFrame,
            {
              backgroundColor: colors.cardStrong,
              borderColor: colors.hairline,
              borderRadius: radius,
              height: size,
              width: size,
            },
          ]}
        >
          {profileImageUrl ? (
            <Image
              accessibilityIgnoresInvertColors
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: profileImageUrl }}
              style={[styles.avatarImage, { borderRadius: radius }]}
              transition={120}
            />
          ) : (
            <View style={[styles.initialsLayer, { backgroundColor: colors.pageElevated }]}>
              <Text style={[styles.initials, { color: colors.accent, fontSize: Math.max(20, Math.round(size * 0.34)) }]}>
                {initials}
              </Text>
            </View>
          )}

          {uploading ? (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.cardStrong }]}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : null}
        </View>

        {canEdit ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.accent,
                borderColor: colors.cardStrong,
                borderRadius: Math.min(radii.control, badgeSize / 2),
                height: badgeSize,
                right: -2,
                width: badgeSize,
              },
            ]}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="camera" size={iconSize} color="#FFFFFF" />
            )}
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarFrame: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    width: '100%',
  },
  badge: {
    alignItems: 'center',
    borderWidth: 2,
    bottom: -2,
    justifyContent: 'center',
    position: 'absolute',
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0,
  },
  initialsLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: {
    position: 'relative',
  },
});
