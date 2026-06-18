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
const { sendExpoPushToUsers } = require('../../_lib/expoPush');
const { assertFeatureEnabled } = require('../../_lib/featureEntitlements');
const { assertRateLimit } = require('../../_lib/rateLimit');

const MAX_OFFLINE_STUDENTS = 500;
const FIRESTORE_IN_LIMIT = 10;
const BATCH_LIMIT = 420;

const TargetScopeSchema = z.enum([
  'all',
  'class',
  'section',
  'classSection',
  'department',
  'semester',
  'departmentSemester',
]);

const RequestSchema = z.object({
  amount: z.coerce.number().positive().max(10000000).optional(),
  currency: z.string().trim().length(3).optional().default('INR'),
  markFullOutstanding: z.coerce.boolean().optional().default(false),
  note: z.string().trim().max(400).optional().default(''),
  studentUid: z.string().trim().min(1).max(300).optional(),
  studentUids: z.array(z.string().trim().min(1).max(300)).max(MAX_OFFLINE_STUDENTS).optional(),
  targetScope: TargetScopeSchema.optional(),
  targetValue: z.string().trim().max(160).optional().default(''),
}).strict();

const normalize = (value) => String(value || '').trim().toLowerCase();

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const parseBody = (body) => {
  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    throw createValidationError(result.error.issues[0]?.message || 'Invalid payment record.');
  }

  const data = result.data;
  const hasStudentTarget = Boolean(data.studentUid) || (Array.isArray(data.studentUids) && data.studentUids.length > 0);
  const hasCohortTarget = Boolean(data.targetScope);

  if (!hasStudentTarget && !hasCohortTarget) {
    throw createValidationError('Choose one student or a group before recording offline payment.');
  }

  if (!data.markFullOutstanding && !data.amount) {
    throw createValidationError('Enter an amount, or choose to mark the outstanding balance as paid.');
  }

  if (data.targetScope && data.targetScope !== 'all' && !data.targetValue) {
    throw createValidationError('Enter the class, section, semester, or cohort value for this offline payment.');
  }

  return data;
};

const studentMatchesTarget = (student, targetScope, targetValue) => {
  if (targetScope === 'all') return true;
  const target = normalize(targetValue);
  if (!target) return false;

  if (targetScope === 'class') return normalize(student.class || student.standard) === target;
  if (targetScope === 'section') return normalize(student.section) === target;
  if (targetScope === 'classSection') {
    const [classValue, sectionValue] = target.split('|');
    return normalize(student.class || student.standard) === classValue && normalize(student.section) === sectionValue;
  }
  if (targetScope === 'department') return normalize(student.dept || student.department) === target;
  if (targetScope === 'semester') return normalize(student.sem || student.semester) === target;
  if (targetScope === 'departmentSemester') {
    const [departmentValue, semesterValue] = target.split('|');
    return normalize(student.dept || student.department) === departmentValue && normalize(student.sem || student.semester) === semesterValue;
  }
  return false;
};

const assertStudentInInstitute = ({ instituteId, snapshot }) => {
  if (!snapshot.exists) {
    const error = new Error('Student profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const student = { id: snapshot.id, ref: snapshot.ref, ...snapshot.data() };
  if (student.instituteId !== instituteId || student.role !== 'student') {
    const error = new Error('The selected student does not belong to your institute.');
    error.statusCode = 403;
    throw error;
  }

  return student;
};

const getStudentLedgerId = (student = {}) => (
  student.loginId ||
  student.uniqueId ||
  student.studentId ||
  student.userId ||
  student.id ||
  ''
);

const buildAllocationAudit = ({ allocationMinor, invoice = {}, student = {} }) => ({
  invoiceId: invoice.id,
  amountMinor: allocationMinor,
  studentId: getStudentLedgerId(student),
  studentName: student.name || 'Student',
  studentUid: student.id,
});

const loadTargetStudents = async ({ body, firestore, instituteId }) => {
  if (body.studentUid || (Array.isArray(body.studentUids) && body.studentUids.length > 0)) {
    const ids = [...new Set([body.studentUid, ...(body.studentUids || [])].filter(Boolean))];
    const students = [];

    for (const studentId of ids) {
      const snapshot = await firestore.collection('users').doc(studentId).get();
      students.push(assertStudentInInstitute({ instituteId, snapshot }));
    }

    return students;
  }

  const snapshot = await firestore
    .collection('users')
    .where('instituteId', '==', instituteId)
    .where('role', '==', 'student')
    .get();

  return snapshot.docs
    .map((document) => ({ id: document.id, ref: document.ref, ...document.data() }))
    .filter((student) => studentMatchesTarget(student, body.targetScope, body.targetValue))
    .slice(0, MAX_OFFLINE_STUDENTS);
};

const loadUnpaidInvoicesByStudent = async ({ firestore, instituteId, studentUids }) => {
  const invoicesByStudent = new Map(studentUids.map((uid) => [uid, []]));

  for (const chunk of chunkArray(studentUids, FIRESTORE_IN_LIMIT)) {
    const snapshot = await firestore
      .collection('feeInvoices')
      .where('instituteId', '==', instituteId)
      .where('studentUid', 'in', chunk)
      .get();

    snapshot.docs
      .map((document) => ({ ref: document.ref, id: document.id, ...document.data() }))
      .filter((invoice) => invoice.status !== 'paid' && Number(invoice.balanceAmountMinor || 0) > 0)
      .forEach((invoice) => {
        const list = invoicesByStudent.get(invoice.studentUid) || [];
        list.push(invoice);
        invoicesByStudent.set(invoice.studentUid, list);
      });
  }

  invoicesByStudent.forEach((invoices) => {
    invoices.sort((left, right) => String(left.dueDate || '').localeCompare(String(right.dueDate || '')));
  });

  return invoicesByStudent;
};

const loadParentRecipients = async ({ firestore, instituteId, studentUids }) => {
  const targetStudentUids = new Set(studentUids);
  const parentSnapshot = await firestore
    .collection('users')
    .where('instituteId', '==', instituteId)
    .where('role', '==', 'parent')
    .get();
  const parentUidsByStudent = new Map(studentUids.map((uid) => [uid, []]));

  parentSnapshot.docs.forEach((document) => {
    const parent = document.data() || {};
    const childUids = Array.isArray(parent.childUids) ? parent.childUids : [];
    const linkedUids = [parent.linkedStudentUid, ...childUids].filter((uid) => targetStudentUids.has(uid));
    linkedUids.forEach((uid) => {
      const list = parentUidsByStudent.get(uid) || [];
      list.push(document.id);
      parentUidsByStudent.set(uid, list);
    });
  });

  return parentUidsByStudent;
};

const createBatchWriter = (firestore) => {
  let batch = firestore.batch();
  let operations = 0;

  return {
    async commitIfNeeded(nextOperations = 1) {
      if (operations > 0 && operations + nextOperations > BATCH_LIMIT) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    },
    async flush() {
      if (operations > 0) {
        await batch.commit();
        batch = firestore.batch();
        operations = 0;
      }
    },
    set(ref, data, options) {
      batch.set(ref, data, options);
      operations += 1;
    },
    update(ref, data) {
      batch.update(ref, data);
      operations += 1;
    },
  };
};

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  setCorsHeaders(req, res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed.', requestId });
    return;
  }

  try {
    const actor = await authenticateUserProfile(req, ['admin']);
    await assertRateLimit({ actor, req, scope: 'admin:record-payment', limit: 30, windowMs: 60 * 1000 });
    const instituteId = actor.profile?.instituteId;
    if (!instituteId) {
      const error = new Error('Your profile is not linked to an institute.');
      error.statusCode = 403;
      throw error;
    }

    const body = parseBody(await getBody(req));
    const { firestore } = getAdminServices();
    await assertFeatureEnabled({ firestore, instituteId, featureKey: 'finance' });

    const targetStudents = await loadTargetStudents({ body, firestore, instituteId });
    if (targetStudents.length === 0) {
      throw createValidationError('No students matched this payment selection.');
    }

    const studentUids = targetStudents.map((student) => student.id);
    const invoicesByStudent = await loadUnpaidInvoicesByStudent({ firestore, instituteId, studentUids });
    const parentUidsByStudent = await loadParentRecipients({ firestore, instituteId, studentUids });
    const currency = body.currency.toUpperCase();
    const fixedAmountMinor = body.amount ? Math.round(body.amount * 100) : 0;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const writer = createBatchWriter(firestore);
    const pushRecipients = new Set();
    const summaries = [];

    for (const student of targetStudents) {
      const invoices = invoicesByStudent.get(student.id) || [];
      const outstandingMinor = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmountMinor || 0), 0);
      if (outstandingMinor <= 0) continue;

      const amountMinor = body.markFullOutstanding ? outstandingMinor : fixedAmountMinor;
      if (amountMinor <= 0) continue;
      if (amountMinor > outstandingMinor) {
        throw createValidationError(`Offline payment for ${student.name || 'selected student'} is higher than the outstanding balance.`);
      }

      let remainingMinor = amountMinor;
      const allocations = [];
      invoices.forEach((invoice) => {
        if (remainingMinor <= 0) return;
        const invoiceBalanceMinor = Number(invoice.balanceAmountMinor || 0);
        const allocationMinor = Math.min(remainingMinor, invoiceBalanceMinor);
        remainingMinor -= allocationMinor;
        allocations.push({ invoice, allocationMinor });
      });

      if (allocations.length === 0) continue;

      const paymentRef = firestore.collection('payments').doc();
      const notificationRef = firestore.collection('notifications').doc();
      const parentUids = parentUidsByStudent.get(student.id) || [];
      const recipientUids = [student.id, ...parentUids];
      recipientUids.forEach((uid) => pushRecipients.add(uid));

      await writer.commitIfNeeded(allocations.length + 3);
      allocations.forEach(({ invoice, allocationMinor }) => {
        const nextPaidMinor = Number(invoice.paidAmountMinor || 0) + allocationMinor;
        const nextBalanceMinor = Math.max(0, Number(invoice.amountMinor || 0) - nextPaidMinor);
        writer.update(invoice.ref, {
          paidAmount: nextPaidMinor / 100,
          paidAmountMinor: nextPaidMinor,
          balanceAmount: nextBalanceMinor / 100,
          balanceAmountMinor: nextBalanceMinor,
          status: nextBalanceMinor === 0 ? 'paid' : 'partially_paid',
          updatedAt: timestamp,
        });
      });

      writer.update(student.ref, {
        feePaid: admin.firestore.FieldValue.increment(amountMinor / 100),
        updatedAt: timestamp,
      });
      writer.set(paymentRef, {
        uid: student.id,
        studentUid: student.id,
        studentId: getStudentLedgerId(student),
        studentName: student.name || 'Student',
        instituteId,
        provider: 'manual',
        recordedBy: actor.uid,
        amount: amountMinor / 100,
        amountMinor,
        currency,
        note: body.note || null,
        allocations: allocations.map(({ invoice, allocationMinor }) => buildAllocationAudit({
          allocationMinor,
          invoice,
          student,
        })),
        status: 'paid',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      writer.set(notificationRef, {
        instituteId,
        title: 'Fee payment recorded',
        message: `${currency} ${(amountMinor / 100).toLocaleString()} was recorded by your institute.`,
        type: 'success',
        targetRoles: ['student', 'parent'],
        recipientUids,
        relatedId: paymentRef.id,
        relatedType: 'payment',
        author: { uid: actor.uid, name: actor.profile.name || 'Institute Admin', role: actor.role },
        data: {
          originalType: 'manual_fee_payment',
          paymentId: paymentRef.id,
          studentId: getStudentLedgerId(student),
          studentUid: student.id,
          offline: true,
        },
        isRead: false,
        readBy: [],
        createdAt: timestamp,
      });

      summaries.push({
        amount: amountMinor / 100,
        allocatedInvoices: allocations.length,
        paymentId: paymentRef.id,
        studentId: getStudentLedgerId(student),
        studentUid: student.id,
      });
    }

    if (summaries.length === 0) {
      throw createValidationError('The selected students do not have unpaid invoices.');
    }

    await writer.flush();

    await sendExpoPushToUsers({
      firestore,
      instituteId,
      recipientUids: [...pushRecipients],
      title: 'Fee payment recorded',
      body: 'Your institute marked an offline fee payment as received.',
      data: { type: 'manual_fee_payment' },
    }).catch((error) => console.warn('Manual payment push failed:', error));

    const totalAmount = summaries.reduce((sum, item) => sum + item.amount, 0);
    const totalInvoices = summaries.reduce((sum, item) => sum + item.allocatedInvoices, 0);

    res.status(201).json({
      success: true,
      amount: totalAmount,
      allocatedInvoices: totalInvoices,
      payments: summaries,
      studentsUpdated: summaries.length,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Payment record could not be saved.', requestId);
  }
};

module.exports.__test = {
  buildAllocationAudit,
  getStudentLedgerId,
};
