import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { SkeletonBlock } from '../ui/LoadingState';

type LoadingProfile = {
  instituteData?: {
    branding?: {
      logoUrl?: string | null;
    };
    logoUrl?: string | null;
    name?: string | null;
    settings?: {
      branding?: {
        logoUrl?: string | null;
      };
    };
  } | null;
  instituteName?: string | null;
};

type AuthValue = {
  authStage?: string;
  cachedInstituteIdentity?: {
    instituteName?: string | null;
    logoUrl?: string | null;
  } | null;
  loadingProfile?: LoadingProfile | null;
};

const getInitials = (name: string) => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join('') || 'EH';

export default function InstituteSyncSplash() {
  const { authStage, cachedInstituteIdentity, loadingProfile } = useAuth() as AuthValue;
  const { colors, radii, spacing } = useRootLayout();
  const insets = useSafeAreaInsets();

  const instituteData = loadingProfile?.instituteData || null;
  const instituteName = instituteData?.name ||
    loadingProfile?.instituteName ||
    cachedInstituteIdentity?.instituteName ||
    'Shii-Edu';
  const logoUrl = instituteData?.branding?.logoUrl ||
    instituteData?.settings?.branding?.logoUrl ||
    instituteData?.logoUrl ||
    cachedInstituteIdentity?.logoUrl ||
    null;
  const stageLabel = authStage === 'verifying'
    ? 'Preparing your institute workspace'
    : authStage === 'biometric-verifying'
      ? 'Confirming biometric access'
      : 'Synchronizing your secure workspace';
  const initials = useMemo(() => getInitials(instituteName), [instituteName]);

  return (
    <View
      accessibilityLabel={`${stageLabel} for ${instituteName}`}
      accessibilityRole="progressbar"
      style={[
        styles.screen,
        {
          backgroundColor: colors.page,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
          paddingTop: Math.max(insets.top, spacing.lg),
        },
      ]}
    >
      <View style={styles.center}>
        <View style={styles.logoStage}>
          <View
            style={[
              styles.logoFrame,
              {
                backgroundColor: colors.cardStrong,
                borderColor: colors.hairline,
                borderRadius: radii.card,
              },
            ]}
          >
            {logoUrl ? (
              <Image
                accessibilityLabel={`${instituteName} logo`}
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: logoUrl }}
                style={styles.logoImage}
                transition={180}
              />
            ) : (
              <Text style={[styles.initials, { color: colors.accent }]}>{initials}</Text>
            )}
          </View>
        </View>

        <Text numberOfLines={2} style={[styles.instituteName, { color: colors.text }]}>
          {instituteName}
        </Text>
        <Text style={[styles.stageLabel, { color: colors.textSoft }]}>{stageLabel}</Text>

        <View style={styles.progressRow}>
          <View style={styles.progressSkeleton}>
            <SkeletonBlock height={4} radius={8} width="100%" />
            <SkeletonBlock height={4} radius={8} width="64%" />
          </View>
          <View style={[styles.securePill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
            <Ionicons name="shield-checkmark" size={15} color={colors.accent} />
            <Text style={[styles.secureText, { color: colors.textSoft }]}>Verified institute session</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
  },
  initials: {
    fontSize: 38,
    fontWeight: '900',
  },
  instituteName: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 26,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  logoFrame: {
    alignItems: 'center',
    borderWidth: 1,
    height: 112,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 112,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoStage: {
    alignItems: 'center',
    height: 128,
    justifyContent: 'center',
    width: 128,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
  },
  progressSkeleton: {
    gap: 4,
    width: 46,
  },
  screen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  securePill: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secureText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stageLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
});
