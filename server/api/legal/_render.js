const SITE_NAME = 'Edu-shii';
const DEFAULT_ORIGIN = 'https://shii-edu.vercel.app';
const UPDATED_AT = '2026-06-04';

const resolveOrigin = (req) => {
  const configured = String(process.env.APP_ORIGIN || '')
    .split(',')
    .map((item) => item.trim())
    .find((item) => /^https:\/\/.+/i.test(item));

  if (configured) return configured.replace(/\/+$/, '');

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${host}`.replace(/\/+$/, '');
  }

  return DEFAULT_ORIGIN;
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const renderDocument = ({
  description,
  jsonLd,
  origin,
  path,
  sections,
  title,
}) => {
  const canonicalUrl = `${origin}${path}`;
  const sectionHtml = sections.map((section) => `
        <section class="legal-section" aria-labelledby="${escapeHtml(section.id)}">
          <h2 id="${escapeHtml(section.id)}">${escapeHtml(section.title)}</h2>
          ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n          ')}
        </section>`).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | ${SITE_NAME}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(title)} | ${SITE_NAME}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(`${origin}/assets/icon.png`)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      :root {
        color-scheme: light;
        --bg: #f8fafc;
        --border: #cbd5e1;
        --ink: #0f172a;
        --muted: #475569;
        --panel: #ffffff;
        --primary: #1d4ed8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        line-height: 1.55;
      }
      .shell {
        margin: 0 auto;
        max-width: 960px;
        padding: 32px 20px 48px;
      }
      nav {
        align-items: center;
        border: 1px solid var(--border);
        background: var(--panel);
        display: flex;
        justify-content: space-between;
        margin-bottom: 24px;
        padding: 12px 16px;
      }
      nav a {
        color: var(--primary);
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
      }
      main {
        background: var(--panel);
        border: 1px solid var(--border);
        padding: 28px;
      }
      header {
        border-bottom: 1px solid var(--border);
        margin-bottom: 24px;
        padding-bottom: 20px;
      }
      h1 {
        font-size: clamp(30px, 4vw, 44px);
        letter-spacing: 0;
        line-height: 1.12;
        margin: 0;
      }
      .updated {
        color: var(--muted);
        font-size: 14px;
        font-weight: 700;
        margin-top: 12px;
      }
      h2 {
        font-size: 20px;
        line-height: 1.25;
        margin: 28px 0 8px;
      }
      p {
        color: var(--muted);
        font-size: 16px;
        margin: 0 0 12px;
      }
      footer {
        color: var(--muted);
        font-size: 13px;
        margin-top: 18px;
      }
      @media (max-width: 640px) {
        .shell { padding: 16px 12px 32px; }
        main { padding: 18px; }
        nav { align-items: flex-start; flex-direction: column; gap: 8px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <nav aria-label="Legal navigation">
        <strong>${SITE_NAME}</strong>
        <div>
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms">Terms of Service</a>
        </div>
      </nav>
      <main>
        <article>
          <header>
            <h1>${escapeHtml(title)}</h1>
            <div class="updated">Last updated: ${UPDATED_AT}</div>
          </header>
${sectionHtml}
        </article>
      </main>
      <footer>
        These documents are generated for the Edu-shii service and should be reviewed by qualified counsel before relying on them as legal advice.
      </footer>
    </div>
  </body>
</html>`;
};

const sendHtml = (res, html) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};

module.exports = {
  SITE_NAME,
  UPDATED_AT,
  renderDocument,
  resolveOrigin,
  sendHtml,
};
