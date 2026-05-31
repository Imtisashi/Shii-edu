const admin = require('firebase-admin');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'https://shii-edu.vercel.app',
];

const parseAllowedOrigins = () => {
  const configured = process.env.APP_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(',');
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = parseAllowedOrigins();
  const isVercelPreview = origin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

  if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
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
    throw new Error('Server is missing Firebase Admin credentials.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
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
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const authenticateSuperAdmin = async (req) => {
  const { admin: firebaseAdmin, firestore } = getAdminServices();
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error('Missing Firebase ID token.');
    error.statusCode = 401;
    throw error;
  }

  const decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
  const userSnap = await firestore.collection('users').doc(decodedToken.uid).get();

  if (!userSnap.exists) {
    const error = new Error('Authenticated user profile was not found.');
    error.statusCode = 403;
    throw error;
  }

  const profile = { id: userSnap.id, ...userSnap.data() };
  if (normalizeRole(profile.role) !== 'superadmin') {
    const error = new Error('You do not have permission to perform this action.');
    error.statusCode = 403;
    throw error;
  }

  return {
    uid: decodedToken.uid,
    token: decodedToken,
    profile,
  };
};

const assertPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    const error = new Error('Password must be at least 8 characters.');
    error.statusCode = 400;
    throw error;
  }
};

const generateInstituteId = async (firestore, name) => {
  let baseId = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
  if (baseId.length < 4) {
    baseId = (String(name).length.toString() + baseId).padStart(6, '0');
  }

  let candidate = baseId;
  let counter = 1;

  while (true) {
    const snapshot = await firestore
      .collection('institutes')
      .where('instituteId', '==', candidate)
      .limit(1)
      .get();

    if (snapshot.empty) return candidate;
    candidate = `${baseId}${counter}`;
    counter += 1;
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

const sendError = (res, error, fallbackMessage = 'Request failed.') => {
  const statusCode = error.statusCode || 500;
  const isConfigurationError = error.message === 'Server is missing Firebase Admin credentials.';
  const safeMessage = statusCode >= 500 && !isConfigurationError ? fallbackMessage : error.message;
  console.error(fallbackMessage, error.message);
  res.status(statusCode).json({ success: false, error: safeMessage });
};

module.exports = {
  admin,
  assertPassword,
  authenticateSuperAdmin,
  commitDeleteBatch,
  deleteWhere,
  generateInstituteId,
  getAdminServices,
  getBody,
  handleOptions,
  resolveInstituteDocument,
  sendError,
  setCorsHeaders,
};
