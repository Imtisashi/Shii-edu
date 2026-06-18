import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, View } from 'react-native';
import { createUnifiedNotification } from '../../services/unifiedNotificationService';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../../constants/theme';
import { useInstituteTheme } from '../../hooks/useInstituteTheme';
import DynamicHeader from '../../components/DynamicHeader';
import { SmoothSpinner } from '../../components/ui/LoadingState';

export default function AdminNotifs({ navigation }) {
  const { colors, styles } = useInstituteTheme(baseStyles);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const { currentUser, userData } = useAuth();

  const returnToAdminHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs');
  };

  const handlePost = async () => {
    if (posting) return;
    if (!title || !content) return Alert.alert("Error", "Please fill in all fields.");

    setPosting(true);
    try {
      // Use unified notification service
      await createUnifiedNotification({
        title: title.trim(),
        message: content.trim(),
        type: 'announcement',
        targetRoles: ['student', 'teacher', 'admin'], // Broadcast to all roles
        instituteId: userData?.instituteId,
        author: {
          uid: currentUser?.uid,
          name: userData?.name || 'Admin',
          role: userData?.role,
        },
        data: {
          originalType: 'admin_notice'
        }
      });

      Alert.alert("Success", "Notice posted to the board!");
      setTitle('');
      setContent('');
      returnToAdminHome();
    } catch (_error) {
      Alert.alert("Error", "Failed to post notice.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <DynamicHeader title="Broadcast Notice" showBack />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.headerTitle}>Create New Notice</Text>
        <TextInput
          style={styles.input}
          placeholder="Title (e.g. Campus schedule update)"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Write notice details..."
          placeholderTextColor={colors.muted}
          multiline
          value={content}
          onChangeText={setContent}
        />
        <TouchableOpacity
          accessibilityLabel="Broadcast notice"
          accessibilityRole="button"
          disabled={posting}
          style={[styles.btn, posting && styles.btnDisabled]}
          onPress={handlePost}
        >
          {posting ? <SmoothSpinner color="#fff" size="small" /> : <Ionicons name="megaphone" size={20} color="#fff" />}
          <Text style={styles.btnText}>Broadcast Notice</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: Colors.textPrimary },
  input: { borderWidth: 1, borderColor: Colors.border, padding: 15, borderRadius: Radius.md, marginBottom: 15 },
  textArea: { height: 150, textAlignVertical: 'top' },
  btn: { backgroundColor: Colors.primary, flexDirection: 'row', padding: 18, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.72 },
  btnText: { color: '#fff', fontWeight: 'bold', marginLeft: 8 }
});
