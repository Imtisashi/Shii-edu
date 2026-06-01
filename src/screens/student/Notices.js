import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const isNotice = (notification) => {
  const originalType = notification?.data?.originalType;
  return (
    notification?.type === 'announcement' ||
    notification?.relatedType === 'notice' ||
    notification?.relatedType === 'broadcast' ||
    originalType === 'admin_notice' ||
    originalType === 'campus_broadcast'
  );
};

const getAuthorName = (author) => {
  if (!author) return 'Campus';
  if (typeof author === 'string') return author;
  return author.name || author.email || 'Campus';
};

const formatDate = (createdAt) => {
  if (!createdAt) return 'Just now';
  if (typeof createdAt.toDate === 'function') return createdAt.toDate().toLocaleDateString();
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString();
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? 'Just now' : parsed.toLocaleDateString();
};

export default function Notices() {
  const { notifications } = useAuth();
  const notices = useMemo(
    () => (notifications || []).filter(isNotice),
    [notifications]
  );

  const renderItem = ({ item }) => (
    <View style={styles.noticeCard}>
      <Text style={styles.noticeTitle}>{item.title || 'Campus Notice'}</Text>
      <Text style={styles.noticeBody}>{item.message || item.content || 'No additional details.'}</Text>
      <View style={styles.footer}>
        <Text style={styles.metaText}>{getAuthorName(item.author)}</Text>
        <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No notices at the moment.</Text>}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  listContent: { padding: 16, paddingBottom: 100 },
  noticeCard: { backgroundColor: '#fff', padding: 18, borderRadius: 15, marginBottom: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#4A90E2' },
  noticeTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
  noticeBody: { color: '#4A5568', marginVertical: 10, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 10 },
  metaText: { fontSize: 12, color: '#A0AEC0', fontStyle: 'italic' },
  empty: { textAlign: 'center', color: '#A0AEC0', marginTop: 50 }
});
