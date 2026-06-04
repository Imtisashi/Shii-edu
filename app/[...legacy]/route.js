import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const excludedFirstSegments = new Set([
  '_expo',
  '_next',
  'api',
  'assets',
  'favicon.ico',
  'metadata.json',
  'privacy',
  'robots.txt',
  'sitemap.xml',
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

  const html = await readFile(path.join(process.cwd(), 'public', 'expo-index.html'), 'utf8');

  return new Response(html, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
