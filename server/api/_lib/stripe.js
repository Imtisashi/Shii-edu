const Stripe = require('stripe');

let stripeClient = null;

const getStripeConfig = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !publishableKey) {
    const error = new Error('Stripe payments are not configured.');
    error.statusCode = 503;
    throw error;
  }

  return {
    publishableKey,
    secretKey,
    webhookSecret,
  };
};

const getStripeClient = () => {
  const config = getStripeConfig();
  if (!stripeClient) {
    stripeClient = new Stripe(config.secretKey, {
      appInfo: {
        name: 'Edu-Hub alpha',
        version: '1.0.0',
      },
    });
  }
  return {
    config,
    stripe: stripeClient,
  };
};

const trustedReturnUrl = (req, requestedUrl) => {
  const origin = req.headers.origin;
  const fallbackOrigin = origin && /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)
    ? origin
    : 'https://shii-edu.vercel.app';
  if (!requestedUrl) return `${fallbackOrigin}/Fee%20Payment`;

  try {
    const parsed = new URL(requestedUrl);
    const fallback = new URL(fallbackOrigin);
    if (parsed.origin !== fallback.origin) return `${fallbackOrigin}/Fee%20Payment`;
    return parsed.toString();
  } catch (_error) {
    return `${fallbackOrigin}/Fee%20Payment`;
  }
};

module.exports = {
  getStripeClient,
  getStripeConfig,
  trustedReturnUrl,
};
