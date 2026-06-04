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
const { assertUserId, toIdentifierKey } = require('../_lib/loginIdentifiers');
const { sendExpoPushToUsers } = require('../_lib/expoPush');

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SetOfficeHoursSchema = z.object({
  action: z.literal('setOfficeHours'),
  days: z.array(z.enum(DAYS)).min(1).max(7),
  endTime: z.string().regex(TIME_PATTERN),
  startTime: z.string().regex(TIME_PATTERN),
  timeZone: z.string().trim().min(1).max(80).default('Asia/Kolkata'),
}).strict();
const StartConversationSchema = z.object({
  action: z.literal('startConversation'),
  recipientUserId: z.string().trim().min(1).max(64),
}).strict();
const SendMessageSchema = z.object({
  action: z.literal('sendMessage'),
  conversationId: z.string().trim().min(1).max(300),
  message: z.string().trim().min(1).max(2000),
}).strict();
const RequestSchema = z.discriminatedUnion('action', [
  SetOfficeHoursSchema,
  StartConversationSchema,
  SendMessageSchema,
]);

const parseBody = (body) => {
  const result = RequestSchema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error(result.error.issues[0]?.message || 'Invalid messaging request.');
  error.statusCode = 400;
  throw error;
};

const roleGroup = (role) => {
  if (['teacher', 'professor', 'admin'].includes(role)) return 'faculty';
  if (['student', 'parent'].includes(role)) return 'learner';
  return role;
};

const assertAllowedPair = (senderRole, recipientRole) => {
  if (senderRole === 'admin' || recipientRole === 'admin') return;
  if (roleGroup(senderRole) !== roleGroup(recipientRole)) return;
  const error = new Error('Messaging is limited to regulated learner-to-faculty conversations.');
  error.statusCode = 403;
  throw error;
};

const timeParts = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    day: String(parts.weekday || '').slice(0, 3).toLowerCase(),
    time: `${parts.hour || '00'}:${parts.minute || '00'}`,
  };
};

const withinOfficeHours = (policy) => {
  if (!policy) return false;
  const now = timeParts(new Date(), policy.timeZone || 'Asia/Kolkata');
  const days = Array.isArray(policy.days) ? policy.days : [];
  return days.includes(now.day) && now.time >= policy.startTime && now.time <= policy.endTime;
};

const resolveRecipientByUserId = async ({ firestore, instituteId, recipientUserId }) => {
  const identifier = assertUserId(recipientUserId, 'Recipient User ID');
  const loginIdKey = toIdentifierKey(identifier);
  const snapshot = await firestore
    .collection('users')
    .where('instituteId', '==', instituteId)
    .where('loginIdKey', '==', loginIdKey)
    .limit(1)
    .get();

  if (snapshot.empty) {
    const error = new Error('No user with that User ID exists in your institute.');
    error.statusCode = 404;
    throw error;
  }
  const document = snapshot.docs[0];
  return { id: document.id, ...document.data() };
};

const assertLearnerOfficeHours = async ({ firestore, actor, recipient }) => {
  if (roleGroup(actor.role) !== 'learner' || roleGroup(recipient.role) !== 'faculty') return;
  const policySnap = await firestore.collection('officeHourPolicies').doc(recipient.id).get();
  const policy = policySnap.exists ? policySnap.data() : null;
  if (!withinOfficeHours(policy)) {
    const error = new Error('This teacher is currently outside their configured office hours.');
    error.statusCode = 403;
    throw error;
  }
};

const participantSummary = (user) => ({
  uid: user.id,
  name: user.name || 'User',
  role: user.role || 'user',
  loginId: user.loginId || user.uniqueId || null,
});

const startConversation = async ({ actor, firestore, body }) => {
  const instituteId = actor.profile.instituteId;
  const recipient = await resolveRecipientByUserId({
    firestore,
    instituteId,
    recipientUserId: body.recipientUserId,
  });
  if (recipient.id === actor.uid) {
    const error = new Error('Choose another user to start a conversation.');
    error.statusCode = 400;
    throw error;
  }

  assertAllowedPair(actor.role, recipient.role);
  await assertLearnerOfficeHours({ firestore, actor, recipient });

  const participantUids = [actor.uid, recipient.id].sort();
  const conversationId = `${instituteId}_${participantUids.join('_')}`;
  const conversationRef = firestore.collection('conversations').doc(conversationId);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  await conversationRef.set({
    id: conversationId,
    instituteId,
    participants: participantUids,
    participantProfiles: [
      participantSummary({ id: actor.uid, ...actor.profile }),
      participantSummary(recipient),
    ],
    lastMessage: null,
    lastMessageAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true });

  return {
    conversationId,
    recipient: participantSummary(recipient),
  };
};

const sendMessage = async ({ actor, firestore, body }) => {
  const conversationRef = firestore.collection('conversations').doc(body.conversationId);
  const conversationSnap = await conversationRef.get();
  if (!conversationSnap.exists) {
    const error = new Error('Conversation not found.');
    error.statusCode = 404;
    throw error;
  }

  const conversation = conversationSnap.data() || {};
  const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
  if (conversation.instituteId !== actor.profile.instituteId || !participants.includes(actor.uid)) {
    const error = new Error('You do not have access to this conversation.');
    error.statusCode = 403;
    throw error;
  }

  const recipientUid = participants.find((uid) => uid !== actor.uid);
  const recipientSnap = await firestore.collection('users').doc(recipientUid).get();
  if (!recipientSnap.exists) {
    const error = new Error('The conversation recipient no longer exists.');
    error.statusCode = 404;
    throw error;
  }
  const recipient = { id: recipientSnap.id, ...recipientSnap.data() };
  assertAllowedPair(actor.role, recipient.role);
  await assertLearnerOfficeHours({ firestore, actor, recipient });

  const messageRef = firestore.collection('messages').doc();
  const notificationRef = firestore.collection('notifications').doc();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const batch = firestore.batch();
  batch.set(messageRef, {
    id: messageRef.id,
    conversationId: conversationRef.id,
    instituteId: actor.profile.instituteId,
    senderUid: actor.uid,
    senderName: actor.profile.name || 'User',
    senderRole: actor.role,
    recipientUid,
    message: body.message,
    createdAt: timestamp,
  });
  batch.update(conversationRef, {
    lastMessage: body.message,
    lastMessageAt: timestamp,
    lastSenderUid: actor.uid,
    updatedAt: timestamp,
  });
  batch.set(notificationRef, {
    instituteId: actor.profile.instituteId,
    title: `Message from ${actor.profile.name || 'Edu-Hub user'}`,
    message: body.message.slice(0, 180),
    type: 'info',
    targetRoles: [recipient.role],
    recipientUids: [recipientUid],
    relatedId: conversationRef.id,
    relatedType: 'conversation',
    author: {
      uid: actor.uid,
      name: actor.profile.name || 'User',
      role: actor.role,
    },
    data: {
      originalType: 'regulated_message',
      conversationId: conversationRef.id,
    },
    isRead: false,
    readBy: [],
    createdAt: timestamp,
  });
  await batch.commit();

  await sendExpoPushToUsers({
    firestore,
    instituteId: actor.profile.instituteId,
    recipientUids: [recipientUid],
    title: `Message from ${actor.profile.name || 'Edu-Hub user'}`,
    body: body.message.slice(0, 180),
    data: {
      type: 'regulated_message',
      conversationId: conversationRef.id,
    },
  }).catch((error) => console.warn('Message push delivery failed:', error));

  return {
    conversationId: conversationRef.id,
    messageId: messageRef.id,
  };
};

const setOfficeHours = async ({ actor, firestore, body }) => {
  if (!['teacher', 'professor', 'admin'].includes(actor.role)) {
    const error = new Error('Only faculty and administrators can configure office hours.');
    error.statusCode = 403;
    throw error;
  }

  if (body.startTime >= body.endTime) {
    const error = new Error('Office hours end time must be later than the start time.');
    error.statusCode = 400;
    throw error;
  }

  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  await firestore.collection('officeHourPolicies').doc(actor.uid).set({
    uid: actor.uid,
    instituteId: actor.profile.instituteId,
    days: body.days,
    startTime: body.startTime,
    endTime: body.endTime,
    timeZone: body.timeZone,
    updatedAt: timestamp,
    updatedBy: actor.uid,
  }, { merge: true });

  return {
    days: body.days,
    startTime: body.startTime,
    endTime: body.endTime,
    timeZone: body.timeZone,
  };
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req, ['admin', 'teacher', 'professor', 'student', 'parent']);
    if (!actor.profile.instituteId) {
      const error = new Error('Your profile is not linked to an institute.');
      error.statusCode = 403;
      throw error;
    }
    const { firestore } = getAdminServices();
    const body = parseBody(await getBody(req));
    let result;

    if (body.action === 'setOfficeHours') result = await setOfficeHours({ actor, firestore, body });
    if (body.action === 'startConversation') result = await startConversation({ actor, firestore, body });
    if (body.action === 'sendMessage') result = await sendMessage({ actor, firestore, body });

    res.status(200).json({
      success: true,
      ...result,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Messaging request failed.', requestId);
  }
};
