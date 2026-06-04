import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import DynamicHeader from '../../components/DynamicHeader';
import { authenticatedFetch } from '../../services/apiClient';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import {
  downloadStudentImportTemplate,
  importStudentsFromCsv,
  parseStudentImportCsv,
} from '../../services/studentImportService';
import { pickSingleDocument } from '../../services/nativePickerService';
import { showNativeMessage } from '../../utils/userFeedback';

const showPlatformAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message || title);
  } else {
    Alert.alert(title, message);
  }
};

export default function AddUser({ navigation }) {
  const { currentUser, userData } = useAuth();
  const { colors, maxContentWidth, radii, spacing, styles, viewport } = useInstituteTheme(baseStyles);
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
  const [importErrors, setImportErrors] = useState([]);
  const [mappingReview, setMappingReview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const instTypeValue = String(userData?.instituteData?.institutionType || userData?.instituteData?.type || 'school').toLowerCase();
  const instType = instTypeValue.includes('college') ? 'college' : 'school';
  const isSchool = instType === 'school';
  const isTeacherRole = role === 'teacher';
  const isParentRole = role === 'parent';
  const isDriverRole = role === 'driver';
  const primaryLabel = isParentRole
    ? 'Linked Student User ID'
    : isDriverRole
      ? 'Vehicle ID'
      : isSchool ? 'Class' : 'Department';
  const secondaryLabel = isParentRole
    ? 'Relationship'
    : isDriverRole
      ? 'Route Name'
      : isSchool ? 'Section' : 'Semester';
  const singleColumn = viewport.width < 520;
  const scrollContentStyle = [
    styles.scrollContent,
    {
      paddingHorizontal: spacing.pageX,
      maxWidth: maxContentWidth,
    },
  ];
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.overlay,
      borderColor: colors.hairline,
      color: colors.text,
    },
  ];
  const labelStyle = [styles.label, { color: colors.textSoft }];

  const returnToAdminHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs');
  };

  const createUserAccount = async ({ fullName, userIdentifier, userPassword, userRole, primary, secondary }) => {
    return authenticatedFetch('/api/admin/users', currentUser, {
      method: 'POST',
      body: {
        instituteId: userData?.instituteId,
        name: fullName,
        identifier: userIdentifier,
        password: userPassword,
        role: userRole,
        primaryTag: primary || null,
        secondaryTag: secondary || null,
      },
    });
  };

  // --- MANUAL CREATION ---
  const handleManualCreate = async () => {
    const trimmedName = name.trim();
    const trimmedIdentifier = identifier.trim();
    const trimmedPrimary = primaryTag.trim();
    const trimmedSecondary = secondaryTag.trim();
    const requiresPrimary = ['student', 'parent', 'driver'].includes(role);
    const requiresSecondary = role === 'student';

    if (!trimmedName || !trimmedIdentifier || !password) {
      showPlatformAlert("Incomplete", "Full name, User ID, and initial password are required.");
      return;
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmedIdentifier)) {
      showPlatformAlert("Invalid User ID", "Use only letters, numbers, dots, underscores, or hyphens.");
      return;
    }

    if ((requiresPrimary && !trimmedPrimary) || (requiresSecondary && !trimmedSecondary)) {
      const requirement = requiresSecondary ? `${primaryLabel} and ${secondaryLabel}` : primaryLabel;
      showPlatformAlert("Incomplete", `${requirement} ${requiresSecondary ? 'are' : 'is'} required for ${role} accounts.`);
      return;
    }

    if (password.length < 8) {
      showPlatformAlert("Weak Password", "Initial password must be at least 8 characters.");
      return;
    }

    setIsCreating(true);

    try {
      await createUserAccount({
        fullName: trimmedName,
        userIdentifier: trimmedIdentifier,
        userPassword: password,
        userRole: role,
        primary: trimmedPrimary || null,
        secondary: trimmedSecondary || null,
      });

      const msg = `Successfully added ${name}!`;
      showPlatformAlert("Success", msg);
      setName(''); setIdentifier(''); setPassword(''); setPrimaryTag(''); setSecondaryTag('');
    } catch (error) {
      console.error(error);
      const err = error.message || "Failed to create user. ID might already exist.";
      showPlatformAlert("Error", err);
    } finally {
      setIsCreating(false);
    }
  };

  // --- BULK CSV CREATION ---
  const handlePickCSV = async () => {
    try {
      const asset = await pickSingleDocument({
        mimeTypes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
      });
      if (!asset) return;

      const result = await parseStudentImportCsv({
        asset,
        currentUser,
        institutionType: isSchool ? 'SCHOOL' : 'COLLEGE',
      });
      setCsvFile(asset);
      setParsedData(result.rows);
      setMappingReview(result.mappingReview);
      setImportErrors([]);
    } catch (error) {
      console.error(error);
      setCsvFile(null);
      setParsedData([]);
      setMappingReview(null);
      setImportErrors([]);
      showPlatformAlert('CSV Validation Failed', error.message || 'The selected CSV file is invalid.');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadStudentImportTemplate(isSchool ? 'SCHOOL' : 'COLLEGE');
    } catch (error) {
      console.error(error);
      showPlatformAlert('Template Download Failed', error.message || 'The CSV template could not be prepared.');
    }
  };

  const handleBulkUpload = async () => {
    if (parsedData.length === 0) return;
    if (mappingReview && !mappingReview.autoApprove) {
      showPlatformAlert('Needs Manual Review', 'The CSV column mapping is below the 95% confidence threshold. Please use the exact template headers before importing.');
      return;
    }
    setIsUploading(true);
    setImportErrors([]);

    try {
      const result = await importStudentsFromCsv({
        currentUser,
        instituteId: userData?.instituteId,
        rows: parsedData,
      });
      if (result.background) {
        showNativeMessage('Processing in Background', 'The student import is running safely. New accounts will appear in the Users list when the job completes.');
        setCsvFile(null);
        setParsedData([]);
        setMappingReview(null);
        returnToAdminHome();
        return;
      }
      setImportErrors(result.errors || []);
      const msg = `Import complete. ${result.createdStudents} students added, ${result.skippedRows} skipped.`;
      showPlatformAlert(result.skippedRows > 0 ? 'Import Completed with Warnings' : 'Import Complete', msg);
      if (result.skippedRows === 0) {
        setCsvFile(null);
        setParsedData([]);
        returnToAdminHome();
      }
    } catch (error) {
      console.error(error);
      showPlatformAlert('Bulk Import Failed', error.message || 'Bulk import failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.page }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DynamicHeader title="Add New Users" showBack={true} />

      <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.hairline, marginHorizontal: spacing.pageX }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'manual' && styles.activeTab,
            activeTab === 'manual' && { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft },
          ]}
          onPress={() => setActiveTab('manual')}
        >
          <Text style={[styles.tabText, { color: colors.muted }, activeTab === 'manual' && styles.activeTabText, activeTab === 'manual' && { color: colors.text }]}>Manual Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'bulk' && styles.activeTab,
            activeTab === 'bulk' && { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft },
          ]}
          onPress={() => setActiveTab('bulk')}
        >
          <Text style={[styles.tabText, { color: colors.muted }, activeTab === 'bulk' && styles.activeTabText, activeTab === 'bulk' && { color: colors.text }]}>Bulk CSV Upload</Text>
        </TouchableOpacity>
      </View>

      {/* MANUAL TAB */}
      {activeTab === 'manual' && (
        <ScrollView contentContainerStyle={scrollContentStyle}>
          <View style={[styles.card, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <Text style={labelStyle}>Full Name</Text>
            <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="e.g. John Doe" placeholderTextColor={colors.muted} />

            <Text style={labelStyle}>User ID</Text>
            <TextInput style={inputStyle} value={identifier} onChangeText={setIdentifier} placeholder="e.g. STU-001, TCH-001, PAR-001, or DRV-001" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} />

            <Text style={labelStyle}>Initial Password</Text>
            <TextInput
              style={inputStyle}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.muted}
              secureTextEntry
            />

            <Text style={labelStyle}>Assign Role</Text>
            <View style={styles.roleContainer}>
              {[
                { id: 'student', label: 'Student' },
                { id: 'teacher', label: 'Teacher' },
                { id: 'parent', label: 'Parent' },
                { id: 'driver', label: 'Driver' },
              ].map((roleOption) => (
                <TouchableOpacity
                  key={roleOption.id}
                  style={[styles.roleBtn, { backgroundColor: colors.card, borderColor: colors.hairline }, role === roleOption.id && styles.activeRole, role === roleOption.id && { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}
                  onPress={() => {
                    setRole(roleOption.id);
                    setPrimaryTag('');
                    setSecondaryTag('');
                  }}
                >
                  <Text style={[styles.roleText, { color: colors.textSoft }, role === roleOption.id && styles.activeRoleText, role === roleOption.id && { color: colors.accent }]}>{roleOption.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.row, singleColumn && styles.rowSingleColumn]}>
              <View style={[styles.fieldColumn, !singleColumn && styles.fieldColumnSpacing]}>
                <Text style={labelStyle}>{primaryLabel}{isTeacherRole ? ' (optional)' : ''}</Text>
                <TextInput
                  style={inputStyle}
                  value={primaryTag}
                  onChangeText={setPrimaryTag}
                  placeholder={
                    isTeacherRole ? `Optional ${primaryLabel.toLowerCase()}`
                      : isParentRole ? 'e.g. STU-2026-001'
                        : isDriverRole ? 'e.g. BUS-04'
                          : isSchool ? 'e.g. 10' : 'e.g. CSE'
                  }
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.fieldColumn}>
                <Text style={labelStyle}>{secondaryLabel}{role !== 'student' ? ' (optional)' : ''}</Text>
                <TextInput
                  style={inputStyle}
                  value={secondaryTag}
                  onChangeText={setSecondaryTag}
                  placeholder={
                    isParentRole ? 'e.g. Mother'
                      : isDriverRole ? 'e.g. North Route'
                        : isTeacherRole ? `Optional ${secondaryLabel.toLowerCase()}`
                          : isSchool ? 'e.g. A' : 'e.g. 3'
                  }
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            {isTeacherRole && (
              <Text style={[styles.helperText, { color: colors.textSoft }]}>
                Teachers are created as unassigned faculty by default. Assign class teacher, batch advisor, department, or semester responsibilities later from Faculty Roster.
              </Text>
            )}
            {isParentRole && (
              <Text style={[styles.helperText, { color: colors.textSoft }]}>
                Parent access is securely linked to one existing student by User ID. Billing and alerts use that student relationship.
              </Text>
            )}
            {isDriverRole && (
              <Text style={[styles.helperText, { color: colors.textSoft }]}>
                Driver access is restricted to the assigned vehicle ID. Live location broadcasting remains institute-isolated.
              </Text>
            )}
          </View>

          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.deepBlue, borderColor: colors.deepBlue }]} onPress={handleManualCreate} disabled={isCreating}>
            {isCreating ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitBtnText}>Create Account</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* BULK TAB */}
      {activeTab === 'bulk' && (
        <ScrollView contentContainerStyle={scrollContentStyle}>
          <View style={[styles.card, { backgroundColor: colors.cardStrong, borderColor: colors.hairline, borderRadius: radii.card }]}>
            <View style={[styles.instructions, { backgroundColor: colors.deepBlueSoft, borderColor: colors.accentSoft }]}>
              <Ionicons name="information-circle" size={24} color={colors.accent} />
              <Text style={[styles.instructionText, { color: colors.textSoft }]}>
                Import up to 500 student accounts in one secure server request. Required headers:{"\n"}
                <Text style={{fontWeight: 'bold'}}>firstName, lastName, userId, password, parentName, parentPhone, {isSchool ? 'standard, section' : 'department, semester'}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.templateButton, { backgroundColor: colors.card, borderColor: colors.hairline }]}
              onPress={handleDownloadTemplate}
            >
              <Ionicons name="download-outline" size={19} color={colors.accent} />
              <Text style={[styles.templateButtonText, { color: colors.text }]}>Download Student Import Template</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.uploadBox, { backgroundColor: colors.overlay, borderColor: colors.muted }]} onPress={handlePickCSV}>
              <Ionicons name="document-text" size={40} color={colors.accent} />
              <Text style={[styles.uploadText, { color: colors.textSoft }]}>{csvFile ? csvFile.name : "Tap to Select CSV File"}</Text>
            </TouchableOpacity>

            {mappingReview ? (
              <View style={[
                styles.mappingPanel,
                {
                  backgroundColor: mappingReview.autoApprove ? colors.emeraldSoft : colors.warningSoft,
                  borderColor: mappingReview.autoApprove ? colors.emerald : colors.warning,
                },
              ]}>
                <Text style={[styles.mappingTitle, { color: colors.text }]}>
                  {mappingReview.autoApprove ? 'AI mapping verified' : 'Needs Manual Review'}
                </Text>
                <Text style={[styles.mappingText, { color: colors.textSoft }]}>
                  Confidence: {Math.round(Number(mappingReview.overallConfidence || 0) * 100)}%
                </Text>
                {!mappingReview.autoApprove ? (
                  <Text style={[styles.mappingText, { color: colors.textSoft }]}>
                    {(mappingReview.reviewReasons || []).join(' ')}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {parsedData.length > 0 && (
              <Text style={[styles.previewText, { color: mappingReview?.autoApprove === false ? colors.warning : colors.success }]}>
                {mappingReview?.autoApprove === false
                  ? `Found ${parsedData.length} row(s), blocked pending manual review.`
                  : `Found ${parsedData.length} valid rows ready for upload.`}
              </Text>
            )}

            {importErrors.length > 0 && (
              <View style={[styles.errorPanel, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
                <Text style={[styles.errorTitle, { color: colors.warning }]}>Rows requiring attention</Text>
                {importErrors.slice(0, 8).map((entry) => (
                  <Text key={`${entry.row}-${entry.userId || 'row'}`} style={[styles.errorRow, { color: colors.textSoft }]}>
                    Row {entry.row}{entry.userId ? ` (${entry.userId})` : ''}: {entry.error}
                  </Text>
                ))}
                {importErrors.length > 8 && (
                  <Text style={[styles.errorRow, { color: colors.textSoft }]}>And {importErrors.length - 8} more rows.</Text>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, { backgroundColor: colors.deepBlue, borderColor: colors.deepBlue }, parsedData.length === 0 && { backgroundColor: colors.muted, borderColor: colors.muted }]}
            onPress={handleBulkUpload} 
            disabled={isUploading || parsedData.length === 0}
          >
            {isUploading ? <SmoothSpinner color="#fff" /> : <Text style={styles.submitBtnText}>Start Bulk Upload</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', overflow: 'hidden' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0F172A', borderColor: '#334155', borderWidth: 1, margin: 16, borderRadius: 8, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8', borderWidth: 1 },
  tabText: { fontSize: 15, fontWeight: '800', color: '#8EA4C8' },
  activeTabText: { color: '#F8FAFC' },
  scrollContent: { alignSelf: 'center', padding: 16, paddingBottom: 80, width: '100%' },
  card: { backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1, padding: 20, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#B9C6DD', marginBottom: 8 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 20, color: '#F8FAFC', outlineStyle: 'none' },
  row: { flexDirection: 'row' },
  rowSingleColumn: { flexDirection: 'column' },
  fieldColumn: { flex: 1, minWidth: 0 },
  fieldColumnSpacing: { marginRight: 10 },
  roleContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 8 },
  roleBtn: { flexGrow: 1, flexBasis: '46%', padding: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center', borderRadius: 8, backgroundColor: '#111827' },
  activeRole: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  roleText: { color: '#B9C6DD', fontWeight: '800' },
  activeRoleText: { color: '#67E8F9', fontWeight: 'bold' },
  helperText: { color: '#B9C6DD', fontSize: 13, lineHeight: 19, marginTop: -6, marginBottom: 8 },
  submitBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB', borderWidth: 1, paddingVertical: 16, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  instructions: { backgroundColor: '#082F49', borderColor: '#075985', borderWidth: 1, padding: 15, borderRadius: 8, flexDirection: 'row', marginBottom: 20 },
  instructionText: { color: '#B9C6DD', fontSize: 13, marginLeft: 10, flex: 1, lineHeight: 20 },
  uploadBox: { borderWidth: 1, borderColor: '#475569', borderStyle: 'dashed', borderRadius: 8, padding: 32, alignItems: 'center', backgroundColor: '#020617' },
  uploadText: { color: '#B9C6DD', marginTop: 10, fontWeight: '800', textAlign: 'center' },
  previewText: { textAlign: 'center', color: '#34D399', fontWeight: 'bold', marginTop: 15 },
  templateButton: { alignItems: 'center', borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', marginBottom: 16, minHeight: 48, paddingHorizontal: 14 },
  templateButtonText: { fontSize: 14, fontWeight: '900', marginLeft: 8 },
  mappingPanel: { borderRadius: 8, borderWidth: 1, marginTop: 14, padding: 13 },
  mappingTitle: { fontSize: 14, fontWeight: '900' },
  mappingText: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 4 },
  errorPanel: { borderRadius: 8, borderWidth: 1, marginTop: 16, padding: 13 },
  errorTitle: { fontSize: 13, fontWeight: '900', marginBottom: 6 },
  errorRow: { fontSize: 12, fontWeight: '700', lineHeight: 18 }
});
