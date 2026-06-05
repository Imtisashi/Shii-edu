import React, { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../home/HomeDashboardScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { filterByFeatureAccess, isFeatureEnabled } from '../../constants/featureEntitlements';

export default function ParentHome() {
  const navigation = useNavigation();
  const { logout, notifications, userData } = useAuth();
  const { instituteData } = useInstitution();

  const openScreen = useCallback((screen) => {
    const parentNavigation = navigation.getParent?.();
    (parentNavigation || navigation).navigate(screen);
  }, [navigation]);

  const openMenu = useCallback(() => {
    const parentNavigation = navigation.getParent?.();
    parentNavigation?.openDrawer?.();
    navigation.openDrawer?.();
  }, [navigation]);

  const notices = useMemo(
    () => (notifications || []).slice(0, 3).map((item, index) => ({
      id: item.id || `notice-${index}`,
      meta: 'Institute update',
      onPress: () => openScreen('Notifications'),
      title: item.title || 'Campus update',
    })),
    [notifications, openScreen]
  );

  const primaryActions = useMemo(() => [
    {
      color: '#B7791F',
      featureKey: 'finance',
      icon: 'wallet',
      key: 'fees',
      onPress: () => openScreen('Fee Payment'),
      softColor: '#431407',
      subtitle: 'Invoices, dues, and receipts for your linked student.',
      title: 'Fees',
    },
    {
      color: '#16A34A',
      featureKey: 'transport',
      icon: 'bus',
      key: 'fleet',
      onPress: () => openScreen('Live Fleet'),
      softColor: '#052E2B',
      subtitle: 'Follow active institute vehicles in real time.',
      title: 'Live Fleet',
    },
    {
      color: '#2563EB',
      featureKey: 'messages',
      icon: 'chatbubbles',
      key: 'messages',
      onPress: () => openScreen('CommunicationHub'),
      softColor: '#082F49',
      subtitle: 'Contact faculty during their configured office hours.',
      title: 'Messages',
    },
    {
      color: '#A78BFA',
      featureKey: 'notices',
      icon: 'notifications',
      key: 'notifications',
      onPress: () => openScreen('Notifications'),
      softColor: '#1E1B4B',
      subtitle: 'Attendance, payment, and institute alerts.',
      title: 'Alerts',
    },
  ], [openScreen]);
  const visiblePrimaryActions = useMemo(
    () => filterByFeatureAccess(primaryActions, instituteData),
    [instituteData, primaryActions]
  );

  return (
    <HomeDashboardScreen
      displayName={userData?.name || 'Parent'}
      instituteName={userData?.instituteData?.name || 'Shii-Edu'}
      notices={notices}
      onLogout={logout}
      onOpenMenu={openMenu}
      onOpenNotifications={() => {
        if (isFeatureEnabled(instituteData, 'notices')) openScreen('Notifications');
      }}
      primaryActions={visiblePrimaryActions}
      profileMeta={[
        userData?.linkedStudentName || 'Linked student',
        userData?.linkedStudentUserId ? `ID ${userData.linkedStudentUserId}` : 'Student ID pending',
      ]}
      secondaryActions={[]}
      unreadCount={(notifications || []).length}
    />
  );
}
