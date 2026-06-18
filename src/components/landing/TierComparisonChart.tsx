'use client';

import { useMemo } from 'react';
import {
  ShieldCheck,
  CalendarCheck2,
  CreditCard,
  Bell,
  MessageCircle,
  Truck,
  BookOpen,
  Brain,
  Zap,
  Settings,
  Activity,
  Wifi,
  Save,
  User,
  CheckCircle2
} from 'lucide-react';
import type { PricingComparisonRow, PricingPlan } from '../../data/landing';

const getIconForAspect = (aspect: string) => {
  const iconMap: Record<string, any> = {
    'Core role apps': ShieldCheck,
    'Attendance and routines': CalendarCheck2,
    'Fees and offline marking': CreditCard,
    'Parent support': Bell,
    'Messages': MessageCircle,
    'Transport': Truck,
    'Courses, media, and PYQ': BookOpen,
    'AI tools': Brain,
    'AI usage ceiling': Save,  // Using Save as alternative to Disk
    'Custom subdomain': Zap,
    'Rate-limit tier': Settings,
    'Best fit': Activity,
    'AI usage': Brain,
    'Custom subdomain/settings': Settings,
  };

  return iconMap[aspect] || User;  // Using User as alternative to Mens
};

type TierComparisonChartProps = {
  comparison: PricingComparisonRow[];
  plans: PricingPlan[];
};

export default function TierComparisonChart({
  comparison,
  plans
}: TierComparisonChartProps) {
  // Find the recommended plan (Pro has the 'Recommended' badge)
  const recommendedPlan = useMemo(() =>
    plans.find(plan => plan.badge === 'Recommended') || plans[1],
  [plans]);

  return (
    <section className="tl-section tl-tier-comparison-section" id="tier-comparison" aria-labelledby="tier-comparison-title">
      <div className="tl-container">
        <div className="tl-section-heading tl-tier-comparison-heading">
          <span className="tl-eyebrow">Choose your perfect plan</span>
          <h2 id="tier-comparison-title">See how each tier matches your institute&apos;s needs</h2>
          <p className="tl-tier-description">
            Every institute is different. Compare what each plan offers to find your perfect fit.
          </p>
        </div>

        <div className="tl-tier-recommendation-badge">
          <ShieldCheck size={20} aria-hidden="true" />
          <span>Most institutes choose: <strong>{recommendedPlan.title}</strong></span>
        </div>

        <div className="tl-tier-cards-wrapper">
          {plans.map((plan, index) => (
            <div
              key={plan.key}
              className={`tl-tier-card ${plan.key === recommendedPlan.key ? 'tl-tier-card--recommended' : ''}`}
            >
              <div className="tl-tier-card-header">
                <h3>{plan.title}</h3>
                {plan.badge && <span className="tl-tier-badge">{plan.badge}</span>}
              </div>

              <div className="tl-tier-card-body">
                <p className="tl-tier-card-description">{plan.description}</p>

                <div className="tl-tier-features-list">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="tl-tier-feature-item">
                      <CheckCircle2 size={14} aria-hidden="true" className="tl-tier-feature-check" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tl-tier-card-footer">
                <div className="tl-tier-pricing">
                  <span className="tl-tier-pricing-label">Pricing</span>
                  <div className="tl-tier-pricing-value">
                    <strong>Rs. {plan.monthly.toLocaleString()}/mo</strong>
                    <span className="tl-tier-pricing-period">(Rs. {plan.yearly.toLocaleString()}/yr)</span>
                  </div>
                </div>

                {/* Action button would go here in a real implementation */}
                {/* <button className="tl-tier-action-button">Select Plan</button> */}
              </div>
            </div>
          ))}
        </div>

        <div className="tl-tier-aspects-comparison">
          <h3 className="tl-tier-aspects-heading">Feature-by-feature comparison</h3>
          <div className="tl-tier-comparison-grid">
            {/* Header row */}
            <div className="tl-tier-comparison-header">
              <div className="tl-tier-aspect-cell">Aspect</div>
              {plans.map(plan => (
                <div key={plan.key} className="tl-tier-plan-cell">
                  <strong>{plan.title}</strong>
                </div>
              ))}
            </div>

            {/* Comparison rows */}
            {comparison.map((row, rowIndex) => (
              <div key={rowIndex} className="tl-tier-comparison-row">
                <div className="tl-tier-aspect-cell">
                  <div className="tl-tier-aspect-icon-wrapper">
                    {getIconForAspect(row.aspect)}
                  </div>
                  <span className="tl-tier-aspect-label">{row.aspect}</span>
                </div>

                {/* Basic column */}
                <div className="tl-tier-plan-cell tl-tier-plan-cell--basic">
                  <span className="tl-tier-comparison-value">{row.basic}</span>
                </div>

                {/* Pro column */}
                <div className="tl-tier-plan-cell tl-tier-plan-cell--pro">
                  <span className="tl-tier-comparison-value">{row.pro}</span>
                </div>

                {/* Max column */}
                <div className="tl-tier-plan-cell tl-tier-plan-cell--max">
                  <span className="tl-tier-comparison-value">{row.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}