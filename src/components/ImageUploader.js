import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { SmoothSpinner } from './ui/LoadingState';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { Ionicons } from '@expo/vector-icons';

export default function ImageUploader() {
  const { userData } = useAuth();
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Needed', 'We need access to your gallery to upload photos.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Keep it light for Nagaland's network speeds
    });

    if (!result.canceled) {
      handleUpload(result.assets[0].uri);
    }
  };

  const handleUpload = async (uri) => {
    setUploading(true);
    const cloudinaryUrl = await uploadToCloudinary(uri, `profile-pictures/${userData.uid}`);

    if (cloudinaryUrl) {
      try {
        const userRef = doc(db, "users", userData.uid);
        await updateDoc(userRef, {
          profilePic: cloudinaryUrl
        });
        Alert.alert("Success", "Profile picture updated.");
      } catch (_err) {
        Alert.alert("Error", "The image uploaded, but the profile could not be updated.");
      }
    } else {
      Alert.alert("Error", "Image upload failed.");
    }
    setUploading(false);
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
      <Text style={styles.hint}>Tap camera to change profile photo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 20 },
  avatarWrapper: { width: 120, height: 120, borderRadius: 60, position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#4A90E2' },
  editBtn: { 
    position: 'absolute', bottom: 0, right: 0, 
    backgroundColor: '#4A90E2', padding: 10, borderRadius: 20,
    elevation: 5
  },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 10 }
});
