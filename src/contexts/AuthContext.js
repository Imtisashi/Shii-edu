import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import {
  assertLoginInstituteId,
  assertLoginUserId,
  normalizeLoginIdentifier,
  toLegacyAuthEmail,
  toLoginIdentifierKey,
  toInstituteAuthEmail,
} from '../utils/instituteLoginIdentifiers';
import { registerDevicePushToken } from '../services/pushNotificationService';
import { registerCurrentUserWebPush } from '../services/webPushSubscriptionService';
import { ensureInstituteClaims } from '../services/instituteClaimsService';
import {
  clearCachedInstituteIdentity,
  readCachedInstituteIdentity,
  writeCachedInstituteIdentity,
} from '../services/secureInstituteIdentityStore';
import {
  authenticateInstituteSession,
  getBiometricCapability,
} from '../services/biometricAuthService';
import { listSupabaseNotifications } from '../services/supabaseTenantDataService';

const AuthContext = createContext();
const INSTITUTE_APP_MODE = 'institute';

export const INVALID_INSTITUTE_ID_ERROR = 'Invalid Institute ID for these credentials.';
export const INVALID_USER_ID_ERROR = 'Invalid User ID for these credentials.';
export const WRONG_PASSWORD_ERROR = 'Wrong password. Something is wrong.';

const normalizeRole = (role) => {
  const compactRole = String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (compactRole === 'superadmin') return 'superadmin';
  if (compactRole === 'instituteadmin') return 'admin';
  if (compactRole === 'professor') return 'teacher';
  return compactRole;
};

const normalizeInstituteId = (instituteId) => normalizeLoginIdentifier(instituteId);
const normalizeUserId = (userId) => normalizeLoginIdentifier(userId);

const createAuthError = (message, code = 'auth/institute-verification-failed') => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const roleMatchesExpectedPortal = (expectedRole, normalizedRole) => {
  if (!expectedRole) return true;
  if (expectedRole === 'parent') return normalizedRole === 'parent';
  if (expectedRole === 'driver') return normalizedRole === 'driver';
  if (expectedRole === 'institute') return !['driver', 'parent'].includes(normalizedRole);
  return true;
};

const roleMismatchMessage = (expectedRole) => {
  if (expectedRole === 'parent') return 'Use a registered parent account for the Parents tab.';
  if (expectedRole === 'driver') return 'Use a registered driver account for the Driver tab.';
  return 'Use an institute account for the Institute tab.';
};

const getInstituteIdentityDetails = (profile = {}) => {
  const instituteData = profile?.instituteData || {};
  const branding = instituteData?.branding || {};
  const settingsBranding = instituteData?.settings?.branding || {};

  return {
    instituteName: instituteData?.name || instituteData?.instituteName || null,
    logoUrl: branding?.logoUrl ||
      settingsBranding?.logoUrl ||
      instituteData?.logoUrl ||
      null,
  };
};

const storeInstituteSession = async (
  uid,
  instituteId,
  userId,
  profile = null,
  biometricEnabled
) => {
  const previousIdentity = await readCachedInstituteIdentity();
  const details = getInstituteIdentityDetails(profile || {});

  return writeCachedInstituteIdentity({
    biometricEnabled: typeof biometricEnabled === 'boolean'
      ? biometricEnabled
      : Boolean(previousIdentity?.biometricEnabled),
    instituteId: normalizeInstituteId(instituteId),
    instituteName: details.instituteName || previousIdentity?.instituteName || 'Shii-Edu',
    logoUrl: details.logoUrl || previousIdentity?.logoUrl || null,
    uid,
    userId: normalizeUserId(userId),
    updatedAt: new Date().toISOString(),
  });
};

const readStoredInstituteSession = async (uid) => {
  try {
    const cachedIdentity = await readCachedInstituteIdentity();
    if (
      cachedIdentity?.uid === uid &&
      normalizeInstituteId(cachedIdentity.instituteId) &&
      normalizeUserId(cachedIdentity.userId)
    ) {
      return cachedIdentity;
    }

    return null;
  } catch (error) {
    console.warn('Failed to read the stored institute session:', error);
    return null;
  }
};

const clearStoredInstituteSession = async () => {
  try {
    await clearCachedInstituteIdentity();
  } catch (error) {
    console.warn('Failed to clear the stored institute session:', error);
  }
};

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children, appMode = 'combined' }) {
  const isInstituteMode = appMode === INSTITUTE_APP_MODE;
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(null);
  const [authStage, setAuthStage] = useState('initializing');
  const [cachedInstituteIdentity, setCachedInstituteIdentity] = useState(null);
  const [biometricCapability, setBiometricCapability] = useState({
    available: false,
    label: 'Biometrics',
    reason: null,
  });
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [authError, setAuthError] = useState(null);
  const unsubscribeDocRef = useRef(null);
  const authResolvedRef = useRef(false);
  const notificationsUnsubscribeRef = useRef(null);
  const pendingInstituteLoginRef = useRef(null);
  const biometricUnlockRef = useRef(false);
  const authChangeVersionRef = useRef(0);

  const cleanupProfileSubscription = useCallback(() => {
    if (unsubscribeDocRef.current) {
      unsubscribeDocRef.current();
      unsubscribeDocRef.current = null;
    }
  }, []);

  const cleanupNotificationSubscription = useCallback(() => {
    if (notificationsUnsubscribeRef.current) {
      notificationsUnsubscribeRef.current();
      notificationsUnsubscribeRef.current = null;
    }
  }, []);

  const buildUserData = useCallback((user, basicData, instituteId, instituteData = null) => ({
    ...basicData,
    uid: user.uid,
    role: normalizeRole(basicData.role) || 'student',
    instituteId,
    loginId: basicData.loginId || basicData.uniqueId || null,
    uniqueId: basicData.uniqueId || null,
    instituteData,
  }), []);

  const verifyInstituteProfile = useCallback(async (user, expectedInstituteId, expectedUserId, expectedRole = null) => {
    const normalizedExpectedId = assertLoginInstituteId(expectedInstituteId);
    const normalizedExpectedUserId = assertLoginUserId(expectedUserId);
    if (!normalizedExpectedId) {
      throw createAuthError('Institute ID is required.', 'auth/missing-institute-id');
    }

    const userSnapshot = await getDoc(doc(db, 'users', user.uid));
    if (!userSnapshot.exists()) {
      throw createAuthError('No institute profile exists for these credentials.', 'auth/missing-institute-profile');
    }

    const basicData = userSnapshot.data();
    const profileInstituteId = normalizeInstituteId(basicData.instituteId);
    const profileUserId = normalizeUserId(basicData.loginId || basicData.uniqueId);
    const normalizedRole = normalizeRole(basicData.role);

    if (!profileInstituteId || profileInstituteId !== normalizedExpectedId) {
      throw createAuthError(INVALID_INSTITUTE_ID_ERROR, 'auth/invalid-institute-id');
    }

    if (!profileUserId || toLoginIdentifierKey(profileUserId) !== toLoginIdentifierKey(normalizedExpectedUserId)) {
      throw createAuthError(INVALID_USER_ID_ERROR, 'auth/invalid-user-id');
    }

    if (normalizedRole === 'superadmin') {
      throw createAuthError('Superadmin accounts must use the Shii-Edu Superadmin application.', 'auth/institute-role-required');
    }

    if (!roleMatchesExpectedPortal(expectedRole, normalizedRole)) {
      throw createAuthError(roleMismatchMessage(expectedRole), 'auth/institute-role-mismatch');
    }

    const instituteSnapshot = await getDoc(doc(db, 'institutes', profileInstituteId));
    if (!instituteSnapshot.exists()) {
      throw createAuthError('The institute linked to this account no longer exists.', 'auth/missing-institute');
    }

    const verifiedProfile = buildUserData(user, basicData, profileInstituteId, instituteSnapshot.data());
    setLoadingProfile(verifiedProfile);
    setAuthStage('synchronizing');
    return verifiedProfile;
  }, [buildUserData]);

  const invalidateInstituteSession = useCallback(async (message, { exposeError = true } = {}) => {
    pendingInstituteLoginRef.current = null;
    biometricUnlockRef.current = false;
    cleanupProfileSubscription();
    cleanupNotificationSubscription();
    await clearStoredInstituteSession();

    setCurrentUser(null);
    setUserData(null);
    setLoadingProfile(null);
    setCachedInstituteIdentity(null);
    setAuthStage('ready');
    setNotifications([]);
    setProfileError(exposeError ? message : null);
    setAuthError(exposeError ? message : null);
    setLoading(false);

    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Failed to sign out an invalid institute session:', error);
      }
    }
  }, [cleanupNotificationSubscription, cleanupProfileSubscription]);

  const subscribeToInstituteProfile = useCallback((user, expectedInstituteId, expectedUserId, expectedRole = null) => {
    cleanupProfileSubscription();

    unsubscribeDocRef.current = onSnapshot(
      doc(db, 'users', user.uid),
      async (userSnapshot) => {
        try {
          if (!userSnapshot.exists()) {
            await invalidateInstituteSession('No institute profile exists for these credentials.');
            return;
          }

          const basicData = userSnapshot.data();
          const profileInstituteId = normalizeInstituteId(basicData.instituteId);
          const profileUserId = normalizeUserId(basicData.loginId || basicData.uniqueId);
          const normalizedRole = normalizeRole(basicData.role);

          if (!profileInstituteId || profileInstituteId !== expectedInstituteId) {
            await invalidateInstituteSession(INVALID_INSTITUTE_ID_ERROR);
            return;
          }

          if (!profileUserId || toLoginIdentifierKey(profileUserId) !== toLoginIdentifierKey(expectedUserId)) {
            await invalidateInstituteSession(INVALID_USER_ID_ERROR);
            return;
          }

          if (normalizedRole === 'superadmin') {
            await invalidateInstituteSession('Superadmin accounts must use the Shii-Edu Superadmin application.');
            return;
          }

          if (!roleMatchesExpectedPortal(expectedRole, normalizedRole)) {
            await invalidateInstituteSession(roleMismatchMessage(expectedRole));
            return;
          }

          const instituteSnapshot = await getDoc(doc(db, 'institutes', profileInstituteId));
          if (!instituteSnapshot.exists()) {
            await invalidateInstituteSession('The institute linked to this account no longer exists.');
            return;
          }

          const refreshedProfile = buildUserData(user, basicData, profileInstituteId, instituteSnapshot.data());
          setUserData(refreshedProfile);
          storeInstituteSession(user.uid, profileInstituteId, profileUserId, refreshedProfile)
            .then(setCachedInstituteIdentity)
            .catch((error) => {
              console.warn('Failed to refresh the cached institute identity:', error);
            });
          setProfileError(null);
        } catch (error) {
          console.error('Institute profile refresh failed:', error);
          await invalidateInstituteSession('Your institute session could not be verified.');
        }
      },
      async (error) => {
        console.error('Institute profile subscription failed:', error);
        await invalidateInstituteSession('Your institute session could not be verified.');
      }
    );
  }, [buildUserData, cleanupProfileSubscription, invalidateInstituteSession]);

  const loginWithInstitute = useCallback(async ({
    instituteId,
    userId,
    password,
    enableBiometrics = false,
    expectedRole = null,
  }) => {
    if (!isInstituteMode) {
      throw createAuthError('Institute login is only available in the Shii-Edu application.');
    }

    const normalizedInstituteId = assertLoginInstituteId(instituteId);
    const normalizedUserId = assertLoginUserId(userId);

    if (!normalizedInstituteId) {
      throw createAuthError('Institute ID is required.', 'auth/missing-institute-id');
    }

    if (!normalizedUserId) {
      throw createAuthError('User ID is required.', 'auth/missing-user-id');
    }

    if (!password) {
      throw createAuthError('Password is required.', 'auth/missing-password');
    }

    pendingInstituteLoginRef.current = {
      biometricEnabled: Boolean(enableBiometrics),
      expectedRole,
      instituteId: normalizedInstituteId,
      userId: normalizedUserId,
    };
    setAuthError(null);
    setProfileError(null);

    let credential = null;

    try {
      const instituteAuthEmail = await toInstituteAuthEmail(normalizedInstituteId, normalizedUserId);
      const legacyAuthEmail = toLegacyAuthEmail(normalizedUserId);
      const authEmails = instituteAuthEmail === legacyAuthEmail
        ? [instituteAuthEmail]
        : [instituteAuthEmail, legacyAuthEmail];

      let lastCredentialError = null;
      for (const authEmail of authEmails) {
        try {
          credential = await signInWithEmailAndPassword(auth, authEmail, password);
          break;
        } catch (error) {
          const errorCode = String(error?.code || '');
          const isCredentialError = errorCode.startsWith('auth/invalid-credential') ||
            errorCode === 'auth/user-not-found' ||
            errorCode === 'auth/wrong-password';

          if (!isCredentialError) throw error;
          lastCredentialError = error;
        }
      }

      if (!credential) throw lastCredentialError || createAuthError('Unable to sign in.');

      const verifiedProfile = await verifyInstituteProfile(
        credential.user,
        normalizedInstituteId,
        normalizedUserId,
        expectedRole
      );
      const cachedIdentity = await storeInstituteSession(
        credential.user.uid,
        normalizedInstituteId,
        normalizedUserId,
        verifiedProfile,
        Boolean(enableBiometrics)
      );
      setCachedInstituteIdentity(cachedIdentity);

      return {
        user: credential.user,
        profile: verifiedProfile,
      };
    } catch (error) {
      const errorCode = String(error?.code || '');
      const message = errorCode.startsWith('auth/invalid-credential') ||
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/wrong-password'
        ? WRONG_PASSWORD_ERROR
        : error?.message || 'Unable to sign in.';

      pendingInstituteLoginRef.current = null;
      setAuthError(message);

      if (credential?.user || auth.currentUser) {
        await invalidateInstituteSession(message);
      }

      throw createAuthError(message, errorCode || 'auth/sign-in-failed');
    }
  }, [invalidateInstituteSession, isInstituteMode, verifyInstituteProfile]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const completeInstituteSession = useCallback(async (user, expectedLogin) => {
    const expectedInstituteId = normalizeInstituteId(expectedLogin?.instituteId);
    const expectedUserId = normalizeUserId(expectedLogin?.userId);
    const expectedRole = expectedLogin?.expectedRole || null;

    if (!expectedInstituteId || !expectedUserId) {
      throw createAuthError(
        'Sign in with your Institute ID and User ID to continue.',
        'auth/missing-institute-session'
      );
    }

    const verifiedProfile = await verifyInstituteProfile(user, expectedInstituteId, expectedUserId, expectedRole);
    await ensureInstituteClaims(user).catch((error) => {
      console.warn('Institute claim synchronization failed:', error);
    });
    const identity = await storeInstituteSession(
      user.uid,
      expectedInstituteId,
      expectedUserId,
      verifiedProfile,
      Boolean(expectedLogin?.biometricEnabled)
    );

    pendingInstituteLoginRef.current = null;
    setCachedInstituteIdentity(identity);
    setCurrentUser(user);
    setUserData(verifiedProfile);
    setProfileError(null);
    setAuthError(null);
    setLoading(false);
    setLoadingProfile(null);
    setAuthStage('ready');
    subscribeToInstituteProfile(user, expectedInstituteId, expectedUserId, expectedRole);
    return verifiedProfile;
  }, [subscribeToInstituteProfile, verifyInstituteProfile]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!isInstituteMode) {
      throw createAuthError('Biometric institute access is only available in the Shii-Edu application.');
    }

    const user = auth.currentUser;
    if (!user) {
      const message = 'Your secure session has expired. Sign in with your password to continue.';
      setAuthError(message);
      throw createAuthError(message, 'auth/biometric-session-expired');
    }

    const identity = cachedInstituteIdentity || await readStoredInstituteSession(user.uid);
    if (!identity || identity.uid !== user.uid) {
      const message = 'Your secure session has expired. Sign in with your password to continue.';
      setAuthError(message);
      throw createAuthError(message, 'auth/biometric-session-expired');
    }

    setLoading(true);
    setAuthStage('biometric-verifying');
    setAuthError(null);
    biometricUnlockRef.current = true;

    try {
      await authenticateInstituteSession(identity.instituteName);
      return await completeInstituteSession(user, identity);
    } catch (error) {
      const message = error?.message || 'Biometric authentication failed.';
      setAuthError(message);
      setLoading(false);
      setLoadingProfile(null);
      setAuthStage('biometric-required');
      throw createAuthError(message, error?.code || 'auth/biometric-failed');
    } finally {
      biometricUnlockRef.current = false;
    }
  }, [cachedInstituteIdentity, completeInstituteSession, isInstituteMode]);

  const logout = useCallback(async () => {
    try {
      pendingInstituteLoginRef.current = null;
      biometricUnlockRef.current = false;
      cleanupProfileSubscription();
      cleanupNotificationSubscription();
      if (isInstituteMode) {
        await clearStoredInstituteSession();
      }
      await signOut(auth);
      setUserData(null);
      setCurrentUser(null);
      setLoadingProfile(null);
      setCachedInstituteIdentity(null);
      setAuthStage('ready');
      setNotifications([]);
      setProfileError(null);
      setAuthError(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  }, [cleanupNotificationSubscription, cleanupProfileSubscription, isInstituteMode]);

  useEffect(() => {
    if (!isInstituteMode) return undefined;

    let active = true;
    Promise.all([
      readCachedInstituteIdentity(),
      getBiometricCapability(),
    ]).then(([identity, capability]) => {
      if (!active) return;
      setCachedInstituteIdentity(identity);
      setBiometricCapability(capability);
    }).catch((error) => {
      console.warn('Failed to prepare institute identity access:', error);
    });

    return () => {
      active = false;
    };
  }, [isInstituteMode]);

  useEffect(() => {
    const handleAuthStateChange = async (user) => {
      const authChangeVersion = ++authChangeVersionRef.current;
      authResolvedRef.current = true;

      if (isInstituteMode && user) {
        setLoading(true);
        setAuthStage('verifying');
        setCurrentUser(null);
        setUserData(null);
        setLoadingProfile(null);
        setProfileError(null);
        cleanupProfileSubscription();

        const pendingLogin = pendingInstituteLoginRef.current;
        const expectedLogin = pendingLogin || await readStoredInstituteSession(user.uid);
        const expectedInstituteId = normalizeInstituteId(expectedLogin?.instituteId);
        const expectedUserId = normalizeUserId(expectedLogin?.userId);
        setCachedInstituteIdentity(expectedLogin || null);

        if (authChangeVersion !== authChangeVersionRef.current) return;

        if (!expectedInstituteId || !expectedUserId) {
          await invalidateInstituteSession('Sign in with your Institute ID and User ID to continue.', { exposeError: false });
          return;
        }

        if (!pendingLogin && expectedLogin?.biometricEnabled && !biometricUnlockRef.current) {
          const capability = await getBiometricCapability();
          if (authChangeVersion !== authChangeVersionRef.current) return;

          setBiometricCapability(capability);
          if (!capability.available) {
            await invalidateInstituteSession(
              capability.reason || 'Biometric authentication is no longer available on this device.'
            );
            return;
          }

          setLoading(false);
          setLoadingProfile(null);
          setAuthStage('biometric-required');
          return;
        }

        try {
          await completeInstituteSession(user, expectedLogin);
          if (authChangeVersion !== authChangeVersionRef.current) return;
        } catch (error) {
          if (authChangeVersion !== authChangeVersionRef.current) return;
          await invalidateInstituteSession(error?.message || 'Your institute session could not be verified.');
        }
        return;
      }

      setCurrentUser(user);
      if (user) {
        setAuthStage('synchronizing');
        const userRef = doc(db, "users", user.uid);
        // Clean up previous subscription if exists
        cleanupProfileSubscription();
        // Set up new document subscription
        unsubscribeDocRef.current = onSnapshot(userRef, async (userSnap) => {
          setProfileError(null);

          if (userSnap.exists()) {
            const basicData = userSnap.data();
            const normalizedRole = normalizeRole(basicData.role);
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
            try {
              const tokenResult = await getIdTokenResult(user);
              const claimsRole = normalizeRole(tokenResult.claims?.role || tokenResult.claims?.userRole || tokenResult.claims?.user_role);
              const hasSuperAdminClaim = claimsRole === 'superadmin' || tokenResult.claims?.superadmin === true || tokenResult.claims?.superAdmin === true;

              if (hasSuperAdminClaim) {
                setUserData({
                  uid: user.uid,
                  role: 'superadmin',
                  name: user.displayName || user.email || 'Super Admin',
                  email: user.email || '',
                  instituteId: null,
                  uniqueId: null,
                  instituteData: null,
                  recoveredFromToken: true,
                });
                setProfileError(null);
              } else {
                setUserData(null);
                setProfileError('Your Firebase Auth account exists, but the matching Firestore user profile is missing.');
              }
            } catch (tokenError) {
              console.error('Failed to recover user profile from token claims:', tokenError);
              setUserData(null);
              setProfileError('Your account profile could not be loaded.');
            }
          }
          setLoading(false);
          setLoadingProfile(null);
          setAuthStage('ready');
        }, (error) => {
          console.error("User profile subscription failed:", error);
          setUserData(null);
          setProfileError(error.message || 'Your account profile could not be loaded.');
          setLoading(false);
          setLoadingProfile(null);
          setAuthStage('ready');
        });
      } else {
        // User logged out, unsubscribe from document listener if exists
        cleanupProfileSubscription();
        setUserData(null);
        setLoadingProfile(null);
        setProfileError(null);
        setLoading(false);
        setAuthStage('ready');
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, handleAuthStateChange);
    const authTimeout = setTimeout(() => {
      if (authResolvedRef.current) return;

      console.warn('Firebase Auth did not resolve before the startup timeout.');
      setCurrentUser(null);
      setUserData(null);
      setLoadingProfile(null);
      setLoading(false);
      setAuthStage('ready');
    }, 8000);

    // Cleanup function
    return () => {
      clearTimeout(authTimeout);
      unsubscribeAuth();
      cleanupProfileSubscription();
      cleanupNotificationSubscription();
    };
  }, [
    cleanupNotificationSubscription,
    cleanupProfileSubscription,
    completeInstituteSession,
    invalidateInstituteSession,
    isInstituteMode,
  ]);

  // Set up tenant-scoped notification loading when user data changes
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

    cleanupNotifications();

    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const result = await listSupabaseNotifications(currentUser, 50);
        if (cancelled) return;
        const nextNotifications = Array.isArray(result?.notifications)
          ? result.notifications
          : [];
        setNotifications(nextNotifications);
        setNotificationsLoading(false);
        setNotificationsError(null);
      } catch (_error) {
        if (cancelled) return;
        setNotifications([]);
        setNotificationsError(null);
        setNotificationsLoading(false);
      }
    };

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 45000);
    notificationsUnsubscribeRef.current = () => {
      cancelled = true;
      clearInterval(intervalId);
    };

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (notificationsUnsubscribeRef.current) {
        notificationsUnsubscribeRef.current = null;
      }
    };
  }, [currentUser, userData]);

  useEffect(() => {
    registerDevicePushToken({
      currentUser,
      profile: userData,
    }).catch((error) => {
      console.warn('Push token registration failed:', error);
    });
  }, [currentUser, userData]);

  useEffect(() => {
    registerCurrentUserWebPush({
      currentUser,
      profile: userData,
    }).catch((error) => {
      console.warn('Web push subscription registration failed:', error);
    });
  }, [currentUser, userData]);

  const value = {
    appMode,
    authStage,
    authError,
    biometricCapability,
    cachedInstituteIdentity,
    clearAuthError,
    currentUser,
    userData,
    loading,
    loadingProfile,
    loginWithInstitute,
    logout,
    notifications,
    notificationsLoading,
    notificationsError,
    profileError,
    unlockWithBiometrics,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
