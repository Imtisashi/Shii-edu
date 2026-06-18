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
} = require('../_lib/firebaseAdmin');
const { getStripeClient, trustedReturnUrl } = require('../_lib/stripe');
const { assertRateLimit } = require('../_lib/rateLimit');

const RequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(180).optional(),
  invoiceId: z.string().trim().min(1).max(300),
  platform: z.enum(['native', 'web']).default('native'),
  returnUrl: z.string().trim().max(1000).optional(),
}).strict();

const parseBody = (body) => {
  const result = RequestSchema.safeParse(body);
  if (result.success) return result.data;
  const error = new Error(result.error.issues[0]?.message || 'Invalid payment request.');
  error.statusCode = 400;
  throw error;
};

const canPayInvoice = (actor, invoice) => {
  if (actor.role === 'student') return invoice.studentUid === actor.uid;
  if (actor.role === 'parent') {
    const childUids = Array.isArray(actor.profile.childUids) ? actor.profile.childUids : [];
    return actor.profile.linkedStudentUid === invoice.studentUid || childUids.includes(invoice.studentUid);
  }
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
    const actor = await authenticateUserProfile(req, ['student', 'parent']);
    await assertRateLimit({ actor, req, scope: 'payments:create-intent', limit: 12, windowMs: 60 * 1000 });
    const { firestore } = getAdminServices();
    const body = parseBody(await getBody(req));
    const invoiceRef = firestore.collection('feeInvoices').doc(body.invoiceId);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      const error = new Error('Fee invoice not found.');
      error.statusCode = 404;
      throw error;
    }

    const invoice = invoiceSnap.data() || {};
    if (invoice.instituteId !== actor.profile.instituteId || !canPayInvoice(actor, invoice)) {
      const error = new Error('You do not have permission to pay this invoice.');
      error.statusCode = 403;
      throw error;
    }

    if (invoice.status === 'paid' || Number(invoice.balanceAmountMinor || 0) <= 0) {
      const error = new Error('This invoice is already paid.');
      error.statusCode = 400;
      throw error;
    }

    const { config, stripe } = getStripeClient();
    const amountMinor = Number(invoice.balanceAmountMinor || Math.round(Number(invoice.balanceAmount || invoice.amount || 0) * 100));
    const currency = String(invoice.currency || 'INR').toLowerCase();
    const idempotencyKey = body.idempotencyKey
      ? `shii-edu:${body.idempotencyKey}`
      : `shii-edu:${invoiceSnap.id}:${amountMinor}`;
    const orderId = `stripe_${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32)}`;
    const metadata = {
      app: 'shii-edu',
      orderId,
      invoiceId: invoiceSnap.id,
      instituteId: invoice.instituteId,
      studentUid: invoice.studentUid,
      actorUid: actor.uid,
    };
    let providerPayload;

    if (body.platform === 'web') {
      const returnUrl = trustedReturnUrl(req, body.returnUrl);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: invoice.title || 'Institute fee',
              description: invoice.description || undefined,
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        }],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}payment=cancelled`,
      }, { idempotencyKey });
      providerPayload = {
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
        paymentIntentId: session.payment_intent || null,
      };
    } else {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency,
        automatic_payment_methods: { enabled: true },
        description: invoice.title || 'Institute fee',
        metadata,
        receipt_email: actor.profile.email || undefined,
      }, { idempotencyKey });
      providerPayload = {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    }

    const orderRef = firestore.collection('paymentOrders').doc(orderId);
    await orderRef.set({
      idempotencyKey,
      uid: actor.uid,
      studentUid: invoice.studentUid,
      instituteId: invoice.instituteId,
      invoiceId: invoiceSnap.id,
      structureId: invoice.structureId || null,
      provider: 'stripe',
      platform: body.platform,
      amountMinor,
      currency: currency.toUpperCase(),
      status: 'pending',
      ...providerPayload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.status(200).json({
      success: true,
      orderId: orderRef.id,
      invoiceId: invoiceSnap.id,
      amountMinor,
      currency: currency.toUpperCase(),
      publishableKey: config.publishableKey,
      ...providerPayload,
      requestId,
    });
  } catch (error) {
    sendError(res, error, 'Payment session could not be created.', requestId);
  }
};
