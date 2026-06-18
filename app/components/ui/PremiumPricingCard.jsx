'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from './MotionComponents';

export function PremiumPricingCard({
  title,
  price,
  period = 'month',
  description,
  features = [],
  isRecommended = false,
  accentColor = '#4f46e5',
  delay = 0,
}) {
  return (
    <FadeIn delay={delay}>
      <motion.div
        className={`premium-pricing-card ${isRecommended ? 'recommended' : ''}`}
        style={{ '--accent': accentColor }}
        whileHover={{ y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {isRecommended && (
          <div className="premium-pricing-badge">Recommended</div>
        )}

        <div className="premium-pricing-header">
          <h3 className="premium-pricing-title">{title}</h3>
          <p className="premium-pricing-description">{description}</p>
        </div>

        <div className="premium-pricing-price">
          <span className="price-currency">$</span>
          <span className="price-amount">{price}</span>
          <span className="price-period">/{period}</span>
        </div>

        <ul className="premium-pricing-features">
          {features.map((feature, index) => (
            <li key={index} className="premium-pricing-feature">
              <Check size={18} className="feature-check" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <motion.button
          className={`premium-pricing-cta ${isRecommended ? 'primary' : 'secondary'}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Get Started
        </motion.button>
      </motion.div>
    </FadeIn>
  );
}

export function PremiumPricingGrid({ plans = [] }) {
  return (
    <StaggerContainer className="premium-pricing-grid" staggerDelay={0.1}>
      {plans.map((plan, index) => (
        <StaggerItem key={plan.title}>
          <PremiumPricingCard {...plan} delay={index * 0.1} />
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}