import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const outputFileTracingRoot = fileURLToPath(new URL('.', import.meta.url));

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' mailto:",
  "manifest-src 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.gstatic.com https://www.googleapis.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://res.cloudinary.com https://api.stripe.com https://m.stripe.network https://*.stripe.com https://vitals.vercel-insights.com https://*.vercel-insights.com http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "media-src 'self' data: blob: https:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.firebaseapp.com https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const strictSecurityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), autoplay=(self), camera=(self), clipboard-read=(), clipboard-write=(self), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(self), picture-in-picture=(), publickey-credentials-get=(self), serial=(), sync-xhr=(), usb=(), xr-spatial-tracking=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
];

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  compress: true,
  outputFileTracingRoot,
  async headers() {
    return [
      {
        headers: strictSecurityHeaders,
        source: '/:path*',
      },
      {
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
          {
            key: 'Content-Disposition',
            value: 'attachment',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
        source: '/downloads/apk/:path*',
      },
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

// Bundle analyzer configuration
export default () => import('@next/bundle-analyzer').then(({ default: withBundleAnalyzer }) => {
  return withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
  })(nextConfig);
});
