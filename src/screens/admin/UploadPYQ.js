import React, { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { uploadInstitutionAsset } from '../../services/cloudinaryService';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
};

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatBytes = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isPdfAsset = (asset) => {
  const mimeType = String(asset?.mimeType || asset?.type || '').toLowerCase();
  const name = String(asset?.name || asset?.fileName || '').toLowerCase();
  return mimeType.includes('pdf') || name.endsWith('.pdf');
};

export default function UploadPYQ() {
  const { currentUser, userData } = useAuth();
  const layout = useResponsiveLayout();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const visiblePapers = useMemo(
    () => [...papers].sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt)),
    [papers]
  );

  useEffect(() => {
    if (!userData?.instituteId) {
      setLoading(false);
      return undefined;
    }

    const papersQuery = query(
      collection(db, 'pyqs'),
      where('instituteId', '==', userData.instituteId)
    );

    const unsubscribe = onSnapshot(papersQuery, (snapshot) => {
      setPapers(snapshot.docs.map((paperDoc) => ({ id: paperDoc.id, ...paperDoc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('PYQ fetch failed:', error);
      setLoading(false);
      showAlert('PYQs Unavailable', 'Could not load uploaded papers right now.');
    });

    return () => unsubscribe();
  }, [userData?.instituteId]);

  const resetForm = () => {
    setTitle('');
    setSubject('');
    setYear(String(new Date().getFullYear()));
  };

  const pickAndUploadPdf = async () => {
    if (!userData?.instituteId) {
      showAlert('Missing Institute', 'Your profile is not linked to an institute.');
      return;
    }

    const cleanedTitle = title.trim();
    const cleanedSubject = subject.trim();
    const cleanedYear = year.trim();

    if (!cleanedTitle || !cleanedSubject || !cleanedYear) {
      showAlert('Details Required', 'Enter the title, subject, and year before uploading a PYQ PDF.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!isPdfAsset(asset)) {
      showAlert('PDF Only', 'Please select a valid PDF file.');
      return;
    }

    setUploading(true);
    try {
      if (!currentUser?.uid) {
        throw new Error('A signed-in faculty user is required to upload PYQs.');
      }

      const uploadResult = await uploadInstitutionAsset({
        asset,
        folder: `institutions/${userData.instituteId}/pyqs`,
        resourceType: 'raw',
        deliveryType: 'upload',
        context: {
          module: 'pyqs',
          subject: cleanedSubject,
          year: cleanedYear,
          instituteId: userData.instituteId,
          uploadedBy: currentUser.uid,
        },
      });

      if (!uploadResult?.secureUrl) {
        throw new Error('Upload service did not return a file URL.');
      }

      await addDoc(collection(db, 'pyqs'), {
        title: cleanedTitle,
        subject: cleanedSubject,
        year: cleanedYear,
        fileUrl: uploadResult.secureUrl,
        fileName: asset.name || `${cleanedTitle}.pdf`,
        fileSize: uploadResult.bytes || asset.size || null,
        fileType: 'pdf',
        mimeType: asset.mimeType || 'application/pdf',
        assetProvider: uploadResult.provider,
        cloudinaryPublicId: uploadResult.publicId || null,
        cloudinaryAssetId: uploadResult.assetId || null,
        resourceType: uploadResult.resourceType || 'raw',
        deliveryType: uploadResult.deliveryType || 'upload',
        instituteId: userData.instituteId,
        uploadedBy: userData.name || userData.email || 'Faculty',
        uploadedByUid: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      resetForm();
      showAlert('Uploaded', 'The PYQ PDF is now available to students.');
    } catch (error) {
      console.error('PYQ upload failed:', error);
      showAlert('Upload Failed', 'Could not upload the PDF. Please retry after deployment finishes.');
    } finally {
      setUploading(false);
    }
  };

  const deletePaper = (paperId) => {
    const removePaper = () => deleteDoc(doc(db, 'pyqs', paperId));

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this PYQ PDF permanently?')) removePaper();
      return;
    }

    Alert.alert('Delete PYQ', 'Delete this PYQ PDF permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: removePaper },
    ]);
  };

  const renderPaper = ({ item }) => (
    <View style={[styles.paperCard, layout.isMobile && styles.paperCardMobile]}>
      <View style={styles.paperIcon}>
        <Ionicons name="document-text" size={24} color="#DC2626" />
      </View>
      <View style={styles.paperInfo}>
        <Text style={styles.paperTitle} numberOfLines={1}>{item.title || `${item.subject} ${item.year}`}</Text>
        <Text style={styles.paperMeta} numberOfLines={1}>
          {item.subject || 'Subject'} - {item.year || 'Year'} - {formatBytes(item.fileSize)}
        </Text>
        <Text style={styles.paperUploader} numberOfLines={1}>Uploaded by {item.uploadedBy || 'Faculty'}</Text>
      </View>
      <View style={styles.paperActions}>
        <TouchableOpacity style={styles.iconButton} onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)} accessibilityLabel="Open PYQ PDF">
          <Ionicons name="open-outline" size={19} color="#2563EB" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconButton, styles.deleteButton]} onPress={() => deletePaper(item.id)} accessibilityLabel="Delete PYQ PDF">
          <Ionicons name="trash-outline" size={19} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={visiblePapers}
        keyExtractor={(item) => item.id}
        renderItem={renderPaper}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.horizontalPadding },
          layout.isDesktop && styles.contentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={[styles.hero, layout.isMobile && styles.heroMobile]}>
              <View style={styles.heroIcon}>
                <Ionicons name="library" size={28} color="#2563EB" />
              </View>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, layout.isMobile && styles.heroTitleMobile]}>PYQ PDF Library</Text>
                <Text style={styles.heroText}>Upload verified previous-year question papers as PDFs for students.</Text>
              </View>
            </View>

            <View style={[styles.uploadPanel, layout.isDesktop && styles.uploadPanelDesktop]}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Paper Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Midterm question paper"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.formRow, layout.isMobile && styles.formRowMobile]}>
                <View style={styles.flexInput}>
                  <Text style={styles.label}>Subject</Text>
                  <TextInput
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Mathematics"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={[styles.yearInput, layout.isMobile && styles.yearInputMobile]}>
                  <Text style={styles.label}>Year</Text>
                  <TextInput
                    style={styles.input}
                    value={year}
                    onChangeText={setYear}
                    placeholder="2026"
                    keyboardType="number-pad"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
              <TouchableOpacity style={[styles.uploadButton, uploading && styles.disabled]} onPress={pickAndUploadPdf} disabled={uploading}>
                {uploading ? (
                  <SmoothSpinner size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={21} color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>Select and Upload PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Uploaded Papers</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <SmoothSpinner color="#2563EB" />
              <Text style={styles.emptyText}>Loading papers...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-attach-outline" size={44} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No PYQ PDFs uploaded</Text>
              <Text style={styles.emptyText}>Use the upload panel above to publish the first paper.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: 16, paddingBottom: 110 },
  contentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  headerStack: { marginBottom: 4 },
  hero: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroMobile: { alignItems: 'flex-start' },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  heroTitleMobile: { fontSize: 22 },
  heroText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginTop: 5 },
  uploadPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  uploadPanelDesktop: { padding: 20 },
  inputGroup: { marginBottom: 12 },
  label: { color: '#475569', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#0F172A',
    fontSize: 15,
    outlineStyle: 'none',
  },
  formRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  formRowMobile: { flexDirection: 'column' },
  flexInput: { flex: 1 },
  yearInput: { width: 150 },
  yearInputMobile: { width: '100%' },
  uploadButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: { opacity: 0.72 },
  uploadButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginLeft: 8 },
  sectionTitle: { color: '#0F172A', fontSize: 19, fontWeight: '900', marginBottom: 12 },
  paperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  paperCardMobile: { alignItems: 'flex-start' },
  paperIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  paperInfo: { flex: 1, minWidth: 0 },
  paperTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  paperMeta: { color: '#64748B', fontSize: 13, fontWeight: '700', marginTop: 4 },
  paperUploader: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  paperActions: { flexDirection: 'row', marginLeft: 10 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteButton: { backgroundColor: '#FEF2F2' },
  emptyState: { alignItems: 'center', padding: 28, backgroundColor: '#FFFFFF', borderRadius: 20 },
  emptyTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
