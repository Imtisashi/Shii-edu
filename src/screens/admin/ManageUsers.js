import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { listSupabaseUsers } from '../../services/supabaseTenantDataService';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const getUserIdentifier = (user) => (
  user?.loginId ||
  user?.uniqueId ||
  user?.studentId ||
  user?.teacherCode ||
  user?.id ||
  'No ID'
);

const getInitials = (name) => {
  const words = String(name || 'User').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('') || 'U';
};

const getTeacherAssignments = (user, isSchool) => {
  if (isSchool) {
    const assignedClass = user?.assignedClass || user?.class || user?.teachingScope?.classes?.[0] || null;
    const assignedSection = user?.assignedSection || user?.section || user?.teachingScope?.sections?.[0] || null;
    return { primary: assignedClass, secondary: assignedSection };
  }

  const assignedDepartment = user?.assignedDept || user?.dept || user?.department ||
    user?.teachingScope?.departments?.[0] || null;
  const assignedSemester = user?.assignedSem || user?.sem || user?.semester ||
    user?.teachingScope?.semesters?.[0] || null;
  return { primary: assignedDepartment, secondary: assignedSemester };
};

export default function ManageUsers({ navigation }) {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing } = useRootLayout();
  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [parents, setParents] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const instType = String(
    userData?.instituteData?.institutionType ||
    userData?.instituteData?.type ||
    'school'
  ).toLowerCase();
  const isSchool = instType.includes('school');
  const instituteModeLabel = isSchool ? 'School' : 'College';

  useEffect(() => {
    if (!userData?.instituteId) {
      setStudents([]);
      setTeachers([]);
      setParents([]);
      setDrivers([]);
      setErrorMessage('Your administrator profile is not linked to an institute.');
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setErrorMessage('');

    let cancelled = false;
    let unsubscribeFirestore = null;

    const applyUsers = (users) => {
        const fetchedStudents = [];
        const fetchedTeachers = [];
        const fetchedParents = [];
        const fetchedDrivers = [];

        users.forEach((data) => {
          const role = normalizeRole(data.role);
          if (role === 'student') fetchedStudents.push(data);
          if (role === 'teacher') fetchedTeachers.push(data);
          if (role === 'parent') fetchedParents.push(data);
          if (role === 'driver') fetchedDrivers.push(data);
        });

        const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
        fetchedStudents.sort(byName);
        fetchedTeachers.sort(byName);
        fetchedParents.sort(byName);
        fetchedDrivers.sort(byName);

        setStudents(fetchedStudents);
        setTeachers(fetchedTeachers);
        setParents(fetchedParents);
        setDrivers(fetchedDrivers);
        setErrorMessage('');
        setLoading(false);
    };

    const startFirestoreFallback = () => {
      const usersQuery = query(
        collection(db, 'users'),
        where('instituteId', '==', userData.instituteId)
      );

      unsubscribeFirestore = onSnapshot(
        usersQuery,
        (snapshot) => {
          if (cancelled) return;
          applyUsers(snapshot.docs.map((document) => ({ id: document.id, ...document.data(), dataSource: 'firestore' })));
        },
        (error) => {
          if (cancelled) return;
          console.error('User database query failed:', error);
          setStudents([]);
          setTeachers([]);
          setParents([]);
          setDrivers([]);
          setErrorMessage(error.message || 'The institute directory could not be loaded.');
          setLoading(false);
        }
      );
    };

    listSupabaseUsers(currentUser)
      .then(({ users }) => {
        if (cancelled) return;
        applyUsers(Array.isArray(users) ? users : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Supabase directory bridge failed, falling back to Firestore:', error);
        startFirestoreFallback();
      });

    return () => {
      cancelled = true;
      if (typeof unsubscribeFirestore === 'function') unsubscribeFirestore();
    };
  }, [currentUser, userData?.instituteId]);

  const displayData = useMemo(() => {
    const sourceData = {
      students,
      teachers,
      parents,
      drivers,
    }[activeTab] || [];
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return sourceData;

    return sourceData.filter((user) => {
      const searchableValues = [
        user.name,
        getUserIdentifier(user),
        user.class,
        user.section,
        user.dept,
        user.department,
        user.sem,
        user.semester,
        user.degree,
        user.linkedStudentName,
        user.linkedStudentUserId,
        user.vehicleId,
        user.routeName,
      ];

      return searchableValues.some((value) => (
        String(value || '').toLowerCase().includes(normalizedSearch)
      ));
    });
  }, [activeTab, drivers, parents, searchQuery, students, teachers]);

  const showUserDetails = (item) => {
    const roleLabel = {
      students: 'Student',
      teachers: 'Teacher',
      parents: 'Parent',
      drivers: 'Driver',
    }[activeTab] || 'User';
    const identifier = getUserIdentifier(item);
    const teacherAssignments = getTeacherAssignments(item, isSchool);
    const academicLines = activeTab === 'parents'
      ? [
        `Linked student: ${item.linkedStudentName || 'Not linked'}`,
        `Student ID: ${item.linkedStudentUserId || 'Not linked'}`,
        `Relationship: ${item.relationship || 'Parent / Guardian'}`,
      ]
      : activeTab === 'drivers'
        ? [
          `Vehicle ID: ${item.vehicleId || 'Not assigned'}`,
          `Route: ${item.routeName || 'Not assigned'}`,
          `Fleet status: ${item.fleetStatus || 'offline'}`,
        ]
        : activeTab === 'students'
      ? (isSchool
        ? [`Class: ${item.class || 'Not assigned'}`, `Section: ${item.section || 'Not assigned'}`]
        : [
          `Department: ${item.dept || item.department || 'Not assigned'}`,
          `Semester: ${item.sem || item.semester || 'Not assigned'}`,
        ])
      : (isSchool
        ? [
          `Class assignment: ${teacherAssignments.primary || 'Not assigned'}`,
          `Section assignment: ${teacherAssignments.secondary || 'Not assigned'}`,
        ]
        : [
          `Department: ${teacherAssignments.primary || 'Not assigned'}`,
          `Semester: ${teacherAssignments.secondary || 'Not assigned'}`,
        ]);

    const message = [
      `Name: ${item.name || 'Unnamed user'}`,
      `User ID: ${identifier}`,
      `Role: ${roleLabel}`,
      ...academicLines,
    ].join('\n');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message);
      return;
    }

    Alert.alert('User Details', message);
  };

  const getBadges = (item) => {
    if (activeTab === 'parents') {
      return [
        item.linkedStudentUserId ? `Student ${item.linkedStudentUserId}` : 'Student unlinked',
        item.relationship || 'Guardian',
      ];
    }

    if (activeTab === 'drivers') {
      return [
        item.vehicleId || 'Vehicle unassigned',
        item.routeName || 'Route unassigned',
      ];
    }

    if (activeTab === 'students') {
      return isSchool
        ? [`Class ${item.class || 'Unassigned'}`, `Section ${item.section || 'Unassigned'}`]
        : [
          item.dept || item.department || 'Department unassigned',
          `Semester ${item.sem || item.semester || 'Unassigned'}`,
        ];
    }

    const teacherAssignments = getTeacherAssignments(item, isSchool);
    return isSchool
      ? [
        teacherAssignments.primary ? `Class ${teacherAssignments.primary}` : 'Faculty',
        teacherAssignments.secondary ? `Section ${teacherAssignments.secondary}` : 'Unassigned',
      ]
      : [
        teacherAssignments.primary || 'Faculty',
        teacherAssignments.secondary ? `Semester ${teacherAssignments.secondary}` : 'Unassigned',
      ];
  };

  const renderUserCard = ({ item }) => {
    const identifier = getUserIdentifier(item);
    const [primaryBadge, secondaryBadge] = getBadges(item);
    const imageUrl = item.photoURL || item.photoUrl || item.profilePic || null;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.cardStrong,
            borderColor: colors.hairline,
            borderRadius: radii.card,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            accessibilityLabel={`${item.name || 'User'} profile picture`}
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: imageUrl }}
            style={styles.avatarImage}
            transition={160}
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft },
            ]}
          >
            <Text style={[styles.avatarInitials, { color: colors.accent }]}>
              {getInitials(item.name)}
            </Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text numberOfLines={1} style={[styles.userName, { color: colors.text }]}>
            {item.name || 'Unnamed user'}
          </Text>
          <Text numberOfLines={1} style={[styles.identifier, { color: colors.textSoft }]}>
            ID: {identifier}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
              <Text style={[styles.badgeText, { color: colors.textSoft }]}>{primaryBadge}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>{secondaryBadge}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          accessibilityLabel={`View ${item.name || 'user'} details`}
          onPress={() => showUserDetails(item)}
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.hairline }]}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSoft} />
        </TouchableOpacity>
      </View>
    );
  };

  const emptyTitle = errorMessage
    ? 'Directory unavailable'
    : `No ${activeTab} found`;
  const emptyBody = errorMessage ||
    (searchQuery.trim()
      ? 'Try a different name, User ID, or academic assignment.'
      : `Create the first ${activeTab === 'students' ? 'student' : 'teacher'} profile for this institute.`);

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <DynamicHeader title="User Database" />

      <View
        style={[
          styles.controls,
          {
            maxWidth: maxContentWidth,
            paddingHorizontal: spacing.pageX,
          },
        ]}
      >
        <View
          style={[
            styles.summaryPanel,
            {
              backgroundColor: colors.cardStrong,
              borderColor: colors.hairline,
              borderRadius: radii.card,
            },
          ]}
        >
          <View style={styles.summaryCopy}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>Directory control</Text>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {students.length + teachers.length + parents.length + drivers.length} people synced
            </Text>
            <Text style={[styles.summarySubtitle, { color: colors.textSoft }]}>
              Search and manage institute profiles by their User ID.
            </Text>
          </View>
          <View style={[styles.modePill, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
            <Ionicons
              color={colors.accent}
              name={isSchool ? 'school-outline' : 'business-outline'}
              size={15}
            />
            <Text style={[styles.modePillText, { color: colors.accent }]}>{instituteModeLabel}</Text>
          </View>
        </View>

        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
          {[
            { id: 'students', label: 'Students', count: students.length },
            { id: 'teachers', label: 'Teachers', count: teachers.length },
            { id: 'parents', label: 'Parents', count: parents.length },
            { id: 'drivers', label: 'Drivers', count: drivers.length },
          ].map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tab,
                  selected && {
                    backgroundColor: colors.deepBlueSoft,
                    borderColor: colors.accentSoft,
                  },
                ]}
              >
                <Text style={[styles.tabText, { color: selected ? colors.accent : colors.muted }]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
          <Ionicons color={colors.muted} name="search" size={20} style={styles.searchIcon} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder={`Search ${activeTab} by name or User ID...`}
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              accessibilityLabel="Clear directory search"
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <Ionicons color={colors.muted} name="close-circle" size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <SmoothSpinner color={colors.accent} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSoft }]}>Syncing institute directory...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            {
              maxWidth: maxContentWidth,
              paddingHorizontal: spacing.pageX,
            },
          ]}
          data={displayData}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={(
          <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
                <Ionicons color={colors.accent} name="people-outline" size={30} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{emptyTitle}</Text>
              <Text style={[styles.emptyText, { color: colors.textSoft }]}>{emptyBody}</Text>
            </View>
          )}
          renderItem={renderUserCard}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        accessibilityLabel="Add institute user"
        onPress={() => navigation.navigate('AddUser')}
        style={[
          styles.fab,
          {
            backgroundColor: colors.deepBlue,
            borderColor: colors.cardStrong,
          },
        ]}
      >
        <Ionicons color="#FFFFFF" name="add" size={30} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  avatarImage: {
    borderRadius: 8,
    height: 48,
    marginRight: 12,
    width: 48,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
    marginRight: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 12,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  clearSearchButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  controls: {
    alignSelf: 'center',
    width: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 28,
    padding: 22,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 320,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    bottom: 88,
    height: 54,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    width: 54,
  },
  identifier: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoContainer: {
    flex: 1,
    minWidth: 0,
  },
  listContent: {
    alignSelf: 'center',
    paddingBottom: 150,
    width: '100%',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  modePill: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  searchContainer: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    outlineStyle: 'none',
    paddingVertical: 13,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryPanel: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 16,
  },
  summarySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 5,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 3,
  },
  tab: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  tabContainer: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginVertical: 12,
    padding: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
});
