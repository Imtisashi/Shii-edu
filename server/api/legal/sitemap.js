const { UPDATED_AT, resolveOrigin } = require('./_render');

module.exports = async function sitemap(req, res) {
  const origin = resolveOrigin(req);
  const routes = ['/', '/Login', '/TenantLogin', '/privacy', '/terms'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url>
    <loc>${origin}${route}</loc>
    <lastmod>${UPDATED_AT}</lastmod>
    <changefreq>${route === '/' ? 'daily' : 'monthly'}</changefreq>
    <priority>${route === '/' ? '1.0' : '0.7'}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(200).send(body);
};
