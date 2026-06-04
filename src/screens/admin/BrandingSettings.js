import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import {
  INSTITUTION_BRANDING_PALETTES,
  getInstitutionBrandingPalette,
} from '../../constants/institutionBrandingPalettes';
import {
  pickInstituteLogo,
  saveInstituteBranding,
  uploadInstituteLogo,
} from '../../services/instituteBrandingService';
import { showNativeError } from '../../utils/userFeedback';

const showMessage = (title, message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message || title);
    return;
  }

  Alert.alert(title, message);
};

const getInitials = (name) => {
  const words = String(name || 'Edu Hub').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || 'EH';
};

const getPaletteTokens = (palette) => {
  const isLight = palette.mode === 'light';

  return {
    border: isLight ? '#CBD5E1' : '#334155',
    cardLabel: isLight ? '#0F172A' : '#F8FAFC',
    description: isLight ? '#475569' : '#94A3B8',
    modeBadgeBackground: isLight ? '#F1F5F9' : '#111827',
    modeBadgeText: isLight ? '#334155' : '#CBD5E1',
    name: isLight ? '#0F172A' : '#F8FAFC',
    swatchBorder: isLight ? '#94A3B8' : '#475569',
  };
};

function BrandPreview({ instituteName, logoUrl, palette }) {
  const initials = getInitials(instituteName);
  const tokens = getPaletteTokens(palette);

  return (
    <View style={[styles.previewShell, { backgroundColor: palette.backgroundColor, borderColor: tokens.border }]}>
      <View style={styles.previewHeader}>
        <View style={[styles.previewLogo, { backgroundColor: palette.primaryColor, borderColor: palette.accentColor }]}>
          {logoUrl ? (
            <Image
              accessibilityLabel={`${instituteName} logo preview`}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: logoUrl }}
              style={styles.previewLogoImage}
              transition={180}
            />
          ) : (
            <Text style={[styles.previewLogoText, { color: palette.accentColor }]}>{initials}</Text>
          )}
        </View>
        <View style={styles.previewCopy}>
          <Text numberOfLines={1} style={[styles.previewInstituteName, { color: tokens.name }]}>{instituteName}</Text>
          <Text style={[styles.previewSubtitle, { color: palette.accentColor }]}>Institute workspace</Text>
        </View>
        <View style={[styles.previewBell, { backgroundColor: palette.primaryColor, borderColor: palette.accentColor }]}>
          <Ionicons name="notifications-outline" size={20} color={palette.accentColor} />
        </View>
      </View>

      <View style={styles.previewCards}>
        <View style={[styles.previewCard, { backgroundColor: palette.primaryColor, borderColor: palette.accentColor }]}>
          <View style={[styles.previewCardIcon, { backgroundColor: palette.backgroundColor }]}>
            <Ionicons name="people" size={18} color={palette.accentColor} />
          </View>
          <Text style={[styles.previewCardLabel, { color: tokens.cardLabel }]}>People</Text>
        </View>
        <View style={[styles.previewCard, { backgroundColor: palette.secondaryColor, borderColor: palette.secondaryColor }]}>
          <View style={[styles.previewCardIcon, { backgroundColor: palette.backgroundColor }]}>
            <Ionicons name="calendar" size={18} color={palette.secondaryColor} />
          </View>
          <Text style={[styles.previewCardLabel, { color: tokens.cardLabel }]}>Schedule</Text>
        </View>
      </View>
    </View>
  );
}

function PaletteCard({ palette, selected, onPress }) {
  const tokens = getPaletteTokens(palette);

  return (
    <Pressable
      accessibilityLabel={`Use ${palette.name} palette`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        onPress();
      }}
      style={[
        styles.paletteCard,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: selected ? palette.accentColor : tokens.border,
        },
        selected && styles.paletteCardSelected,
      ]}
    >
      <View style={styles.paletteTopRow}>
        <View style={styles.swatchRow}>
          <View style={[styles.swatch, { backgroundColor: palette.primaryColor, borderColor: tokens.swatchBorder }]} />
          <View style={[styles.swatch, { backgroundColor: palette.secondaryColor, borderColor: tokens.swatchBorder }]} />
          <View style={[styles.swatch, { backgroundColor: palette.accentColor, borderColor: tokens.swatchBorder }]} />
        </View>
        {selected ? (
          <View style={[styles.selectedBadge, { backgroundColor: palette.accentColor, borderColor: palette.accentColor }]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        ) : (
          <View style={[styles.modeBadge, { backgroundColor: tokens.modeBadgeBackground, borderColor: tokens.border }]}>
            <Text style={[styles.modeBadgeText, { color: tokens.modeBadgeText }]}>
              {palette.mode === 'light' ? 'Light' : 'Dark'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.paletteName, { color: tokens.name }]}>{palette.name}</Text>
      <Text style={[styles.paletteDescription, { color: tokens.description }]}>{palette.description}</Text>
    </Pressable>
  );
}

export default function BrandingSettings() {
  const { currentUser, userData } = useAuth();
  const { instituteData } = useInstitution();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const institutionType = instituteData?.institutionType || instituteData?.type || 'SCHOOL';
  const savedPaletteId = instituteData?.branding?.paletteId ||
    instituteData?.settings?.branding?.paletteId ||
    getInstitutionBrandingPalette(null, institutionType).id;
  const savedLogoUrl = instituteData?.branding?.logoUrl ||
    instituteData?.settings?.branding?.logoUrl ||
    instituteData?.logoUrl ||
    null;
  const instituteName = instituteData?.name || 'Your Institute';
  const [selectedPaletteId, setSelectedPaletteId] = useState(savedPaletteId);
  const [logoUrl, setLogoUrl] = useState(savedLogoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const selectedPalette = useMemo(
    () => getInstitutionBrandingPalette(selectedPaletteId, institutionType),
    [institutionType, selectedPaletteId]
  );

  useEffect(() => {
    setSelectedPaletteId(savedPaletteId);
    setLogoUrl(savedLogoUrl);
    setDirty(false);
  }, [savedLogoUrl, savedPaletteId]);

  const selectPalette = (paletteId) => {
    setSelectedPaletteId(paletteId);
    setDirty(paletteId !== savedPaletteId || logoUrl !== savedLogoUrl);
  };

  const chooseLogo = async () => {
    if (uploadingLogo || saving) return;

    try {
      const asset = await pickInstituteLogo();
      if (!asset) return;

      setUploadingLogo(true);
      const upload = await uploadInstituteLogo({
        asset,
        currentUser,
        instituteId: userData?.instituteId,
      });
      setLogoUrl(upload.secureUrl);
      setDirty(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showNativeError('Logo Upload Failed', error, 'The institute logo could not be uploaded.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
    setDirty(selectedPaletteId !== savedPaletteId || savedLogoUrl !== null);
  };

  const saveBranding = async () => {
    if (saving || uploadingLogo || !dirty) return;

    try {
      setSaving(true);
      await saveInstituteBranding({
        currentUser,
        instituteId: userData?.instituteId,
        logoUrl,
        paletteId: selectedPalette.id,
      });
      setDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showMessage('Branding Saved', 'Your institute logo and palette are now live across Edu Shii.');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showMessage('Save Failed', error.message || 'The institute branding could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Brand Studio" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingBottom: spacing.xxl + 24,
            paddingHorizontal: spacing.pageX,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.introCard, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.introIcon, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
            <Ionicons name="color-palette-outline" size={24} color={colors.accent} />
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>Institute identity</Text>
            <Text style={[styles.title, { color: colors.text }]}>Choose your visual signature</Text>
            <Text style={[styles.subtitle, { color: colors.textSoft }]}>
              Select a polished palette and upload a square logo. Changes apply to your institute only.
            </Text>
          </View>
        </View>

        <BrandPreview
          instituteName={instituteName}
          logoUrl={logoUrl}
          palette={selectedPalette}
        />

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: colors.muted }]}>Logo</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Institute mark</Text>
          </View>
          <View style={[styles.cloudinaryBadge, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
            <Ionicons name="cloud-done-outline" size={15} color={colors.accent} />
            <Text style={[styles.cloudinaryText, { color: colors.textSoft }]}>Supabase media</Text>
          </View>
        </View>

        <View style={[styles.logoPanel, { backgroundColor: colors.card, borderColor: colors.hairline, borderRadius: radii.card }]}>
          <View style={[styles.logoOrb, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
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
              <Text style={[styles.logoInitials, { color: colors.accent }]}>{getInitials(instituteName)}</Text>
            )}
            {uploadingLogo ? (
              <View style={styles.logoLoadingOverlay}>
                <SmoothSpinner color="#FFFFFF" size={30} />
              </View>
            ) : null}
          </View>
          <View style={styles.logoActions}>
            <TouchableOpacity
              disabled={uploadingLogo || saving}
              onPress={chooseLogo}
              style={[styles.primaryAction, { backgroundColor: colors.deepBlue, borderColor: colors.accentSoft }]}
            >
              {uploadingLogo ? (
                <SmoothSpinner color="#FFFFFF" size={20} />
              ) : (
                <Ionicons name="image-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.primaryActionText}>{uploadingLogo ? 'Uploading...' : 'Choose Logo'}</Text>
            </TouchableOpacity>
            {logoUrl ? (
              <TouchableOpacity
                disabled={uploadingLogo || saving}
                onPress={removeLogo}
                style={[styles.secondaryAction, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}
              >
                <Ionicons name="close-circle-outline" size={18} color="#FCA5A5" />
                <Text style={styles.secondaryActionText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: colors.muted }]}>Color palette</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Curated light and dark themes</Text>
          </View>
        </View>

        <View style={styles.paletteGrid}>
          {INSTITUTION_BRANDING_PALETTES.map((palette) => (
            <PaletteCard
              key={palette.id}
              onPress={() => selectPalette(palette.id)}
              palette={palette}
              selected={selectedPalette.id === palette.id}
            />
          ))}
        </View>

        <TouchableOpacity
          accessibilityLabel="Save institute branding"
          disabled={!dirty || saving || uploadingLogo}
          onPress={saveBranding}
          style={[
            styles.saveButton,
            {
              backgroundColor: selectedPalette.primaryColor,
              borderColor: selectedPalette.accentColor,
            },
            (!dirty || saving || uploadingLogo) && styles.saveButtonDisabled,
          ]}
        >
          {saving ? (
            <SmoothSpinner color="#FFFFFF" size={22} />
          ) : (
            <Ionicons name="sparkles" size={19} color="#FFFFFF" />
          )}
          <Text style={styles.saveButtonText}>{saving ? 'Saving Brand...' : 'Apply Brand to Institute'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cloudinaryBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  cloudinaryText: {
    fontSize: 11,
    fontWeight: '800',
  },
  content: {
    alignSelf: 'center',
    paddingTop: 18,
    width: '100%',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  introCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 18,
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
  },
  introIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    marginRight: 14,
    width: 56,
  },
  logoActions: {
    flex: 1,
    gap: 10,
    minWidth: 180,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoInitials: {
    fontSize: 28,
    fontWeight: '900',
  },
  logoLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: '#020617',
    justifyContent: 'center',
  },
  logoOrb: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 104,
    justifyContent: 'center',
    marginRight: 18,
    overflow: 'hidden',
    width: 104,
  },
  logoPanel: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
    padding: 18,
  },
  paletteCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 142,
    minWidth: 180,
    padding: 16,
  },
  paletteCardSelected: {
    borderWidth: 2,
  },
  paletteDescription: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 5,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 22,
  },
  paletteName: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 18,
  },
  paletteTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewBell: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  previewCard: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 78,
    padding: 12,
  },
  previewCardIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  previewCardLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
  },
  previewCards: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  previewCopy: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  previewInstituteName: {
    fontSize: 16,
    fontWeight: '900',
  },
  previewLogo: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  previewLogoImage: {
    height: '100%',
    width: '100%',
  },
  previewLogoText: {
    fontSize: 15,
    fontWeight: '900',
  },
  previewShell: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
    padding: 18,
  },
  previewSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
  },
  selectedBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  modeBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 5,
  },
  swatch: {
    borderRadius: 8,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
});
