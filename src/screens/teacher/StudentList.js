import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Image } from 'react-native';
import { RosterSkeleton } from '../../components/ui/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';

export default function StudentList() {
  const { userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if we are dealing with a school or college
  const instType = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = instType.includes('school');

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    // REAL DATA CONNECTION: Fetch all students for this specific campus
    const q = query(
      collection(db, "users"),
      where("instituteId", "==", userData.instituteId),
      where("role", "==", "student")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStudents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort students alphabetically by name
      fetchedStudents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setStudents(fetchedStudents);
      setFilteredStudents(fetchedStudents);
      setLoading(false);
    }, (error) => {
      console.error('Student directory query failed:', error);
      setStudents([]);
      setFilteredStudents([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredStudents(students);
    } else {
      const lowerCaseText = text.toLowerCase();
      const filtered = students.filter(
        student => 
          (student.name && student.name.toLowerCase().includes(lowerCaseText)) || 
          getStudentId(student).toLowerCase().includes(lowerCaseText)
      );
      setFilteredStudents(filtered);
    }
  };

  const getStudentId = (student) => String(
    student?.loginId ||
    student?.uniqueId ||
    student?.studentId ||
    student?.id ||
    'ID pending'
  );

  const renderStudentCard = ({ item }) => {
    // Determine dynamic tags based on school vs college
    const primaryTag = isSchool ? `Class ${item.class || 'N/A'}` : (item.dept || 'N/A');
    const secondaryTag = isSchool ? `Sec ${item.section || 'N/A'}` : `Sem ${item.sem || 'N/A'}`;
    const initials = item.name ? item.name.charAt(0).toUpperCase() : 'S';

    return (
      <View style={styles.card}>
        
        {/* Real Avatar or Initial Fallback */}
        {item.photoURL || item.profilePic ? (
          <Image source={{ uri: item.photoURL || item.profilePic }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitialText}>{initials}</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.emailText}>ID: {getStudentId(item)}</Text>
          
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{primaryTag}</Text>
            </View>
            <View style={[styles.badge, styles.secondaryBadge]}>
              <Text style={[styles.badgeText, styles.secondaryBadgeText]}>{secondaryTag}</Text>
            </View>
          </View>
        </View>
        
        {/* Optional Action Button (Could be used to message the student later) */}
        <View style={styles.actionIcon}>
           <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </View>

      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DynamicHeader title="Student Directory" showBack={false} />

      <View style={styles.summaryPanel}>
        <View>
          <Text style={styles.eyebrow}>Classroom directory</Text>
          <Text style={styles.summaryTitle}>{students.length} enrolled profiles</Text>
        </View>
        <View style={styles.modePill}>
          <Ionicons name={isSchool ? 'school-outline' : 'business-outline'} size={15} color="#A78BFA" />
          <Text style={styles.modePillText}>{isSchool ? 'School' : 'College'}</Text>
        </View>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or User ID..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor={colors.muted}
        />
        {searchQuery.length > 0 && (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color={colors.muted}
            onPress={() => handleSearch('')} 
          />
        )}
      </View>

      <View style={styles.statsRow}>
         <Text style={styles.statsText}>Showing <Text style={styles.statsValue}>{filteredStudents.length}</Text> of {students.length}</Text>
      </View>

      {loading ? (
        <RosterSkeleton rowCount={6} />
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color={colors.muted} />
              <Text style={styles.emptyText}>No students found in the database.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#02030A',
    overflow: 'hidden',
  },
  summaryPanel: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  eyebrow: {
    color: '#8EA4C8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  summaryTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  modePill: {
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderColor: '#6D28D9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillText: {
    color: '#EDE9FE',
    fontSize: 12,
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F8FAFC',
    outlineStyle: 'none',
  },
  statsRow: {
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'flex-end',
    marginTop: 8,
  },
  statsText: {
    fontSize: 12,
    color: '#8EA4C8',
    fontWeight: '800',
  },
  statsValue: {
    color: '#A78BFA',
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 16,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#1E1B4B',
    borderColor: '#6D28D9',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarInitialText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A78BFA',
  },
  infoContainer: {
    flex: 1,
  },
  studentName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  emailText: {
    fontSize: 13,
    color: '#B9C6DD',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#1E1B4B',
    borderColor: '#6D28D9',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#DDD6FE',
    fontWeight: '700',
  },
  secondaryBadge: {
    backgroundColor: '#052E2B',
    borderColor: '#047857',
  },
  secondaryBadgeText: {
    color: '#34D399',
  },
  actionIcon: {
    padding: 5
  },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#B9C6DD', fontWeight: '800' },
});
