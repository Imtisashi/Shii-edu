const { createHash } = require('crypto');

const WEB_PUSH_COLLECTION = 'webPushSubscriptions';
const DEFAULT_CONTACT = 'mailto:sashimiofficials@gmail.com';

let configured = false;
let webPushClient = null;

const getWebPushClient = () => {
  if (!webPushClient) {
    webPushClient = require('web-push');
  }

  return webPushClient;
};

const getVapidConfig = () => {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY ||
    process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ||
    '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '';
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || DEFAULT_CONTACT;

  return {
    configured: Boolean(publicKey && privateKey),
    privateKey,
    publicKey,
    subject,
  };
};

const ensureConfigured = () => {
  const config = getVapidConfig();
  if (!config.configured) return false;

  if (!configured) {
    getWebPushClient().setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configured = true;
  }

  return true;
};

const hashEndpoint = (endpoint) => createHash('sha256').update(String(endpoint), 'utf8').digest('hex');

const normalizeWebPushSubscription = (subscription) => {
  if (!subscription || typeof subscription !== 'object') return null;
  const endpoint = String(subscription.endpoint || '').trim();
  const keys = subscription.keys || {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    expirationTime: subscription.expirationTime || null,
    keys: {
      auth,
      p256dh,
    },
  };
};

const safeNotificationPayload = ({
  body,
  data = {},
  tag = 'shii-edu-notification',
  title,
  url = '/',
}) => ({
  body: String(body || ''),
  data,
  icon: '/icon.png',
  tag,
  title: String(title || 'Shii-Edu'),
  url,
});

const sendWebPushToSubscriptions = async ({
  body,
  data = {},
  firestore = null,
  subscriptions = [],
  tag,
  title,
  url = '/',
}) => {
  if (!ensureConfigured()) return { sent: 0, skipped: 'not_configured' };

  const payload = JSON.stringify(safeNotificationPayload({ body, data, tag, title, url }));
  let sent = 0;

  await Promise.all(subscriptions.map(async (entry) => {
    const subscription = normalizeWebPushSubscription(entry.subscription || entry);
    if (!subscription) return;

    try {
      await getWebPushClient().sendNotification(subscription, payload, {
        TTL: 60 * 60 * 24,
      });
      sent += 1;
    } catch (error) {
      const statusCode = error.statusCode || error.status;
      if (firestore && entry.ref && (statusCode === 404 || statusCode === 410)) {
        await entry.ref.delete().catch(() => null);
        return;
      }

      console.warn('Web push delivery failed:', error?.message || error);
    }
  }));

  return { sent };
};

const sendWebPushToUsers = async ({
  body,
  data = {},
  firestore,
  instituteId,
  recipientUids,
  tag,
  title,
  url = '/',
}) => {
  if (!firestore || !instituteId || !Array.isArray(recipientUids) || recipientUids.length === 0) {
    return { sent: 0 };
  }

  if (!ensureConfigured()) return { sent: 0, skipped: 'not_configured' };

  const recipients = new Set(recipientUids);
  const snapshot = await firestore
    .collection(WEB_PUSH_COLLECTION)
    .where('instituteId', '==', instituteId)
    .get();
  const subscriptions = snapshot.docs
    .map((document) => ({ ref: document.ref, ...(document.data() || {}) }))
    .filter((entry) => recipients.has(entry.uid));

  return sendWebPushToSubscriptions({
    body,
    data,
    firestore,
    subscriptions,
    tag,
    title,
    url,
  });
};

module.exports = {
  WEB_PUSH_COLLECTION,
  getVapidConfig,
  hashEndpoint,
  normalizeWebPushSubscription,
  sendWebPushToSubscriptions,
  sendWebPushToUsers,
};
