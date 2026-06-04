import React, { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import HomeDashboardScreen from '../home/HomeDashboardScreen';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';

export default function TeacherHome() {
  const navigation = useNavigation();
  const { brand, colors } = useRootLayout();
  const { logout, notifications, userData } = useAuth();

  const teacherName = userData?.name || 'Teacher';
  const firstName = teacherName.split(' ')[0] || teacherName;
  const instTypeStr = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = instTypeStr.includes('school');
  const assignmentLabel = userData?.isClassTeacher
    ? isSchool
      ? `Class ${userData?.assignedClass || 'Unassigned'} - Sec ${userData?.assignedSection || 'Unassigned'}`
      : `${userData?.assignedDept || 'Unassigned'} - Sem ${userData?.assignedSem || 'Unassigned'}`
    : 'Subject teacher';

  const actions = useMemo(() => [
    {
      color: '#047857',
      icon: 'checkmark-done-circle',
      key: 'attendance',
      onPress: () => navigation.navigate('Attendance'),
      softColor: colors.emeraldSoft,
      subtitle: "Open the roster and submit today's attendance.",
      title: 'Attendance',
    },
    {
      color: '#2563EB',
      icon: 'megaphone',
      key: 'notices',
      onPress: () => navigation.navigate('TeacherNotifs'),
      softColor: colors.deepBlueSoft,
      subtitle: 'Publish and review classroom notices.',
      title: 'Notices',
    },
    {
      color: '#7C3AED',
      icon: 'people',
      key: 'students',
      onPress: () => navigation.navigate('Students'),
      softColor: colors.violetSoft,
      subtitle: 'Review student IDs, sections, and classroom records.',
      title: 'Directory',
    },
    {
      color: '#DC2626',
      icon: 'calendar',
      key: 'routine',
      onPress: () => navigation.navigate('Routine'),
      softColor: colors.warningSoft,
      subtitle: 'View assigned teaching schedule and room slots.',
      title: 'Routine',
    },
    {
      color: '#B45309',
      icon: 'document-text',
      key: 'assignments',
      onPress: () => navigation.navigate('Assignments'),
      softColor: colors.warningSoft,
      subtitle: 'Create and manage coursework submissions.',
      title: 'Assignments',
    },
    {
      color: '#2563EB',
      icon: 'play-circle',
      key: 'courses',
      onPress: () => navigation.navigate('Courses'),
      softColor: colors.deepBlueSoft,
      subtitle: 'Upload lessons and maintain course resources.',
      title: 'Courses',
    },
    {
      color: '#DC2626',
      icon: 'document-attach',
      key: 'pyq',
      onPress: () => navigation.navigate('UploadPYQ'),
      softColor: colors.warningSoft,
      subtitle: 'Upload and organize question-paper documents.',
      title: 'PYQs',
    },
    {
      color: '#EA580C',
      icon: 'images',
      key: 'gallery',
      onPress: () => navigation.navigate('GalleryView'),
      softColor: colors.bronzeSoft,
      subtitle: 'Review and contribute approved class media.',
      title: 'Gallery',
    },
    {
      color: '#0369A1',
      icon: 'print',
      key: 'reports',
      onPress: () => navigation.navigate('ReportsCenter'),
      softColor: colors.cyanSoft,
      subtitle: 'Generate class-level academic reports.',
      title: 'Reports',
    },
    {
      color: '#0F766E',
      icon: 'chatbubbles',
      key: 'messages',
      onPress: () => navigation.navigate('CommunicationHub'),
      softColor: colors.emeraldSoft,
      subtitle: 'Message admins, parents, and assigned students.',
      title: 'Messages',
    },
    {
      color: '#4F46E5',
      icon: 'library',
      key: 'syllabus',
      onPress: () => navigation.navigate('SyllabusTutor'),
      softColor: colors.violetSoft,
      subtitle: 'Review syllabus coverage and tutoring prompts.',
      title: 'Syllabus AI',
    },
  ], [colors, navigation]);

  const notices = useMemo(
    () => (notifications || []).slice(0, 3).map((item, index) => ({
      id: item.id || `teacher-notice-${index}`,
      meta: item.type || 'Faculty update',
      onPress: () => navigation.navigate('TeacherNotifs'),
      title: item.title || 'Faculty update',
    })),
    [navigation, notifications]
  );

  return (
    <HomeDashboardScreen
      displayName={firstName}
      greetingLabel="Faculty workspace"
      instituteName={brand.name}
      notices={notices}
      onLogout={logout}
      onOpenNotifications={() => navigation.navigate('TeacherNotifs')}
      primaryActions={actions.slice(0, 4)}
      profileMeta={[
        assignmentLabel,
        isSchool ? 'School mode' : 'College mode',
        userData?.instituteId ? `Institute ${userData.instituteId}` : 'Institute pending',
      ]}
      secondaryActions={actions.slice(4)}
      title="Faculty"
      unreadCount={(notifications || []).length}
    />
  );
}
