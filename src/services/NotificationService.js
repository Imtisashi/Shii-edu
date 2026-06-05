import { useState, useEffect, useCallback } from 'react';
import {
  addDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import {
  listSupabaseNotifications,
  markAllSupabaseNotificationsRead,
  markSupabaseNotificationRead,
} from './supabaseTenantDataService';

/**
 * Custom hook for real-time notifications
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Number of recent notifications to fetch (default: 50)
 * @param {Function} options.onNotification - Callback when new notification arrives
 * @param {Function} options.onError - Callback when error occurs
 * @returns {Object} { notifications, loading, error, markAsRead, clearNotifications }
 */
export const useNotifications = ({ limit: limitCount = 50, onNotification, onError } = {}) => {
  const { currentUser, userData } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch notifications based on user role
  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.uid || !userData?.instituteId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await listSupabaseNotifications(currentUser, limitCount);
      const newNotifications = Array.isArray(result?.notifications) ? result.notifications : [];
      setNotifications(newNotifications);
      if (onNotification && newNotifications.length > 0) {
        onNotification(newNotifications[0]);
      }
    } catch (err) {
      setNotifications([]);
      setError(null);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, userData, limitCount, onNotification, onError]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await markSupabaseNotificationRead(currentUser, notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId
            ? { ...notif, readBy: [...new Set([...(notif.readBy || []), currentUser.uid])] }
            : notif
        )
      );
    } catch (err) {
      if (onError) onError(err);
    }
  }, [currentUser, onError]);

  // Clear all notifications (for user)
  const clearNotifications = useCallback(async () => {
    try {
      await markAllSupabaseNotificationsRead(currentUser);

      // Update local state
      setNotifications(prev =>
        prev.map(notif => ({
          ...notif,
          readBy: [...new Set([...(notif.readBy || []), currentUser.uid])]
        }))
      );
    } catch (err) {
      if (onError) onError(err);
    }
  }, [currentUser, onError]);

  // Effect to set up/unsubscribe listener
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) await fetchNotifications();
    };
    load();
    const intervalId = setInterval(load, 45000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    markAsRead,
    clearNotifications,
    refetch: fetchNotifications
  };
};

/**
 * Helper function to create a notification
 * @param {Object} notificationData - Data for the notification
 * @returns {Promise<string>} Returns the notification ID
 */
export const createNotification = async (notificationData) => {
  try {
    const { title, message, type, targetRoles, instituteId, relatedId, relatedType, author } = notificationData;

    if (!title || !message || !instituteId) {
      throw new Error('Title, message, and instituteId are required');
    }

    const notificationRef = await addDoc(collection(db, "notifications"), {
      title: title.trim(),
      message: message.trim(),
      type: type || 'info',
      targetRoles: targetRoles || ['student'], // Default to student
      recipientUids: Array.isArray(notificationData.recipientUids) ? notificationData.recipientUids : [],
      instituteId,
      relatedId: relatedId || null,
      relatedType: relatedType || null,
      author: author || 'School',
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

export default { useNotifications, createNotification };
