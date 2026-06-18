require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Razorpay = require('razorpay');
const admin = require('firebase-admin');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { v4: uuidv4 } = require('uuid');

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

// Request ID middleware for traceability
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// Security middleware
app.disable('x-powered-by');

// Enhanced Helmet configuration with stricter policies
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        // Additional security for workers and frame ancestors
        workerSrc: ["'self'", "blob:"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl: true,
    expectCt: { maxAge: 86400, enforce: true },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
      // Apply HSTS to subdomains as well
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
    // Prevent clickjacking
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Additional security headers
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Hide server header (already done by helmet.hidePoweredBy, but extra sure)
  res.setHeader('Server', '');

  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  next();
});

// Data sanitization middleware
app.use(express.json({ limit: '10kb' })); // Reduced limit for JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(mongoSanitize()); // Prevent MongoDB injection
app.use(hpp()); // Prevent HTTP parameter pollution

// CORS configuration with stricter settings
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = parseAllowedOrigins();
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

// Rate limiting with different tiers and stricter limits
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: Number(process.env.API_RATE_LIMIT || 60), // Further reduced default limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
  skipSuccessfulRequests: false, // Count all requests, not just failed ones
  skipFailedRequests: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: Number(process.env.AUTH_RATE_LIMIT || 10), // Even stricter for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: Number(process.env.PAYMENT_RATE_LIMIT || 5), // Very strict for payments
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests, please try again later.' },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Apply rate limiting to all API routes
app.use('/api/v1/', apiLimiter);
// Specific limiters will be applied to individual routes below (auth and payment routes already have their limiters)

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: 'Missing Firebase ID token.' });
    }

    const idToken = match[1];

    // Additional token validation
    if (!idToken || idToken.length < 10) {
      return res.status(401).json({ error: 'Invalid token format.' });
    }

    // Verify the ID token with revocation check
    const decodedToken = await admin.auth().verifyIdToken(idToken, true); // true = checkRevoked

    // Additional payload validation
    if (!decodedToken.uid) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }

    // Optional: Check token age (not older than 24 hours for example)
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (decodedToken.auth_time && (nowSeconds - decodedToken.auth_time) > 86400) {
      return res.status(401).json({ error: 'Token is too old. Please re-authenticate.' });
    }

    const userSnap = await firestore.collection('users').doc(decodedToken.uid).get();

    if (!userSnap.exists) {
      return res.status(403).json({ error: 'Authenticated user profile was not found.' });
    }

    const userData = userSnap.data();

    // Optional: Check if account is disabled/locked
    if (userData.accountLocked === true) {
      return res.status(403).json({ error: 'Account is locked. Contact administrator.' });
    }

    // Optional: Check if email is verified (if using email/password)
    // if (decodedToken.email && !decodedToken.email_verified) {
    //   return res.status(403).json({ error: 'Please verify your email address.' );
    // }

    req.auth = {
      uid: decodedToken.uid,
      token: decodedToken,
      profile: {
        id: userSnap.id,
        ...userData,
      },
      requestId: req.id, // Add request ID for tracing
    };

    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    // Distinguish between different error types for better security
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token has been revoked. Please re-authenticate.' });
    }
    if (error.code === 'auth/user-disabled') {
      return res.status(401).json({ error: 'User account has been disabled.' });
    }
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
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
  if (typeof password !== 'string') {
    throw new Error('Password must be a string.');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  if (password.length > 128) {
    throw new Error('Password must not exceed 128 characters.');
  }

  // Require complexity for stronger security
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
    throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
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

// Health check without rate limiting for monitoring
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// API routes with versioning
app.post('/api/v1/super-admin/institutes', authenticate, requireRole('superadmin'), authLimiter, async (req, res) => {
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

app.delete('/api/v1/super-admin/institutes/:instituteId', authenticate, requireRole('superadmin'), authLimiter, async (req, res) => {
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

app.post('/api/v1/admin/users', authenticate, requireRole('admin'), authLimiter, async (req, res) => {
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

app.post('/api/v1/payments/create-order', authenticate, requireRole('student'), paymentLimiter, async (req, res) => {
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

app.post('/api/v1/payments/verify', authenticate, requireRole('student'), async (req, res) => {
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

// Centralized error handling middleware
app.use((error, _req, res, _next) => {
  // Log the error for internal monitoring (in production, use a proper logging service)
  console.error({
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    requestId: _req.id,
    url: _req.originalUrl,
    method: _req.method,
    timestamp: new Date().toISOString(),
  });

  // Never leak stack traces or internal error details to the client
  res.status(500).json({
    error: 'Internal server error.',
    // In development, you might want to include more details
    ...(process.env.NODE_ENV === 'development' && { message: error.message })
  });
});

// Handle 404 errors
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource could not be found.'
  });
});

// Handle uncaught exceptions and unhandled rejections with graceful shutdown
const handleError = (error, type) => {
  console.error(`${type}:`, error);
  // In production, you might want to send this to an error tracking service
  // Like Sentry, Datadog, etc.

  // Only exit in certain situations to allow for graceful shutdown
  if (type === 'Uncaught Exception') {
    // Give some time to finish ongoing requests
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }
};

process.on('uncaughtException', (err) => {
  handleError(err, 'Uncaught Exception');
});

process.on('unhandledRejection', (reason, promise) => {
  handleError(reason, 'Unhandled Rejection');
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  // Close server connections
  if (server) {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.log('Force closing connections');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Store server reference for graceful shutdown
let server;

// Start the server and keep reference for graceful shutdown
server = app.listen(PORT, () => {
  console.log(`Shii-Edu backend running on port ${PORT}`);
});
