const { createHash, randomBytes } = require('crypto');
const { z } = require('zod');
const {
  admin,
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');
const {
  assertInstituteId,
  assertUserId,
  toIdentifierKey,
  toInstituteAuthEmail,
  toLegacyAuthEmail,
} = require('../_lib/loginIdentifiers');
const { assertRateLimit } = require('../_lib/rateLimit');
const { sendExpoPushToUsers } = require('../_lib/expoPush');
const {
  normalizeWebPushSubscription,
  sendWebPushToSubscriptions,
  sendWebPushToUsers,
} = require('../_lib/webPush');

const RESET_COLLECTION = 'passwordResetRequests';
const REQUEST_TOKEN_BYTES = 24;
const REQUEST_EXPIRY_MS = 1000 * 60 * 60 * 24 * 3;
const VALID_STATUSES = new Set(['approved', 'pending', 'rejected']);

const RoleSchema = z.enum(['driver', 'institute', 'parent']);
const WebPushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    auth: z.string().trim().min(8).max(512),
    p256dh: z.string().trim().min(20).max(2048),
  }),
});
const RequestSchema = z.object({
  action: z.literal('request'),
  contact: z.string().trim().max(160).optional().nullable(),
  instituteId: z.string().trim().min(1).max(128),
  note: z.string().trim().max(500).optional().nullable(),
  role: RoleSchema.default('institute'),
  webPushSubscription: WebPushSubscriptionSchema.optional().nullable(),
  userId: z.string().trim().min(1).max(64),
});
const StatusSchema = z.object({
  action: z.literal('status'),
  requestId: z.string().trim().min(8).max(160),
  token: z.string().trim().min(16).max(160),
});
const ListSchema = z.object({
  action: z.literal('list'),
  instituteId: z.string().trim().max(128).optional().nullable(),
  status: z.enum(['approved', 'pending', 'rejected', 'all']).default('all'),
});
const ApproveSchema = z.object({
  action: z.literal('approve'),
  requestId: z.string().trim().min(8).max(160),
});
const RejectSchema = z.object({
  action: z.literal('reject'),
  reason: z.string().trim().max(280).optional().nullable(),
  requestId: z.string().trim().min(8).max(160),
});

const parseWithSchema = (schema, body) => {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const error = new Error(result.error.issues[0]?.message || 'Invalid password reset request.');
  error.statusCode = 400;
  throw error;
};

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'instituteadmin') return 'admin';
  if (normalized === 'professor') return 'teacher';
  return normalized;
};

const roleMatchesRequestedPortal = (requestedRole, profileRole) => {
  const role = normalizeRole(profileRole);
  if (requestedRole === 'parent') return role === 'parent';
  if (requestedRole === 'driver') return role === 'driver';
  return !['driver', 'parent', 'superadmin'].includes(role);
};

const hashToken = (token) => createHash('sha256').update(String(token), 'utf8').digest('hex');
const createRequestToken = () => randomBytes(REQUEST_TOKEN_BYTES).toString('hex');

const createdAtToMillis = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const timestampToIso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const serializeRequest = (document) => {
  const data = document.data() || {};
  return {
    approvedAt: timestampToIso(data.approvedAt),
    contact: data.contact || '',
    createdAt: timestampToIso(data.createdAt),
    id: document.id,
    approvalRole: data.approvalRole || (normalizeRole(data.userRole) === 'admin' ? 'superadmin' : 'admin'),
    instituteId: data.instituteId || '',
    note: data.note || '',
    rejectedAt: timestampToIso(data.rejectedAt),
    rejectedReason: data.rejectedReason || '',
    resetLinkAvailable: Boolean(data.resetLink),
    role: data.role || 'institute',
    status: VALID_STATUSES.has(data.status) ? data.status : 'pending',
    updatedAt: timestampToIso(data.updatedAt),
    userId: data.userId || '',
    userName: data.userName || 'User',
  };
};

const resolveAppOrigin = (req) => {
  const configured = String(process.env.APP_ORIGIN || '').split(',')[0]?.trim();
  const candidate = String(req.headers.origin || configured || 'https://shii-edu.vercel.app').replace(/\/+$/, '');
  return /^https?:\/\//i.test(candidate) ? candidate : 'https://shii-edu.vercel.app';
};

const rolePath = (role) => {
  if (role === 'parent') return '/auth/parents';
  if (role === 'driver') return '/auth/driver';
  return '/auth/institute';
};

const generateResetLink = async (req, email, role) => {
  const continueUrl = `${resolveAppOrigin(req)}${rolePath(role)}`;

  try {
    return await admin.auth().generatePasswordResetLink(email, {
      handleCodeInApp: false,
      url: continueUrl,
    });
  } catch (error) {
    console.warn('Password reset link with continue URL failed; retrying default Firebase link.', error?.message || error);
    return admin.auth().generatePasswordResetLink(email);
  }
};

const findInstituteUser = async ({ firestore, instituteId, userId }) => {
  const loginIdKey = toIdentifierKey(userId);
  const usersRef = firestore.collection('users');
  const snapshots = await Promise.all([
    usersRef.where('instituteId', '==', instituteId).where('loginIdKey', '==', loginIdKey).limit(1).get(),
    usersRef.where('instituteId', '==', instituteId).where('uniqueId', '==', userId).limit(1).get(),
    usersRef.where('instituteId', '==', instituteId).where('loginId', '==', userId).limit(1).get(),
  ]);

  const profileDoc = snapshots.flatMap((snapshot) => snapshot.docs)[0];
  if (profileDoc) return { id: profileDoc.id, ...profileDoc.data() };

  const authEmails = [toInstituteAuthEmail(instituteId, userId), toLegacyAuthEmail(userId)];
  for (const email of [...new Set(authEmails)]) {
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      const userSnap = await usersRef.doc(userRecord.uid).get();
      if (userSnap.exists && userSnap.data()?.instituteId === instituteId) {
        return { id: userSnap.id, ...userSnap.data() };
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }

  return null;
};

const findInstituteAdmins = async ({ firestore, instituteId }) => {
  const snapshot = await firestore.collection('users').where('instituteId', '==', instituteId).get();
  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((profile) => normalizeRole(profile.role) === 'admin');
};

const findSuperadmins = async ({ firestore }) => {
  const snapshot = await firestore.collection('users').where('role', '==', 'superadmin').limit(50).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
};

const createNotification = async ({
  body,
  data = {},
  firestore,
  instituteId,
  recipientUids = [],
  roleTargets,
  title,
  type = 'info',
}) => {
  const notificationRef = firestore.collection('notifications').doc();
  await notificationRef.set({
    author: {
      name: 'Shii-Edu',
      role: 'system',
      uid: 'system',
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    data,
    instituteId,
    isRead: false,
    message: body,
    readBy: [],
    recipientUids,
    relatedId: data.requestId || null,
    relatedType: 'password_reset_request',
    targetRoles: roleTargets,
    title,
    type,
  });

  await sendExpoPushToUsers({
    body,
    data,
    firestore,
    instituteId,
    recipientUids,
    title,
  }).catch((error) => {
    console.warn('Password reset Expo push notification failed:', error?.message || error);
  });

  await sendWebPushToUsers({
    body,
    data,
    firestore,
    instituteId,
    recipientUids,
    tag: `shii-edu-${type}-${data.requestId || 'notification'}`,
    title,
    url: data.url || '/',
  }).catch((error) => {
    console.warn('Password reset web push notification failed:', error?.message || error);
  });
};

const ensureAdminCanAccessRequest = (actor, requestData) => {
  if (actor.role === 'superadmin') return;
  if (normalizeRole(requestData.userRole) === 'admin') {
    const error = new Error('Administrator password reset requests require Superadmin approval.');
    error.statusCode = 403;
    throw error;
  }
  if (actor.profile?.instituteId && actor.profile.instituteId === requestData.instituteId) return;

  const error = new Error('Admins can only manage password reset requests for their own institute.');
  error.statusCode = 403;
  throw error;
};

const handleCreateRequest = async (req, res, body) => {
  await assertRateLimit({ req, scope: 'auth:password-reset-request', limit: 6, windowMs: 10 * 60 * 1000 });

  const payload = parseWithSchema(RequestSchema, body);
  const instituteId = assertInstituteId(payload.instituteId);
  const userId = assertUserId(payload.userId);
  const { firestore } = getAdminServices();
  const [instituteSnap, profile] = await Promise.all([
    firestore.collection('institutes').doc(instituteId).get(),
    findInstituteUser({ firestore, instituteId, userId }),
  ]);

  if (!instituteSnap.exists) {
    const error = new Error('Institute ID was not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!profile || !roleMatchesRequestedPortal(payload.role, profile.role)) {
    const error = new Error('No matching Shii-Edu account was found for this role and institute.');
    error.statusCode = 404;
    throw error;
  }

  const authEmail = profile.authEmail || toInstituteAuthEmail(instituteId, userId);
  await admin.auth().getUserByEmail(authEmail).catch((error) => {
    if (error.code !== 'auth/user-not-found') throw error;
    const missingAuth = new Error('The account profile exists, but its sign-in account could not be found.');
    missingAuth.statusCode = 404;
    throw missingAuth;
  });

  const requestToken = createRequestToken();
  const requestRef = firestore.collection(RESET_COLLECTION).doc();
  const userRole = normalizeRole(profile.role);
  const requiresSuperadminApproval = userRole === 'admin';
  const approvers = requiresSuperadminApproval
    ? await findSuperadmins({ firestore })
    : await findInstituteAdmins({ firestore, instituteId });
  const approverUids = approvers.map((profileData) => profileData.id || profileData.uid).filter(Boolean);
  const webPushSubscription = normalizeWebPushSubscription(payload.webPushSubscription);

  await requestRef.set({
    adminUids: approverUids,
    approvalRole: requiresSuperadminApproval ? 'superadmin' : 'admin',
    authEmail,
    contact: payload.contact || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + REQUEST_EXPIRY_MS),
    instituteId,
    note: payload.note || '',
    requestedFrom: {
      origin: req.headers.origin || null,
      userAgent: req.headers['user-agent'] || null,
    },
    requestTokenHash: hashToken(requestToken),
    role: payload.role,
    status: 'pending',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    userId,
    userIdKey: toIdentifierKey(userId),
    userName: profile.name || profile.displayName || userId,
    userRole,
    userUid: profile.id || profile.uid || null,
    webPushSubscription,
  });

  await createNotification({
    body: requiresSuperadminApproval
      ? `${profile.name || userId} requested an administrator password reset for institute ${instituteId}. Verify in person before approval.`
      : `${profile.name || userId} requested a password reset for User ID ${userId}.`,
    data: {
      requestId: requestRef.id,
      role: payload.role,
      userId,
      url: '/',
    },
    firestore,
    instituteId,
    recipientUids: approverUids,
    roleTargets: requiresSuperadminApproval ? ['superadmin'] : ['admin'],
    title: requiresSuperadminApproval ? 'Admin password reset review' : 'Password reset request',
    type: 'warning',
  }).catch((error) => {
    console.warn('Admin password reset notification failed:', error?.message || error);
  });

  res.status(201).json({
    success: true,
    requestId: requestRef.id,
    status: 'pending',
    token: requestToken,
    webPushReady: Boolean(webPushSubscription),
  });
};

const handleStatus = async (_req, res, body) => {
  const payload = parseWithSchema(StatusSchema, body);
  const { firestore } = getAdminServices();
  const requestSnap = await firestore.collection(RESET_COLLECTION).doc(payload.requestId).get();

  if (!requestSnap.exists || requestSnap.data()?.requestTokenHash !== hashToken(payload.token)) {
    const error = new Error('Password reset request was not found.');
    error.statusCode = 404;
    throw error;
  }

  const data = requestSnap.data() || {};
  res.status(200).json({
    success: true,
    rejectedReason: data.rejectedReason || '',
    resetLink: data.status === 'approved' ? data.resetLink || '' : '',
    status: VALID_STATUSES.has(data.status) ? data.status : 'pending',
    updatedAt: timestampToIso(data.updatedAt),
  });
};

const handleList = async (req, res, body) => {
  const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
  await assertRateLimit({ actor, req, scope: 'admin:password-reset-list', limit: 60, windowMs: 60 * 1000 });
  const payload = parseWithSchema(ListSchema, body);
  const { firestore } = getAdminServices();
  const instituteId = actor.role === 'superadmin'
    ? payload.instituteId ? assertInstituteId(payload.instituteId) : null
    : actor.profile.instituteId;

  let snapshot;
  if (instituteId) {
    snapshot = await firestore.collection(RESET_COLLECTION).where('instituteId', '==', instituteId).limit(120).get();
  } else {
    snapshot = await firestore.collection(RESET_COLLECTION).limit(120).get();
  }

  const requests = snapshot.docs
    .filter((document) => payload.status === 'all' || document.data()?.status === payload.status)
    .filter((document) => actor.role === 'superadmin' || normalizeRole(document.data()?.userRole) !== 'admin')
    .sort((left, right) => createdAtToMillis(right.data()?.createdAt) - createdAtToMillis(left.data()?.createdAt))
    .map(serializeRequest);

  res.status(200).json({ success: true, requests });
};

const handleApprove = async (req, res, body) => {
  const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
  await assertRateLimit({ actor, req, scope: 'admin:password-reset-approve', limit: 24, windowMs: 60 * 1000 });
  const payload = parseWithSchema(ApproveSchema, body);
  const { firestore } = getAdminServices();
  const requestRef = firestore.collection(RESET_COLLECTION).doc(payload.requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    const error = new Error('Password reset request was not found.');
    error.statusCode = 404;
    throw error;
  }

  const requestData = requestSnap.data() || {};
  ensureAdminCanAccessRequest(actor, requestData);

  if (requestData.status !== 'pending') {
    const error = new Error('Only pending password reset requests can be approved.');
    error.statusCode = 409;
    throw error;
  }

  const resetLink = await generateResetLink(req, requestData.authEmail, requestData.role);
  await requestRef.update({
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvedBy: actor.uid,
    approvedByName: actor.profile?.name || 'Admin',
    resetLink,
    resetLinkCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'approved',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (requestData.userUid) {
    await createNotification({
      body: 'Your password reset was approved. Return to the login page to open the reset link.',
      data: {
        requestId: payload.requestId,
        role: requestData.role,
        url: `/auth/${requestData.role === 'driver' ? 'driver' : requestData.role === 'parent' ? 'parents' : 'institute'}`,
      },
      firestore,
      instituteId: requestData.instituteId,
      recipientUids: [requestData.userUid],
      roleTargets: [requestData.userRole || requestData.role || 'student'],
      title: 'Password reset approved',
      type: 'success',
    }).catch((error) => {
      console.warn('Requester password reset notification failed:', error?.message || error);
    });
  }

  const requesterSubscription = normalizeWebPushSubscription(requestData.webPushSubscription);
  if (requesterSubscription) {
    await sendWebPushToSubscriptions({
      body: 'Your password reset was approved. Open Shii-Edu to continue.',
      data: {
        requestId: payload.requestId,
        role: requestData.role,
      },
      firestore,
      subscriptions: [requesterSubscription],
      tag: `password-reset-approved-${payload.requestId}`,
      title: 'Password reset approved',
      url: `/auth/${requestData.role === 'driver' ? 'driver' : requestData.role === 'parent' ? 'parents' : 'institute'}`,
    }).catch((error) => {
      console.warn('Requester approval web push failed:', error?.message || error);
    });
  }

  res.status(200).json({ success: true, requestId: payload.requestId, resetLink, status: 'approved' });
};

const handleReject = async (req, res, body) => {
  const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
  await assertRateLimit({ actor, req, scope: 'admin:password-reset-reject', limit: 24, windowMs: 60 * 1000 });
  const payload = parseWithSchema(RejectSchema, body);
  const { firestore } = getAdminServices();
  const requestRef = firestore.collection(RESET_COLLECTION).doc(payload.requestId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    const error = new Error('Password reset request was not found.');
    error.statusCode = 404;
    throw error;
  }

  const requestData = requestSnap.data() || {};
  ensureAdminCanAccessRequest(actor, requestData);

  if (requestData.status !== 'pending') {
    const error = new Error('Only pending password reset requests can be rejected.');
    error.statusCode = 409;
    throw error;
  }

  const rejectedReason = payload.reason || 'The institute administrator rejected this reset request.';
  await requestRef.update({
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    rejectedBy: actor.uid,
    rejectedByName: actor.profile?.name || 'Admin',
    rejectedReason,
    status: 'rejected',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (requestData.userUid) {
    await createNotification({
      body: rejectedReason,
      data: {
        requestId: payload.requestId,
        role: requestData.role,
        url: `/auth/${requestData.role === 'driver' ? 'driver' : requestData.role === 'parent' ? 'parents' : 'institute'}`,
      },
      firestore,
      instituteId: requestData.instituteId,
      recipientUids: [requestData.userUid],
      roleTargets: [requestData.userRole || requestData.role || 'student'],
      title: 'Password reset rejected',
      type: 'warning',
    }).catch((error) => {
      console.warn('Requester rejection notification failed:', error?.message || error);
    });
  }

  const requesterSubscription = normalizeWebPushSubscription(requestData.webPushSubscription);
  if (requesterSubscription) {
    await sendWebPushToSubscriptions({
      body: rejectedReason,
      data: {
        requestId: payload.requestId,
        role: requestData.role,
      },
      firestore,
      subscriptions: [requesterSubscription],
      tag: `password-reset-rejected-${payload.requestId}`,
      title: 'Password reset rejected',
      url: `/auth/${requestData.role === 'driver' ? 'driver' : requestData.role === 'parent' ? 'parents' : 'institute'}`,
    }).catch((error) => {
      console.warn('Requester rejection web push failed:', error?.message || error);
    });
  }

  res.status(200).json({ success: true, requestId: payload.requestId, status: 'rejected' });
};

module.exports = async (req, res) => {
  const requestId = createRequestId();
  if (handleOptions(req, res)) return;
  setCorsHeaders(req, res);
  res.setHeader('X-Request-Id', requestId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const body = await getBody(req);
    const action = String(body?.action || '').trim();

    if (action === 'request') return await handleCreateRequest(req, res, body);
    if (action === 'status') return await handleStatus(req, res, body);
    if (action === 'list') return await handleList(req, res, body);
    if (action === 'approve') return await handleApprove(req, res, body);
    if (action === 'reject') return await handleReject(req, res, body);

    res.status(400).json({ success: false, error: 'Unknown password reset action.', requestId });
  } catch (error) {
    sendError(res, error, 'Password reset request failed.', requestId);
  }
};
