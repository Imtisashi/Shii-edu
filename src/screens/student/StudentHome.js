import React, { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../home/HomeDashboardScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { filterByFeatureAccess, isFeatureEnabled } from '../../constants/featureEntitlements';
import { isNoticeForBroadcasts } from '../../utils/isNoticeForBroadcasts';

const getAuthorName = (author) => {
  if (!author) return 'Campus';
  if (typeof author === 'string') return author;
  return author.name || author.email || 'Campus';
};

const formatNotificationDate = (createdAt) => {
  if (!createdAt) return 'Just now';
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().toLocaleDateString();
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString();
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? 'Just now' : parsed.toLocaleDateString();
};

const buildMeta = (userData) => {
  const institutionType = (
    userData?.instituteData?.institutionType ||
    userData?.instituteData?.type ||
    userData?.institutionType ||
    'school'
  ).toString().toLowerCase();
  const isSchool = institutionType.includes('school');

  if (isSchool) {
    return [
      userData?.class ? `Class ${userData.class}` : 'Class pending',
      userData?.section ? `Section ${userData.section}` : 'Section pending',
    ];
  }

  return [
    userData?.dept || userData?.department ? (userData.dept || userData.department) : 'Department pending',
    userData?.sem || userData?.semester ? `Semester ${userData.sem || userData.semester}` : 'Semester pending',
  ];
};

export default function StudentHome() {
  const navigation = useNavigation();
  const { logout, notifications, userData } = useAuth();
  const { instituteData } = useInstitution();

  const openStudentScreen = useCallback((screen, params) => {
    const parentNavigation = navigation.getParent?.();
    const targetNavigation = parentNavigation || navigation;
    targetNavigation.navigate(screen, params);
  }, [navigation]);

  const openMenu = useCallback(() => {
    const parentNavigation = navigation.getParent?.();
    if (parentNavigation?.openDrawer) {
      parentNavigation.openDrawer();
      return;
    }

    navigation.openDrawer?.();
  }, [navigation]);

  const openNotifications = useCallback(() => {
    openStudentScreen('Notifications');
  }, [openStudentScreen]);

  const studentName = userData?.name || userData?.displayName || 'Student';
  const instituteName = userData?.instituteData?.name || userData?.instituteName || 'Shii-Edu';
  const userRole = userData?.role;
  const userUid = userData?.uid;

  const unreadCount = useMemo(() => {
    if (userRole !== 'student' || !notifications) return 0;

    return notifications.filter((notification) => {
      const alreadyRead = notification.readBy?.includes(userUid) || notification.isRead === true;
      return !alreadyRead && isNoticeForBroadcasts(notification);
    }).length;
  }, [notifications, userRole, userUid]);

  const notices = useMemo(
    () => (notifications || [])
      .filter(isNoticeForBroadcasts)
      .slice(0, 3)
      .map((item, index) => ({
        id: item.id || `notice-${index}`,
        meta: `${getAuthorName(item.author)} - ${formatNotificationDate(item.createdAt)}`,
        onPress: openNotifications,
        title: item.title || 'Campus broadcast',
      })),
    [notifications, openNotifications]
  );

  const primaryActions = useMemo(() => [
    {
      color: '#F7C948',
      featureKey: 'grades',
      icon: 'school',
      key: 'grades',
      onPress: () => openStudentScreen('Grades'),
      softColor: '#422006',
      subtitle: 'Results, marksheets, and academic progress.',
      title: 'Grades',
    },
    {
      color: '#16A34A',
      featureKey: 'attendance',
      icon: 'bar-chart',
      key: 'attendance',
      onPress: () => openStudentScreen('Attendance'),
      softColor: '#052E2B',
      subtitle: 'Daily presence, trends, and missed sessions.',
      title: 'Attendance',
    },
    {
      color: '#2563EB',
      featureKey: 'courses',
      icon: 'play-circle',
      key: 'courses',
      onPress: () => openStudentScreen('Courses'),
      softColor: '#082F49',
      subtitle: 'Lessons, videos, and institute resources.',
      title: 'Courses',
    },
    {
      color: '#B7791F',
      featureKey: 'finance',
      icon: 'wallet',
      key: 'fees',
      onPress: () => openStudentScreen('Fee Payment'),
      softColor: '#431407',
      subtitle: 'Invoices, dues, receipts, and payment status.',
      title: 'Fees',
    },
  ], [openStudentScreen]);

  const secondaryActions = useMemo(() => [
    {
      color: '#A78BFA',
      featureKey: 'routines',
      icon: 'calendar',
      key: 'routine',
      onPress: () => openStudentScreen('Routine'),
      softColor: '#1E1B4B',
      subtitle: 'Timetable',
      title: 'Routine',
    },
    {
      color: '#67E8F9',
      featureKey: 'pyq',
      icon: 'document-text',
      key: 'pyqs',
      onPress: () => openStudentScreen('PYQs'),
      softColor: '#082F49',
      subtitle: 'Previous papers',
      title: 'PYQs',
    },
    {
      color: '#F472B6',
      featureKey: 'media',
      icon: 'images',
      key: 'gallery',
      onPress: () => openStudentScreen('Gallery'),
      softColor: '#500724',
      subtitle: 'Campus media',
      title: 'Gallery',
    },
    {
      color: '#2DD4BF',
      featureKey: 'messages',
      icon: 'chatbubbles',
      key: 'messages',
      onPress: () => openStudentScreen('CommunicationHub'),
      softColor: '#134E4A',
      subtitle: 'Office-hour messages',
      title: 'Messages',
    },
    {
      color: '#4ADE80',
      featureKey: 'transport',
      icon: 'bus',
      key: 'fleet',
      onPress: () => openStudentScreen('Live Fleet'),
      softColor: '#14532D',
      subtitle: 'Live institute vehicles',
      title: 'Fleet',
    },
    {
      color: '#818CF8',
      featureKey: 'ai',
      icon: 'sparkles',
      key: 'syllabus-tutor',
      onPress: () => openStudentScreen('SyllabusTutor'),
      softColor: '#312E81',
      subtitle: 'Strict syllabus answers',
      title: 'Syllabus AI',
    },
  ], [openStudentScreen]);
  const visiblePrimaryActions = useMemo(
    () => filterByFeatureAccess(primaryActions, instituteData),
    [instituteData, primaryActions]
  );
  const visibleSecondaryActions = useMemo(
    () => filterByFeatureAccess(secondaryActions, instituteData),
    [instituteData, secondaryActions]
  );

  return (
    <HomeDashboardScreen
      displayName={studentName}
      instituteName={instituteName}
      notices={notices}
      onLogout={logout}
      onOpenMenu={openMenu}
      onOpenNotifications={() => {
        if (isFeatureEnabled(instituteData, 'notices')) openNotifications();
      }}
      primaryActions={visiblePrimaryActions}
      profileMeta={buildMeta(userData)}
      secondaryActions={visibleSecondaryActions}
      unreadCount={unreadCount}
    />
  );
}
