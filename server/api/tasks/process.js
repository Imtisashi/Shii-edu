const { z } = require('zod');
const {
  authenticateUserProfile,
  createRequestId,
  getAdminServices,
  getBody,
  handleOptions,
  sendError,
  setCorsHeaders,
} = require('../_lib/firebaseAdmin');
const {
  TASK_COLLECTION,
  processBackgroundTaskById,
  processQueuedBackgroundTasks,
} = require('../_lib/backgroundTasks');

const RequestSchema = z.object({
  taskId: z.string().trim().min(1).max(180),
}).strict();

const cronAuthorized = (req) => (
  Boolean(process.env.CRON_SECRET) &&
  req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
);

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;

  try {
    if (req.method === 'GET') {
      if (!cronAuthorized(req)) {
        const error = new Error('Unauthorized background task sweep.');
        error.statusCode = 401;
        throw error;
      }
      const results = await processQueuedBackgroundTasks(8);
      res.status(200).json({ success: true, processed: results.length, results, requestId });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
      return;
    }

    const actor = await authenticateUserProfile(req);
    const parsed = RequestSchema.safeParse(await getBody(req));
    if (!parsed.success) {
      const error = new Error(parsed.error.issues[0]?.message || 'Invalid task request.');
      error.statusCode = 400;
      throw error;
    }

    const { firestore } = getAdminServices();
    const taskSnap = await firestore.collection(TASK_COLLECTION).doc(parsed.data.taskId).get();
    if (!taskSnap.exists) {
      const error = new Error('Background task was not found.');
      error.statusCode = 404;
      throw error;
    }
    const task = taskSnap.data() || {};
    const sameInstitute = task.instituteId && task.instituteId === actor.profile?.instituteId;
    if (actor.role !== 'superadmin' && task.actorUid !== actor.uid && !(actor.role === 'admin' && sameInstitute)) {
      const error = new Error('You do not have permission to process this background task.');
      error.statusCode = 403;
      throw error;
    }

    const result = await processBackgroundTaskById(taskSnap.id);
    res.status(200).json({ success: true, ...result, requestId });
  } catch (error) {
    sendError(res, error, 'Background task processing failed.', requestId);
  }
};
