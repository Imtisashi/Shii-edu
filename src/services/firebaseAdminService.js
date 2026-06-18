import { auth, db } from '../../firebaseConfig';
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { authenticatedFetch } from './apiClient';

const INSTITUTE_SCOPED_COLLECTIONS = [
  'users',
  'notices',
  'routines',
  'assignments',
  'grades',
  'attendance',
  'gallery',
  'pyqs',
  'paymentOrders',
  'payments',
];

/**
 * Creates a new institute and admin profile
 * @param {Object} params - Institute and admin details
 * @returns {Promise<Object>} Result with instituteId and adminUid
 */
export const createInstituteAndAdmin = async ({
  instituteName,
  adminUserId,
  adminPassword,
  adminName,
  institutionType = 'SCHOOL',
  payoutBankAccount,
}, currentUser = auth.currentUser) => {
  try {
    return await authenticatedFetch('/api/super-admin/institutes', currentUser, {
      method: 'POST',
      body: {
        instituteName,
        adminUserId,
        adminPassword,
        adminName,
        institutionType,
        payoutBankAccount,
      },
    });
  } catch (error) {
    console.error('Error creating institute and admin:', error);
    return {
      success: false,
      error: error.message,
      code: error.payload?.code,
      requestId: error.payload?.requestId,
      requiredEnv: error.payload?.requiredEnv,
    };
  }
};

export const deleteInstituteAsSuperAdmin = async (instituteId) => {
  try {
    return await authenticatedFetch(`/api/super-admin/institutes/${encodeURIComponent(instituteId)}`, auth.currentUser, {
      method: 'DELETE',
    });
  } catch (error) {
    if (error.message?.includes('Missing EXPO_PUBLIC_API_BASE_URL')) {
      return deleteInstituteFromFirestore(instituteId);
    }

    console.error('Error deleting institute:', error);
    return { success: false, error: error.message };
  }
};

export const updateInstituteFeatureSettings = async (instituteId, settings) => {
  const body = settings?.features || settings?.rateLimits
    ? settings
    : { features: settings };

  try {
    return await authenticatedFetch(`/api/super-admin/institutes/${encodeURIComponent(instituteId)}`, auth.currentUser, {
      method: 'PATCH',
      body,
    });
  } catch (error) {
    console.error('Error updating institute feature settings:', error);
    return {
      success: false,
      error: error.message,
      code: error.payload?.code,
      requestId: error.payload?.requestId,
    };
  }
};

const deleteSnapshot = async (snapshot) => {
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return snapshot.size;
};

const deleteCollectionByInstituteId = async (collectionName, instituteId) => {
  let deleted = 0;

  while (true) {
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('instituteId', '==', instituteId),
      limit(400)
    ));

    if (snapshot.empty) return deleted;
    deleted += await deleteSnapshot(snapshot);
  }
};

const resolveInstituteSnapshot = async (instituteId) => {
  const directRef = doc(db, 'institutes', instituteId);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return directSnap;
  }

  const byPublicId = await getDocs(query(
    collection(db, 'institutes'),
    where('instituteId', '==', instituteId),
    limit(1)
  ));

  return byPublicId.docs[0] || null;
};

const deleteInstituteFromFirestore = async (instituteId) => {
  try {
    const instituteSnap = await resolveInstituteSnapshot(instituteId);
    if (!instituteSnap) {
      return { success: false, error: 'Institute not found.' };
    }

    const publicInstituteId = instituteSnap.data().instituteId || instituteSnap.id;
    const deleted = {};

    for (const collectionName of INSTITUTE_SCOPED_COLLECTIONS) {
      deleted[collectionName] = await deleteCollectionByInstituteId(collectionName, publicInstituteId);
    }

    const batch = writeBatch(db);
    batch.delete(instituteSnap.ref);
    await batch.commit();
    deleted.institutes = 1;
    deleted.authUsers = 0;

    return {
      success: true,
      fallback: 'firestore',
      instituteId: publicInstituteId,
      deleted,
    };
  } catch (error) {
    console.error('Firestore institute delete failed:', error);
    return { success: false, error: error.message || 'Failed to delete institute.' };
  }
};

/**
 * Invites a teacher or student to an institute
 * @param {Object} params - Invitation details
 * @returns {Promise<Object>} Result
 */
export const inviteUserToInstitute = async ({ instituteId, role, uniqueId, email, name }) => {
  try {
    // Validate institute exists
    const instituteRef = doc(db, 'institutes', instituteId);
    const instituteSnap = await getDoc(instituteRef);
    if (!instituteSnap.exists()) {
      return { success: false, error: 'Institute not found' };
    }

    // Check if uniqueId is already taken in this institute for this role
    const usersRef = collection(db, 'users');
    const q = query(usersRef,
      where('instituteId', '==', instituteId),
      where('role', '==', role),
      where('uniqueId', '==', uniqueId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { success: false, error: `${role} ID already exists in this institute` };
    }

    // Create invitation (could be stored in invitations collection)
    // For now, we'll just return success - actual user creation happens via auth
    return { success: true, message: `Invitation ready for ${email}` };
  } catch (error) {
    console.error('Error inviting user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Gets institute stats for dashboard
 * @param {string} instituteId
 * @returns {Promise<Object>} Stats
 */
export const getInstituteStats = async (instituteId) => {
  try {
    const usersRef = collection(db, 'users');
    const instituteUsersQ = query(usersRef, where('instituteId', '==', instituteId));
    const instituteUsersSnap = await getDocs(instituteUsersQ);

    const teachersQ = query(usersRef,
      where('instituteId', '==', instituteId),
      where('role', '==', 'teacher')
    );
    const teachersSnap = await getDocs(teachersQ);

    const studentsQ = query(usersRef,
      where('instituteId', '==', instituteId),
      where('role', '==', 'student')
    );
    const studentsSnap = await getDocs(studentsQ);

    return {
      totalUsers: instituteUsersSnap.size,
      teachers: teachersSnap.size,
      students: studentsSnap.size,
      instituteId
    };
  } catch (error) {
    console.error('Error getting institute stats:', error);
    return { totalUsers: 0, teachers: 0, students: 0 };
  }
};

/**
 * Updates institute settings
 * @param {string} instituteId
 * @param {Object} settings
 * @returns {Promise<Object>} Result
 */
export const updateInstituteSettings = async (instituteId, settings) => {
  try {
    const instituteRef = doc(db, 'institutes', instituteId);
    await updateDoc(instituteRef, {
      settings: { ...settings, updatedAt: new Date() }
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating institute settings:', error);
    return { success: false, error: error.message };
  }
};

export default {
  createInstituteAndAdmin,
  deleteInstituteAsSuperAdmin,
  updateInstituteFeatureSettings,
  inviteUserToInstitute,
  getInstituteStats,
  updateInstituteSettings
};
