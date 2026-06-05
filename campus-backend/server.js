require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Razorpay = require('razorpay');
const admin = require('firebase-admin');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8082',
];

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseAllowedOrigins = () => {
  const configured = process.env.APP_ORIGIN || DEFAULT_ALLOWED_ORIGINS.join(',');
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const initializeFirebaseAdmin = () => {
  if (admin.apps.length) return;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
};

const razorpayKeyId = requireEnv('RAZORPAY_KEY_ID');
const razorpayKeySecret = requireEnv('RAZORPAY_KEY_SECRET');
initializeFirebaseAdmin();

const firestore = admin.firestore();
const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));
app.use(cors({
  origin(origin, callback) {
    const allowedOrigins = parseAllowedOrigins();
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
}));
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 120),
  standardHeaders: true,
  legacyHeaders: false,
}));

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: 'Missing Firebase ID token.' });
    }

    const decodedToken = await admin.auth().verifyIdToken(match[1]);
    const userSnap = await firestore.collection('users').doc(decodedToken.uid).get();

    if (!userSnap.exists) {
      return res.status(403).json({ error: 'Authenticated user profile was not found.' });
    }

    req.auth = {
      uid: decodedToken.uid,
      token: decodedToken,
      profile: {
        id: userSnap.id,
        ...userSnap.data(),
      },
    };

    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  const userRole = normalizeRole(req.auth?.profile?.role);
  if (!roles.includes(userRole)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  next();
};

const normalizeAuthEmail = (identifier) => {
  const value = String(identifier || '').trim().toLowerCase();
  return value.includes('@') ? value : `${value}@eduhub.local`;
};

const assertPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
};

const generateInstituteId = async (name) => {
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

const getInstituteType = async (instituteId) => {
  const instituteSnap = await firestore.collection('institutes').doc(instituteId).get();
  return String(instituteSnap.data()?.type || 'school').toLowerCase();
};

const commitDeleteBatch = async (docs) => {
  let deleted = 0;

  for (const chunk of chunkArray(docs, 450)) {
    const batch = firestore.batch();
    chunk.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
};

const deleteWhere = async (collectionName, fieldName, value) => {
  let deleted = 0;

  while (true) {
    const snapshot = await firestore
      .collection(collectionName)
      .where(fieldName, '==', value)
      .limit(450)
      .get();

    if (snapshot.empty) return deleted;
    deleted += await commitDeleteBatch(snapshot.docs);
  }
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const resolveInstituteDocument = async (instituteId) => {
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

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/super-admin/institutes', authenticate, requireRole('superadmin'), async (req, res) => {
  let adminUser = null;

  try {
    const instituteName = String(req.body.instituteName || '').trim();
    const adminName = String(req.body.adminName || '').trim();
    const adminEmail = String(req.body.adminEmail || '').trim().toLowerCase();
    const adminPassword = req.body.adminPassword;

    if (!instituteName || !adminName || !adminEmail) {
      return res.status(400).json({ error: 'Institute name, admin name, and admin email are required.' });
    }

    assertPassword(adminPassword);

    const instituteId = await generateInstituteId(instituteName);
    adminUser = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      displayName: adminName,
    });

    const batch = firestore.batch();
    batch.set(firestore.collection('institutes').doc(instituteId), {
      instituteId,
      name: instituteName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.auth.uid,
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
      createdBy: req.auth.uid,
    });

    await batch.commit();
    res.status(201).json({ success: true, instituteId, adminUid: adminUser.uid });
  } catch (error) {
    if (adminUser?.uid) {
      await admin.auth().deleteUser(adminUser.uid).catch(() => {});
    }

    console.error('Create institute failed:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Failed to create institute.' });
  }
});

app.delete('/api/super-admin/institutes/:instituteId', authenticate, requireRole('superadmin'), async (req, res) => {
  try {
    const requestedInstituteId = String(req.params.instituteId || '').trim();
    if (!requestedInstituteId) {
      return res.status(400).json({ error: 'Institute ID is required.' });
    }

    const institute = await resolveInstituteDocument(requestedInstituteId);
    if (!institute) {
      return res.status(404).json({ error: 'Institute not found.' });
    }

    const instituteData = institute.snap.data();
    const instituteId = instituteData.instituteId || institute.snap.id;
    const usersSnapshot = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .get();
    const userIds = usersSnapshot.docs.map((userDoc) => userDoc.id);

    const deleted = {
      users: await commitDeleteBatch(usersSnapshot.docs),
      notices: await deleteWhere('notices', 'instituteId', instituteId),
      routines: await deleteWhere('routines', 'instituteId', instituteId),
      assignments: await deleteWhere('assignments', 'instituteId', instituteId),
      grades: await deleteWhere('grades', 'instituteId', instituteId),
      attendance: await deleteWhere('attendance', 'instituteId', instituteId),
      gallery: await deleteWhere('gallery', 'instituteId', instituteId),
      pyqs: await deleteWhere('pyqs', 'instituteId', instituteId),
      paymentOrders: await deleteWhere('paymentOrders', 'instituteId', instituteId),
      payments: await deleteWhere('payments', 'instituteId', instituteId),
      institutes: 1,
      authUsers: 0,
    };

    await institute.ref.delete();

    for (const chunk of chunkArray(userIds, 1000)) {
      const result = await admin.auth().deleteUsers(chunk);
      deleted.authUsers += result.successCount;
      if (result.failureCount > 0) {
        console.warn('Some institute auth users could not be deleted:', result.errors.map((entry) => entry.error.message));
      }
    }

    res.json({ success: true, deleted, instituteId });
  } catch (error) {
    console.error('Delete institute failed:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete institute.' });
  }
});

app.post('/api/admin/users', authenticate, requireRole('admin'), async (req, res) => {
  let newUser = null;

  try {
    const name = String(req.body.name || '').trim();
    const identifier = String(req.body.identifier || '').trim();
    const password = req.body.password;
    const role = normalizeRole(req.body.role || 'student');
    const primaryTag = String(req.body.primaryTag || '').trim();
    const secondaryTag = String(req.body.secondaryTag || '').trim();
    const instituteId = req.auth.profile.instituteId;

    if (!instituteId) {
      return res.status(400).json({ error: 'Admin profile is missing an institute.' });
    }

    if (!name || !identifier || !primaryTag) {
      return res.status(400).json({ error: 'Name, ID/email, and class/department are required.' });
    }

    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ error: 'Admins can only create student or teacher accounts.' });
    }

    assertPassword(password);

    const authEmail = normalizeAuthEmail(identifier);
    newUser = await admin.auth().createUser({
      email: authEmail,
      password,
      displayName: name,
    });

    const instituteType = await getInstituteType(instituteId);
    const userDoc = {
      uid: newUser.uid,
      name,
      email: identifier,
      authEmail,
      role,
      instituteId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.auth.uid,
      totalFee: 0,
      feePaid: 0,
    };

    if (instituteType.includes('school')) {
      userDoc.class = primaryTag;
      userDoc.section = secondaryTag || 'A';
    } else {
      userDoc.dept = primaryTag;
      userDoc.sem = secondaryTag || '1';
    }

    await firestore.collection('users').doc(newUser.uid).set(userDoc);
    res.status(201).json({ success: true, uid: newUser.uid });
  } catch (error) {
    if (newUser?.uid) {
      await admin.auth().deleteUser(newUser.uid).catch(() => {});
    }

    console.error('Create user failed:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Failed to create user.' });
  }
});

app.post('/api/payments/create-order', authenticate, requireRole('student'), async (req, res) => {
  try {
    const userRef = firestore.collection('users').doc(req.auth.uid);
    const userSnap = await userRef.get();
    const user = userSnap.data();
    const totalFee = Number(user.totalFee || 0);
    const feePaid = Number(user.feePaid || 0);
    const pendingAmount = Math.max(0, totalFee - feePaid);

    if (!pendingAmount) {
      return res.status(400).json({ error: 'No unpaid dues remain.' });
    }

    const amountPaise = Math.round(pendingAmount * 100);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `fee_${req.auth.uid.slice(0, 12)}_${Date.now()}`,
      notes: {
        uid: req.auth.uid,
        instituteId: user.instituteId || '',
      },
    });

    await firestore.collection('paymentOrders').doc(order.id).set({
      uid: req.auth.uid,
      instituteId: user.instituteId || null,
      amount: pendingAmount,
      amountPaise,
      currency: order.currency,
      status: 'created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
    });
  } catch (error) {
    console.error('Create order failed:', error.message);
    res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

app.post('/api/payments/verify', authenticate, requireRole('student'), async (req, res) => {
  try {
    const orderId = String(req.body.razorpay_order_id || '');
    const paymentId = String(req.body.razorpay_payment_id || '');
    const signature = String(req.body.razorpay_signature || '');

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification fields.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const isValidSignature =
      expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));

    if (!isValidSignature) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    const orderRef = firestore.collection('paymentOrders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists || orderSnap.data().uid !== req.auth.uid) {
      return res.status(403).json({ error: 'Payment order does not belong to this user.' });
    }

    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status !== 'captured') {
      return res.status(400).json({ error: 'Payment has not been captured.' });
    }

    if (Number(payment.amount) !== Number(orderSnap.data().amountPaise)) {
      return res.status(400).json({ error: 'Payment amount does not match the order.' });
    }

    await firestore.runTransaction(async (transaction) => {
      const freshOrder = await transaction.get(orderRef);
      if (freshOrder.data()?.status === 'paid') return;

      const amount = Number(freshOrder.data().amount || 0);
      const userRef = firestore.collection('users').doc(req.auth.uid);
      const paymentRef = firestore.collection('payments').doc(paymentId);

      transaction.update(userRef, {
        feePaid: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(paymentRef, {
        uid: req.auth.uid,
        instituteId: freshOrder.data().instituteId || null,
        orderId,
        paymentId,
        amount,
        status: payment.status,
        method: payment.method || null,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(orderRef, {
        status: 'paid',
        paymentId,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Verify payment failed:', error.message);
    res.status(500).json({ error: 'Failed to verify payment.' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error.message);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Shii-Edu backend running on port ${PORT}`);
});
