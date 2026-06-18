import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const roleShellMetadata = [
  {
    appleTitle: 'Institute',
    manifest: '/manifest-institute.webmanifest',
    paths: ['/app/institute', '/auth/institute'],
    title: 'Shii-Edu Institute',
  },
  {
    appleTitle: 'Parents',
    manifest: '/manifest-parents.webmanifest',
    paths: ['/app/parents', '/auth/parents'],
    title: 'Shii-Edu Parents',
  },
  {
    appleTitle: 'Driver',
    manifest: '/manifest-driver.webmanifest',
    paths: ['/app/driver', '/auth/driver'],
    title: 'Shii-Edu Driver',
  },
  {
    appleTitle: 'Superadmin',
    manifest: '/manifest-superadmin.webmanifest',
    paths: ['/app/superadmin'],
    title: 'Shii-Edu Superadmin',
  },
];

const normalizeLegacyPath = (legacyPath = []) => {
  const pathname = `/${legacyPath.filter(Boolean).join('/')}`;
  return pathname.replace(/\/+$/, '') || '/';
};

export const resolveLegacyShellMetadata = (legacyPath = []) => {
  const pathname = normalizeLegacyPath(legacyPath);
  return roleShellMetadata.find((item) => (
    item.paths.some((scope) => pathname === scope || pathname.startsWith(`${scope}/`))
  ));
};

const applyLegacyShellMetadata = (html, metadata) => {
  if (!metadata) return html;

  const titleTag = `<title>${metadata.title}</title>`;
  let next = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, titleTag)
    : html.replace('</head>', `  ${titleTag}\n</head>`);

  const manifestTag = `<link rel="manifest" href="${metadata.manifest}" />`;
  next = /<link\s+rel=["']manifest["'][^>]*>/i.test(next)
    ? next.replace(/<link\s+rel=["']manifest["'][^>]*>/i, manifestTag)
    : next.replace('</head>', `  ${manifestTag}\n</head>`);

  next = next.replace(
    /<meta name="apple-mobile-web-app-title" content="[^"]*" \/>/i,
    `<meta name="apple-mobile-web-app-title" content="${metadata.appleTitle}" />`
  );

  return next;
};

const excludedFirstSegments = new Set([
  '_expo',
  '_next',
  'api',
  'assets',
  'downloads',
  'favicon.ico',
  'manifest-driver.webmanifest',
  'manifest-institute.webmanifest',
  'manifest-parents.webmanifest',
  'manifest-superadmin.webmanifest',
  'manifest.webmanifest',
  'metadata.json',
  'privacy',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
  'terms',
]);

export async function GET(_request, { params }) {
  const resolvedParams = await params;
  const legacyPath = Array.isArray(resolvedParams?.legacy) ? resolvedParams.legacy : [];
  const firstSegment = legacyPath[0] || '';

  if (excludedFirstSegments.has(firstSegment)) {
    return new Response('Not found', {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      status: 404,
    });
  }

  let html;

  try {
    html = await readFile(path.join(process.cwd(), 'public', 'expo-index.html'), 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }

    return new Response(
      '<!doctype html><html><head><title>Shii-Edu app shell unavailable</title></head><body><main style="font-family:system-ui,sans-serif;max-width:680px;margin:64px auto;padding:24px;line-height:1.5"><h1>Shii-Edu app shell is not built yet.</h1><p>Run the web build or sync step, then refresh this page.</p></main></body></html>',
      {
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/html; charset=utf-8',
        },
        status: 503,
      }
    );
  }

  const metadata = resolveLegacyShellMetadata(legacyPath);

  return new Response(applyLegacyShellMetadata(html, metadata), {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
