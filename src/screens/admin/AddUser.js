import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, ActivityIndicator, Platform, Alert, KeyboardAvoidingView
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { authenticatedFetch } from '../../services/apiClient';

const showPlatformAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message || title);
  } else {
    Alert.alert(title, message);
  }
};

export default function AddUser({ navigation }) {
  const { currentUser, userData } = useAuth();
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'bulk'
  
  // Manual Form State
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [primaryTag, setPrimaryTag] = useState(''); // Class or Dept
  const [secondaryTag, setSecondaryTag] = useState(''); // Sec or Sem
  const [isCreating, setIsCreating] = useState(false);

  // Bulk Form State
  const [csvFile, setCsvFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const instType = userData?.instituteData?.type || 'school';

  const createUserAccount = async ({ fullName, userIdentifier, userPassword, userRole, primary, secondary }) => {
    return authenticatedFetch('/api/admin/users', currentUser, {
      method: 'POST',
      body: {
        name: fullName,
        identifier: userIdentifier,
        password: userPassword,
        role: userRole,
        primaryTag: primary,
        secondaryTag: secondary,
      },
    });
  };

  // --- MANUAL CREATION ---
  const handleManualCreate = async () => {
    if (!name || !identifier || !primaryTag || !password) {
      showPlatformAlert("Incomplete", "Fill required fields.");
      return;
    }

    if (password.length < 8) {
      showPlatformAlert("Weak Password", "Initial password must be at least 8 characters.");
      return;
    }

    setIsCreating(true);

    try {
      await createUserAccount({
        fullName: name.trim(),
        userIdentifier: identifier.trim(),
        userPassword: password,
        userRole: role,
        primary: primaryTag.trim(),
        secondary: secondaryTag.trim(),
      });

      const msg = `Successfully added ${name}!`;
      showPlatformAlert("Success", msg);
      setName(''); setIdentifier(''); setPassword(''); setPrimaryTag(''); setSecondaryTag('');
    } catch (error) {
      console.error(error);
      const err = "Failed to create user. ID might already exist.";
      showPlatformAlert("Error", err);
    } finally {
      setIsCreating(false);
    }
  };

  // --- BULK CSV CREATION ---
  const handlePickCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'application/vnd.ms-excel'] });
      if (!result.canceled) {
        setCsvFile(result.assets[0]);
        // Fetch and parse the CSV string
        const response = await fetch(result.assets[0].uri);
        const csvText = await response.text();
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => setParsedData(results.data)
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkUpload = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);

    try {
      let successCount = 0;
      let failCount = 0;

      // Process sequentially to avoid tripping auth/provider rate limits.
      for (const row of parsedData) {
        if (!row.Name || !row.ID || !row.Password) {
          failCount++;
          continue;
        }

        try {
          await createUserAccount({
            fullName: row.Name.trim(),
            userIdentifier: row.ID.trim(),
            userPassword: row.Password,
            userRole: row.Role ? row.Role.toLowerCase() : 'student',
            primary: instType === 'school' ? row.Class : row.Dept,
            secondary: instType === 'school' ? row.Section : row.Sem,
          });
          successCount++;
        } catch (e) {
          console.warn(`Failed to process row: ${row.Name}`, e);
          failCount++;
        }
      }

      const msg = `Bulk upload complete. ${successCount} users added, ${failCount} skipped.`;
      showPlatformAlert("Success", msg);
      setCsvFile(null); setParsedData([]);
      navigation.goBack();
    } catch (error) {
      console.error(error);
      showPlatformAlert("Error", "Bulk upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DynamicHeader title="Add New Users" showBack={true} />

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'manual' && styles.activeTab]} onPress={() => setActiveTab('manual')}>
          <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>Manual Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'bulk' && styles.activeTab]} onPress={() => setActiveTab('bulk')}>
          <Text style={[styles.tabText, activeTab === 'bulk' && styles.activeTabText]}>Bulk CSV Upload</Text>
        </TouchableOpacity>
      </View>

      {/* MANUAL TAB */}
      {activeTab === 'manual' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. John Doe" />

            <Text style={styles.label}>{instType === 'school' ? 'Student ID' : 'Email Address'}</Text>
            <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} placeholder={instType === 'school' ? 'e.g. STU-2026-001' : 'e.g. john@college.edu'} autoCapitalize="none" />

            <Text style={styles.label}>Initial Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
            />

            <Text style={styles.label}>Assign Role</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleBtn, role === 'student' && styles.activeRole]} onPress={() => setRole('student')}>
                <Text style={[styles.roleText, role === 'student' && styles.activeRoleText]}>Student</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleBtn, role === 'teacher' && styles.activeRole]} onPress={() => setRole('teacher')}>
                <Text style={[styles.roleText, role === 'teacher' && styles.activeRoleText]}>Teacher</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 10}}>
                <Text style={styles.label}>{instType === 'school' ? 'Class' : 'Department'}</Text>
                <TextInput style={styles.input} value={primaryTag} onChangeText={setPrimaryTag} placeholder={instType === 'school' ? 'e.g. 10' : 'e.g. CSE'} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.label}>{instType === 'school' ? 'Section' : 'Semester'}</Text>
                <TextInput style={styles.input} value={secondaryTag} onChangeText={setSecondaryTag} placeholder={instType === 'school' ? 'e.g. A' : 'e.g. 3'} />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleManualCreate} disabled={isCreating}>
            {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Account</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* BULK TAB */}
      {activeTab === 'bulk' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.instructions}>
              <Ionicons name="information-circle" size={24} color="#3B82F6" />
              <Text style={styles.instructionText}>
                Upload a CSV file with the following headers:{"\n"}
                <Text style={{fontWeight: 'bold'}}>Name, ID, Password, Role, {instType === 'school' ? 'Class, Section' : 'Dept, Sem'}</Text>{"\n"}
                Password is required for every row.
              </Text>
            </View>

            <TouchableOpacity style={styles.uploadBox} onPress={handlePickCSV}>
              <Ionicons name="document-text" size={40} color="#94A3B8" />
              <Text style={styles.uploadText}>{csvFile ? csvFile.name : "Tap to Select CSV File"}</Text>
            </TouchableOpacity>

            {parsedData.length > 0 && (
              <Text style={styles.previewText}>Found {parsedData.length} valid rows ready for upload.</Text>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, parsedData.length === 0 && { backgroundColor: '#94A3B8' }]} 
            onPress={handleBulkUpload} 
            disabled={isUploading || parsedData.length === 0}
          >
            {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Start Bulk Upload</Text>}
          </TouchableOpacity>
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
  activeTabText: { color: '#3B82F6' },
  scrollContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, elevation: 2, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 20 },
  row: { flexDirection: 'row' },
  roleContainer: { flexDirection: 'row', marginBottom: 20 },
  roleBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', marginRight: 10, borderRadius: 10 },
  activeRole: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  roleText: { color: '#64748B', fontWeight: '600' },
  activeRoleText: { color: '#3B82F6', fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#3B82F6', paddingVertical: 18, borderRadius: 16, alignItems: 'center', elevation: 3 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  instructions: { backgroundColor: '#EFF6FF', padding: 15, borderRadius: 12, flexDirection: 'row', marginBottom: 20 },
  instructionText: { color: '#1E3A8A', fontSize: 13, marginLeft: 10, flex: 1, lineHeight: 20 },
  uploadBox: { borderWidth: 2, borderColor: '#CBD5E0', borderStyle: 'dashed', borderRadius: 16, padding: 40, alignItems: 'center', backgroundColor: '#F8FAFC' },
  uploadText: { color: '#64748B', marginTop: 10, fontWeight: '600', textAlign: 'center' },
  previewText: { textAlign: 'center', color: '#10B981', fontWeight: 'bold', marginTop: 15 }
});
