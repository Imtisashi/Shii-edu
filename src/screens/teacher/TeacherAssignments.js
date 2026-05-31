import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DynamicHeader from '../../components/DynamicHeader';

export default function TeacherAssignments() {
  return (
    <View style={styles.container}>
      <DynamicHeader title="Assignments" showBack={true} />
      <View style={styles.center}>
        <Text style={styles.text}>Assignment Management Coming Soon...</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { color: '#64748B', fontSize: 16 }
});