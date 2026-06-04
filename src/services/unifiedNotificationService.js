import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  writeBatch,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Notification types
 */
export const NotificationType = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
  ANNOUNCEMENT: 'announcement',
  REMINDER: 'reminder',
  UPDATE: 'update'
};

/**
 * Unified notification hook for real-time notifications
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Number of recent notifications to fetch (default: 50)
 * @param {Function} options.onNotification - Callback when new notification arrives
 * @param {Function} options.onError - Callback when error occurs
 * @returns {Object} { notifications, loading, error, markAsRead, markAllAsRead, clearNotifications, deleteNotification, refetch }
 */
export const useUnifiedNotifications = ({ limit: limitCount = 50, onNotification, onError } = {}) => {
  const { currentUser, userData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  // Fetch notifications based on user role
  const fetchNotifications = useCallback(() => {
    if (!currentUser?.uid || !userData?.instituteId) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setLoading(false);
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setLoading(true);
    setError(null);

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("instituteId", "==", userData.instituteId)
    );

    const notificationRole = ['student', 'teacher', 'admin', 'parent', 'driver'].includes(userData.role)
      ? userData.role
      : 'student';

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const newNotifications = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((notification) => {
            if (userData.role === 'superadmin') return true;
            const targets = notification.targetRoles || [];
            const recipientUids = Array.isArray(notification.recipientUids) ? notification.recipientUids : [];
            const parentStudentMatch = userData.role === 'parent' &&
              userData.linkedStudentUid &&
              recipientUids.includes(userData.linkedStudentUid);
            const recipientMatch = recipientUids.length === 0 || recipientUids.includes(currentUser.uid) || parentStudentMatch;
            return recipientMatch && (targets.includes(notificationRole) || targets.includes('all'));
          })
          .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt))
          .slice(0, limitCount || undefined);

        setNotifications(newNotifications);
        setLoading(false);
        setError(null);

        // Call onNotification callback if provided and we have new notifications
        if (onNotification && newNotifications.length > 0) {
          onNotification(newNotifications[0]); // Pass the most recent notification
        }
      },
      (err) => {
        console.warn('Notifications are unavailable for this session; showing an empty inbox.', err?.code || err?.message || '');
        setNotifications([]);
        setError(null);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      if (unsubscribeRef.current === unsubscribe) {
        unsubscribeRef.current = null;
      }
    };
  }, [currentUser, userData, limitCount, onNotification]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!currentUser?.uid) return;

    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        readBy: arrayUnion(currentUser.uid)
      });

      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, readBy: [...new Set([...(notif.readBy || []), currentUser.uid])] }
            : notif
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      if (onError) onError(err);
    }
  }, [currentUser, onError]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.uid || !userData?.role) return;

    try {
      const userNotifications = notifications.filter(notif =>
        notif.targetRoles?.includes(userData.role) ||
        notif.targetRoles?.includes('all')
      );

      const batch = writeBatch(db);
      userNotifications.forEach(notif => {
        const notifRef = doc(db, "notifications", notif.id);
        batch.update(notifRef, {
          readBy: arrayUnion(currentUser.uid)
        });
      });

      await batch.commit();

      // Update local state
      setNotifications(prev =>
        prev.map(notif => ({
          ...notif,
          readBy: [...new Set([...(notif.readBy || []), currentUser.uid])]
        }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      if (onError) onError(err);
    }
  }, [currentUser, notifications, userData, onError]);

  // Delete notification (admin/superadmin only)
  const deleteNotification = useCallback(async (notificationId) => {
    if (!userData?.role) return;

    try {
      // Only allow admins and superadmins to delete notifications
      if (userData.role !== 'admin' && userData.role !== 'superadmin') {
        throw new Error('Unauthorized to delete notifications');
      }

      await deleteDoc(doc(db, "notifications", notificationId));

      // Update local state
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
      if (onError) onError(err);
    }
  }, [userData, onError]);

  // Clear all notifications (for user)
  const clearNotifications = useCallback(async () => {
    if (!currentUser?.uid || !userData?.role) return;

    try {
      const userNotifications = notifications.filter(notif =>
        notif.targetRoles?.includes(userData.role) ||
        notif.targetRoles?.includes('all')
      );

      const batch = writeBatch(db);
      userNotifications.forEach(notif => {
        const notifRef = doc(db, "notifications", notif.id);
        batch.update(notifRef, {
          readBy: arrayUnion(currentUser.uid)
        });
      });

      await batch.commit();

      // Update local state
      setNotifications(prev =>
        prev.map(notif => ({
          ...notif,
          readBy: [...new Set([...(notif.readBy || []), currentUser.uid])]
        }))
      );
    } catch (err) {
      console.error('Error clearing notifications:', err);
      if (onError) onError(err);
    }
  }, [currentUser, notifications, userData, onError]);

  // Effect to set up/unsubscribe listener
  useEffect(() => {
    const unsubscribe = fetchNotifications();
    return unsubscribe;
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    deleteNotification,
    refetch: fetchNotifications
  };
};

/**
 * Helper function to create a notification
 * @param {Object} notificationData - Data for the notification
 * @returns {Promise<string>} Returns the notification ID
 */
export const createUnifiedNotification = async (notificationData) => {
  try {
    const {
      title,
      message,
      type = NotificationType.INFO,
      targetRoles,
      instituteId,
      relatedId,
      relatedType,
      author,
      data // Optional additional data
    } = notificationData;

    if (!title || !message || !instituteId) {
      throw new Error('Title, message, and instituteId are required');
    }

    // Validate targetRoles
    const validRoles = ['student', 'teacher', 'parent', 'driver', 'admin', 'superadmin', 'all'];
    if (targetRoles && !Array.isArray(targetRoles)) {
      throw new Error('targetRoles must be an array');
    }
    if (targetRoles && targetRoles.some(role => !validRoles.includes(role))) {
      throw new Error(`targetRoles must be one of: ${validRoles.join(', ')}`);
    }

    const notificationRef = await addDoc(collection(db, "notifications"), {
      title: title.trim(),
      message: message.trim(),
      type: type,
      targetRoles: targetRoles || ['student'], // Default to student
      instituteId,
      relatedId: relatedId || null,
      relatedType: relatedType || null,
      author: author || 'System',
      data: data || null,
      isRead: false,
      createdAt: serverTimestamp(),
      readBy: [] // Array of user IDs who have read this notification
    });

    return notificationRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export default {
  useUnifiedNotifications,
  createUnifiedNotification,
  NotificationType
};
