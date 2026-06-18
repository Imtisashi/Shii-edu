import { ShieldCheck } from 'lucide-react';
import { legalJsonLd, legalUpdatedAt, privacySections } from '../lib/legal';
import { routeMetadata, SITE } from '../lib/site';
import Image from 'next/image';

function BrandMark() {
  return (
    <Image src="/shii-edu-logo.png" alt="Shii Edu" width={160} height={50} style={{ objectFit: 'contain' }} />
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const description =
  'Shii-Edu Privacy Policy covering institute data, student records, payment metadata, India DPDP Act alignment, child-data minimization, and liability limits.';

export function generateMetadata() {
  return routeMetadata({
    description,
    path: '/privacy',
    title: 'Privacy Policy',
    type: 'article',
  });
}

export default function PrivacyPage() {
  const jsonLd = legalJsonLd({
    description,
    path: '/privacy',
    title: 'Privacy Policy',
    type: 'PrivacyPolicy',
  });

  return (
    <main id="main" className="legal-page">
      <nav className="brand-lockup legal-nav" aria-label="Legal navigation">
        <BrandMark className="brand-mark" />
        <a className="nav-link" href="/">
          Back to operations
        </a>
        <a className="nav-link" href="/terms">
          Terms of Service
        </a>
      </nav>

      <article className="legal-layout">
        <header className="legal-header">
          <span className="badge success">
            <ShieldCheck size={14} aria-hidden="true" />
            Last updated {legalUpdatedAt}
          </span>
          <h1>Privacy Policy</h1>
          <p>{description}</p>
        </header>
        <div className="legal-body">
          {privacySections.map((section) => (
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
