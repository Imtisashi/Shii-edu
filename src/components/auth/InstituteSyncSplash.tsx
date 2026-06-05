import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
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
  .join('') || 'SE';

export default function InstituteSyncSplash() {
  const { authStage, cachedInstituteIdentity, loadingProfile } = useAuth() as AuthValue;
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
          paddingBottom: Math.max(insets.bottom, 22),
          paddingTop: Math.max(insets.top, 22),
        },
      ]}
    >
      <View style={styles.shell}>
        <View style={styles.brandRow}>
          <View style={styles.logoFrame}>
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
              <Text style={styles.initials}>{initials}</Text>
            )}
          </View>
          <View style={styles.brandCopy}>
            <Text numberOfLines={1} style={styles.instituteName}>
              {instituteName}
            </Text>
            <Text style={styles.stageLabel}>{stageLabel}</Text>
          </View>
        </View>

        <View style={styles.dashboardSkeleton}>
          <View style={styles.skeletonHero}>
            <SkeletonBlock height={56} radius={8} width={56} />
            <View style={styles.skeletonCopy}>
              <SkeletonBlock height={12} width="38%" />
              <SkeletonBlock height={26} style={styles.skeletonGap} width="74%" />
              <SkeletonBlock height={48} radius={8} style={styles.skeletonGap} width="100%" />
            </View>
          </View>

          <View style={styles.tileGrid}>
            {[0, 1, 2, 3].map((tile) => (
              <View style={styles.tile} key={tile}>
                <SkeletonBlock height={42} radius={8} width={42} />
                <View style={styles.tileCopy}>
                  <SkeletonBlock height={14} width={tile % 2 === 0 ? '64%' : '52%'} />
                  <SkeletonBlock height={10} style={styles.skeletonGapSmall} width="86%" />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.noticeSkeleton}>
            <SkeletonBlock height={17} width="42%" />
            <SkeletonBlock height={44} radius={8} style={styles.skeletonGap} width="100%" />
            <SkeletonBlock height={44} radius={8} style={styles.skeletonGapSmall} width="100%" />
          </View>
        </View>

        <View style={styles.securePill}>
          <Ionicons name="shield-checkmark" size={15} color="#635BFF" />
          <Text style={styles.secureText}>Verified institute session</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  dashboardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
    width: '100%',
  },
  initials: {
    color: '#635BFF',
    fontSize: 28,
    fontWeight: '900',
  },
  instituteName: {
    color: '#010110',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  logoFrame: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 68,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  noticeSkeleton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  screen: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 18,
  },
  securePill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secureText: {
    color: '#4B4B5F',
    fontSize: 12,
    fontWeight: '800',
  },
  shell: {
    gap: 18,
    maxWidth: 560,
    width: '100%',
  },
  skeletonCopy: {
    flex: 1,
    minWidth: 0,
  },
  skeletonGap: {
    marginTop: 9,
  },
  skeletonGapSmall: {
    marginTop: 7,
  },
  skeletonHero: {
    alignItems: 'center',
    backgroundColor: '#F7F7FB',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  stageLabel: {
    color: '#4B4B5F',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  tile: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48.5%',
    flexDirection: 'row',
    gap: 10,
    minHeight: 76,
    padding: 12,
  },
  tileCopy: {
    flex: 1,
    minWidth: 0,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
});
