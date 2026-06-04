import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRootLayout } from '../contexts/RootLayoutContext';
import { useUnifiedNotifications } from '../services/unifiedNotificationService';
import { RosterSkeleton } from './ui/LoadingState';
import StudentScreenScaffold, { EnterprisePanel, ScreenIntro } from './student/StudentScreenScaffold';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDate = (createdAt) => {
  if (!createdAt) return 'Just now';
  if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleString();
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? 'Just now' : parsed.toLocaleString();
};

const getAuthorName = (author) => {
  if (!author) return 'System';
  if (typeof author === 'string') return author;
  return author.name || author.email || author.uid || 'System';
};

export default function UnifiedNotificationCenter() {
  const { currentUser, userData } = useAuth();
  const { colors, radii } = useRootLayout();
  const {
    clearNotifications,
    deleteNotification,
    error,
    loading,
    markAllAsRead,
    markAsRead,
    notifications,
    refetch,
  } = useUnifiedNotifications({ limit: 100 });

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const sortedNotifications = useMemo(
    () => [...(notifications || [])].sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt)),
    [notifications]
  );

  const unreadCount = useMemo(
    () => sortedNotifications.filter((notification) => !(notification.readBy?.includes(currentUser?.uid) || notification.isRead === true)).length,
    [currentUser?.uid, sortedNotifications]
  );

  const canDelete = userData?.role === 'admin' || userData?.role === 'superadmin';

  const getTypeColor = (type) => {
    switch (type) {
      case 'error': return '#F87171';
      case 'warning': return colors.amber;
      case 'success': return colors.emerald;
      case 'announcement': return colors.accent;
      case 'reminder': return colors.violet;
      case 'update': return colors.deepBlue;
      default: return colors.textSoft;
    }
  };

  const isRead = (notification) => notification.readBy?.includes(currentUser?.uid) || notification.isRead === true;

  const handleRefresh = () => {
    setRefreshing(true);
    refetch?.();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleNotificationPress = (notification) => {
    setSelectedNotification(notification);
    setModalVisible(true);
  };

  const handleMarkAsRead = (id) => {
    markAsRead(id);
  };

  const handleDelete = (id) => {
    deleteNotification(id);
  };

  const renderHeader = () => (
    <View>
      <ScreenIntro
        accentColor={colors.accent}
        eyebrow="Campus inbox"
        subtitle="Announcements, alerts, and role-targeted updates from your institute."
        title="Notifications"
        trailing={<Ionicons name="notifications" size={27} color={colors.accent} />}
      />

      <View style={styles.actionRow}>
        <EnterprisePanel style={styles.summaryPanel}>
          <Ionicons name="mail-unread-outline" size={20} color={colors.accent} />
          <Text style={[styles.summaryText, { color: colors.text }]}>
            {unreadCount} unread / {sortedNotifications.length} total
          </Text>
        </EnterprisePanel>

        <View style={styles.headerActions}>
          {sortedNotifications.length > 0 && (
            <TouchableOpacity
              accessibilityLabel="Mark all notifications as read"
              accessibilityRole="button"
              onPress={markAllAsRead}
              style={[styles.smallAction, { backgroundColor: colors.card, borderColor: colors.hairline }]}
            >
              <Ionicons name="checkmark-circle" size={19} color={colors.emerald} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityLabel="Refresh notifications"
            accessibilityRole="button"
            onPress={handleRefresh}
            style={[styles.smallAction, { backgroundColor: colors.card, borderColor: colors.hairline }]}
          >
            <Ionicons name="refresh" size={19} color={refreshing ? colors.accent : colors.textSoft} />
          </TouchableOpacity>
          {sortedNotifications.length > 0 && (
            <TouchableOpacity
              accessibilityLabel="Clear notifications"
              accessibilityRole="button"
              onPress={clearNotifications}
              style={[styles.smallAction, { backgroundColor: colors.card, borderColor: colors.hairline }]}
            >
              <Ionicons name="trash" size={19} color="#F87171" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderNotification = ({ item }) => {
    const read = isRead(item);
    const typeColor = getTypeColor(item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        accessibilityLabel={`Open notification ${item.title || 'details'}`}
        accessibilityRole="button"
        onPress={() => handleNotificationPress(item)}
        style={[
          styles.notificationItem,
          {
            backgroundColor: colors.card,
            borderColor: read ? colors.hairline : `${typeColor}77`,
            borderRadius: radii.card,
          },
        ]}
      >
        <View style={[styles.typeRail, { backgroundColor: typeColor }]} />
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text numberOfLines={2} style={[styles.notificationTitle, { color: colors.text }, !read && styles.unreadTitle]}>
              {item.title || 'Notification'}
            </Text>
            <Text style={[styles.notificationDate, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
          </View>

          <Text numberOfLines={3} style={[styles.notificationMessage, { color: colors.textSoft }]}>
            {item.message || 'No message content.'}
          </Text>

          <View style={styles.notificationFooter}>
            <Text numberOfLines={1} style={[styles.notificationMeta, { color: colors.muted }]}>
              From {getAuthorName(item.author)}
            </Text>
            {!read && (
              <TouchableOpacity
                accessibilityLabel="Mark notification as read"
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation?.();
                  handleMarkAsRead(item.id);
                }}
                style={[styles.markAsReadButton, { backgroundColor: colors.accentSoft, borderColor: colors.hairline }]}
              >
                <Text style={[styles.markAsReadText, { color: colors.text }]}>Mark read</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {canDelete && (
          <TouchableOpacity
            accessibilityLabel="Delete notification"
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation?.();
              handleDelete(item.id);
            }}
            style={[styles.deleteButton, { backgroundColor: '#450A0A', borderColor: colors.hairline }]}
          >
            <Ionicons name="trash" size={17} color="#F87171" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft, borderColor: colors.hairline }]}>
        <Ionicons name="notifications-off" size={34} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {error ? 'Unable to load notifications' : 'No notifications yet'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>
        {error ? 'Try refreshing the campus inbox.' : 'Campus updates will appear here.'}
      </Text>
    </View>
  );

  if (loading && sortedNotifications.length === 0) {
    return <RosterSkeleton rowCount={5} showFilters={false} />;
  }

  return (
    <StudentScreenScaffold accentVariant="blue" scroll={false} style={styles.scaffoldContent}>
      <FlatList
        data={sortedNotifications}
        keyExtractor={(item, index) => item.id || `notification-${index}`}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        renderItem={renderNotification}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.pageElevated,
                borderColor: colors.hairline,
                borderRadius: radii.card,
              },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.hairline }]}>
              <Text numberOfLines={2} style={[styles.modalTitle, { color: colors.text }]}>
                {selectedNotification?.title || 'Notification Details'}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Close notification details"
                accessibilityRole="button"
                onPress={() => setModalVisible(false)}
                style={[styles.modalClose, { backgroundColor: colors.card, borderColor: colors.hairline }]}
              >
                <Ionicons name="close" size={22} color={colors.textSoft} />
              </TouchableOpacity>
            </View>

            {selectedNotification && (
              <>
                <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Message</Text>
                    <Text style={[styles.modalText, { color: colors.textSoft }]}>
                      {selectedNotification.message || 'No message content.'}
                    </Text>
                  </View>

                  {selectedNotification.data && (
                    <View style={styles.modalSection}>
                      <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Details</Text>
                      <Text style={[styles.modalText, styles.monospace, { color: colors.textSoft }]}>
                        {typeof selectedNotification.data === 'string'
                          ? selectedNotification.data
                          : JSON.stringify(selectedNotification.data, null, 2)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Information</Text>
                    <InfoRow label="Type" value={selectedNotification.type || 'general'} valueColor={getTypeColor(selectedNotification.type)} />
                    <InfoRow label="From" value={getAuthorName(selectedNotification.author)} />
                    <InfoRow label="Sent" value={formatDate(selectedNotification.createdAt)} />
                    {selectedNotification.targetRoles && (
                      <InfoRow
                        label="Target"
                        value={selectedNotification.targetRoles.map((role) => role.charAt(0).toUpperCase() + role.slice(1)).join(', ')}
                      />
                    )}
                  </View>
                </ScrollView>

                <View style={[styles.modalActions, { borderTopColor: colors.hairline }]}>
                  {!isRead(selectedNotification) && (
                    <TouchableOpacity
                      onPress={() => {
                        handleMarkAsRead(selectedNotification.id);
                        setModalVisible(false);
                      }}
                      style={[styles.modalActionButton, { backgroundColor: colors.emeraldSoft, borderColor: colors.hairline }]}
                    >
                      <Ionicons name="checkmark-circle" size={18} color={colors.emerald} />
                      <Text style={[styles.modalActionText, { color: colors.text }]}>Mark as Read</Text>
                    </TouchableOpacity>
                  )}

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() => {
                        handleDelete(selectedNotification.id);
                        setModalVisible(false);
                      }}
                      style={[styles.modalActionButton, { backgroundColor: '#450A0A', borderColor: colors.hairline }]}
                    >
                      <Ionicons name="trash" size={18} color="#F87171" />
                      <Text style={[styles.modalActionText, { color: colors.text }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </StudentScreenScaffold>
  );
}

function InfoRow({ label, value, valueColor }) {
  const { colors } = useRootLayout();

  return (
    <View style={styles.modalInfoRow}>
      <Text style={[styles.modalInfoLabel, { color: colors.muted }]}>{label}:</Text>
      <Text style={[styles.modalInfoValue, { color: valueColor || colors.textSoft }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  centerContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginLeft: 10,
    width: 34,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    marginBottom: 16,
    width: 72,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 250,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  listContent: {
    paddingBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 16,
  },
  markAsReadButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAsReadText: {
    fontSize: 11,
    fontWeight: '900',
  },
  modalActionButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  modalActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  modalActions: {
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 16,
  },
  modalBackground: {
    alignItems: 'center',
    backgroundColor: '#020617',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  modalBody: {
    maxHeight: 420,
  },
  modalBodyContent: {
    padding: 18,
  },
  modalClose: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    marginLeft: 12,
    width: 40,
  },
  modalContainer: {
    borderWidth: 1,
    maxHeight: '82%',
    maxWidth: 560,
    overflow: 'hidden',
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalInfoLabel: {
    fontSize: 13,
    fontWeight: '900',
    width: 86,
  },
  modalInfoRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 5,
  },
  modalInfoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 22,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  monospace: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationDate: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 10,
  },
  notificationFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 12,
  },
  notificationHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationItem: {
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
    padding: 16,
  },
  notificationMessage: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  notificationMeta: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 0,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    minWidth: 0,
  },
  scaffoldContent: {
    flex: 1,
  },
  smallAction: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  summaryPanel: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '900',
  },
  typeRail: {
    borderRadius: 8,
    bottom: 16,
    left: 0,
    position: 'absolute',
    top: 16,
    width: 4,
  },
  unreadTitle: {
    fontWeight: '900',
  },
});
