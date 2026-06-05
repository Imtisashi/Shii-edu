import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { useRootLayout } from '../../contexts/RootLayoutContext';
import { fetchFacultyDirectory } from '../../services/facultyDirectoryService';
import DynamicHeader from '../../components/DynamicHeader';

const getInitial = (name) => String(name || 'F').trim().charAt(0).toUpperCase() || 'F';

function FacultyHeader({ count }) {
  const { colors, typography } = useRootLayout();

  return (
    <View style={styles.headerBlock}>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>Campus faculty</Text>
      <Text style={[styles.screenTitle, { color: colors.text, fontFamily: typography.title }]}>Faculty</Text>
      <Text style={[styles.screenSubtitle, { color: colors.textSoft }]}>
        Your institute teachers and faculty identifiers in one polished roster.
      </Text>
      <View style={[styles.summaryPill, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
        <Ionicons name="people-outline" size={16} color={colors.emerald} />
        <Text style={[styles.summaryText, { color: colors.text }]}>{count} teacher{count === 1 ? '' : 's'}</Text>
      </View>
    </View>
  );
}

function FacultyAvatar({ item }) {
  const { colors } = useRootLayout();
  const photoURL = item.photoURL || item.profilePic || item.avatarUrl;

  return (
    <View style={styles.avatarFrame}>
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: colors.cardStrong, borderColor: colors.hairline }]}>
          <Text style={[styles.avatarText, { color: colors.text }]}>{getInitial(item.name)}</Text>
        </View>
      )}
    </View>
  );
}

function FacultyCard({ item }) {
  const { colors, radii } = useRootLayout();
  const department = item.department || item.dept || item.subject || 'Faculty';
  const teacherCode = item.loginId || item.teacherCode || item.uniqueId || item.code || item.id || 'ID pending';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.hairline,
          borderRadius: radii.card,
        },
      ]}
    >
      <FacultyAvatar item={item} />
      <View style={styles.infoBlock}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {item.name || 'Unnamed Faculty'}
        </Text>
        <Text numberOfLines={1} style={[styles.email, { color: colors.textSoft }]}>
          ID: {teacherCode}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
            <Ionicons name="briefcase-outline" size={13} color={colors.emerald} />
            <Text numberOfLines={1} style={[styles.badgeText, { color: colors.text }]}>{department}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.deepBlueSoft, borderColor: colors.hairline }]}>
            <Ionicons name="id-card-outline" size={13} color={colors.deepBlue} />
            <Text numberOfLines={1} style={[styles.badgeText, { color: colors.text }]}>Code {teacherCode}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function EmptyState({ message = 'Teacher profiles will appear after admin onboarding.', title = 'No faculty yet' }) {
  const { colors } = useRootLayout();

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}>
        <Ionicons name="people-outline" size={34} color={colors.emerald} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

export default function TeachersProfile() {
  const { currentUser, userData } = useAuth();
  const { colors, insets, isDesktop, maxContentWidth, spacing } = useRootLayout();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    if (!currentUser || !userData?.instituteId) {
      setTeachers([]);
      setLoading(false);
      return () => {
        isActive = false;
      };
    }

    setLoading(true);
    setErrorMessage('');

    fetchFacultyDirectory(currentUser)
      .then((nextTeachers) => {
        if (!isActive) return;
        setTeachers(nextTeachers);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Teacher roster request failed:', error);
        setTeachers([]);
        setErrorMessage('The faculty directory could not be loaded. Please try again shortly.');
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentUser, userData?.instituteId]);

  const listStyle = useMemo(() => ({
    alignSelf: 'center',
    maxWidth: isDesktop ? maxContentWidth : undefined,
    paddingBottom: Math.max(insets.bottom, 10) + 104,
    paddingHorizontal: spacing.pageX,
    paddingTop: 18,
    width: '100%',
  }), [insets.bottom, isDesktop, maxContentWidth, spacing.pageX]);

  return (
    <View style={[styles.container, { backgroundColor: colors.page }]}>
      <DynamicHeader title="Faculty" />
      {loading ? (
        <RosterSkeleton rowCount={5} showFilters={false} />
      ) : (
        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={errorMessage
            ? <EmptyState title="Unable to load faculty" message={errorMessage} />
            : <EmptyState />}
          ListHeaderComponent={<FacultyHeader count={teachers.length} />}
          contentContainerStyle={listStyle}
          renderItem={({ item }) => <FacultyCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarFallback: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  avatarFrame: {
    height: 62,
    justifyContent: 'center',
    width: 68,
  },
  avatarImage: {
    borderRadius: 8,
    height: 58,
    width: 58,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    maxWidth: 180,
  },
  card: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 18,
  },
  container: {
    flex: 1,
  },
  email: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 16,
    width: 72,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerBlock: {
    marginBottom: 22,
  },
  infoBlock: {
    flex: 1,
    minWidth: 0,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  screenSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 620,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
  },
  summaryPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
