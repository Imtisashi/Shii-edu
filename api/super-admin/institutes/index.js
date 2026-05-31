const {
  admin,
  assertPassword,
  authenticateSuperAdmin,
  createRequestId,
  generateInstituteId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

module.exports = async (req, res) => {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }

  let adminUser = null;

  try {
    const authContext = await authenticateSuperAdmin(req);
    const { firestore } = getAdminServices();
    const body = await getBody(req);
    const instituteName = normalizeName(body.instituteName);
    const adminName = normalizeName(body.adminName);
    const adminEmail = normalizeEmail(body.adminEmail);
    const adminPassword = body.adminPassword;

    if (!instituteName || !adminName || !adminEmail) {
      res.status(400).json({
        success: false,
        error: 'Institute name, admin name, and admin email are required.',
      });
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(adminEmail)) {
      res.status(400).json({ success: false, error: 'Please enter a valid admin email address.' });
      return;
    }

    assertPassword(adminPassword);

    const duplicateInstitute = await firestore
      .collection('institutes')
      .where('nameKey', '==', instituteName.toLowerCase())
      .limit(1)
      .get();

    if (!duplicateInstitute.empty) {
      res.status(409).json({ success: false, error: 'An institute with this name already exists.', requestId });
      return;
    }

    await admin.auth().getUserByEmail(adminEmail)
      .then(() => {
        const error = new Error('An account with that admin email already exists.');
        error.statusCode = 409;
        throw error;
      })
      .catch((error) => {
        if (error.code === 'auth/user-not-found') return;
        throw error;
      });

    const instituteId = await generateInstituteId(firestore, instituteName);
    adminUser = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    });

    const batch = firestore.batch();
    batch.set(firestore.collection('institutes').doc(instituteId), {
      instituteId,
      name: instituteName,
      nameKey: instituteName.toLowerCase(),
      type: 'school',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: authContext.uid,
      settings: {
        theme: 'default',
        notificationsEnabled: true,
      },
    });
    batch.set(firestore.collection('users').doc(adminUser.uid), {
      uid: adminUser.uid,
      email: adminEmail,
      name: adminName,
      role: 'admin',
      instituteId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: authContext.uid,
    });

    await batch.commit();
    res.status(201).json({
      success: true,
      instituteId,
      adminUid: adminUser.uid,
      institute: {
        id: instituteId,
        instituteId,
        name: instituteName,
        adminEmail,
      },
      requestId,
    });
  } catch (error) {
    if (adminUser?.uid) {
      await admin.auth().deleteUser(adminUser.uid).catch(() => {});
    }

    if (error.code === 'auth/email-already-exists') {
      error.statusCode = 409;
      error.message = 'An account with that admin email already exists.';
    }

    sendError(res, error, 'Failed to create institute.', requestId);
  }
};
