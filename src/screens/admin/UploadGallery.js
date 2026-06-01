import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; 
import { useAuth } from '../../contexts/AuthContext';
import { uploadInstitutionAsset } from '../../services/cloudinaryService';
import { Ionicons } from '@expo/vector-icons';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function UploadGallery() {
  const { currentUser, userData } = useAuth();
  const layout = useResponsiveLayout();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const columns = layout.isDesktop ? 4 : layout.isTablet ? 3 : 2;
  const gap = layout.isDesktop ? 14 : 10;
  const imageSize = useMemo(() => {
    const available = Math.min(layout.availableWidth, layout.maxContentWidth);
    return Math.floor((available - gap * (columns - 1)) / columns);
  }, [columns, gap, layout.availableWidth, layout.maxContentWidth]);

  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "gallery"),
      where("instituteId", "==", userData.instituteId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(document => ({ id: document.id, ...document.data() }))
        .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
      setImages(list);
      setLoading(false);
    }, (error) => {
      console.error("Gallery Fetch Error:", error);
      setLoading(false);
      showAlert("Gallery Unavailable", "Could not load gallery items. Please check your connection and access permissions.");
    });

    return () => unsubscribe();
  }, [userData]);

  const handlePickAndUpload = async () => {
    if (!userData?.instituteId) {
      showAlert('Missing Institute', 'Your admin profile is not linked to an institute.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return showAlert('Permission Denied', 'Need gallery access to upload photos.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: Platform.OS === 'web',
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        if (!currentUser?.uid) {
          throw new Error('A signed-in admin is required to upload gallery media.');
        }

        const uploadResult = await uploadInstitutionAsset({
          asset: result.assets[0],
          folder: `institutions/${userData.instituteId}/gallery`,
          resourceType: 'image',
          deliveryType: 'upload',
          context: {
            module: 'gallery',
            instituteId: userData.instituteId,
            uploadedBy: currentUser.uid,
          },
        });

        if (!uploadResult?.secureUrl) {
          throw new Error('Upload service did not return a file URL.');
        }

        await addDoc(collection(db, "gallery"), {
          imageUrl: uploadResult.secureUrl,
          assetProvider: uploadResult.provider,
          cloudinaryPublicId: uploadResult.publicId || null,
          cloudinaryAssetId: uploadResult.assetId || null,
          resourceType: uploadResult.resourceType || 'image',
          mimeType: uploadResult.mimeType || result.assets[0]?.mimeType || 'image/jpeg',
          fileSize: uploadResult.bytes || result.assets[0]?.fileSize || null,
          width: uploadResult.width || result.assets[0]?.width || null,
          height: uploadResult.height || result.assets[0]?.height || null,
          instituteId: userData.instituteId,
          uploadedBy: userData.name || userData.email || 'Admin',
          uploadedByUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Gallery upload failed:', error);
        showAlert("Upload Failed", "Could not save the image. Storage and Cloudinary access have been checked; please retry after the deployment finishes.");
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = (imageId) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Delete this photo permanently?")) deleteDoc(doc(db, "gallery", imageId));
    } else {
      Alert.alert("Confirm Delete", "Delete this photo permanently?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteDoc(doc(db, "gallery", imageId)) }
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        key={String(columns)}
        data={images}
        keyExtractor={item => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: layout.horizontalPadding },
          layout.isDesktop && styles.contentDesktop,
          layout.isDesktop && { maxWidth: layout.maxContentWidth },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.headerCard, layout.isMobile && styles.headerCardMobile]}>
            <View style={styles.headerIcon}>
              <Ionicons name="images" size={26} color="#F97316" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.headerTitle, layout.isMobile && styles.headerTitleMobile]}>Campus Gallery</Text>
              <Text style={styles.headerSub}>Upload official event photos. Students see them instantly in their gallery.</Text>
            </View>
            <TouchableOpacity style={[styles.uploadBtn, layout.isMobile && styles.uploadBtnMobile]} onPress={handlePickAndUpload} disabled={uploading}>
              {uploading ? <SmoothSpinner color="#fff" size="small" /> : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.uploadBtnText}>Upload Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<View style={{ height: 28 }} />}
        renderItem={({ item }) => (
          <View style={[styles.imageContainer, { width: imageSize, height: imageSize, marginBottom: gap }]}>
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
            <View style={styles.imageMeta}>
              <Text style={styles.imageMetaText} numberOfLines={1}>{item.uploadedBy || 'Campus'}</Text>
            </View>
            <TouchableOpacity style={styles.deleteOverlay} onPress={() => handleDelete(item.id)} accessibilityLabel="Delete gallery photo">
              <Ionicons name="trash" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingState}>
              <SmoothSpinner size="large" color="#F97316" />
              <Text style={styles.loadingText}>Loading gallery...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={50} color="#CBD5E0" />
              <Text style={styles.emptyText}>No photos uploaded yet.</Text>
              <Text style={styles.emptySub}>Tap Upload Photo to publish the first campus memory.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingTop: 16, paddingBottom: 96 },
  contentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  headerCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  headerCardMobile: { flexWrap: 'wrap', alignItems: 'flex-start' },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  headerTitleMobile: { fontSize: 22 },
  headerSub: { fontSize: 14, color: '#CBD5E1', marginTop: 4, lineHeight: 20 },
  uploadBtn: {
    backgroundColor: '#F97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 48,
  },
  uploadBtnMobile: { width: '100%', marginTop: 4 },
  uploadBtnText: { color: '#fff', fontWeight: '900', marginLeft: 7 },
  imageContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  imageMetaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  deleteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.94)',
    padding: 8,
    borderRadius: 999,
  },
  loadingState: { alignItems: 'center', marginTop: 80 },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '800' },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyText: { marginTop: 10, color: '#64748B', fontSize: 17, fontWeight: '900' },
  emptySub: { marginTop: 5, color: '#94A3B8', fontSize: 13, textAlign: 'center' },
});
