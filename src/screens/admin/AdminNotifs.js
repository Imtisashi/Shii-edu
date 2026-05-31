import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function AdminNotifs({ navigation }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const { userData } = useAuth();
  const returnToAdminHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs');
  };

  const handlePost = async () => {
    if (!title || !content) return Alert.alert("Error", "Please fill in all fields.");

    try {
      await addDoc(collection(db, "notices"), {
        title: title.trim(),
        content: content.trim(),
        author: userData?.name || "Admin",
        instituteId: userData?.instituteId,
        createdAt: serverTimestamp(),
      });
      
      Alert.alert("Success", "Notice posted to the board!");
      setTitle('');
      setContent('');
      returnToAdminHome();
    } catch (_error) {
      Alert.alert("Error", "Failed to post notice.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Create New Notice</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Title (e.g. Zona Fest Update)" 
        value={title}
        onChangeText={setTitle}
      />
      <TextInput 
        style={[styles.input, styles.textArea]} 
        placeholder="Write notice details..." 
        multiline
        value={content}
        onChangeText={setContent}
      />
      <TouchableOpacity style={styles.btn} onPress={handlePost}>
        <Ionicons name="megaphone" size={20} color="#fff" />
        <Text style={styles.btnText}> Broadcast Notice</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#2D3748' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', padding: 15, borderRadius: 10, marginBottom: 15 },
  textArea: { height: 150, textAlignVertical: 'top' },
  btn: { backgroundColor: '#2D3748', flexDirection: 'row', padding: 18, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' }
});
