const routes = new Map([
  ['admin/branding', require('../server/api/admin/branding')],
  ['admin/fees/assign', require('../server/api/admin/fees/assign')],
  ['admin/fees/record-payment', require('../server/api/admin/fees/record-payment')],
  ['admin/users', require('../server/api/admin/users')],
  ['admin/users/bulk', require('../server/api/admin/users/bulk')],
  ['ai', require('../server/api/ai')],
  ['ai/csv-map', require('../server/api/ai/csv-map')],
  ['ai/substitute-schedule', require('../server/api/ai/substitute-schedule')],
  ['ai/syllabus-ingest', require('../server/api/ai/syllabus-ingest')],
  ['auth/institute-claims', require('../server/api/auth/institute-claims')],
  ['auth/password-reset', require('../server/api/auth/password-reset')],
  ['cloudinary/signature', require('../server/api/cloudinary/signature')],
  ['cron/proactive-warnings', require('../server/api/cron/proactive-warnings')],
  ['messages', require('../server/api/messages')],
  ['media/upload-signature', require('../server/api/media/upload-signature')],
  ['payments/create-intent', require('../server/api/payments/create-intent')],
  ['payments/stripe-webhook', require('../server/api/payments/stripe-webhook')],
  ['super-admin/institutes', require('../server/api/super-admin/institutes')],
  ['tasks/process', require('../server/api/tasks/process')],
  ['institute/faculty', require('../server/api/institute/faculty')],
  ['legal/privacy', require('../server/api/legal/privacy')],
  ['legal/robots', require('../server/api/legal/robots')],
  ['legal/sitemap', require('../server/api/legal/sitemap')],
  ['legal/terms', require('../server/api/legal/terms')],
]);

const instituteByIdHandler = require('../server/api/super-admin/institutes/[instituteId]');

const normalizeRoute = (route) => {
  if (Array.isArray(route)) return route.join('/');
  return String(route || '')
    .split('/')
    .filter(Boolean)
    .join('/');
};

module.exports = async function handler(req, res) {
  const route = normalizeRoute(req.query?.route);
  const institutePrefix = 'super-admin/institutes/';

  if (route.startsWith(institutePrefix)) {
    req.query.instituteId = route.slice(institutePrefix.length);
    return instituteByIdHandler(req, res);
  }

  const routeHandler = routes.get(route);
  if (!routeHandler) {
    res.status(404).json({ success: false, error: 'API route not found.' });
    return;
  }

  return routeHandler(req, res);
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
