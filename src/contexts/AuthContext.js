import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeDocRef = useRef(null);

  const logout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      setCurrentUser(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  useEffect(() => {
    const handleAuthStateChange = async (user) => {
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

            try {
              // Fetch the parent Institute's data to apply white-labeling and routing logic
              const instRef = doc(db, "institutes", basicData.instituteId);
              const instSnap = await getDoc(instRef);

              const instituteData = instSnap.exists() ? instSnap.data() : null;

              // Normalize role for consistent comparison (trim + lowercase)
              const normalizedRole = (basicData.role || '').trim().toLowerCase();

              setUserData({
                uid: user.uid,
                role: normalizedRole || 'student', // default to student if not set or invalid
                instituteId: basicData.instituteId || null,
                uniqueId: basicData.uniqueId || null, // for teacher and student
                ...basicData,
                instituteData: instituteData
              });
            } catch (err) {
              console.error("Failed to fetch Institute Data:", err);
              // Fallback if institute fetch fails
              const normalizedRole = (basicData.role || '').trim().toLowerCase();
              setUserData({
                uid: user.uid,
                role: normalizedRole || 'student',
                instituteId: basicData.instituteId || null,
                uniqueId: basicData.uniqueId || null,
                ...basicData
              });
            }
          } else {
            console.error("Critical Error: Firebase Auth exists, but Firestore User Profile is missing.");
            setUserData(null);
          }
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

    // Cleanup function
    return () => {
      unsubscribeAuth();
      if (unsubscribeDocRef.current) {
        unsubscribeDocRef.current();
      }
    };
  }, []);

  const value = {
    currentUser,
    userData,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
