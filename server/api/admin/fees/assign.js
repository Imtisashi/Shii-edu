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
} = require('../../_lib/firebaseAdmin');
const { assertInstituteId } = require('../../_lib/loginIdentifiers');
const { sendExpoPushToUsers } = require('../../_lib/expoPush');
const {
  enqueueBackgroundTask,
  isInternalTaskExecution,
  startBackgroundTask,
} = require('../../_lib/backgroundTasks');
const { assertFeatureEnabled } = require('../../_lib/featureEntitlements');
const { assertRateLimit } = require('../../_lib/rateLimit');

const TargetScopeSchema = z.enum(['all', 'class', 'department', 'section', 'semester']);
const AssignFeeSchema = z.object({
  amount: z.coerce.number().positive().max(10000000),
  currency: z.string().trim().length(3).optional().default('INR'),
  description: z.string().trim().max(600).optional().default(''),
  dueDate: z.string().trim().max(40).optional().default(''),
  feeType: z.string().trim().min(2).max(80),
  idempotencyKey: z.string().trim().max(180).optional().default(''),
  instituteId: z.string().trim().min(1).max(160),
  targetScope: TargetScopeSchema.default('all'),
  targetValue: z.string().trim().max(160).optional().default(''),
  title: z.string().trim().min(3).max(140),
}).strict();

const normalize = (value) => String(value || '').trim().toLowerCase();
const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const parseBody = (body) => {
  const result = AssignFeeSchema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const error = new Error(issue?.message || 'Invalid fee assignment request.');
  error.statusCode = 400;
  throw error;
};

const studentMatchesTarget = (student, targetScope, targetValue) => {
  if (targetScope === 'all') return true;
  const target = normalize(targetValue);
  if (!target) return false;

  if (targetScope === 'class') return normalize(student.class || student.standard) === target;
  if (targetScope === 'section') return normalize(student.section) === target;
  if (targetScope === 'department') return normalize(student.dept || student.department) === target;
  if (targetScope === 'semester') return normalize(student.sem || student.semester) === target;
  return false;
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
    const actor = await authenticateUserProfile(req, ['admin', 'superadmin']);
    if (!isInternalTaskExecution(req)) {
      assertRateLimit({ actor, req, scope: 'admin:fee-assignment', limit: 12, windowMs: 60 * 1000 });
    }
    const { firestore } = getAdminServices();
    const body = parseBody(await getBody(req));
    const instituteId = assertInstituteId(body.instituteId || actor.profile.instituteId);

    if (actor.role === 'admin' && actor.profile.instituteId !== instituteId) {
      const error = new Error('Admins can only assign fees inside their own institute.');
      error.statusCode = 403;
      throw error;
    }

    if (body.targetScope !== 'all' && !body.targetValue) {
      const error = new Error('A target value is required for this fee scope.');
      error.statusCode = 400;
      throw error;
    }

    await assertFeatureEnabled({ firestore, instituteId, featureKey: 'finance' });

    if (!isInternalTaskExecution(req)) {
      const task = await enqueueBackgroundTask({
        actor,
        idempotencyKey: body.idempotencyKey || `fee-assignment:${requestId}`,
        instituteId,
        payload: body,
        type: 'fee_assignment',
      });
      startBackgroundTask(task.id);
      res.status(task.created ? 202 : 200).json({
        success: true,
        background: true,
        taskId: task.id,
        status: task.status,
        requestId,
      });
      return;
    }

    const instituteSnap = await firestore.collection('institutes').doc(instituteId).get();
    if (!instituteSnap.exists) {
      const error = new Error('Institute not found.');
      error.statusCode = 404;
      throw error;
    }

    const studentSnapshot = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .where('role', '==', 'student')
      .get();
    const targetStudents = studentSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }))
      .filter((student) => studentMatchesTarget(student, body.targetScope, body.targetValue));

    if (targetStudents.length === 0) {
      const error = new Error('No students match the selected fee assignment scope.');
      error.statusCode = 400;
      throw error;
    }

    const targetStudentUids = new Set(targetStudents.map((student) => student.id));
    const parentSnapshot = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .where('role', '==', 'parent')
      .get();
    const parentUids = parentSnapshot.docs
      .filter((document) => {
        const parent = document.data() || {};
        const childUids = Array.isArray(parent.childUids) ? parent.childUids : [];
        return targetStudentUids.has(parent.linkedStudentUid) || childUids.some((uid) => targetStudentUids.has(uid));
      })
      .map((document) => document.id);
    const notificationRecipientUids = [...targetStudents.map((student) => student.id), ...parentUids];

    const structureRef = firestore.collection('feeStructures').doc();
    const notificationRef = firestore.collection('notifications').doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const currency = body.currency.toUpperCase();
    const amount = Math.round(body.amount * 100) / 100;
    const amountMinor = Math.round(amount * 100);
    const target = {
      scope: body.targetScope,
      value: body.targetScope === 'all' ? null : body.targetValue,
    };
    const feeStructure = {
      id: structureRef.id,
      instituteId,
      title: body.title,
      description: body.description || null,
      feeType: body.feeType,
      amount,
      amountMinor,
      currency,
      dueDate: body.dueDate || null,
      target,
      invoiceCount: targetStudents.length,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: actor.uid,
    };
    const feeBreakdownItem = {
      id: structureRef.id,
      structureId: structureRef.id,
      title: body.title,
      type: body.feeType,
      amount,
      currency,
      dueDate: body.dueDate || null,
      dateAdded: new Date().toISOString(),
    };

    const studentChunks = chunkArray(targetStudents, 200);
    for (let index = 0; index < studentChunks.length; index += 1) {
      const batch = firestore.batch();

      if (index === 0) {
        batch.set(structureRef, feeStructure);
        batch.set(notificationRef, {
          instituteId,
          title: `New fee assigned: ${body.title}`,
          message: `${currency} ${amount.toLocaleString()} has been added to your fee ledger${body.dueDate ? ` and is due on ${body.dueDate}` : ''}.`,
          type: 'reminder',
          targetRoles: ['student', 'parent'],
          recipientUids: notificationRecipientUids,
          relatedId: structureRef.id,
          relatedType: 'fee_structure',
          author: {
            uid: actor.uid,
            name: actor.profile.name || 'Institute Admin',
            role: actor.role,
          },
          data: {
            originalType: 'fee_assigned',
            feeStructureId: structureRef.id,
            target,
          },
          isRead: false,
          readBy: [],
          createdAt: timestamp,
        });
      }

      studentChunks[index].forEach((student) => {
        const invoiceRef = firestore.collection('feeInvoices').doc(`${structureRef.id}_${student.id}`);
        batch.set(invoiceRef, {
          id: invoiceRef.id,
          instituteId,
          structureId: structureRef.id,
          studentUid: student.id,
          studentId: student.loginId || student.uniqueId || student.id,
          studentName: student.name || 'Student',
          title: body.title,
          description: body.description || null,
          feeType: body.feeType,
          amount,
          amountMinor,
          currency,
          dueDate: body.dueDate || null,
          paidAmount: 0,
          paidAmountMinor: 0,
          balanceAmount: amount,
          balanceAmountMinor: amountMinor,
          status: 'unpaid',
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: actor.uid,
        });
        batch.update(firestore.collection('users').doc(student.id), {
          totalFee: admin.firestore.FieldValue.increment(amount),
          feeBreakdown: admin.firestore.FieldValue.arrayUnion(feeBreakdownItem),
          updatedAt: timestamp,
        });
      });

      await batch.commit();
    }

    await sendExpoPushToUsers({
      firestore,
      instituteId,
      recipientUids: notificationRecipientUids,
      title: `New fee assigned: ${body.title}`,
      body: `${currency} ${amount.toLocaleString()} has been added to your fee ledger.`,
      data: {
        type: 'fee_assigned',
        feeStructureId: structureRef.id,
      },
    }).catch((error) => {
      console.warn('Fee assignment push notification failed:', error);
    });

    res.status(201).json({
      success: true,
      feeStructureId: structureRef.id,
      assignedStudents: targetStudents.length,
      amount,
      currency,
      target,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Fee assignment failed.', requestId);
  }
};
