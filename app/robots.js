import { SITE } from './lib/site';

export default function robots() {
  return {
    host: SITE.origin,
    rules: {
      allow: ['/', '/privacy', '/terms', '/roles', '/llm.txt'],
      disallow: ['/api/', '/app/'],
      userAgent: '*',
    },
    sitemap: `${SITE.origin}/sitemap.xml`,
    other: `Llms-txt: ${SITE.origin}/llm.txt`,
  };
}
