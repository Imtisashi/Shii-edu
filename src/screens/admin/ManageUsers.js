import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Image, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';

export default function ManageUsers({ navigation }) {
  const { userData } = useAuth();
  
  const [activeTab, setActiveTab] = useState('students'); // 'students' or 'teachers'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [displayData, setDisplayData] = useState([]);

  const instType = userData?.instituteData?.type || 'school';

  // --- 1. FETCH LIVE DATA ---
  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "users"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedStudents = [];
      const fetchedTeachers = [];

      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        if (data.role === 'student') fetchedStudents.push(data);
        if (data.role === 'teacher') fetchedTeachers.push(data);
      });

      // Sort alphabetically
      fetchedStudents.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      fetchedTeachers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setStudents(fetchedStudents);
      setTeachers(fetchedTeachers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // --- 2. HANDLE TABS & SEARCH ---
  useEffect(() => {
    const sourceData = activeTab === 'students' ? students : teachers;
    
    if (searchQuery.trim() === '') {
      setDisplayData(sourceData);
    } else {
      const lowerCaseText = searchQuery.toLowerCase();
      const filtered = sourceData.filter(
        user => 
          (user.name && user.name.toLowerCase().includes(lowerCaseText)) || 
          (user.email && user.email.toLowerCase().includes(lowerCaseText)) ||
          (user.teacherCode && user.teacherCode.toLowerCase().includes(lowerCaseText))
      );
      setDisplayData(filtered);
    }
  }, [activeTab, searchQuery, students, teachers]);

  const showUserDetails = (item) => {
    const roleLabel = activeTab === 'students' ? 'Student' : 'Teacher';
    const academicLines = activeTab === 'students'
      ? (instType === 'school'
        ? [`Class: ${item.class || 'N/A'}`, `Section: ${item.section || 'N/A'}`]
        : [`Department: ${item.dept || 'N/A'}`, `Semester: ${item.sem || 'N/A'}`])
      : [`Teacher Code: ${item.teacherCode || 'N/A'}`, `Degree: ${item.degree || 'Faculty'}`];

    const message = [
      `Name: ${item.name || 'Unnamed user'}`,
      `Email: ${item.email || 'No email'}`,
      `Role: ${roleLabel}`,
      `User ID: ${item.uniqueId || item.id || 'N/A'}`,
      ...academicLines,
    ].join('\n');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message);
      return;
    }

    Alert.alert('User Details', message);
  };

  // --- 3. RENDER CARD ---
  const renderUserCard = ({ item }) => {
    const initials = item.name ? item.name.charAt(0).toUpperCase() : 'U';
    
    let primaryBadge = '';
    let secondaryBadge = '';
    
    if (activeTab === 'students') {
      primaryBadge = instType === 'school' ? `Class ${item.class || 'N/A'}` : (item.dept || 'N/A');
      secondaryBadge = instType === 'school' ? `Sec ${item.section || 'N/A'}` : `Sem ${item.sem || 'N/A'}`;
    } else {
      primaryBadge = `Code: ${item.teacherCode || 'N/A'}`;
      secondaryBadge = item.degree || 'Faculty';
    }

    return (
      <View style={styles.card}>
        
        {/* Live Avatar or Fallback */}
        {item.profilePic ? (
          <Image source={{ uri: item.profilePic }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        
        <View style={styles.infoContainer}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.identifier}>{item.email}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{primaryBadge}</Text>
            </View>
            <View style={[styles.badge, styles.secondaryBadge]}>
              <Text style={[styles.badgeText, styles.secondaryBadgeText]}>{secondaryBadge}</Text>
            </View>
          </View>
        </View>
        
        {/* Context Menu Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => showUserDetails(item)}
          accessibilityLabel={`View ${item.name || 'user'} details`}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#A0AEC0" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <DynamicHeader title="User Database" />
      
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'students' && styles.activeTab]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>Students ({students.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'teachers' && styles.activeTab]}
          onPress={() => setActiveTab('teachers')}
        >
          <Text style={[styles.tabText, activeTab === 'teachers' && styles.activeTabText]}>Teachers ({teachers.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#A0AEC0" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab} by name or email...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#A0AEC0"
        />
        {searchQuery.length > 0 && (
          <Ionicons name="close-circle" size={20} color="#A0AEC0" onPress={() => setSearchQuery('')} />
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <SmoothSpinner size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#CBD5E0" />
              <Text style={styles.emptyText}>No users found in this category.</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddUser')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#718096' },
  activeTabText: { color: '#3B82F6' }, // Admin Blue

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#2D3748', outlineStyle: 'none' },

  listContent: { paddingHorizontal: 16, paddingBottom: 130 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  
  // Avatar Styles
  avatarImage: { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
  avatarFallback: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarInitials: { fontSize: 20, fontWeight: 'bold', color: '#3B82F6' },
  
  infoContainer: { flex: 1, minWidth: 0 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#2D3748', marginBottom: 2 },
  identifier: { fontSize: 13, color: '#718096', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 8 },
  badgeText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  secondaryBadge: { backgroundColor: '#EFF6FF' },
  secondaryBadgeText: { color: '#2563EB' },
  actionBtn: { padding: 8 },
  
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#718096' },
  fab: { position: 'absolute', bottom: 88, right: 20, backgroundColor: '#3B82F6', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
});
