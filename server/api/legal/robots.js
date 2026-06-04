const { resolveOrigin } = require('./_render');

module.exports = async function robots(req, res) {
  const origin = resolveOrigin(req);

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send([
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n'));
};
