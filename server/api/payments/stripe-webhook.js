const {
  admin,
  getAdminServices,
} = require('../_lib/firebaseAdmin');
const { getStripeClient } = require('../_lib/stripe');

const readRawBody = async (req) => {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const eventPaymentData = (event) => {
  const object = event.data.object;
  if (event.type === 'payment_intent.succeeded') {
    return {
      metadata: object.metadata || {},
      amountMinor: object.amount_received || object.amount || 0,
      currency: object.currency || 'inr',
      paymentIntentId: object.id,
      checkoutSessionId: null,
    };
  }

  if (event.type === 'checkout.session.completed' && object.payment_status === 'paid') {
    return {
      metadata: object.metadata || {},
      amountMinor: object.amount_total || 0,
      currency: object.currency || 'inr',
      paymentIntentId: typeof object.payment_intent === 'string' ? object.payment_intent : null,
      checkoutSessionId: object.id,
    };
  }

  return null;
};

const safeDocumentId = (value) => String(value || '')
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .slice(0, 180);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ received: false });
    return;
  }

  try {
    const { config, stripe } = getStripeClient();
    if (!config.webhookSecret) {
      res.status(503).json({ received: false, error: 'Stripe webhook secret is not configured.' });
      return;
    }

    const signature = req.headers['stripe-signature'];
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
    const paymentData = eventPaymentData(event);
    if (!paymentData) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const invoiceId = paymentData.metadata.invoiceId;
    if (!invoiceId) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const { firestore } = getAdminServices();
    const canonicalProviderId = paymentData.paymentIntentId || paymentData.checkoutSessionId || event.id;
    const paymentRef = firestore.collection('payments').doc(`stripe_${safeDocumentId(canonicalProviderId)}`);
    const eventRef = firestore.collection('stripeWebhookEvents').doc(safeDocumentId(event.id));
    const invoiceRef = firestore.collection('feeInvoices').doc(invoiceId);

    await firestore.runTransaction(async (transaction) => {
      const [eventSnap, paymentSnap, invoiceSnap] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(paymentRef),
        transaction.get(invoiceRef),
      ]);
      if (eventSnap.exists) return;

      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      if (!invoiceSnap.exists) {
        transaction.set(eventRef, {
          eventId: event.id,
          eventType: event.type,
          invoiceId,
          ignored: true,
          reason: 'invoice_not_found',
          receivedAt: timestamp,
        });
        return;
      }

      const invoice = invoiceSnap.data() || {};
      if (
        (paymentData.metadata.instituteId && paymentData.metadata.instituteId !== invoice.instituteId) ||
        (paymentData.metadata.studentUid && paymentData.metadata.studentUid !== invoice.studentUid)
      ) {
        throw new Error('Stripe payment metadata does not match the invoice.');
      }

      if (paymentSnap.exists) {
        transaction.set(eventRef, {
          eventId: event.id,
          eventType: event.type,
          invoiceId,
          paymentId: paymentRef.id,
          duplicate: true,
          receivedAt: timestamp,
        });
        return;
      }

      const paidMinor = Math.min(
        Number(paymentData.amountMinor || 0),
        Number(invoice.balanceAmountMinor || invoice.amountMinor || 0)
      );
      if (paidMinor <= 0) {
        transaction.set(eventRef, {
          eventId: event.id,
          eventType: event.type,
          invoiceId,
          ignored: true,
          reason: 'invoice_has_no_balance',
          receivedAt: timestamp,
        });
        return;
      }

      const paidAmount = Math.round(paidMinor) / 100;
      const newPaidMinor = Number(invoice.paidAmountMinor || 0) + paidMinor;
      const newPaidAmount = Math.round(newPaidMinor) / 100;
      const remainingMinor = Math.max(0, Number(invoice.amountMinor || 0) - newPaidMinor);

      transaction.set(paymentRef, {
        uid: paymentData.metadata.actorUid || invoice.studentUid,
        studentUid: invoice.studentUid,
        instituteId: invoice.instituteId,
        invoiceId,
        structureId: invoice.structureId || null,
        provider: 'stripe',
        providerEventId: event.id,
        paymentIntentId: paymentData.paymentIntentId,
        checkoutSessionId: paymentData.checkoutSessionId,
        amount: paidAmount,
        amountMinor: paidMinor,
        currency: String(paymentData.currency || invoice.currency || 'INR').toUpperCase(),
        status: 'paid',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      transaction.set(eventRef, {
        eventId: event.id,
        eventType: event.type,
        invoiceId,
        paymentId: paymentRef.id,
        receivedAt: timestamp,
      });
      transaction.update(invoiceRef, {
        paidAmount: newPaidAmount,
        paidAmountMinor: newPaidMinor,
        balanceAmount: Math.round(remainingMinor) / 100,
        balanceAmountMinor: remainingMinor,
        status: remainingMinor === 0 ? 'paid' : 'partially_paid',
        paidAt: timestamp,
        paymentIntentId: paymentData.paymentIntentId,
        checkoutSessionId: paymentData.checkoutSessionId,
        updatedAt: timestamp,
      });
      transaction.update(firestore.collection('users').doc(invoice.studentUid), {
        feePaid: admin.firestore.FieldValue.increment(paidAmount),
        updatedAt: timestamp,
      });
      transaction.set(firestore.collection('notifications').doc(), {
        instituteId: invoice.instituteId,
        title: 'Fee payment received',
        message: `${String(invoice.currency || 'INR').toUpperCase()} ${paidAmount.toLocaleString()} was received for ${invoice.title || 'your fee invoice'}.`,
        type: 'success',
        targetRoles: ['student', 'parent'],
        recipientUids: [invoice.studentUid],
        relatedId: invoiceId,
        relatedType: 'fee_invoice',
        author: 'Edu-Hub Payments',
        data: {
          originalType: 'fee_payment_received',
          invoiceId,
        },
        isRead: false,
        readBy: [],
        createdAt: timestamp,
      });
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook failed:', error);
    res.status(400).json({ received: false });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
