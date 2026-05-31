import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, FlatList, 
  Image, ActivityIndicator, Alert, Platform, Dimensions 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig'; 
import { useAuth } from '../../contexts/AuthContext';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const IMAGE_SIZE = (width - 60) / 2;

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function UploadGallery() {
  const { userData } = useAuth();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userData?.instituteId) return;

    const q = query(
      collection(db, "gallery"),
      where("instituteId", "==", userData.instituteId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      setImages(list);
      setLoading(false);
    }, (error) => {
      console.error("Gallery Fetch Error:", error);
      setLoading(false);
      showAlert("Index Required", "Open your F12 Console. Click the Firebase link to build the gallery index.");
    });

    return () => unsubscribe();
  }, [userData]);

  const handlePickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return showAlert('Permission Denied', 'Need gallery access to upload photos.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.7,
      base64: true, // Crucial for Web JSON upload
    });

    if (!result.canceled) {
      setUploading(true);
      try {
        const cloudinaryUrl = await uploadToCloudinary(result.assets[0]);
        
        if (cloudinaryUrl) {
          await addDoc(collection(db, "gallery"), {
            imageUrl: cloudinaryUrl,
            instituteId: userData.instituteId,
            uploadedBy: userData.name,
            createdAt: serverTimestamp(),
          });
        }
      } catch (_error) {
        showAlert("Upload Failed", "Could not save the image to the gallery.");
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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Campus Gallery</Text>
          <Text style={styles.headerSub}>Manage official event photos</Text>
        </View>
        <TouchableOpacity style={styles.uploadBtn} onPress={handlePickAndUpload} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.uploadBtnText}>Upload</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={images}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.imageContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.image} />
              <TouchableOpacity style={styles.deleteOverlay} onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={50} color="#CBD5E0" />
              <Text style={styles.emptyText}>No photos uploaded yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  headerSub: { fontSize: 14, color: '#64748B' },
  uploadBtn: { backgroundColor: '#F97316', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  uploadBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 6 },
  row: { justifyContent: 'space-between', marginBottom: 15 },
  imageContainer: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E2E8F0', elevation: 3 },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  deleteOverlay: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(229, 62, 62, 0.9)', padding: 6, borderRadius: 20 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 10, color: '#A0AEC0', fontSize: 16, fontWeight: '500' },
});
