import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Alert, Platform } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; 
import { useAuth } from '../../contexts/AuthContext';
import { uploadInstitutionAsset } from '../../services/cloudinaryService';
import { pickImageFromLibrary } from '../../services/nativePickerService';
import {
  createSupabaseGalleryItem,
  deleteSupabaseGalleryItem,
  listSupabaseGallery,
} from '../../services/supabaseTenantDataService';
import { showNativeError } from '../../utils/userFeedback';
import { Ionicons } from '@expo/vector-icons';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';

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
  const { colors, styles } = useInstituteTheme(baseStyles);
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

    let cancelled = false;
    let unsubscribeFirestore = null;

    const startFirestoreFallback = () => {
      const q = query(
        collection(db, "gallery"),
        where("instituteId", "==", userData.instituteId)
      );

      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        if (cancelled) return;
        const list = snapshot.docs
          .map(document => ({ id: document.id, ...document.data(), dataSource: 'firestore' }))
          .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt));
        setImages(list);
        setLoading(false);
      }, (error) => {
        if (cancelled) return;
        console.error("Gallery Fetch Error:", error);
        setLoading(false);
        showAlert("Gallery Unavailable", "Could not load gallery items. Please check your connection and access permissions.");
      });
    };

    setLoading(true);
    listSupabaseGallery(currentUser)
      .then(({ images: supabaseImages }) => {
        if (cancelled) return;
        setImages(Array.isArray(supabaseImages) ? supabaseImages : []);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Supabase gallery bridge failed, falling back to Firestore:', error);
        startFirestoreFallback();
      });

    return () => {
      cancelled = true;
      if (typeof unsubscribeFirestore === 'function') unsubscribeFirestore();
    };
  }, [currentUser, userData?.instituteId]);

  const handlePickAndUpload = async () => {
    if (!userData?.instituteId) {
      showAlert('Missing Institute', 'Your admin profile is not linked to an institute.');
      return;
    }

    setUploading(true);
    try {
      const asset = await pickImageFromLibrary({
        allowsEditing: true,
        quality: 0.78,
      });
      if (!asset) return;

      if (!currentUser?.uid) {
        throw new Error('A signed-in admin is required to upload gallery media.');
      }

      const uploadResult = await uploadInstitutionAsset({
        currentUser,
        asset,
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

      const galleryPayload = {
        imageUrl: uploadResult.secureUrl,
        assetProvider: uploadResult.provider,
        cloudinaryPublicId: uploadResult.provider === 'cloudinary' ? uploadResult.publicId || null : null,
        cloudinaryAssetId: uploadResult.provider === 'cloudinary' ? uploadResult.assetId || null : null,
        storageBucket: uploadResult.storageBucket || null,
        storagePath: uploadResult.storagePath || null,
        supabasePath: uploadResult.supabasePath || null,
        resourceType: uploadResult.resourceType || 'image',
        mimeType: uploadResult.mimeType || asset.mimeType || 'image/jpeg',
        fileSize: uploadResult.bytes || asset.fileSize || null,
        width: uploadResult.width || asset.width || null,
        height: uploadResult.height || asset.height || null,
        instituteId: userData.instituteId,
        uploadedBy: userData.name || userData.email || 'Admin',
        uploadedByUid: currentUser.uid,
      };

      await createSupabaseGalleryItem(currentUser, galleryPayload);
      await addDoc(collection(db, "gallery"), {
        ...galleryPayload,
        createdAt: serverTimestamp(),
      });

      const { images: supabaseImages } = await listSupabaseGallery(currentUser);
      setImages(Array.isArray(supabaseImages) ? supabaseImages : []);
    } catch (error) {
      console.error('Gallery upload failed:', error);
      showNativeError('Upload Failed', error, 'Could not upload the image. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (imageId, item = {}) => {
    const removeImage = async () => {
      if (item.dataSource === 'supabase' || item.supabaseId) {
        await deleteSupabaseGalleryItem(currentUser, item.supabaseId || imageId);
        setImages((current) => current.filter((image) => image.id !== imageId));
        return;
      }

      await deleteDoc(doc(db, "gallery", imageId));
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Delete this photo permanently?")) removeImage();
    } else {
      Alert.alert("Confirm Delete", "Delete this photo permanently?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: removeImage }
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
              {uploading ? (
                <>
                  <SmoothSpinner color="#fff" size="small" />
                  <Text style={styles.uploadBtnText}>Uploading...</Text>
                </>
              ) : (
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
            <TouchableOpacity style={styles.deleteOverlay} onPress={() => handleDelete(item.id, item)} accessibilityLabel="Delete gallery photo">
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
              <Ionicons name="images-outline" size={50} color={colors.muted} />
              <Text style={styles.emptyText}>No photos uploaded yet.</Text>
              <Text style={styles.emptySub}>Tap Upload Photo to publish the first campus memory.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02030A', overflow: 'hidden' },
  content: { paddingTop: 16, paddingBottom: 96 },
  contentDesktop: { width: '100%', alignSelf: 'center', paddingTop: 24 },
  headerCard: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerCardMobile: { flexWrap: 'wrap', alignItems: 'flex-start' },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#431407',
    borderColor: '#C2410C',
    borderWidth: 1,
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
    borderRadius: 8,
    minHeight: 48,
  },
  uploadBtnMobile: { width: '100%', marginTop: 4 },
  uploadBtnText: { color: '#fff', fontWeight: '900', marginLeft: 7 },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
  },
  imageMetaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  deleteOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#450A0A',
    padding: 8,
    borderRadius: 8,
  },
  loadingState: { alignItems: 'center', marginTop: 80 },
  loadingText: { marginTop: 12, color: '#B9C6DD', fontWeight: '800' },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyText: { marginTop: 10, color: '#F8FAFC', fontSize: 17, fontWeight: '900' },
  emptySub: { marginTop: 5, color: '#B9C6DD', fontSize: 13, textAlign: 'center' },
});
