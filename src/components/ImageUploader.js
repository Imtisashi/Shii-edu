import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { SmoothSpinner } from './ui/LoadingState';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { pickAndUploadProfileImage } from '../services/profileImageUpload';
import { updateSupabaseProfileMedia } from '../services/supabaseTenantDataService';
import { showNativeError } from '../utils/userFeedback';
import { Ionicons } from '@expo/vector-icons';

export default function ImageUploader() {
  const { currentUser, userData } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    setUploading(true);
    try {
      const upload = await pickAndUploadProfileImage({ currentUser });
      if (!upload) return;

      if (!currentUser?.uid) {
        throw new Error('Your session expired before the profile could be saved.');
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await Promise.all([
        updateSupabaseProfileMedia(currentUser, {
          assetId: upload.assetId,
          bytes: upload.bytes,
          format: upload.format,
          height: upload.height,
          mimeType: upload.mimeType,
          provider: upload.provider,
          publicId: upload.publicId,
          secureUrl: upload.secureUrl,
          storageBucket: upload.storageBucket,
          storagePath: upload.storagePath,
          supabasePath: upload.supabasePath,
          transformation: upload.transformation,
          width: upload.width,
        }),
        updateDoc(userRef, {
          photoURL: upload.secureUrl,
          profilePic: upload.secureUrl,
          profileUpdatedAt: serverTimestamp(),
        }),
      ]);
      Alert.alert('Success', 'Profile picture updated.');
    } catch (error) {
      showNativeError('Upload Failed', error, 'The profile picture could not be updated.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        <Image 
          source={{ uri: userData?.profilePic || 'https://via.placeholder.com/150' }} 
          style={styles.avatar} 
        />
        <TouchableOpacity style={styles.editBtn} onPress={pickImage} disabled={uploading}>
          {uploading ? (
            <SmoothSpinner color="#fff" size="small" />
          ) : (
            <Ionicons name="camera" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>{uploading ? 'Uploading...' : 'Tap camera to change profile photo'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 20 },
  avatarWrapper: { width: 120, height: 120, borderRadius: 8, position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 8, borderWidth: 1, borderColor: '#4A90E2' },
  editBtn: { 
    position: 'absolute', bottom: 0, right: 0, 
    backgroundColor: '#4A90E2', padding: 10, borderRadius: 8
  },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 10 }
});
