const admin = require('firebase-admin');
const { Buffer } = require('buffer');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8098',
  'http://127.0.0.1:8098',
  'http://localhost:8101',
  'http://127.0.0.1:8101',
  'http://localhost:8108',
  'http://127.0.0.1:8108',
  'https://shii-edu.vercel.app',
];

const parseAllowedOrigins = () => {
  const configured = process.env.APP_ORIGIN || '';
  return [...DEFAULT_ALLOWED_ORIGINS, ...configured.split(',')]
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin, index, origins) => origins.indexOf(origin) === index);
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = parseAllowedOrigins();
  const isVercelPreview = origin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

  if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
};

const createRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

class FirebaseAdminConfigurationError extends Error {
  constructor(message, code = 'FIREBASE_ADMIN_CONFIG_MISSING') {
    super(message);
    this.name = 'FirebaseAdminConfigurationError';
    this.code = code;
    this.statusCode = 503;
  }
}

const FIREBASE_ADMIN_ENV_HINT = [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY',
];
const CLOUDINARY_ENV_HINT = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];
const FIREBASE_ID_TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60;
const FIREBASE_ID_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const makeAuthError = (message) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const assertBearerTokenFormat = (token) => {
  if (!FIREBASE_ID_TOKEN_PATTERN.test(String(token || '').trim())) {
    throw makeAuthError('Invalid Firebase ID token format.');
  }
};

const assertDecodedTokenFresh = (decodedToken, nowSeconds = Math.floor(Date.now() / 1000)) => {
  const authTime = Number(decodedToken?.auth_time || decodedToken?.iat || 0);
  if (!Number.isFinite(authTime) || authTime <= 0) {
    throw makeAuthError('Invalid Firebase ID token timestamp.');
  }

  if (nowSeconds - authTime > FIREBASE_ID_TOKEN_MAX_AGE_SECONDS) {
    throw makeAuthError('Firebase ID token is too old. Sign in again.');
  }
};

const getFirebaseAdminConfigStatus = () => {
  const hasServiceAccountJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const requiredTriplet = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  const missingTriplet = requiredTriplet.filter((key) => !process.env[key]);

  return {
    configured: hasServiceAccountJson || missingTriplet.length === 0,
    hasServiceAccountJson,
    missingTriplet,
    acceptedForms: FIREBASE_ADMIN_ENV_HINT,
  };
};

const handleOptions = (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
};

const getServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (_error) {
      throw new FirebaseAdminConfigurationError(
        'FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.',
        'FIREBASE_ADMIN_CONFIG_INVALID_JSON'
      );
    }

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new FirebaseAdminConfigurationError(
        'FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.',
        'FIREBASE_ADMIN_CONFIG_INCOMPLETE_JSON'
      );
    }

    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    return serviceAccount;
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
};

const initializeFirebaseAdmin = () => {
  if (admin.apps.length) return admin.app();

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new FirebaseAdminConfigurationError('Server is missing Firebase Admin credentials.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  });
};

const getAdminServices = () => {
  initializeFirebaseAdmin();
  return {
    admin,
    firestore: admin.firestore(),
  };
};

const getBody = async (req) => {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
  } catch (_error) {
    const error = new Error('Invalid JSON request body.');
    error.statusCode = 400;
    throw error;
  }
};

const normalizeRole = (role) => {
  const compactRole = String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (compactRole === 'instituteadmin') return 'admin';
  if (compactRole === 'professor') return 'teacher';
  return compactRole;
};

const authenticateUserProfile = async (req, allowedRoles = []) => {
  const internalActor = req?.[Symbol.for('edu-shii.internalActor')];
  if (internalActor) {
    if (allowedRoles.length > 0 && !allowedRoles.includes(internalActor.role)) {
      const error = new Error('You do not have permission to perform this action.');
      error.statusCode = 403;
      throw error;
    }
    return internalActor;
  }

  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error('Missing Firebase ID token.');
    error.statusCode = 401;
    throw error;
  }

  const { admin: firebaseAdmin, firestore } = getAdminServices();
  let decodedToken;
  try {
    const firebaseToken = match[1].trim();
    assertBearerTokenFormat(firebaseToken);
    decodedToken = await firebaseAdmin.auth().verifyIdToken(firebaseToken, true);
    assertDecodedTokenFresh(decodedToken);
  } catch (_error) {
    const error = new Error('Invalid or expired Firebase ID token.');
    error.statusCode = 401;
    throw error;
  }

  const userSnap = await firestore.collection('users').doc(decodedToken.uid).get();

  if (!userSnap.exists) {
    const error = new Error('Authenticated user profile was not found.');
    error.statusCode = 403;
    throw error;
  }

  const profile = { id: userSnap.id, ...userSnap.data() };
  const role = normalizeRole(profile.role);
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const error = new Error('You do not have permission to perform this action.');
    error.statusCode = 403;
    throw error;
  }

  return {
    uid: decodedToken.uid,
    token: decodedToken,
    role,
    profile,
  };
};

const authenticateSuperAdmin = async (req) => authenticateUserProfile(req, ['superadmin']);

const assertPassword = (password) => {
  const value = typeof password === 'string' ? password : '';
  const isStrong = value.length >= 10 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value);

  if (!isStrong) {
    const error = new Error('Use at least 10 characters with uppercase and lowercase letters, a number, and a symbol.');
    error.statusCode = 400;
    throw error;
  }
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const commitDeleteBatch = async (firestore, docs) => {
  let deleted = 0;

  for (const chunk of chunkArray(docs, 450)) {
    const batch = firestore.batch();
    chunk.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
};

const deleteWhere = async (firestore, collectionName, fieldName, value) => {
  let deleted = 0;

  while (true) {
    const snapshot = await firestore
      .collection(collectionName)
      .where(fieldName, '==', value)
      .limit(450)
      .get();

    if (snapshot.empty) return deleted;
    deleted += await commitDeleteBatch(firestore, snapshot.docs);
  }
};

const resolveInstituteDocument = async (firestore, instituteId) => {
  const directRef = firestore.collection('institutes').doc(instituteId);
  const directSnap = await directRef.get();

  if (directSnap.exists) {
    return { ref: directRef, snap: directSnap };
  }

  const byPublicId = await firestore
    .collection('institutes')
    .where('instituteId', '==', instituteId)
    .limit(1)
    .get();

  if (byPublicId.empty) return null;
  const snap = byPublicId.docs[0];
  return { ref: snap.ref, snap };
};

const sendError = (res, error, fallbackMessage = 'Request failed.', requestId = createRequestId()) => {
  const statusCode = error.statusCode || 500;
  const isConfigurationError = error.name === 'FirebaseAdminConfigurationError' ||
    String(error.code || '').startsWith('FIREBASE_ADMIN_CONFIG_');
  const isCloudinaryConfigurationError = error.name === 'CloudinaryConfigurationError' ||
    String(error.code || '').startsWith('CLOUDINARY_CONFIG_');
  const safeMessage = isConfigurationError
    ? 'Server is missing Firebase Admin credentials. Add Firebase Admin environment variables in Vercel, then redeploy.'
    : isCloudinaryConfigurationError
      ? 'Cloudinary uploads are not configured. Add valid Cloudinary environment variables in Vercel, then redeploy.'
    : statusCode >= 500
      ? fallbackMessage
      : error.message;
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  const logPayload = {
    level: logLevel,
    requestId,
    statusCode,
    message: error.message,
    fallbackMessage,
  };
  const writeLog = statusCode >= 500 ? console.error : console.warn;
  writeLog(JSON.stringify(logPayload));

  const response = { success: false, error: safeMessage, requestId };
  if (error.retryAfterSeconds) {
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
    response.retryAfterSeconds = error.retryAfterSeconds;
  }
  if (isConfigurationError) {
    response.code = error.code || 'FIREBASE_ADMIN_CONFIG_MISSING';
    response.requiredEnv = FIREBASE_ADMIN_ENV_HINT;
    response.configured = getFirebaseAdminConfigStatus().configured;
  }
  if (isCloudinaryConfigurationError) {
    response.code = error.code || 'CLOUDINARY_CONFIG_INVALID';
    response.requiredEnv = CLOUDINARY_ENV_HINT;
    response.configured = false;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  admin,
  assertBearerTokenFormat,
  assertDecodedTokenFresh,
  assertPassword,
  authenticateUserProfile,
  authenticateSuperAdmin,
  commitDeleteBatch,
  createRequestId,
  deleteWhere,
  getFirebaseAdminConfigStatus,
  getAdminServices,
  getBody,
  handleOptions,
  resolveInstituteDocument,
  sendError,
  setCorsHeaders,
};
