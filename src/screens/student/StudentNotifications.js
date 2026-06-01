import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SmoothSpinner } from '../../components/ui/LoadingState';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import DynamicHeader from '../../components/DynamicHeader';
import { Ionicons } from '@expo/vector-icons';

export default function StudentNotifications({ navigation }) {
  const { userData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch real-time notifications for the student
  useEffect(() => {
    if (!userData?.instituteId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("instituteId", "==", userData.instituteId),
      where("targetRoles", "array-contains-any", ["student", "all"]),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        readBy: arrayUnion(userData.uid)
      });

      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, readBy: [...new Set([...(notif.readBy || []), userData.uid])] }
            : notif
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      Alert.alert("Error", "Failed to mark notification as read.");
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        const notifRef = doc(db, "notifications", notif.id);
        batch.update(notifRef, {
          readBy: arrayUnion(userData.uid)
        });
      });
      await batch.commit();

      // Update local state
      setNotifications(prev =>
        prev.map(notif => ({
          ...notif,
          readBy: [...new Set([...(notif.readBy || []), userData.uid])]
        }))
      );
    } catch (error) {
      console.error("Error clearing notifications:", error);
      Alert.alert("Error", "Failed to clear notifications.");
    }
  };

  const formatDate = (createdAt) => {
    if (!createdAt) return 'Just now';
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString();
    return new Date(createdAt).toLocaleDateString();
  };

  const isReadByCurrentUser = (item) => item.readBy?.includes(userData?.uid) || item.isRead === true;

  const renderNotification = ({ item }) => {
    const isRead = isReadByCurrentUser(item);

    return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        // Mark as read when tapped
        markAsRead(item.id);
        // You can navigate to a specific screen based on notification type if needed
      }}
    >
      <View style={[styles.notifCard, { borderLeftColor: isRead ? '#E2E8F0' : '#3B82F6' }]}>
        <View style={styles.notifHeader}>
          <Text style={[
            styles.notifTitle,
            !isRead && { fontWeight: 'bold' }
          ]}>{item.title}</Text>
          <Text style={styles.notifDate}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Text style={[
          styles.notifMessage,
          !isRead && { fontWeight: '600' }
        ]}>{item.message}</Text>

        <View style={styles.notifFooter}>
          <Text style={styles.notifSender}>From: {item.author || 'School'}</Text>
          {item.targetLevel && (
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>{item.targetLevel}</Text>
            </View>
          )}
          {!isRead && (
            <TouchableOpacity
              style={styles.markAsReadBtn}
              onPress={(e) => {
                e.stopPropagation();
                markAsRead(item.id);
              }}
            >
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  if (loading) return <SmoothSpinner style={{ marginTop: 50 }} color="#4A90E2" />;

  return (
    <View style={styles.container}>
      <DynamicHeader title="Notifications" showBack>
        <TouchableOpacity style={styles.clearBtn} onPress={clearAllNotifications}>
          <Ionicons name="trash" size={20} color="#EF4444" />
          <Text style={styles.clearBtnText}>Clear All</Text>
        </TouchableOpacity>
      </DynamicHeader>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={50} color="#CBD5E0" />
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.emptyState} />}
/>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  listContent: { padding: 16, paddingBottom: 80 },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
  },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  notifTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
  },
  notifDate: { fontSize: 12, color: '#A0AEC0' },
  notifMessage: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 16,
  },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EDF2F7', paddingTop: 12 },
  notifSender: { fontSize: 12, fontWeight: '600', color: '#718096' },
  targetBadge: { backgroundColor: '#F3E5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  targetBadgeText: { color: '#8E24AA', fontSize: 10, fontWeight: 'bold' },
  markAsReadBtn: { padding: 6, borderRadius: 6 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  clearBtnText: { color: '#EF4444', fontWeight: 'bold', marginLeft: 6 },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 10,
    color: '#A0AEC0',
    fontSize: 16,
    fontWeight: '500',
  },
});
