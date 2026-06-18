const crypto = require('crypto');
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
const { assertFeatureEnabled } = require('../../_lib/featureEntitlements');
const { assertRateLimit } = require('../../_lib/rateLimit');
const { getStripeClient } = require('../../_lib/stripe');

const MAX_TEACHERS_PER_RUN = 120;

const RequestSchema = z.object({
  currency: z.string().trim().length(3).optional().default('INR'),
  idempotencyKey: z.string().trim().min(8).max(180).optional(),
  month: z.string().trim().regex(/^\d{4}-\d{2}$/),
  teacherUids: z.array(z.string().trim().min(1).max(300)).max(MAX_TEACHERS_PER_RUN).optional().default([]),
}).strict();

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const getSalary = (teacher) => Number(teacher?.payrollMonthlySalary || teacher?.payroll?.monthlySalary || 0);
const getStripeAccountId = (teacher) => String(
  teacher?.stripeConnectedAccountId ||
  teacher?.payrollStripeConnectedAccountId ||
  teacher?.payroll?.stripeConnectedAccountId ||
  ''
).trim();
const safeDocumentId = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);

const parseBody = (body) => {
  const result = RequestSchema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error(result.error.issues[0]?.message || 'Invalid payroll request.');
  error.statusCode = 400;
  throw error;
};

const loadTeachers = async ({ body, firestore, instituteId }) => {
  const selectedIds = [...new Set(body.teacherUids || [])];
  if (selectedIds.length > 0) {
    const teachers = [];
    for (const uid of selectedIds) {
      const snapshot = await firestore.collection('users').doc(uid).get();
      if (!snapshot.exists) continue;
      const teacher = { id: snapshot.id, ref: snapshot.ref, ...snapshot.data() };
      if (
        teacher.instituteId === instituteId &&
        ['teacher', 'professor'].includes(normalizeRole(teacher.role))
      ) {
        teachers.push(teacher);
      }
    }
    return teachers;
  }

  const snapshot = await firestore
    .collection('users')
    .where('instituteId', '==', instituteId)
    .get();

  return snapshot.docs
    .map((document) => ({ id: document.id, ref: document.ref, ...document.data() }))
    .filter((entry) => ['teacher', 'professor'].includes(normalizeRole(entry.role)))
    .slice(0, MAX_TEACHERS_PER_RUN);
};

const transferIdempotencyKey = ({ amountMinor, baseKey, instituteId, month, teacherId }) => {
  const digest = crypto
    .createHash('sha256')
    .update(`${baseKey}:${instituteId}:${month}:${teacherId}:${amountMinor}`)
    .digest('hex')
    .slice(0, 32);
  return `shii-edu-payroll-${digest}`;
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
    const actor = await authenticateUserProfile(req, ['admin']);
    await assertRateLimit({ actor, req, scope: 'admin:teacher-payroll-run', limit: 6, windowMs: 60 * 1000 });
    const instituteId = actor.profile?.instituteId;
    if (!instituteId) {
      const error = new Error('Your profile is not linked to an institute.');
      error.statusCode = 403;
      throw error;
    }

    const body = parseBody(await getBody(req));
    const { firestore } = getAdminServices();
    await assertFeatureEnabled({ firestore, instituteId, featureKey: 'finance' });

    const teachers = await loadTeachers({ body, firestore, instituteId });
    if (teachers.length === 0) {
      const error = new Error('No teachers matched this payroll run.');
      error.statusCode = 400;
      throw error;
    }

    const payableTeachers = teachers.filter((teacher) => getSalary(teacher) > 0);
    if (payableTeachers.length === 0) {
      const error = new Error('No selected teacher has a monthly salary amount.');
      error.statusCode = 400;
      throw error;
    }

    const { stripe } = getStripeClient();
    const currency = body.currency.toLowerCase();
    const transferGroup = `payroll_${safeDocumentId(instituteId)}_${body.month}`;
    const baseKey = body.idempotencyKey || `${requestId}:${body.month}`;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const results = [];

    for (const teacher of payableTeachers) {
      const amount = getSalary(teacher);
      const amountMinor = Math.round(amount * 100);
      const destination = getStripeAccountId(teacher);
      const payrollRunId = safeDocumentId(`${instituteId}_${body.month}_${teacher.id}`);
      const payrollRef = firestore.collection('teacherPayrollPayments').doc(payrollRunId);
      const metadata = {
        app: 'shii-edu',
        instituteId,
        month: body.month,
        payrollRunId,
        teacherUid: teacher.id,
      };

      if (!destination) {
        await payrollRef.set({
          amount,
          amountMinor,
          currency: currency.toUpperCase(),
          instituteId,
          month: body.month,
          reason: 'missing_stripe_connected_account',
          status: 'needs_connected_account',
          teacherName: teacher.name || null,
          teacherUid: teacher.id,
          updatedAt: timestamp,
        }, { merge: true });
        results.push({
          amount,
          status: 'needs_connected_account',
          teacherName: teacher.name || 'Teacher',
          teacherUid: teacher.id,
        });
        continue;
      }

      try {
        const transfer = await stripe.transfers.create({
          amount: amountMinor,
          currency,
          destination,
          metadata,
          transfer_group: transferGroup,
        }, {
          idempotencyKey: transferIdempotencyKey({
            amountMinor,
            baseKey,
            instituteId,
            month: body.month,
            teacherId: teacher.id,
          }),
        });

        const batch = firestore.batch();
        batch.set(payrollRef, {
          amount,
          amountMinor,
          currency: currency.toUpperCase(),
          destinationAccountId: destination,
          instituteId,
          metadata,
          month: body.month,
          provider: 'stripe_connect',
          requestedBy: actor.uid,
          status: 'submitted',
          stripeTransferId: transfer.id,
          teacherName: teacher.name || null,
          teacherUid: teacher.id,
          transferGroup,
          updatedAt: timestamp,
        }, { merge: true });
        batch.update(teacher.ref, {
          payrollLastRunMonth: body.month,
          payrollLastTransferId: transfer.id,
          payrollStatus: 'processing',
          payrollUpdatedAt: timestamp,
          payrollUpdatedBy: actor.uid,
        });
        batch.set(firestore.collection('notifications').doc(), {
          instituteId,
          title: 'Teacher payroll submitted',
          message: `${body.month} salary transfer was submitted for ${teacher.name || 'teacher'}.`,
          type: 'info',
          targetRoles: ['admin'],
          recipientUids: [actor.uid],
          relatedId: payrollRef.id,
          relatedType: 'teacher_payroll',
          author: { uid: actor.uid, name: actor.profile.name || 'Institute Admin', role: actor.role },
          data: {
            originalType: 'teacher_payroll_submitted',
            stripeTransferId: transfer.id,
          },
          isRead: false,
          readBy: [],
          createdAt: timestamp,
        });
        await batch.commit();

        results.push({
          amount,
          status: 'submitted',
          stripeTransferId: transfer.id,
          teacherName: teacher.name || 'Teacher',
          teacherUid: teacher.id,
        });
      } catch (error) {
        await payrollRef.set({
          amount,
          amountMinor,
          currency: currency.toUpperCase(),
          destinationAccountId: destination,
          errorMessage: error.message || 'Stripe transfer failed.',
          instituteId,
          month: body.month,
          provider: 'stripe_connect',
          status: 'failed',
          teacherName: teacher.name || null,
          teacherUid: teacher.id,
          updatedAt: timestamp,
        }, { merge: true });
        results.push({
          amount,
          status: 'failed',
          teacherName: teacher.name || 'Teacher',
          teacherUid: teacher.id,
        });
      }
    }

    res.status(200).json({
      success: true,
      month: body.month,
      results,
      submitted: results.filter((item) => item.status === 'submitted').length,
      needsSetup: results.filter((item) => item.status === 'needs_connected_account').length,
      failed: results.filter((item) => item.status === 'failed').length,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Teacher payroll could not be submitted.', requestId);
  }
};
