'use client';

'use client';

import { landingContent } from '../../data/landing';
import ExpandableFeatureCards from './ExpandableFeatureCards';
import Footer from './Footer';
import FutureOfWorkSection from './FutureOfWorkSection';
import HeroSection from './HeroSection';
import LogoCloud from './LogoCloud';
import Navbar from './Navbar';
import TracingBeam from './TracingBeam';
import FinalCTA from './FinalCTA';
import dynamic from 'next/dynamic';

const FeatureTabs = dynamic(() => import('./FeatureTabs'), {
  loading: () => (
    <div className="tl-loading-skeleton" style={{ padding: '40px 20px' }}>
      <div className="tl-skeleton-title" style={{ width: '60%', height: '2rem' }}></div>
      <div className="tl-skeleton-paragraph" style={{ width: '80%', height: '1rem', marginBottom: '0.5rem' }}></div>
      <div className="tl-skeleton-paragraph" style={{ width: '60%', height: '1rem', marginBottom: '0.5rem' }}></div>
      <div className="tl-skeleton-paragraph" style={{ width: '70%', height: '1rem', marginBottom: '0.5rem' }}></div>
    </div>
  ),
  ssr: false,
});

const PricingSection = dynamic(() => import('./PricingSection'), {
  loading: () => (
    <div className="tl-loading-skeleton" style={{ padding: '40px 20px' }}>
      <div className="tl-skeleton-title" style={{ width: '50%', height: '2rem' }}></div>
      <div className="tl-skeleton-paragraph" style={{ width: '70%', height: '1rem', marginBottom: '1rem' }}></div>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {[1, 2, 3].map((col) => (
          <div key={col} className="tl-loading-skeleton" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div className="tl-skeleton-text" style={{ width: '40%', height: '1.5rem' }}></div>
            <div className="tl-skeleton-text" style={{ width: '60%', height: '1rem' }}></div>
            <div className="tl-skeleton-text" style={{ width: '50%', height: '1rem' }}></div>
            <div className="tl-skeleton-text" style={{ width: '70%', height: '1rem' }}></div>
          </div>
        ))}
      </div>
    </div>
  ),
  ssr: false,
});

const EnterpriseProofSection = dynamic(() => import('./EnterpriseProofSection'), {
  loading: () => (
    <div className="tl-loading-skeleton" style={{ padding: '40px 20px' }}>
      <div className="tl-skeleton-title" style={{ width: '50%', height: '2rem' }}></div>
      <div className="tl-skeleton-paragraph" style={{ width: '70%', height: '1rem', marginBottom: '1.5rem' }}></div>
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {[1, 2, 3].map((item) => (
          <div key={item} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="tl-skeleton-icon" style={{ width: '3rem', height: '3rem' }}></div>
            <div className="tl-skeleton-title" style={{ width: '80%', height: '1.5rem' }}></div>
            <div className="tl-skeleton-paragraph" style={{ width: '100%', height: '1rem' }}></div>
          </div>
        ))}
      </div>
    </div>
  ),
  ssr: false,
});

const ResourcesSection = dynamic(() => import('./ResourcesSection'), {
  loading: () => (
    <div className="tl-loading-skeleton" style={{ padding: '40px 20px' }}>
      <div className="tl-skeleton-title" style={{ width: '50%', height: '2rem' }}></div>
      <div className="tl-skeleton-paragraph" style={{ width: '70%', height: '1rem', marginBottom: '1.5rem' }}></div>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="tl-loading-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="tl-skeleton-text" style={{ width: '50%', height: '1rem' }}></div>
            <div className="tl-skeleton-text" style={{ width: '70%', height: '1rem' }}></div>
            <div className="tl-skeleton-paragraph" style={{ width: '100%', height: '1.5rem' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="tl-skeleton-text" style={{ width: '40%', height: '0.75rem' }}></div>
              <div className="tl-skeleton-text" style={{ width: '30%', height: '0.75rem' }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  ssr: false,
});

export default function LandingPage() {
  return (
    <div className="thrive-landing">
      <Navbar contactHref={landingContent.hero.contactCta.href} navItems={landingContent.nav} />
      <main id="main">
        <HeroSection hero={landingContent.hero} mockup={landingContent.mockup} />
        <LogoCloud logos={landingContent.logos} />
        <TracingBeam>
          <section className="tl-section tl-platform-section" id="platform" aria-labelledby="platform-title">
            <div className="tl-container tl-platform-grid">
              <div className="tl-section-heading tl-platform-heading">
                <span className="tl-eyebrow">Platform</span>
                <h2 id="platform-title">One operating layer, five focused role apps.</h2>
                <p>
                  Shii-Edu keeps the institute record shared while each role sees a narrower, faster surface for the work
                  they actually perform.
                </p>
              </div>
              <div className="tl-platform-panel">
                <span>Daily operating loop</span>
                <div className="tl-platform-loop" aria-label="Campus workflow loop">
                  <strong>Plan</strong>
                  <strong>Teach</strong>
                  <strong>Collect</strong>
                  <strong>Move</strong>
                  <strong>Review</strong>
                </div>
              </div>
            </div>
          </section>
          <div className="dynamic-component">
            <FeatureTabs features={landingContent.features} />
          </div>
          <section className="tl-section tl-inside-app-section" id="inside-app" aria-labelledby="inside-app-title">
            <div className="tl-container">
              <div className="tl-section-heading tl-inside-heading">
                <span className="tl-eyebrow">Inside the app</span>
                <h2 id="inside-app-title">Role previews with product-shaped demos.</h2>
                <p>
                  Open a role card to see the kind of workflow each app is built around: admin reports, teacher roster
                  work, parent help, and driver routes.
                </p>
              </div>
              <ExpandableFeatureCards cards={landingContent.uiFeatureCards} />
            </div>
          </section>
          <div className="dynamic-component">
            <PricingSection
              comparison={landingContent.pricing.comparison}
              contactHref={landingContent.hero.contactCta.href}
              note={landingContent.pricing.note}
              plans={landingContent.pricing.plans}
            />
          </div>
          <div className="dynamic-component">
            <EnterpriseProofSection cards={landingContent.proofCards} />
          </div>
          <FutureOfWorkSection editorial={landingContent.editorial} />
          <div className="dynamic-component">
            <ResourcesSection resources={landingContent.resources} />
          </div>
        </TracingBeam>
        <FinalCTA contact={landingContent.hero.contactCta} primary={landingContent.hero.primaryCta} />
      </main>
      <Footer footer={landingContent.footer} />
    </div>
  );
}
