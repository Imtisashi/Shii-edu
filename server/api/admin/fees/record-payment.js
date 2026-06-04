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

const RequestSchema = z.object({
  amount: z.coerce.number().positive().max(10000000),
  currency: z.string().trim().length(3).optional().default('INR'),
  note: z.string().trim().max(400).optional().default(''),
  studentUid: z.string().trim().min(1).max(300),
}).strict();

const parseBody = (body) => {
  const result = RequestSchema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error(result.error.issues[0]?.message || 'Invalid payment record.');
  error.statusCode = 400;
  throw error;
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
    const instituteId = actor.profile?.instituteId;
    if (!instituteId) {
      const error = new Error('Your profile is not linked to an institute.');
      error.statusCode = 403;
      throw error;
    }
    const body = parseBody(await getBody(req));
    const { firestore } = getAdminServices();
    const studentRef = firestore.collection('users').doc(body.studentUid);
    const studentSnapshot = await studentRef.get();
    if (!studentSnapshot.exists) {
      const error = new Error('Student profile not found.');
      error.statusCode = 404;
      throw error;
    }
    const student = studentSnapshot.data() || {};
    if (student.instituteId !== instituteId || student.role !== 'student') {
      const error = new Error('The selected student does not belong to your institute.');
      error.statusCode = 403;
      throw error;
    }

    const invoiceSnapshot = await firestore
      .collection('feeInvoices')
      .where('instituteId', '==', instituteId)
      .where('studentUid', '==', body.studentUid)
      .get();
    const invoices = invoiceSnapshot.docs
      .map((document) => ({ ref: document.ref, id: document.id, ...document.data() }))
      .filter((invoice) => invoice.status !== 'paid' && Number(invoice.balanceAmountMinor || 0) > 0)
      .sort((left, right) => String(left.dueDate || '').localeCompare(String(right.dueDate || '')));
    const amountMinor = Math.round(body.amount * 100);
    const outstandingMinor = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmountMinor || 0), 0);
    if (outstandingMinor === 0) {
      const error = new Error('This student has no unpaid fee invoices.');
      error.statusCode = 400;
      throw error;
    }
    if (amountMinor > outstandingMinor) {
      const error = new Error('Payment amount cannot exceed the student’s outstanding invoice balance.');
      error.statusCode = 400;
      throw error;
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

    const parentSnapshot = await firestore
      .collection('users')
      .where('instituteId', '==', instituteId)
      .where('role', '==', 'parent')
      .get();
    const parentUids = parentSnapshot.docs
      .filter((document) => {
        const parent = document.data() || {};
        const childUids = Array.isArray(parent.childUids) ? parent.childUids : [];
        return parent.linkedStudentUid === body.studentUid || childUids.includes(body.studentUid);
      })
      .map((document) => document.id);
    const recipientUids = [body.studentUid, ...parentUids];
    const paymentRef = firestore.collection('payments').doc();
    const notificationRef = firestore.collection('notifications').doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const batch = firestore.batch();
    allocations.forEach(({ invoice, allocationMinor }) => {
      const nextPaidMinor = Number(invoice.paidAmountMinor || 0) + allocationMinor;
      const nextBalanceMinor = Math.max(0, Number(invoice.amountMinor || 0) - nextPaidMinor);
      batch.update(invoice.ref, {
        paidAmount: nextPaidMinor / 100,
        paidAmountMinor: nextPaidMinor,
        balanceAmount: nextBalanceMinor / 100,
        balanceAmountMinor: nextBalanceMinor,
        status: nextBalanceMinor === 0 ? 'paid' : 'partially_paid',
        updatedAt: timestamp,
      });
    });
    batch.update(studentRef, {
      feePaid: admin.firestore.FieldValue.increment(amountMinor / 100),
      updatedAt: timestamp,
    });
    batch.set(paymentRef, {
      uid: body.studentUid,
      studentUid: body.studentUid,
      instituteId,
      provider: 'manual',
      recordedBy: actor.uid,
      amount: amountMinor / 100,
      amountMinor,
      currency: body.currency.toUpperCase(),
      note: body.note || null,
      allocations: allocations.map(({ invoice, allocationMinor }) => ({
        invoiceId: invoice.id,
        amountMinor: allocationMinor,
      })),
      status: 'paid',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    batch.set(notificationRef, {
      instituteId,
      title: 'Fee payment recorded',
      message: `${body.currency.toUpperCase()} ${(amountMinor / 100).toLocaleString()} was recorded by your institute.`,
      type: 'success',
      targetRoles: ['student', 'parent'],
      recipientUids,
      relatedId: paymentRef.id,
      relatedType: 'payment',
      author: { uid: actor.uid, name: actor.profile.name || 'Institute Admin', role: actor.role },
      data: { originalType: 'manual_fee_payment', paymentId: paymentRef.id },
      isRead: false,
      readBy: [],
      createdAt: timestamp,
    });
    await batch.commit();

    await sendExpoPushToUsers({
      firestore,
      instituteId,
      recipientUids,
      title: 'Fee payment recorded',
      body: `${body.currency.toUpperCase()} ${(amountMinor / 100).toLocaleString()} was recorded by your institute.`,
      data: { type: 'manual_fee_payment', paymentId: paymentRef.id },
    }).catch((error) => console.warn('Manual payment push failed:', error));

    res.status(201).json({
      success: true,
      paymentId: paymentRef.id,
      amount: amountMinor / 100,
      allocatedInvoices: allocations.length,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Payment record could not be saved.', requestId);
  }
};
