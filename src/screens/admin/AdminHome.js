import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../home/HomeDashboardScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { filterByFeatureAccess, isFeatureEnabled } from '../../constants/featureEntitlements';
import { openNearestDrawer } from '../../navigation/openNearestDrawer';

export default function AdminHome() {
  const navigation = useNavigation();
  const { brand, colors } = useRootLayout();
  const { instituteData } = useInstitution();
  const { logout, notifications, userData } = useAuth();

  const adminName = userData?.name || 'Administrator';
  const firstName = adminName.split(' ')[0] || adminName;
  const isSchool = String(userData?.instituteData?.type || userData?.instituteData?.institutionType || 'school')
    .toLowerCase()
    .includes('school');

  const actions = useMemo(() => [
    {
      color: '#2563EB',
      featureKey: 'people',
      icon: 'people',
      key: 'users',
      onPress: () => navigation.navigate('Users'),
      softColor: colors.deepBlueSoft,
      subtitle: 'Create, edit, and audit student and staff profiles.',
      title: 'Users',
    },
    {
      color: '#047857',
      featureKey: 'finance',
      icon: 'wallet',
      key: 'ledger',
      onPress: () => navigation.navigate('Ledger'),
      softColor: colors.emeraldSoft,
      subtitle: 'Track student dues, receipts, concessions, and payment status.',
      title: 'Student Fees',
    },
    {
      color: '#BE123C',
      featureKey: 'people',
      icon: 'key',
      key: 'password-resets',
      onPress: () => navigation.navigate('PasswordResetRequests'),
      softColor: colors.warningSoft,
      subtitle: 'Approve or reject password reset requests from login.',
      title: 'Password Resets',
    },
    {
      color: '#7C3AED',
      featureKey: 'finance',
      icon: 'cash',
      key: 'payroll',
      onPress: () => navigation.navigate('TeacherPayroll'),
      softColor: colors.violetSoft,
      subtitle: 'Monitor teacher salary status and monthly payroll controls.',
      title: 'Payroll',
    },
    {
      color: '#0F766E',
      featureKey: 'transport',
      icon: 'navigate',
      key: 'transport-control',
      onPress: () => navigation.navigate('TransportControl'),
      softColor: colors.emeraldSoft,
      subtitle: 'Manage route destinations and assign drivers to vehicles.',
      title: 'Route Control',
    },
    {
      color: '#7C3AED',
      featureKey: 'people',
      icon: 'briefcase',
      key: 'faculty',
      onPress: () => navigation.navigate('ManageTeachers'),
      softColor: colors.violetSoft,
      subtitle: 'Maintain faculty records and class-teacher assignments.',
      title: 'Faculty',
    },
    {
      color: '#DC2626',
      featureKey: 'routines',
      icon: 'calendar',
      key: 'routine',
      onPress: () => navigation.navigate('ManageRoutines'),
      softColor: colors.warningSoft,
      subtitle: 'Publish class, section, department, and semester schedules.',
      title: 'Routine',
    },
    {
      color: '#B45309',
      featureKey: 'notices',
      icon: 'megaphone',
      key: 'broadcasts',
      onPress: () => navigation.navigate('Broadcasts'),
      softColor: colors.warningSoft,
      subtitle: 'Send notices to students, parents, teachers, and drivers.',
      title: 'Broadcasts',
    },
    {
      color: '#2563EB',
      featureKey: 'courses',
      icon: 'play-circle',
      key: 'courses',
      onPress: () => navigation.navigate('Courses'),
      softColor: colors.deepBlueSoft,
      subtitle: 'Manage learning resources and uploaded course material.',
      title: 'Courses',
    },
    {
      color: '#EA580C',
      featureKey: 'media',
      icon: 'images',
      key: 'gallery',
      onPress: () => navigation.navigate('UploadGallery'),
      softColor: colors.bronzeSoft,
      subtitle: 'Publish verified institute media and event galleries.',
      title: 'Gallery',
    },
    {
      color: '#DC2626',
      featureKey: 'pyq',
      icon: 'document-attach',
      key: 'pyq',
      onPress: () => navigation.navigate('UploadPYQ'),
      softColor: colors.warningSoft,
      subtitle: 'Upload and organize previous-year question papers.',
      title: 'PYQ PDFs',
    },
    {
      color: '#64748B',
      featureKey: 'routines',
      icon: 'calendar-number',
      key: 'calendar',
      onPress: () => navigation.navigate('ManageHolidays'),
      softColor: colors.pageElevated,
      subtitle: 'Maintain holiday lists and institute calendar events.',
      title: 'Calendar',
    },
    {
      color: colors.accent,
      featureKey: 'branding',
      icon: 'color-palette',
      key: 'branding',
      onPress: () => navigation.navigate('BrandingSettings'),
      softColor: colors.accentSoft,
      subtitle: 'Set the institute logo, palette, and theme mode.',
      title: 'Branding',
    },
    {
      color: '#0369A1',
      featureKey: 'reports',
      icon: 'print',
      key: 'reports',
      onPress: () => navigation.navigate('ReportsCenter'),
      softColor: colors.cyanSoft,
      subtitle: 'Export operational reports for review and meetings.',
      title: 'Reports',
    },
    {
      color: '#0F766E',
      featureKey: 'messages',
      icon: 'chatbubbles',
      key: 'messages',
      onPress: () => navigation.navigate('CommunicationHub'),
      softColor: colors.emeraldSoft,
      subtitle: 'Coordinate messages across the institute.',
      title: 'Messages',
    },
    {
      color: '#16A34A',
      featureKey: 'transport',
      icon: 'bus',
      key: 'fleet',
      onPress: () => navigation.navigate('FleetTracking'),
      softColor: colors.emeraldSoft,
      subtitle: 'Monitor transport routes and live fleet activity.',
      title: 'Live Fleet',
    },
    {
      color: '#7C3AED',
      featureKey: 'ai',
      icon: 'sparkles',
      key: 'ai',
      onPress: () => navigation.navigate('AICommandCenter'),
      softColor: colors.violetSoft,
      subtitle: 'Run approved admin automation and assistant workflows.',
      title: 'AI Command',
    },
    {
      color: '#4F46E5',
      featureKey: 'ai',
      icon: 'library',
      key: 'syllabus',
      onPress: () => navigation.navigate('SyllabusTutor'),
      softColor: colors.violetSoft,
      subtitle: 'Review syllabus coverage and learning support tools.',
      title: 'Syllabus AI',
    },
  ], [colors, navigation]);
  const visibleActions = useMemo(
    () => filterByFeatureAccess(actions, instituteData),
    [actions, instituteData]
  );

  const notices = useMemo(
    () => (notifications || []).slice(0, 3).map((item, index) => ({
      id: item.id || `notice-${index}`,
      meta: item.type || 'Institute update',
      onPress: () => navigation.navigate('Broadcasts'),
      title: item.title || 'Campus update',
    })),
    [navigation, notifications]
  );

  return (
    <HomeDashboardScreen
      displayName={firstName}
      greetingLabel="Admin workspace"
      instituteName={brand.name}
      notices={notices}
      onLogout={logout}
      onOpenMenu={() => openNearestDrawer(navigation)}
      onOpenNotifications={() => {
        if (isFeatureEnabled(instituteData, 'notices')) navigation.navigate('Broadcasts');
      }}
      primaryActions={visibleActions.slice(0, 4)}
      profileMeta={[
        'Institute admin',
        isSchool ? 'School mode' : 'College mode',
        userData?.instituteId ? `Institute ${userData.instituteId}` : 'Institute pending',
      ]}
      secondaryActions={visibleActions.slice(4)}
      title="Dashboard"
      unreadCount={(notifications || []).length}
    />
  );
}
