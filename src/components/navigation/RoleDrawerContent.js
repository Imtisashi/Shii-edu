import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import BrandWordmark from '../BrandWordmark';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';

export default function RoleDrawerContent({
  dashboardRoute,
  profileRoute,
  settingsRoute,
  ...props
}) {
  const { logout, userData } = useAuth();
  const { brand, colors, typography } = useRootLayout();
  const role = String(userData?.role || 'workspace').trim() || 'workspace';

  const drawerItemStyle = {
    borderRadius: 8,
    marginHorizontal: 8,
  };

  const labelStyle = {
    color: colors.text,
    fontWeight: '900',
  };

  const navigateTo = (routeName) => {
    props.navigation.navigate(routeName);
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.container, { backgroundColor: colors.page }]}
    >
      <View style={[styles.identity, { borderBottomColor: colors.hairline }]}>
        <BrandWordmark color={colors.text} size="sm" />
        <Text numberOfLines={2} style={[styles.instituteName, { color: colors.text, fontFamily: typography.block }]}>
          {brand.name}
        </Text>
        <Text style={[styles.roleText, { color: colors.textSoft }]}>
          {role.charAt(0).toUpperCase() + role.slice(1)} portal
        </Text>
      </View>

      <View style={styles.coreLinks}>
        <DrawerItem
          icon={({ size }) => <Ionicons name="grid-outline" color={colors.text} size={size} />}
          label="Dashboard"
          labelStyle={labelStyle}
          onPress={() => navigateTo(dashboardRoute)}
          style={drawerItemStyle}
        />
        <DrawerItem
          icon={({ size }) => <Ionicons name="person-circle-outline" color={colors.text} size={size} />}
          label="Profile"
          labelStyle={labelStyle}
          onPress={() => navigateTo(profileRoute)}
          style={drawerItemStyle}
        />
        <DrawerItem
          icon={({ size }) => <Ionicons name="settings-outline" color={colors.text} size={size} />}
          label="Settings"
          labelStyle={labelStyle}
          onPress={() => navigateTo(settingsRoute)}
          style={drawerItemStyle}
        />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.hairline }]}>
        <DrawerItem
          icon={({ size }) => <Ionicons name="log-out-outline" color="#DC2626" size={size} />}
          label="Logout"
          labelStyle={[labelStyle, { color: '#DC2626' }]}
          onPress={logout}
          style={drawerItemStyle}
        />
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  coreLinks: {
    paddingTop: 8,
  },
  footer: {
    borderTopWidth: 1,
    marginTop: 'auto',
    paddingTop: 8,
  },
  identity: {
    borderBottomWidth: 1,
    marginHorizontal: 14,
    paddingBottom: 18,
    paddingTop: 8,
  },
  instituteName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 23,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
});
