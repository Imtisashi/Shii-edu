import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const require = createRequire(import.meta.url);

const routeHandlers = new Map([
  ['admin/branding', () => require('../../../server/api/admin/branding')],
  ['admin/agent', () => require('../../../server/api/admin/agent')],
  ['admin/fees/assign', () => require('../../../server/api/admin/fees/assign')],
  ['admin/fees/record-payment', () => require('../../../server/api/admin/fees/record-payment')],
  ['admin/custom-subdomain', () => require('../../../server/api/admin/custom-subdomain')],
  ['admin/payroll/run', () => require('../../../server/api/admin/payroll/run')],
  ['admin/users', () => require('../../../server/api/admin/users')],
  ['admin/users/bulk', () => require('../../../server/api/admin/users/bulk')],
  ['ai', () => require('../../../server/api/ai')],
  ['ai/csv-map', () => require('../../../server/api/ai/csv-map')],
  ['ai/substitute-schedule', () => require('../../../server/api/ai/substitute-schedule')],
  ['ai/syllabus-ingest', () => require('../../../server/api/ai/syllabus-ingest')],
  ['auth/institute-claims', () => require('../../../server/api/auth/institute-claims')],
  ['auth/password-reset', () => require('../../../server/api/auth/password-reset')],
  ['cloudinary/signature', () => require('../../../server/api/cloudinary/signature')],
  ['cron/proactive-warnings', () => require('../../../server/api/cron/proactive-warnings')],
  ['institute/faculty', () => require('../../../server/api/institute/faculty')],
  ['legal/privacy', () => require('../../../server/api/legal/privacy')],
  ['legal/robots', () => require('../../../server/api/legal/robots')],
  ['legal/sitemap', () => require('../../../server/api/legal/sitemap')],
  ['legal/terms', () => require('../../../server/api/legal/terms')],
  ['media/upload-signature', () => require('../../../server/api/media/upload-signature')],
  ['messages', () => require('../../../server/api/messages')],
  ['notifications/web-push-subscriptions', () => require('../../../server/api/notifications/web-push-subscriptions')],
  ['payments/create-intent', () => require('../../../server/api/payments/create-intent')],
  ['payments/stripe-webhook', () => require('../../../server/api/payments/stripe-webhook')],
  ['super-admin/institutes', () => require('../../../server/api/super-admin/institutes')],
  ['tasks/process', () => require('../../../server/api/tasks/process')],
]);

const institutePrefix = 'super-admin/institutes/';

class ApiRouteResponse {
  constructor() {
    this.body = '';
    this.headers = new Headers();
    this.statusCode = 200;
  }

  end(value = '') {
    this.body = value || '';
    return this;
  }

  json(value) {
    this.headers.set('Content-Type', 'application/json; charset=utf-8');
    this.body = JSON.stringify(value ?? {});
    return this;
  }

  setHeader(name, value) {
    this.headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  toResponse() {
    const body = this.statusCode === 204 || this.statusCode === 304 ? null : this.body;
    return new Response(body, {
      headers: this.headers,
      status: this.statusCode,
    });
  }
}

const readBody = async (request, route) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return {};
  }

  if (route === 'payments/stripe-webhook') {
    return Buffer.from(await request.arrayBuffer());
  }

  const text = await request.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
};

const toHeaderObject = (headers) => {
  const output = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
};

const invokeApiRoute = async (request, context) => {
  const resolvedParams = await context.params;
  const routeSegments = Array.isArray(resolvedParams?.route) ? resolvedParams.route : [];
  const route = routeSegments.join('/');
  const requestUrl = new URL(request.url);
  const req = {
    body: await readBody(request, route),
    headers: toHeaderObject(request.headers),
    method: request.method,
    query: { route: routeSegments },
    socket: {
      remoteAddress: request.headers.get('x-forwarded-for') || 'app-router',
    },
    url: `${requestUrl.pathname}${requestUrl.search}`,
  };
  const res = new ApiRouteResponse();
  let apiHandlerFactory = routeHandlers.get(route);
  if (!apiHandlerFactory && route.startsWith(institutePrefix)) {
    req.query.instituteId = route.slice(institutePrefix.length);
    apiHandlerFactory = () => require('../../../server/api/super-admin/institutes/[instituteId]');
  }

  if (!apiHandlerFactory) {
    return Response.json({ success: false, error: 'API route not found.' }, { status: 404 });
  }

  const apiHandler = apiHandlerFactory();

  await apiHandler(req, res);
  return res.toResponse();
};

export const DELETE = invokeApiRoute;
export const GET = invokeApiRoute;
export const OPTIONS = invokeApiRoute;
export const PATCH = invokeApiRoute;
export const POST = invokeApiRoute;
export const PUT = invokeApiRoute;
