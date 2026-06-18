import { SITE } from './lib/site';

export default function sitemap() {
  return ['/', '/privacy', '/terms', '/roles'].map((path) => ({
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    lastModified: new Date(SITE.updatedAt),
    priority: path === '/' ? 1 : path === '/roles' ? 0.9 : 0.8,
    url: `${SITE.origin}${path}`,
  }));
}
