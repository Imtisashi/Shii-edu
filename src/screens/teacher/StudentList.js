import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';

export default function StudentList() {
  const { userData } = useAuth();
  
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Check if we are dealing with a school or college
  const instType = userData?.instituteData?.type || 'school';

  useEffect(() => {
    if (!userData?.instituteId) return;

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
          (student.email && student.email.toLowerCase().includes(lowerCaseText))
      );
      setFilteredStudents(filtered);
    }
  };

  const renderStudentCard = ({ item }) => {
    // Determine dynamic tags based on school vs college
    const primaryTag = instType === 'school' ? `Class ${item.class || 'N/A'}` : (item.dept || 'N/A');
    const secondaryTag = instType === 'school' ? `Sec ${item.section || 'N/A'}` : `Sem ${item.sem || 'N/A'}`;
    const initials = item.name ? item.name.charAt(0).toUpperCase() : 'S';

    return (
      <View style={styles.card}>
        
        {/* Real Avatar or Initial Fallback */}
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitialText}>{initials}</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.studentName}>{item.name}</Text>
          <Text style={styles.emailText}>{item.email}</Text>
          
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
           <Ionicons name="chevron-forward" size={20} color="#CBD5E0" />
        </View>

      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DynamicHeader title="Student Directory" showBack={false} />
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#A0AEC0" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#A0AEC0"
        />
        {searchQuery.length > 0 && (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color="#A0AEC0" 
            onPress={() => handleSearch('')} 
          />
        )}
      </View>

      <View style={styles.statsRow}>
         <Text style={styles.statsText}>Total Enrolled: <Text style={{fontWeight: 'bold', color: '#8E24AA'}}>{students.length}</Text></Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8E24AA" />
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#CBD5E0" />
              <Text style={styles.emptyText}>No students found in the database.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 5,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3748',
  },
  statsRow: {
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'flex-end'
  },
  statsText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '600'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3E5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarInitialText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8E24AA',
  },
  infoContainer: {
    flex: 1,
  },
  studentName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 2,
  },
  emailText: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#3182CE',
    fontWeight: '700',
  },
  secondaryBadge: {
    backgroundColor: '#F0FDF4',
  },
  secondaryBadgeText: {
    color: '#16A34A',
  },
  actionIcon: {
    padding: 5
  }
});