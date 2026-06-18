import { useState, useEffect, useCallback } from 'react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import {
  deleteSupabaseNotification,
  listSupabaseNotifications,
  markAllSupabaseNotificationsRead,
  markSupabaseNotificationRead,
} from './supabaseTenantDataService';

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
      setError(null);
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
    if (!currentUser?.uid) return;

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

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.uid || !userData?.role) return;

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
  }, [currentUser, userData, onError]);

  // Delete notification (admin/superadmin only)
  const deleteNotification = useCallback(async (notificationId) => {
    if (!userData?.role) return;

    try {
      // Only allow admins and superadmins to delete notifications
      if (userData.role !== 'admin' && userData.role !== 'superadmin') {
        throw new Error('Unauthorized to delete notifications');
      }

      await deleteSupabaseNotification(currentUser, notificationId);

      // Update local state
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    } catch (err) {
      if (onError) onError(err);
    }
  }, [currentUser, userData, onError]);

  // Clear all notifications (for user)
  const clearNotifications = useCallback(async () => {
    if (!currentUser?.uid || !userData?.role) return;

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
  }, [currentUser, userData, onError]);

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
      recipientUids: Array.isArray(notificationData.recipientUids) ? notificationData.recipientUids : [],
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

export const submitNotificationResponse = async ({
  answer,
  currentUser,
  instituteId,
  notificationId,
  prompt,
  responseType,
}) => {
  if (!currentUser?.uid || !instituteId || !notificationId) {
    throw new Error('Sign in before sending a response.');
  }

  const cleanedAnswer = String(answer || '').trim();
  if (!cleanedAnswer) {
    throw new Error('Choose or type a response before sending.');
  }

  const responseRef = doc(db, 'notificationResponses', `${notificationId}_${currentUser.uid}`);
  await setDoc(responseRef, {
    answer: cleanedAnswer,
    instituteId,
    notificationId,
    prompt: String(prompt || '').trim() || null,
    responseType: responseType || 'opinion',
    uid: currentUser.uid,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return responseRef.id;
};

export default {
  useUnifiedNotifications,
  createUnifiedNotification,
  submitNotificationResponse,
  NotificationType
};
