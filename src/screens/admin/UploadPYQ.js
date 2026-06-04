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
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { uploadInstitutionAsset } from '../../services/cloudinaryService';
import { RosterSkeleton, SmoothSpinner } from '../../components/ui/LoadingState';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import { pickSingleDocument } from '../../services/nativePickerService';
import {
  createSupabasePyq,
  deleteSupabasePyq,
  listSupabasePyqs,
} from '../../services/supabaseTenantDataService';
import { showNativeError } from '../../utils/userFeedback';

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
  const { colors, styles } = useInstituteTheme(baseStyles);
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

    let cancelled = false;
    let unsubscribeFirestore = null;

    const startFirestoreFallback = () => {
      const papersQuery = query(
        collection(db, 'pyqs'),
        where('instituteId', '==', userData.instituteId)
      );

      unsubscribeFirestore = onSnapshot(papersQuery, (snapshot) => {
        if (cancelled) return;
        setPapers(snapshot.docs.map((paperDoc) => ({ id: paperDoc.id, ...paperDoc.data(), dataSource: 'firestore' })));
        setLoading(false);
      }, (error) => {
        if (cancelled) return;
        console.error('PYQ fetch failed:', error);
        setLoading(false);
        showAlert('PYQs Unavailable', 'Could not load uploaded papers right now.');
      });
    };

    setLoading(true);
    listSupabasePyqs(currentUser)
      .then(({ papers: supabasePapers }) => {
        if (cancelled) return;
        setPapers(Array.isArray(supabasePapers) ? supabasePapers : []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Supabase PYQ bridge failed, falling back to Firestore:', error);
        startFirestoreFallback();
      });

    return () => {
      cancelled = true;
      if (typeof unsubscribeFirestore === 'function') unsubscribeFirestore();
    };
  }, [currentUser, userData?.instituteId]);

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

    setUploading(true);
    try {
      const asset = await pickSingleDocument({
        mimeTypes: 'application/pdf',
      });
      if (!asset) return;

      if (!isPdfAsset(asset)) {
        throw new Error('Please select a valid PDF file.');
      }

      if (!currentUser?.uid) {
        throw new Error('A signed-in faculty user is required to upload PYQs.');
      }

      const uploadResult = await uploadInstitutionAsset({
        currentUser,
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

      const pyqPayload = {
        title: cleanedTitle,
        subject: cleanedSubject,
        year: cleanedYear,
        fileUrl: uploadResult.secureUrl,
        fileName: asset.name || `${cleanedTitle}.pdf`,
        fileSize: uploadResult.bytes || asset.size || null,
        fileType: 'pdf',
        mimeType: asset.mimeType || 'application/pdf',
        assetProvider: uploadResult.provider,
        cloudinaryPublicId: uploadResult.provider === 'cloudinary' ? uploadResult.publicId || null : null,
        cloudinaryAssetId: uploadResult.provider === 'cloudinary' ? uploadResult.assetId || null : null,
        storageBucket: uploadResult.storageBucket || null,
        storagePath: uploadResult.storagePath || null,
        supabasePath: uploadResult.supabasePath || null,
        resourceType: uploadResult.resourceType || 'raw',
        deliveryType: uploadResult.deliveryType || 'upload',
        instituteId: userData.instituteId,
        uploadedBy: userData.name || userData.email || 'Faculty',
        uploadedByUid: currentUser.uid,
      };

      await createSupabasePyq(currentUser, pyqPayload);
      await addDoc(collection(db, 'pyqs'), {
        ...pyqPayload,
        createdAt: serverTimestamp(),
      });

      const { papers: supabasePapers } = await listSupabasePyqs(currentUser);
      setPapers(Array.isArray(supabasePapers) ? supabasePapers : []);
      resetForm();
      showAlert('Uploaded', 'The PYQ PDF is now available to students.');
    } catch (error) {
      console.error('PYQ upload failed:', error);
      showNativeError('Upload Failed', error, 'Could not upload the PDF. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const deletePaper = (paperId, item = {}) => {
    const removePaper = async () => {
      if (item.dataSource === 'supabase' || item.supabaseId) {
        await deleteSupabasePyq(currentUser, item.supabaseId || paperId);
        setPapers((current) => current.filter((paper) => paper.id !== paperId));
        return;
      }

      await deleteDoc(doc(db, 'pyqs', paperId));
    };

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
        <TouchableOpacity style={[styles.iconButton, styles.deleteButton]} onPress={() => deletePaper(item.id, item)} accessibilityLabel="Delete PYQ PDF">
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
                  placeholderTextColor={colors.muted}
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
                    placeholderTextColor={colors.muted}
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
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
              <TouchableOpacity style={[styles.uploadButton, uploading && styles.disabled]} onPress={pickAndUploadPdf} disabled={uploading}>
                {uploading ? (
                  <>
                    <SmoothSpinner size="small" color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>Uploading Document...</Text>
                  </>
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
            <RosterSkeleton rowCount={5} showFilters={false} style={styles.embeddedSkeleton} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="document-attach-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>No PYQ PDFs uploaded</Text>
              <Text style={styles.emptyText}>Use the upload panel above to publish the first paper.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  content: { paddingTop: 16, paddingBottom: 110 },
  contentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  headerStack: { marginBottom: 4 },
  hero: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroMobile: { alignItems: 'flex-start' },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderColor: '#075985',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  heroTitleMobile: { fontSize: 22 },
  heroText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20, marginTop: 5 },
  uploadPanel: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  uploadPanelDesktop: { padding: 20 },
  inputGroup: { marginBottom: 12 },
  label: { color: '#8EA4C8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  input: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#F8FAFC',
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
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: { opacity: 0.72 },
  uploadButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginLeft: 8 },
  sectionTitle: { color: '#F8FAFC', fontSize: 19, fontWeight: '900', marginBottom: 12 },
  paperCard: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  paperCardMobile: { alignItems: 'flex-start' },
  paperIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#450A0A',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  paperInfo: { flex: 1, minWidth: 0 },
  paperTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  paperMeta: { color: '#B9C6DD', fontSize: 13, fontWeight: '700', marginTop: 4 },
  paperUploader: { color: '#8EA4C8', fontSize: 12, marginTop: 3 },
  paperActions: { flexDirection: 'row', marginLeft: 10 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#082F49',
    borderColor: '#075985',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteButton: { backgroundColor: '#450A0A', borderColor: '#7F1D1D' },
  emptyState: { alignItems: 'center', padding: 28, backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: 8, borderWidth: 1 },
  embeddedSkeleton: { minHeight: 440 },
  emptyTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', marginTop: 12 },
  emptyText: { color: '#B9C6DD', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
