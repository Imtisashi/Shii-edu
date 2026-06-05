const {
  admin,
  assertPassword,
  authenticateSuperAdmin,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../../_lib/firebaseAdmin');
const { buildDefaultAcademicModel } = require('../../_lib/academicModels');
const { buildFeatureSettings } = require('../../_lib/featureEntitlements');
const { createBrandingPayload } = require('../../_lib/institutionBranding');
const {
  assertUserId,
  toIdentifierKey,
  toInstituteAuthEmail,
} = require('../../_lib/loginIdentifiers');
const { callSupabaseTenantBridge } = require('../../_lib/supabaseTenantBridge');

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const VALID_INSTITUTION_TYPES = new Set(['SCHOOL', 'COLLEGE']);

const normalizeInstitutionType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (VALID_INSTITUTION_TYPES.has(normalized)) return normalized;

  const error = new Error('institutionType must be either SCHOOL or COLLEGE.');
  error.statusCode = 400;
  throw error;
};

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
    const adminUserId = assertUserId(body.adminUserId, 'Administrator User ID');
    const adminLoginIdKey = toIdentifierKey(adminUserId);
    const adminPassword = body.adminPassword;
    const institutionType = normalizeInstitutionType(body.institutionType);
    const lowerInstitutionType = institutionType.toLowerCase();
    const branding = createBrandingPayload({ institutionType });
    const featureSettings = buildFeatureSettings({
      actorUid: authContext.uid,
      tier: 'complete',
    });

    if (!instituteName || !adminName) {
      res.status(400).json({
        success: false,
        error: 'Institute name, admin name, and Administrator User ID are required.',
      });
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

    const instituteRef = firestore.collection('institutes').doc();
    const instituteId = instituteRef.id;
    const adminAuthEmail = toInstituteAuthEmail(instituteId, adminUserId);

    await admin.auth().getUserByEmail(adminAuthEmail)
      .then(() => {
        const error = new Error('An account with that Administrator User ID already exists in this institute.');
        error.statusCode = 409;
        throw error;
      })
      .catch((error) => {
        if (error.code === 'auth/user-not-found') return;
        throw error;
      });

    adminUser = await admin.auth().createUser({
      email: adminAuthEmail,
      password: adminPassword,
      displayName: adminName,
    });
    await admin.auth().setCustomUserClaims(adminUser.uid, {
      instituteId,
      role: 'admin',
      instituteVerified: true,
    });

    const instituteProfile = {
      instituteId,
      name: instituteName,
      nameKey: instituteName.toLowerCase(),
      institutionType,
      type: lowerInstitutionType,
      branding,
      configuration: {
        features: featureSettings,
      },
      features: featureSettings,
      schemaVersion: 3,
      academicModel: buildDefaultAcademicModel(institutionType),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: authContext.uid,
      settings: {
        theme: 'white-label',
        branding,
        features: featureSettings,
        notificationsEnabled: true,
        institutionType,
      },
    };
    const adminProfile = {
      uid: adminUser.uid,
      email: null,
      authEmail: adminAuthEmail,
      name: adminName,
      role: 'admin',
      instituteId,
      loginId: adminUserId,
      loginIdKey: adminLoginIdKey,
      uniqueId: adminUserId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: authContext.uid,
    };

    const batch = firestore.batch();
    batch.set(instituteRef, instituteProfile);
    batch.set(firestore.collection('users').doc(adminUser.uid), adminProfile);

    await batch.commit();
    const supabaseMirror = await callSupabaseTenantBridge({
      action: 'createInstituteWithProfiles',
      authorization: req.headers.authorization || '',
      payload: {
        institute: instituteProfile,
        profiles: [adminProfile],
      },
    });

    res.status(201).json({
      success: true,
      instituteId,
      adminUid: adminUser.uid,
      supabaseInstituteId: supabaseMirror.institute?.id || null,
      institute: {
        id: instituteId,
        instituteId,
        name: instituteName,
        institutionType,
        type: lowerInstitutionType,
        adminUserId,
        branding,
      },
      requestId,
    });
  } catch (error) {
    if (adminUser?.uid) {
      await admin.auth().deleteUser(adminUser.uid).catch(() => {});
    }

    if (error.code === 'auth/email-already-exists') {
      error.statusCode = 409;
      error.message = 'An account with that Administrator User ID already exists in this institute.';
    }

    sendError(res, error, 'Failed to create institute.', requestId);
  }
};
