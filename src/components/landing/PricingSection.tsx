'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
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
  Save,
  User,
} from 'lucide-react';
import type { PricingComparisonRow, PricingPlan } from '../../data/landing';
import Reveal from '../motion/Reveal';
import StatefulButton from './StatefulButton';

type PricingSectionProps = {
  comparison: PricingComparisonRow[];
  contactHref: string;
  note: string;
  plans: PricingPlan[];
};

const formatInr = (value: number) => `Rs. ${value.toLocaleString('en-IN')}`;

export default function PricingSection({ comparison, contactHref, note, plans }: PricingSectionProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const yearly = billing === 'yearly';
  const activePlans = useMemo(
    () => plans.map((plan) => ({
      ...plan,
      displayPrice: yearly ? plan.yearly : plan.monthly,
      suffix: yearly ? '/ year' : '/ month',
    })),
    [plans, yearly]
  );

  return (
    <section className="tl-section tl-pricing-section" id="pricing" aria-labelledby="pricing-title">
      <div className="tl-container">
        <Reveal className="tl-pricing-head">
          <span className="tl-eyebrow">Pricing</span>
          <h2 id="pricing-title">Find your perfect plan</h2>
          <p className="tl-pricing-intro">
            Every institute is unique. Whether you&apos;re just starting out or looking for premium control,
            we have a plan that grows with your needs. All plans include core functionality with special
            features added at each level.
          </p>
        </Reveal>

        <div className="tl-pricing-switch" role="group" aria-label="Billing period">
          <button aria-pressed={!yearly} onClick={() => setBilling('monthly')} type="button">
            Monthly
          </button>
          <button aria-pressed={yearly} onClick={() => setBilling('yearly')} type="button">
            Yearly
          </button>
          <span
            aria-hidden="true"
            className={`tl-pricing-switch-thumb${yearly ? ' is-yearly' : ''}`}
          />
        </div>

        <div className="tl-pricing-grid">
          {activePlans.map((plan, index) => (
            <Reveal
              className={`tl-pricing-card tl-pricing-${plan.key} ${plan.badge ? 'is-featured' : ''}`}
              delay={index * 0.05}
              key={plan.key}
            >
              <div className="tl-pricing-card-top">
                <span>{plan.badge || 'Plan'}</span>
                <h3>{plan.title}</h3>
                <p>{plan.description}</p>
              </div>
              <div className="tl-price-line">
                <strong>{formatInr(plan.displayPrice)}</strong>
                <small>{plan.suffix}</small>
              </div>
              {yearly ? <p className="tl-yearly-note">{note}</p> : null}
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <StatefulButton href={contactHref}>
                {plan.key === 'max' ? 'Discuss Max' : `Ask about ${plan.title}`}
              </StatefulButton>
            </Reveal>
          ))}
        </div>

        <Reveal className="tl-pricing-comparison" delay={0.08}>
          <div className="tl-pricing-comparison-head">
            <span className="tl-eyebrow">Plan comparison</span>
            <h3>See how each plan compares</h3>
            <p className="tl-comparison-intro">
              Take a look at what each plan offers to help you decide which one is right for your institute.
              The highlighted options show where each plan offers the best value for specific needs.
            </p>
          </div>
          <div className="tl-comparison-table-wrap">
            <table className="tl-comparison-table">
              <caption>Basic, Pro, and Max plan comparison</caption>
              <thead>
                <tr>
                  <th scope="col">Aspect</th>
                  <th scope="col">Basic</th>
                  <th scope="col">Pro</th>
                  <th scope="col">Max</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => {
                  // Determine which plan offers the best value for this aspect
                  // Simple heuristic: Max is usually best, then Pro, then Basic
                  // But we can refine this based on the actual content
                  const getAspectIcon = (aspect: string) => {
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

                  const Icon = getAspectIcon(row.aspect);

                  // Determine best value (simplified - in reality this would be more nuanced)
                  const isBasicBest = row.basic.includes('Max') || row.basic.includes('Unlimited') ||
                                    (row.basic.includes('Premium') && !row.pro.includes('Premium') && !row.max.includes('Premium'));
                  const isProBest = !isBasicBest && (row.pro.includes('Max') || row.pro.includes('Unlimited') ||
                                    row.pro.includes('Advanced') && !row.max.includes('Advanced') ||
                                    row.pro.includes('Premium') && !row.max.includes('Premium'));
                  const isMaxBest = !isBasicBest && !isProBest;

                  return (
                    <tr key={row.aspect} className="tl-comparison-row">
                      <th scope="row" className="tl-aspect-cell">
                        <div className="tl-aspect-icon">
                          <Icon size={14} aria-hidden="true" />
                        </div>
                        <span className="tl-aspect-label">{row.aspect}</span>
                      </th>
                      <td className={`tl-plan-cell tl-plan-cell--basic${isBasicBest ? ' tl-best-value' : ''}`}>
                        <span className="tl-comparison-value">{row.basic}</span>
                        {isBasicBest && <span className="tl-badge tl-badge--basic">Best</span>}
                      </td>
                      <td className={`tl-plan-cell tl-plan-cell--pro${isProBest ? ' tl-best-value' : ''}`}>
                        <span className="tl-comparison-value">{row.pro}</span>
                        {isProBest && <span className="tl-badge tl-badge--pro">Best</span>}
                      </td>
                      <td className={`tl-plan-cell tl-plan-cell--max${isMaxBest ? ' tl-best-value' : ''}`}>
                        <span className="tl-comparison-value">{row.max}</span>
                        {isMaxBest && <span className="tl-badge tl-badge--max">Best</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
