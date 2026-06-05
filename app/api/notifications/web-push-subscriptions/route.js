import { createRequire } from 'node:module';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const require = createRequire(import.meta.url);

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  'http://localhost:3064',
  'http://127.0.0.1:3064',
  'https://shii-edu.vercel.app',
];

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

const parseAllowedOrigins = () => {
  const configured = process.env.APP_ORIGIN || '';
  return [...DEFAULT_ALLOWED_ORIGINS, ...configured.split(',')]
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin, index, origins) => origins.indexOf(origin) === index);
};

const setCorsHeaders = (request, headers) => {
  const origin = request.headers.get('origin');
  const allowedOrigins = parseAllowedOrigins();
  const isVercelPreview = origin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

  if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export async function GET(request) {
  const { getVapidConfig } = require('../../../../server/api/_lib/webPush');
  const config = getVapidConfig();
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  setCorsHeaders(request, headers);

  return new Response(JSON.stringify({
    configured: config.configured,
    publicKey: config.publicKey || null,
    success: true,
  }), {
    headers,
    status: 200,
  });
}

export async function OPTIONS(request) {
  const headers = new Headers();
  setCorsHeaders(request, headers);
  return new Response(null, { headers, status: 204 });
}

export async function POST(request) {
  const apiHandler = require('../../../../server/api/notifications/web-push-subscriptions');
  const req = {
    body: await request.json().catch(() => ({})),
    headers: Object.fromEntries(request.headers.entries()),
    method: 'POST',
    query: {},
    socket: {
      remoteAddress: request.headers.get('x-forwarded-for') || 'app-router',
    },
    url: new URL(request.url).pathname,
  };
  const res = new ApiRouteResponse();

  await apiHandler(req, res);
  return res.toResponse();
}
