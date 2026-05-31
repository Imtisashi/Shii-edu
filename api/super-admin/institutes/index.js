const {
  admin,
  assertPassword,
  authenticateSuperAdmin,
  generateInstituteId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);

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
    const instituteName = String(body.instituteName || '').trim();
    const adminName = String(body.adminName || '').trim();
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
    res.status(201).json({ success: true, instituteId, adminUid: adminUser.uid });
  } catch (error) {
    if (adminUser?.uid) {
      await admin.auth().deleteUser(adminUser.uid).catch(() => {});
    }

    if (error.code === 'auth/email-already-exists') {
      error.statusCode = 409;
      error.message = 'An account with that admin email already exists.';
    }

    sendError(res, error, 'Failed to create institute.');
  }
};
