import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { authenticatedFetch } from './apiClient';

/**
 * Generates a unique institute ID from the institute name
 * @param {string} name - Institute name
 * @returns {Promise<string>} Unique institute ID
 */
export const generateInstituteId = async (name) => {
  // Convert to uppercase, remove non-alphanumeric, take first 6 chars
  let baseId = name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);

  // If too short, pad with institute name length
  if (baseId.length < 4) {
    baseId = (name.length.toString() + baseId).padStart(6, '0');
  }

  // Check if ID exists, if so append a number
  const institutesRef = collection(db, 'institutes');
  const q = query(institutesRef, where('instituteId', '==', baseId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Find next available number
    let counter = 1;
    let newId = `${baseId}${counter}`;
    while (true) {
      const q2 = query(institutesRef, where('instituteId', '==', newId));
      const snapshot2 = await getDocs(q2);
      if (snapshot2.empty) break;
      counter++;
      newId = `${baseId}${counter}`;
    }
    return newId;
  }

  return baseId;
};

/**
 * Creates a new institute and admin profile
 * @param {Object} params - Institute and admin details
 * @returns {Promise<Object>} Result with instituteId and adminUid
 */
export const createInstituteAndAdmin = async ({ instituteName, adminEmail, adminPassword, adminName }) => {
  try {
    return await authenticatedFetch('/api/super-admin/institutes', auth.currentUser, {
      method: 'POST',
      body: {
        instituteName,
        adminEmail,
        adminPassword,
        adminName,
      },
    });
  } catch (error) {
    console.error('Error creating institute and admin:', error);
    return { success: false, error: error.message };
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
  generateInstituteId,
  createInstituteAndAdmin,
  inviteUserToInstitute,
  getInstituteStats,
  updateInstituteSettings
};
