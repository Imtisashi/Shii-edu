const crypto = require('crypto');
const { waitUntil } = require('@vercel/functions');
const { admin, getAdminServices } = require('./firebaseAdmin');

const TASK_COLLECTION = 'backgroundTasks';
const DEAD_LETTER_COLLECTION = 'backgroundTaskDeadLetters';
const DEFAULT_MAX_ATTEMPTS = 3;
const LEASE_DURATION_MS = 5 * 60 * 1000;
const INTERNAL_ACTOR = Symbol.for('edu-shii.internalActor');
const INTERNAL_TASK_EXECUTION = Symbol.for('edu-shii.internalTaskExecution');

const TASK_HANDLERS = {
  fee_assignment: () => require('../admin/fees/assign'),
  student_import: () => require('../admin/users/bulk'),
  syllabus_ingest: () => require('../ai/syllabus-ingest'),
};

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const taskIdFor = ({ type, instituteId, idempotencyKey }) => {
  const digest = crypto
    .createHash('sha256')
    .update(`${type}:${instituteId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 32);
  return `${type}_${digest}`;
};

const redactSecrets = (value) => {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/password|secret|token|authorization|api[_-]?key/i.test(key)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactSecrets(item)];
  }));
};

const taskError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const loadActor = async (firestore, uid) => {
  const userSnap = await firestore.collection('users').doc(uid).get();
  if (!userSnap.exists) throw taskError('Background task actor profile was not found.', 403);
  const profile = { id: userSnap.id, ...userSnap.data() };
  return {
    uid,
    role: String(profile.role || '').trim().toLowerCase(),
    profile,
    token: {
      uid,
      instituteId: profile.instituteId || null,
      role: profile.role || null,
    },
  };
};

const createSyntheticResponse = () => {
  let statusCode = 200;
  let payload = null;
  let ended = false;

  return {
    end() {
      ended = true;
      return this;
    },
    getPayload() {
      return { ended, payload, statusCode };
    },
    json(value) {
      payload = value;
      ended = true;
      return this;
    },
    setHeader() {
      return this;
    },
    status(value) {
      statusCode = value;
      return this;
    },
  };
};

const invokeTaskHandler = async ({ actor, task }) => {
  const handlerFactory = TASK_HANDLERS[task.type];
  if (!handlerFactory) throw taskError(`Unsupported background task type: ${task.type}`, 400);

  const request = {
    body: task.payload,
    headers: {},
    method: 'POST',
    query: {},
    [INTERNAL_ACTOR]: actor,
    [INTERNAL_TASK_EXECUTION]: true,
  };
  const response = createSyntheticResponse();
  await handlerFactory()(request, response);
  const result = response.getPayload();

  if (!result.ended) throw taskError('Background task handler did not return a response.');
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw taskError(result.payload?.error || 'Background task handler failed.', result.statusCode);
  }

  return result.payload || { success: true };
};

const enqueueBackgroundTask = async ({
  actor,
  idempotencyKey,
  instituteId,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  payload,
  type,
}) => {
  if (!actor?.uid || !instituteId || !idempotencyKey || !TASK_HANDLERS[type]) {
    throw taskError('Background task request is incomplete.', 400);
  }

  const { firestore } = getAdminServices();
  const id = taskIdFor({ type, instituteId, idempotencyKey });
  const ref = firestore.collection(TASK_COLLECTION).doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();
  let created = false;
  let status = 'queued';

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      status = snapshot.data()?.status || 'queued';
      return;
    }

    created = true;
    transaction.set(ref, {
      id,
      actorUid: actor.uid,
      attempts: 0,
      createdAt: now,
      idempotencyKey,
      instituteId,
      maxAttempts: Math.min(Math.max(Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS, 1), DEFAULT_MAX_ATTEMPTS),
      nextAttemptAt: now,
      payload,
      status: 'queued',
      type,
      updatedAt: now,
    });
  });

  return { created, id, status };
};

const claimTask = async (firestore, taskId) => {
  const ref = firestore.collection(TASK_COLLECTION).doc(taskId);
  const nowMs = Date.now();

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw taskError('Background task was not found.', 404);

    const task = { id: snapshot.id, ...snapshot.data() };
    if (task.status === 'completed' || task.status === 'dead_letter') return { task, claimed: false };
    if (task.status === 'running' && task.leaseUntil?.toMillis?.() > nowMs) return { task, claimed: false };
    if (task.nextAttemptAt?.toMillis?.() > nowMs) return { task, claimed: false };

    const attempts = Number(task.attempts || 0) + 1;
    transaction.update(ref, {
      attempts,
      lastStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      leaseUntil: admin.firestore.Timestamp.fromMillis(nowMs + LEASE_DURATION_MS),
      status: 'running',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      claimed: true,
      task: {
        ...task,
        attempts,
      },
    };
  });
};

const completeTask = async (firestore, task, result) => {
  await firestore.collection(TASK_COLLECTION).doc(task.id).update({
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastError: admin.firestore.FieldValue.delete(),
    leaseUntil: admin.firestore.FieldValue.delete(),
    payload: admin.firestore.FieldValue.delete(),
    result: redactSecrets(result),
    status: 'completed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const failTask = async (firestore, task, error) => {
  const maxAttempts = Math.min(Number(task.maxAttempts || DEFAULT_MAX_ATTEMPTS), DEFAULT_MAX_ATTEMPTS);
  const lastError = {
    message: error instanceof Error ? error.message : 'Background task failed.',
    statusCode: Number(error?.statusCode || 500),
  };
  const taskRef = firestore.collection(TASK_COLLECTION).doc(task.id);

  if (task.attempts >= maxAttempts) {
    const deadLetterRef = firestore.collection(DEAD_LETTER_COLLECTION).doc(task.id);
    const batch = firestore.batch();
    batch.set(deadLetterRef, {
      ...task,
      payload: redactSecrets(task.payload),
      deadLetteredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError,
      status: 'dead_letter',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(taskRef, {
      deadLetteredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError,
      leaseUntil: admin.firestore.FieldValue.delete(),
      payload: admin.firestore.FieldValue.delete(),
      status: 'dead_letter',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return;
  }

  const backoffMs = Math.min(15 * 60 * 1000, 30 * 1000 * (2 ** Math.max(task.attempts - 1, 0)));
  await taskRef.update({
    lastError,
    leaseUntil: admin.firestore.FieldValue.delete(),
    nextAttemptAt: admin.firestore.Timestamp.fromMillis(Date.now() + backoffMs),
    status: 'retry',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const processBackgroundTaskById = async (taskId) => {
  const { firestore } = getAdminServices();
  const { claimed, task } = await claimTask(firestore, taskId);
  if (!claimed) return { id: task.id, status: task.status };

  try {
    const actor = await loadActor(firestore, task.actorUid);
    if (actor.role !== 'superadmin' && actor.profile?.instituteId !== task.instituteId) {
      throw taskError('Background task actor no longer belongs to this institute.', 403);
    }
    const result = await invokeTaskHandler({ actor, task });
    await completeTask(firestore, task, result);
    return { id: task.id, result, status: 'completed' };
  } catch (error) {
    await failTask(firestore, task, error);
    throw error;
  }
};

const processQueuedBackgroundTasks = async (limit = 8) => {
  const { firestore } = getAdminServices();
  const snapshot = await firestore
    .collection(TASK_COLLECTION)
    .where('status', 'in', ['queued', 'retry'])
    .limit(Math.min(Math.max(Number(limit) || 1, 1), 20))
    .get();
  const nowMs = Date.now();
  const taskIds = snapshot.docs
    .filter((document) => document.data()?.nextAttemptAt?.toMillis?.() <= nowMs)
    .map((document) => document.id);
  const results = [];

  for (const taskId of taskIds) {
    try {
      results.push(await processBackgroundTaskById(taskId));
    } catch (error) {
      results.push({
        id: taskId,
        error: error instanceof Error ? error.message : 'Background task failed.',
        status: 'failed',
      });
    }
  }

  return results;
};

const startBackgroundTask = (taskId) => {
  const work = processBackgroundTaskById(taskId).catch((error) => {
    console.error('Background task execution failed:', taskId, error);
  });

  try {
    waitUntil(work);
  } catch (_error) {
    void work;
  }
};

const isInternalTaskExecution = (req) => req?.[INTERNAL_TASK_EXECUTION] === true;
const getInternalActor = (req) => req?.[INTERNAL_ACTOR] || null;

module.exports = {
  DEAD_LETTER_COLLECTION,
  INTERNAL_ACTOR,
  INTERNAL_TASK_EXECUTION,
  TASK_COLLECTION,
  enqueueBackgroundTask,
  getInternalActor,
  isInternalTaskExecution,
  processBackgroundTaskById,
  processQueuedBackgroundTasks,
  startBackgroundTask,
};
