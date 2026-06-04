import { FileCheck2 } from 'lucide-react';
import { legalJsonLd, legalUpdatedAt, termsSections } from '../lib/legal';
import { routeMetadata, SITE } from '../lib/site';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const description =
  'Edu-shii Terms of Service covering institute workspace access, uploads, payments, AI assistance, transport features, indemnity, and limitation of liability.';

export function generateMetadata() {
  return routeMetadata({
    description,
    path: '/terms',
    title: 'Terms of Service',
    type: 'article',
  });
}

export default function TermsPage() {
  const jsonLd = legalJsonLd({
    description,
    path: '/terms',
    title: 'Terms of Service',
    type: 'TermsOfService',
  });

  return (
    <main id="main" className="legal-page">
      <nav className="brand-lockup legal-nav" aria-label="Legal navigation">
        <img className="brand-mark" src="/assets/images/icon.png" alt="" width="40" height="40" />
        <a className="nav-link" href="/">
          Back to operations
        </a>
        <a className="nav-link" href="/privacy">
          Privacy Policy
        </a>
      </nav>

      <article className="legal-layout">
        <header className="legal-header">
          <span className="badge success">
            <FileCheck2 size={14} aria-hidden="true" />
            Last updated {legalUpdatedAt}
          </span>
          <h1>Terms of Service</h1>
          <p>{description}</p>
        </header>
        <div className="legal-body">
          {termsSections.map((section) => (
            <section className="legal-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </article>

      <p className="legal-footer">
        This document is provided for {SITE.name} operations and should be reviewed by qualified counsel before relying
        on it as legal advice.
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
