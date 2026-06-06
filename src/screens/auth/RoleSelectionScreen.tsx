import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import BrandWordmark from '../../components/BrandWordmark';
import DownloadAppAction from '../../components/auth/DownloadAppAction';
import EnterpriseAuthBackground from '../../components/auth/EnterpriseAuthBackground';
import PwaNotificationPrompt from '../../components/auth/PwaNotificationPrompt';
import { AUTH_ROLE_OPTIONS, type AuthRoleOption } from '../../constants/authRoles';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const goToWebPath = (path: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
  }
};

function RoleCard({ option }: { option: AuthRoleOption }) {
  const navigation = useNavigation<any>();

  const openAuth = () => {
    goToWebPath(option.authPath);
    navigation.navigate(option.routeName, { initialRole: option.id });
  };

  return (
    <View style={[styles.roleCard, { borderColor: option.border, backgroundColor: option.soft }]}>
      <View style={[styles.roleAccentBar, { backgroundColor: option.accent }]} />
      <View style={styles.roleCardTop}>
        <View style={[styles.roleIcon, { borderColor: option.border }]}>
          <Ionicons name={option.icon} size={25} color={option.accent} />
        </View>
        <View style={styles.roleTitleBlock}>
          <Text style={styles.roleLabel}>{option.label}</Text>
          <Text style={styles.roleTitle}>{option.title}</Text>
        </View>
      </View>
      <Text style={styles.roleCopy}>{option.copy}</Text>
      <View style={styles.featureList}>
        {option.features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Ionicons name="checkmark-circle-outline" size={17} color={option.accent} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.roleCardMeta, { borderColor: option.border, backgroundColor: '#FFFFFF' }]}>
        <Ionicons name="phone-portrait-outline" size={16} color={option.accent} />
        <Text style={styles.roleCardMetaText}>Installable PWA with a dedicated start screen</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue as ${option.label}`}
        onPress={openAuth}
        style={({ pressed }) => [
          styles.primaryAction,
          { backgroundColor: option.accent, opacity: pressed ? 0.86 : 1 },
        ]}
      >
        <Text style={styles.primaryActionText}>Continue as {option.label}</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
      <DownloadAppAction
        accentColor={option.accent}
        appName={`Shii-Edu ${option.shortName}`}
        borderColor={option.border}
        manifestHref={option.manifestHref}
        softColor="#FFFFFF"
        startUrl={option.authPath}
        style={styles.downloadAction}
      />
      <PwaNotificationPrompt
        accentColor={option.accent}
        borderColor={option.border}
        roleLabel={option.shortName}
        softColor="#FFFFFF"
        style={styles.notificationPrompt}
      />
    </View>
  );
}

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const columns = useMemo(() => (layout.isDesktop ? styles.roleGridDesktop : styles.roleGridMobile), [layout.isDesktop]);

  return (
    <EnterpriseAuthBackground backgroundColor="#FFFFFF">
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: Math.max(insets.top + 18, layout.isMobile ? 24 : 36),
              paddingBottom: Math.max(insets.bottom + 18, layout.isMobile ? 24 : 36),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroPanel}>
            <View style={styles.brandRow}>
              <View style={styles.logoCell}>
                <BrandLogo size={44} style={undefined} />
              </View>
              <View>
                <BrandWordmark color="#010110" size={layout.isMobile ? 'sm' : 'md'} />
                <Text style={styles.brandCaption}>Choose the right Shii-Edu app</Text>
              </View>
            </View>
            <Text style={[styles.title, layout.isMobile && styles.titleMobile]}>
              Choose your role.
            </Text>
            <Text style={styles.subtitle}>
              Institute, Parents, and Driver access open different auth paths, app names, manifests, and notification
              contexts so each user lands in the right workspace.
            </Text>
            <View style={styles.heroMetaRow}>
              {AUTH_ROLE_OPTIONS.map((option) => (
                <View key={option.id} style={[styles.heroMetaChip, { borderColor: option.border, backgroundColor: option.soft }]}>
                  <Ionicons name={option.icon} size={15} color={option.accent} />
                  <Text style={styles.heroMetaText}>{option.shortName}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.roleGrid, columns]}>
            {AUTH_ROLE_OPTIONS.map((option) => (
              <RoleCard key={option.id} option={option} />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </EnterpriseAuthBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { backgroundColor: '#FFFFFF', flex: 1 },
  container: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: 18,
  },
  heroPanel: {
    maxWidth: 980,
    width: '100%',
    borderColor: '#D9D8E8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    padding: 22,
  },
  heroMetaChip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  heroMetaText: {
    color: '#1E1F2F',
    fontSize: 12,
    fontWeight: '900',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  logoCell: {
    alignItems: 'center',
    backgroundColor: '#F7F6FF',
    borderColor: '#D9D7FF',
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  brandCaption: {
    color: '#4B4B5F',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  title: {
    color: '#010110',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 39,
    marginTop: 22,
    maxWidth: 640,
  },
  titleMobile: {
    fontSize: 28,
    lineHeight: 33,
  },
  subtitle: {
    color: '#3F4054',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 720,
  },
  roleGrid: {
    gap: 12,
    marginTop: 14,
    maxWidth: 980,
    width: '100%',
  },
  roleGridDesktop: {
    flexDirection: 'row',
  },
  roleGridMobile: {
    flexDirection: 'column',
  },
  roleCard: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    padding: 16,
    paddingTop: 20,
    position: 'relative',
  },
  roleAccentBar: {
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  roleCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  roleIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  roleTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  roleLabel: {
    color: '#4B4B5F',
    fontSize: 12,
    fontWeight: '900',
  },
  roleTitle: {
    color: '#010110',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: 2,
  },
  roleCopy: {
    color: '#343548',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 13,
  },
  roleCardMeta: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  roleCardMetaText: {
    color: '#343548',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  featureList: {
    gap: 8,
    marginTop: 14,
  },
  featureRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  featureText: {
    color: '#343548',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  downloadAction: {
    marginTop: 10,
  },
  notificationPrompt: {
    marginTop: 8,
  },
});
