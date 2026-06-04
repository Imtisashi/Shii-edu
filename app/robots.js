import { SITE } from './lib/site';

export default function robots() {
  return {
    host: SITE.origin,
    rules: {
      allow: ['/', '/privacy', '/terms'],
      disallow: ['/api/'],
      userAgent: '*',
    },
    sitemap: `${SITE.origin}/sitemap.xml`,
  };
}
