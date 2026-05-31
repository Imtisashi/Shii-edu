import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Switch
} from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';

export default function ManageTeachers() {
  const { userData } = useAuth();
  
  // BULLETPROOF DETECTION
  const instTypeStr = (userData?.instituteData?.type || 'school').toLowerCase();
  const isSchool = instTypeStr.includes('school');

  const [activeTab, setActiveTab] = useState('roster'); // 'roster' or 'assign'
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Assignment Form State
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [primaryTag, setPrimaryTag] = useState(''); // Holds either Class OR Dept
  const [secondaryTag, setSecondaryTag] = useState(''); // Holds either Section OR Sem

  // 1. Fetch Live Faculty Data
  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "users"), 
      where("instituteId", "==", userData.instituteId), 
      where("role", "==", "teacher")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTeachers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedTeachers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setTeachers(fetchedTeachers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // 2. Handle Assignment Saving
  const handleSaveRole = async () => {
    if (!selectedTeacher) {
      if (Platform.OS === 'web') {
        window.alert("Select a teacher first.");
      } else {
        Alert.alert("Error", "Select a teacher first.");
      }
      return;
    }

    if (isClassTeacher && (!primaryTag || !secondaryTag)) {
      const msg = `Please provide the ${isSchool ? 'Class and Section' : 'Department and Semester'}.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert("Incomplete", msg);
      }
      return;
    }

    setIsSaving(true);
    try {
      const teacherRef = doc(db, "users", selectedTeacher.id);
      
      const updateData = {
        isClassTeacher: isClassTeacher,
      };

      // Strict saving based on campus type
      if (isClassTeacher) {
        if (isSchool) {
          updateData.assignedClass = primaryTag.trim();
          updateData.assignedSection = secondaryTag.trim();
          updateData.assignedDept = null;
          updateData.assignedSem = null;
        } else {
          updateData.assignedDept = primaryTag.trim();
          updateData.assignedSem = secondaryTag.trim();
          updateData.assignedClass = null;
          updateData.assignedSection = null;
        }
      } else {
        updateData.assignedClass = null;
        updateData.assignedSection = null;
        updateData.assignedDept = null;
        updateData.assignedSem = null;
      }

      await updateDoc(teacherRef, updateData);

      const successMsg = `Updated roles for ${selectedTeacher.name}`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert("Success", successMsg);
      }
      
      // Reset Form
      setSelectedTeacher(null);
      setIsClassTeacher(false);
      setPrimaryTag('');
      setSecondaryTag('');
      setActiveTab('roster');
      
    } catch (error) {
      console.error(error);
      if (Platform.OS === 'web') {
        window.alert("Failed to update teacher.");
      } else {
        Alert.alert("Error", "Failed to update teacher.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to dynamically render the teacher's badge
  const getTeacherBadgeText = (t) => {
    if (isSchool) {
      return `Class ${t.assignedClass || 'N/A'} - Sec ${t.assignedSection || 'N/A'}`;
    } else {
      return `${t.assignedDept || 'N/A'} - Sem ${t.assignedSem || 'N/A'}`;
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DynamicHeader title="Faculty Roster" showBack={true} />

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'roster' && styles.activeTab]} onPress={() => setActiveTab('roster')}>
          <Text style={[styles.tabText, activeTab === 'roster' && styles.activeTabText]}>Teacher Directory</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'assign' && styles.activeTab]} onPress={() => setActiveTab('assign')}>
          <Text style={[styles.tabText, activeTab === 'assign' && styles.activeTabText]}>Assign Roles</Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: ROSTER DIRECTORY */}
      {activeTab === 'roster' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator size="large" color="#10B981" /> : teachers.length === 0 ? (
            <Text style={styles.emptyText}>No teachers found in the database.</Text>
          ) : (
            teachers.map(t => (
              <View key={t.id} style={styles.teacherCard}>
                <View style={styles.avatarCage}>
                  <Text style={styles.avatarText}>{t.name ? t.name.charAt(0).toUpperCase() : 'T'}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.teacherName}>{t.name}</Text>
                  <Text style={styles.teacherEmail}>{t.email}</Text>
                  
                  {t.isClassTeacher ? (
                    <View style={styles.classTeacherBadge}>
                      <Ionicons name="star" size={12} color="#D97706" style={{marginRight: 4}} />
                      <Text style={styles.classTeacherText}>{getTeacherBadgeText(t)}</Text>
                    </View>
                  ) : (
                    <View style={styles.subjectTeacherBadge}>
                      <Text style={styles.subjectTeacherText}>Subject Teacher</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* TAB 2: ROLE ASSIGNMENT */}
      {activeTab === 'assign' && (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set Privileges</Text>

            <Text style={styles.label}>Select Faculty Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {teachers.map(t => (
                <TouchableOpacity 
                  key={t.id} 
                  style={[styles.chip, selectedTeacher?.id === t.id && styles.activeChip]}
                  onPress={() => setSelectedTeacher(t)}
                >
                  <Text style={[styles.chipText, selectedTeacher?.id === t.id && styles.activeChipText]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedTeacher && (
              <View style={styles.formArea}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 15 }}>
                    <Text style={styles.switchTitle}>
                      {isSchool ? 'Assign as Class Teacher' : 'Assign as Batch Advisor'}
                    </Text>
                    <Text style={styles.switchSub}>Grants exclusive attendance & reporting rights for a specific batch.</Text>
                  </View>
                  <Switch 
                    value={isClassTeacher} 
                    onValueChange={setIsClassTeacher}
                    trackColor={{ false: "#E2E8F0", true: "#10B981" }}
                    thumbColor={"#ffffff"}
                  />
                </View>

                {isClassTeacher && (
                  <View style={styles.targetBox}>
                    <View style={styles.row}>
                      <View style={{flex: 1, marginRight: 10}}>
                        <Text style={styles.label}>{isSchool ? 'Target Class' : 'Target Dept'}</Text>
                        <TextInput 
                          style={styles.input} 
                          placeholder={isSchool ? 'e.g. 10' : 'e.g. CSE'} 
                          value={primaryTag} 
                          onChangeText={setPrimaryTag} 
                        />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.label}>{isSchool ? 'Section' : 'Semester'}</Text>
                        <TextInput 
                          style={styles.input} 
                          placeholder={isSchool ? 'e.g. A' : 'e.g. 3'} 
                          value={secondaryTag} 
                          onChangeText={setSecondaryTag} 
                        />
                      </View>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.submitBtn} onPress={handleSaveRole} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Privileges</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#E2E8F0', margin: 16, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#FFFFFF', elevation: 2 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#718096' },
  activeTabText: { color: '#10B981' },
  scrollContent: { padding: 16, paddingBottom: 80 },
  emptyText: { color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  
  teacherCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1, alignItems: 'center' },
  avatarCage: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#10B981' },
  infoBox: { flex: 1 },
  teacherName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
  teacherEmail: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  classTeacherBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  classTeacherText: { color: '#D97706', fontSize: 11, fontWeight: 'bold' },
  subjectTeacherBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  subjectTeacherText: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', marginBottom: 25 },
  chip: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  activeChip: { backgroundColor: '#10B981', borderColor: '#10B981' },
  chipText: { color: '#64748B', fontWeight: '600' },
  activeChipText: { color: '#fff' },
  
  formArea: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  switchTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  switchSub: { fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 18 },
  
  targetBox: { backgroundColor: '#ECFDF5', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#A7F3D0' },
  row: { flexDirection: 'row', marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, padding: 12, fontSize: 15, color: '#1E293B' },
  
  submitBtn: { backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
