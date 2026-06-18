import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView, Switch } from 'react-native';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';

export default function ManageTeachers() {
  const { userData } = useAuth();
  const { colors, styles } = useInstituteTheme(baseStyles);
  
  // BULLETPROOF DETECTION
  const instTypeStr = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();
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
  const getTeacherId = (teacher) => (
    teacher?.loginId ||
    teacher?.uniqueId ||
    teacher?.teacherCode ||
    teacher?.id ||
    'ID pending'
  );
  const normalizeAssignment = (value) => String(value || '').trim().toLowerCase();

  // 1. Fetch Live Faculty Data
  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

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
    }, (error) => {
      console.error('Faculty roster query failed:', error);
      setTeachers([]);
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

    if (isClassTeacher) {
      const primary = normalizeAssignment(primaryTag);
      const secondary = normalizeAssignment(secondaryTag);
      const duplicateTeacher = teachers.find((teacher) => {
        if (teacher.id === selectedTeacher.id || teacher.isClassTeacher !== true) return false;
        const teacherPrimary = normalizeAssignment(isSchool ? teacher.assignedClass : teacher.assignedDept);
        const teacherSecondary = normalizeAssignment(isSchool ? teacher.assignedSection : teacher.assignedSem);
        return teacherPrimary === primary && teacherSecondary === secondary;
      });

      if (duplicateTeacher) {
        const msg = `${duplicateTeacher.name || 'Another teacher'} is already assigned to ${isSchool ? 'Class' : 'Department'} ${primaryTag.trim()} - ${isSchool ? 'Section' : 'Semester'} ${secondaryTag.trim()}. Remove that assignment before adding a new in-charge.`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Duplicate Assignment', msg);
        }
        return;
      }
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

      <View style={styles.summaryPanel}>
        <View>
          <Text style={styles.eyebrow}>Faculty command</Text>
          <Text style={styles.summaryTitle}>{teachers.length} active educators</Text>
        </View>
        <View style={styles.modePill}>
          <Ionicons name={isSchool ? 'school-outline' : 'business-outline'} size={15} color="#34D399" />
          <Text style={styles.modePillText}>{isSchool ? 'Class Teacher' : 'Batch Advisor'} model</Text>
        </View>
      </View>

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
          {loading ? <RosterSkeleton rowCount={5} /> : teachers.length === 0 ? (
            <Text style={styles.emptyText}>No teachers found in the database.</Text>
          ) : (
            teachers.map(t => (
              <View key={t.id} style={styles.teacherCard}>
                <View style={styles.avatarCage}>
                  <Text style={styles.avatarText}>{t.name ? t.name.charAt(0).toUpperCase() : 'T'}</Text>
                </View>
                <View style={styles.infoBox}>
                  <Text style={styles.teacherName}>{t.name}</Text>
                  <Text style={styles.teacherEmail}>ID: {getTeacherId(t)}</Text>
                  
                  {t.isClassTeacher ? (
                    <View style={styles.classTeacherBadge}>
                      <Ionicons name="star" size={12} color="#F7C948" style={{marginRight: 4}} />
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
                          placeholderTextColor={colors.muted}
                          value={primaryTag} 
                          onChangeText={setPrimaryTag} 
                        />
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.label}>{isSchool ? 'Section' : 'Semester'}</Text>
                        <TextInput 
                          style={styles.input} 
                          placeholder={isSchool ? 'e.g. A' : 'e.g. 3'} 
                          placeholderTextColor={colors.muted}
                          value={secondaryTag} 
                          onChangeText={setSecondaryTag} 
                        />
                      </View>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.submitBtn} onPress={handleSaveRole} disabled={isSaving}>
                  {isSaving ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitText}>Save Privileges</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}

    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', overflow: 'hidden' },
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
    backgroundColor: '#064E3B',
    borderColor: '#047857',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '900',
  },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1, margin: 16, borderRadius: 8, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#047857', borderColor: '#047857', borderWidth: 1 },
  tabText: { fontSize: 15, fontWeight: '800', color: '#8EA4C8' },
  activeTabText: { color: '#F8FAFC' },
  scrollContent: { padding: 16, paddingBottom: 80 },
  emptyText: { color: '#B9C6DD', fontWeight: '800', textAlign: 'center', marginTop: 20 },
  
  teacherCard: { flexDirection: 'row', backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 14, marginBottom: 10, alignItems: 'center' },
  avatarCage: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#064E3B', borderColor: '#047857', borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#34D399' },
  infoBox: { flex: 1, minWidth: 0 },
  teacherName: { fontSize: 16, fontWeight: '900', color: '#F8FAFC', marginBottom: 2 },
  teacherEmail: { fontSize: 12, color: '#B9C6DD', marginBottom: 8 },
  classTeacherBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#422006', borderColor: '#A16207', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  classTeacherText: { color: '#F7C948', fontSize: 11, fontWeight: 'bold' },
  subjectTeacherBadge: { backgroundColor: '#111827', borderColor: '#334155', borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  subjectTeacherText: { color: '#B9C6DD', fontSize: 11, fontWeight: 'bold' },

  card: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 20 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#F8FAFC', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#8EA4C8', marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', marginBottom: 25 },
  chip: { backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  activeChip: { backgroundColor: '#10B981', borderColor: '#10B981' },
  chipText: { color: '#B9C6DD', fontWeight: '800' },
  activeChipText: { color: '#fff' },
  
  formArea: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginBottom: 20 },
  switchTitle: { fontSize: 15, fontWeight: 'bold', color: '#F8FAFC' },
  switchSub: { fontSize: 12, color: '#B9C6DD', marginTop: 4, lineHeight: 18 },
  
  targetBox: { backgroundColor: '#052E2B', padding: 15, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#047857' },
  row: { flexDirection: 'row', marginBottom: 10 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 12, fontSize: 15, color: '#F8FAFC', outlineStyle: 'none' },
  
  submitBtn: { backgroundColor: '#047857', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
