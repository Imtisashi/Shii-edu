import { useState, useEffect, useCallback } from 'react';
import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit as limitQuery,
  doc,
  updateDoc,
  arrayUnion,
  writeBatch,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';

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

  // Fetch notifications based on user role
  const fetchNotifications = useCallback(() => {
    if (!currentUser?.uid || !userData?.instituteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Base query for institute-specific notifications
    const baseQuery = query(
      collection(db, "notifications"),
      where("instituteId", "==", userData.instituteId),
      orderBy("createdAt", "desc")
    );

    // Role-specific filters
    let notificationsQuery;
    const notificationRole = ['student', 'teacher', 'admin'].includes(userData.role)
      ? userData.role
      : 'student';

    if (userData.role === 'superadmin') {
      notificationsQuery = baseQuery;
    } else {
      notificationsQuery = query(
        baseQuery,
        where("targetRoles", "array-contains-any", [notificationRole, "all"])
      );
    }

    // Apply limit if specified
    const finalQuery = limitCount ? query(notificationsQuery, limitQuery(limitCount)) : notificationsQuery;

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      finalQuery,
      (snapshot) => {
        const newNotifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setNotifications(newNotifications);
        setLoading(false);
        setError(null);

        // Call onNotification callback if provided and we have new notifications
        if (onNotification && newNotifications.length > 0) {
          onNotification(newNotifications[0]); // Pass the most recent notification
        }
      },
      (err) => {
        console.error('Error fetching notifications:', err);
        setError(err);
        setLoading(false);
        if (onError) onError(err);
      }
    );

    // Return cleanup function
    return () => unsubscribe();
  }, [currentUser, userData, limitCount, onNotification, onError]);

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
    const validRoles = ['student', 'teacher', 'admin', 'superadmin', 'all'];
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
