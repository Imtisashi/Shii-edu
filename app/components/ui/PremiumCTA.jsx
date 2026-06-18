'use client';

import { motion } from 'motion/react';
import { FadeIn, StaggerContainer, StaggerItem } from './MotionComponents';
import { ArrowRight, Mail } from 'lucide-react';

export default function PremiumCTA() {
  return (
    <section className="premium-cta">
      <div className="premium-cta-bg" aria-hidden="true">
        <div className="premium-cta-glow premium-cta-glow-1" />
        <div className="premium-cta-glow premium-cta-glow-2" />
      </div>

      <div className="premium-cta-content">
        <FadeIn>
          <h2 className="premium-cta-title">
            Ready to transform your institute operations?
          </h2>
          <p className="premium-cta-description">
            Start with verified role access, institute onboarding, and support handoff before
            adding public customer claims.
          </p>
        </FadeIn>

        <StaggerContainer className="premium-cta-actions" staggerDelay={0.1}>
          <StaggerItem>
            <motion.a
              className="premium-cta-btn-primary"
              href="/roles"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Choose role
              <ArrowRight size={20} />
            </motion.a>
          </StaggerItem>
          <StaggerItem>
            <motion.a
              className="premium-cta-btn-secondary"
              href="mailto:sashimiofficials@gmail.com?subject=Shii-Edu%20institute%20demo"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <Mail size={18} />
              Schedule a demo
            </motion.a>
          </StaggerItem>
        </StaggerContainer>

        <FadeIn delay={0.3}>
          <div className="premium-cta-contact">
            <span>Questions? Contact us at</span>
            <a href="mailto:sashimiofficials@gmail.com" className="premium-cta-email">
              <Mail size={16} />
              sashimiofficials@gmail.com
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
