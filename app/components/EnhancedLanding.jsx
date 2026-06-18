'use client';

import { motion } from 'motion/react';
import { PremiumHero } from './ui/PremiumHero';
import LaunchEvidenceSlider from './ui/TestimonialSlider';
import AnimatedBackground from './ui/AnimatedBackground';
import LandingRoleExplorer from './LandingRoleExplorer';
import CinematicLandingStage from './CinematicLandingStage';
import PricingSection from '@/src/components/landing/PricingSection';
import { landingContent } from '@/src/data/landing';
import { ArrowRight } from 'lucide-react';

export default function EnhancedLanding() {
  return (
    <div className="landing-v2 enhanced-landing">
      <AnimatedBackground />
      
      <header className="enhanced-landing-nav">
        <a className="landing-brand" href="/">
          <svg height="40" viewBox="0 0 40 40" width="40" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#4f46e5" height="40" rx="8" width="40"/>
            <text dominantBaseline="central" fill="white" fontSize="20" fontWeight="bold" textAnchor="middle" x="20" y="20">S</text>
          </svg>
          <span>
            <strong className="nav-wordmark">
              <span className="shii-wordmark-major">S</span>
              <span className="shii-wordmark-rest">HII-EDU</span>
            </strong>
            <span>Institute operating system</span>
          </span>
        </a>
        
        <nav className="landing-links" aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#inside-app">Inside app</a>
        </nav>
        
        <a className="landing-login" href="/roles">
          Login
        </a>
      </header>

      <main>
        <PremiumHero />
        
        <section id="platform" className="landing-band workspace-band">
          <div className="landing-section-head">
            <svg fill="none" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <div>
              <h2>A role-scoped workspace for daily campus operations.</h2>
              <p>
                Attendance, notices, fees, transport, files, and people records in one operator surface.
                Each role stays focused on their own work.
              </p>
            </div>
          </div>
          
          <div className="landing-command-strip">
            {[
              { value: '3', label: 'role apps' },
              { value: '5', label: 'platform modules' },
              { value: '1', label: 'Max AI tier' },
              { value: '24/7', label: 'system status' },
            ].map((stat) => (
              <span key={stat.label}>
                <strong>{stat.value}</strong>
                <em>{stat.label}</em>
              </span>
            ))}
          </div>
        </section>

        <CinematicLandingStage />

        <section id="features" className="landing-band features-band">
          <div className="landing-section-head">
            <svg fill="none" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <h2>Everything institutes need after launch.</h2>
              <p>
                A complete set of modules for academics, finance, transport, parent support, and bounded AI tools.
              </p>
            </div>
          </div>
          
          <div className="feature-map">
            {[
              { title: 'Academic workflow', desc: 'Routines, attendance, assignments, grades, reports, courses, and learning files.', icon: 'book' },
              { title: 'Finance workflow', desc: 'Bulk fee allocation, offline payment marking, payroll, receipts, and ledgers.', icon: 'card' },
              { title: 'Map transport', desc: 'Coordinates, assigned drivers, parent route views, and simple driver screens.', icon: 'map' },
              { title: 'Parent support', desc: 'Simple parent app with office fallback for families who need assisted rollout.', icon: 'users' },
              { title: 'AI reports', desc: 'Bounded Max agent for approved reports and exports, not open-ended database access.', icon: 'spark' },
              { title: 'Role apps', desc: 'Admin, teacher, student, parent, and driver interfaces stay focused on their own work.', icon: 'shield' },
            ].map((feature) => (
              <div className="feature-cluster" key={feature.title}>
                <div className="feature-cluster-head">
                  <svg fill="none" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="20">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <h3>{feature.title}</h3>
                </div>
                <p style={{ color: '#3f4054', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="inside-app" className="landing-band explorer-band">
          <div className="landing-section-head">
            <svg fill="none" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            <div>
              <h2>Different roles deserve different software.</h2>
              <p>
                A useful institute platform does not flatten every person into the same dashboard.
                It gives each role the shortest responsible path to the work they need to finish.
              </p>
            </div>
          </div>
          <LandingRoleExplorer />
        </section>

        <section className="landing-band proof-band">
          <div className="landing-section-head">
            <svg fill="none" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <h2>Verified product, not brochure-only presentation.</h2>
              <p>
                Feature access is tied to institute settings and enforced from server routes
                where sensitive work happens.
              </p>
            </div>
          </div>
          
          <div className="proof-grid">
            {[
              { icon: 'shield', title: 'Subscription gates are not decorative', body: 'Feature access is tied to institute settings and enforced from server routes.' },
              { icon: 'receipt', title: 'Finance is built for real office work', body: 'Fee allocation supports cohorts first, then individual corrections.' },
              { icon: 'route', title: 'Transport has a shared route record', body: 'Route assignment stores map points, labels, driver links, and visibility.' },
              { icon: 'spark', title: 'AI has guardrails', body: 'The Max agent uses approved report tools, rate limits, and audit logs.' },
            ].map((proof) => (
              <div className="proof-card" key={proof.title}>
                <span>{proof.icon}</span>
                <h3>{proof.title}</h3>
                <p>{proof.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-band">
          <div className="landing-section-head">
            <svg fill="none" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <h2>Launch checks that matter.</h2>
              <p>Only verified platform behavior is shown here; customer proof can be added after real consented references exist.</p>
            </div>
          </div>
          <LaunchEvidenceSlider />
        </section>

        <section id="pricing" className="landing-band pricing-band">
          <PricingSection
            comparison={landingContent.pricing.comparison}
            contactHref="mailto:sashimiofficials@gmail.com?subject=Institute%20onboarding%20request"
            note={landingContent.pricing.note}
            plans={landingContent.pricing.plans}
          />
        </section>

        <section className="premium-cta">
          <div className="premium-cta-bg" aria-hidden="true">
            <div className="premium-cta-glow premium-cta-glow-1" />
            <div className="premium-cta-glow premium-cta-glow-2" />
          </div>

          <div className="premium-cta-content">
            <h2 className="premium-cta-title">
              Ready to transform your institute operations?
            </h2>
            <p className="premium-cta-description">
              Start with a verified institute onboarding flow, role-specific apps, and clear
              support handoff before adding public customer claims.
            </p>

            <div className="premium-cta-actions">
              <motion.a
                className="premium-cta-btn-primary"
                href="/roles"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                Choose role
                <ArrowRight size={20} />
              </motion.a>

              <motion.a
                className="premium-cta-btn-secondary"
                href="mailto:sashimiofficials@gmail.com?subject=Shii-Edu%20institute%20demo"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                Schedule a demo
              </motion.a>
            </div>

            <div className="premium-cta-contact">
              <span>Questions? Contact us at</span>
              <a href="mailto:sashimiofficials@gmail.com" className="premium-cta-email">
                sashimiofficials@gmail.com
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-brand">
            <span className="shii-wordmark">
              <span className="shii-wordmark-major">S</span>
              <span className="shii-wordmark-rest">HII-EDU</span>
            </span>
            <p>The campus operating system for every role.</p>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-column">
              <strong>Product</strong>
              <a href="#platform">Platform</a>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="landing-footer-column">
              <strong>Access</strong>
              <a href="/roles">Choose role</a>
              <a href="/auth/institute">Institute login</a>
              <a href="/auth/parents">Parents login</a>
            </div>
            <div className="landing-footer-column">
              <strong>Legal</strong>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>Built for serious institute operations.</p>
        </div>
      </footer>
    </div>
  );
}
