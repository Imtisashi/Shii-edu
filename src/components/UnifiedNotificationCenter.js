import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, Platform, ScrollView
} from 'react-native';
import { useUnifiedNotifications } from '../services/unifiedNotificationService';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Spacing } from '../constants/theme';

export default function UnifiedNotificationCenter() {
  const { currentUser, userData } = useAuth();
  const {
    notifications,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    deleteNotification,
    refetch
  } = useUnifiedNotifications({ limit: 100 });

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const handleRefresh = () => {
    setRefreshing(true);
    refetch?.();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleNotificationPress = (notification) => {
    Haptics.selectionAsync();
    setSelectedNotification(notification);
    setModalVisible(true);
  };

  const handleMarkAsRead = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAsRead(id);
  };

  const handleDelete = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteNotification(id);
  };

  const formatDate = (createdAt) => {
    if (!createdAt) return 'Just now';
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleString();
    return new Date(createdAt).toLocaleString();
  };

  const getAuthorName = (author) => {
    if (!author) return 'System';
    if (typeof author === 'string') return author;
    return author.name || author.email || author.uid || 'System';
  };

  const isRead = (notification) => notification.readBy?.includes(currentUser?.uid) || notification.isRead === true;
  const canDelete = userData?.role === 'admin' || userData?.role === 'superadmin';

  const getTypeColor = (type) => {
    switch (type) {
      case 'error': return Colors.error;
      case 'warning': return Colors.warning;
      case 'success': return Colors.success;
      case 'announcement': return Colors.primary;
      case 'reminder': return Colors.secondary;
      case 'update': return Colors.info;
      default: return Colors.textPrimary;
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.actionButton}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={clearNotifications} style={styles.actionButton}>
            <Ionicons name="trash" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Refresh control for web */}
      {Platform.OS === 'web' && (
        <View style={styles.refreshControl}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color={refreshing ? Colors.primary : Colors.textSecondary} />
            {refreshing && <Text style={styles.refreshText}>Updating...</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      {!loading && notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>{error ? 'Unable to load notifications' : 'No notifications yet'}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleNotificationPress(item)}
              style={[styles.notificationItem, { borderLeftWidth: 4, borderLeftColor: getTypeColor(item.type) }]}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={[styles.notificationTitle, !isRead(item) && styles.unreadTitle]}>
                    {item.title}
                  </Text>
                  <Text style={styles.notificationDate}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>

                <Text style={styles.notificationMessage} numberOfLines={2}>
                  {item.message}
                </Text>

                {item.data && (
                  <View style={styles.notificationData}>
                    <Text style={styles.notificationDataLabel}>Details:</Text>
                    <Text style={styles.notificationDataValue}>
                      {typeof item.data === 'string' ? item.data : JSON.stringify(item.data)}
                    </Text>
                  </View>
                )}

                <View style={styles.notificationFooter}>
                  <Text style={styles.notificationMeta}>
                    From: {getAuthorName(item.author)}
                  </Text>
                  {item.targetRoles && item.targetRoles.length > 0 && (
                    <Text style={styles.notificationMeta}>
                      To: {item.targetRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                    </Text>
                  )}
                  {!isRead(item) && (
                    <TouchableOpacity
                      style={styles.markAsReadButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(item.id);
                      }}
                    >
                      <Ionicons name="radio-button-off" size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Admin/Superadmin delete button */}
              {canDelete && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
                  <Ionicons name="trash" size={18} color={Colors.error} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            Platform.OS !== 'web' && (
              <></> // We'll handle refresh manually for consistency
            )
          }
          ListFooterComponent={
            <View style={styles.footerSpacer} />
          }
        />
      )}

      {/* Notification Detail Modal */}
      <Modal
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        animationType="slide"
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedNotification?.title || 'Notification Details'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedNotification && (
              <>
                <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Message</Text>
                    <Text style={styles.modalText}>{selectedNotification.message}</Text>
                  </View>

                  {selectedNotification.data && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Details</Text>
                      <Text style={styles.modalText}>
                        {typeof selectedNotification.data === 'string'
                          ? selectedNotification.data
                          : JSON.stringify(selectedNotification.data, null, 2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Information</Text>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Type:</Text>
                      <Text style={[styles.modalInfoValue, { color: getTypeColor(selectedNotification.type) }]}>
                        {selectedNotification.type}
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>From:</Text>
                      <Text style={styles.modalInfoValue}>
                        {getAuthorName(selectedNotification.author)}
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Text style={styles.modalInfoLabel}>Sent:</Text>
                      <Text style={styles.modalInfoValue}>
                        {formatDate(selectedNotification.createdAt)}
                      </Text>
                    </View>
                    {selectedNotification.targetRoles && (
                      <View style={styles.modalInfoRow}>
                        <Text style={styles.modalInfoLabel}>Target:</Text>
                        <Text style={styles.modalInfoValue}>
                          {selectedNotification.targetRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  {!isRead(selectedNotification) && (
                    <TouchableOpacity
                      onPress={() => {
                        handleMarkAsRead(selectedNotification.id);
                        setModalVisible(false);
                      }}
                      style={styles.actionButton}
                    >
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                      <Text style={styles.actionButtonText}>Mark as Read</Text>
                    </TouchableOpacity>
                  )}

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() => {
                        handleDelete(selectedNotification.id);
                        setModalVisible(false);
                      }}
                      style={styles.actionButton}
                    >
                      <Ionicons name="trash" size={20} color={Colors.error} />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                    <Text style={styles.actionButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontFamily: Fonts.heading,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
    borderRadius: Radius.md,
  },

  refreshControl: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },

  refreshText: {
    marginLeft: Spacing.xs,
    fontSize: 12,
    color: Colors.textPrimary,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.textSecondary,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },

  emptyText: {
    marginTop: Spacing.lg,
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  notificationItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.xs,
    elevation: 2,
  },

  notificationContent: {
    flex: 1,
  },

  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },

  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },

  unreadTitle: {
    fontWeight: '900',
  },

  notificationDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  notificationMessage: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },

  notificationData: {
    marginBottom: Spacing.xs,
  },

  notificationDataLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xxs,
  },

  notificationDataValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },

  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  notificationMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  markAsReadButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
  },

  deleteButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.error + '10',
  },

  footerSpacer: {
    height: 80,
  },

  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    elevation: 5,
    maxHeight: '80%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontFamily: Fonts.heading,
  },

  modalClose: {
    padding: Spacing.xs,
  },

  modalBody: {
    maxHeight: 420,
  },

  modalBodyContent: {
    padding: Spacing.lg,
  },

  modalSection: {
    marginBottom: Spacing.md,
  },

  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },

  modalText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  modalInfoRow: {
    flexDirection: 'row',
    marginVertical: Spacing.xs,
  },

  modalInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    width: 100,
  },

  modalInfoValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
