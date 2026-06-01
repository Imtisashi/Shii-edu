import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const AuthContext = createContext();

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(null);
  const unsubscribeDocRef = useRef(null);
  const authResolvedRef = useRef(false);
  const notificationsUnsubscribeRef = useRef(null);

  const logout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      setCurrentUser(null);
      setNotifications([]);

      // Clean up notification subscription
      if (notificationsUnsubscribeRef.current) {
        notificationsUnsubscribeRef.current();
        notificationsUnsubscribeRef.current = null;
      }
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  useEffect(() => {
    const handleAuthStateChange = async (user) => {
      authResolvedRef.current = true;
      setCurrentUser(user);
      if (user) {
        const userRef = doc(db, "users", user.uid);
        // Clean up previous subscription if exists
        if (unsubscribeDocRef.current) {
          unsubscribeDocRef.current();
        }
        // Set up new document subscription
        unsubscribeDocRef.current = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const basicData = userSnap.data();
            const normalizedRole = (basicData.role || '').trim().toLowerCase();
            const instituteId = basicData.instituteId || null;

            try {
              // Fetch the parent Institute's data to apply white-labeling and routing logic
              const instituteData = instituteId
                ? await getDoc(doc(db, "institutes", instituteId)).then((instSnap) => (instSnap.exists() ? instSnap.data() : null))
                : null;

              setUserData({
                ...basicData,
                uid: user.uid,
                role: normalizedRole || 'student', // default to student if not set or invalid
                instituteId,
                uniqueId: basicData.uniqueId || null, // for teacher and student
                instituteData: instituteData
              });
            } catch (err) {
              console.error("Failed to fetch Institute Data:", err);
              // Fallback if institute fetch fails
              setUserData({
                ...basicData,
                uid: user.uid,
                role: normalizedRole || 'student',
                instituteId,
                uniqueId: basicData.uniqueId || null,
              });
            }
          } else {
            console.error("Critical Error: Firebase Auth exists, but Firestore User Profile is missing.");
            setUserData(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("User profile subscription failed:", error);
          setUserData(null);
          setLoading(false);
        });
      } else {
        // User logged out, unsubscribe from document listener if exists
        if (unsubscribeDocRef.current) {
          unsubscribeDocRef.current();
          unsubscribeDocRef.current = null;
        }
        setUserData(null);
        setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, handleAuthStateChange);
    const authTimeout = setTimeout(() => {
      if (authResolvedRef.current) return;

      console.warn('Firebase Auth did not resolve before the startup timeout.');
      setCurrentUser(null);
      setUserData(null);
      setLoading(false);
    }, 8000);

    // Cleanup function
    return () => {
      clearTimeout(authTimeout);
      unsubscribeAuth();
      if (unsubscribeDocRef.current) {
        unsubscribeDocRef.current();
      }
      // Clean up notification subscription
      if (notificationsUnsubscribeRef.current) {
        notificationsUnsubscribeRef.current();
        notificationsUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Set up real-time notifications listener when user data changes
  useEffect(() => {
    const cleanupNotifications = () => {
      if (notificationsUnsubscribeRef.current) {
        notificationsUnsubscribeRef.current();
        notificationsUnsubscribeRef.current = null;
      }
    };

    if (!currentUser?.uid || !userData?.instituteId) {
      cleanupNotifications();
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError(null);

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("instituteId", "==", userData.instituteId)
    );

    const notificationRole = ['student', 'teacher', 'admin'].includes(userData.role)
      ? userData.role
      : 'student';

    cleanupNotifications();

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
            return targets.includes(notificationRole) || targets.includes('all');
          })
          .sort((a, b) => createdAtToMillis(b.createdAt) - createdAtToMillis(a.createdAt))
          .slice(0, 50);
        setNotifications(newNotifications);
        setNotificationsLoading(false);
        setNotificationsError(null);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        setNotificationsError(error);
        setNotificationsLoading(false);
      }
    );

    notificationsUnsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      if (notificationsUnsubscribeRef.current === unsubscribe) {
        notificationsUnsubscribeRef.current = null;
      }
    };
  }, [currentUser?.uid, userData?.instituteId, userData?.role]);

  const value = {
    currentUser,
    userData,
    loading,
    logout,
    notifications,
    notificationsLoading,
    notificationsError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
