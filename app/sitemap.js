import { SITE } from './lib/site';

export default function sitemap() {
  return ['/', '/privacy', '/terms'].map((path) => ({
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    lastModified: new Date(SITE.updatedAt),
    priority: path === '/' ? 1 : 0.8,
    url: `${SITE.origin}${path}`,
  }));
}
