'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { FeatureTab } from '../../data/landing';
import Reveal from '../motion/Reveal';

type FeatureTabsProps = {
  features: FeatureTab[];
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function FeatureTabs({ features }: FeatureTabsProps) {
  const [activeId, setActiveId] = useState(features[0]?.id ?? '');
  const reducedMotion = useReducedMotion();
  const active = features.find((feature) => feature.id === activeId) ?? features[0];

  if (!active) {
    return null;
  }

  return (
    <section className="tl-section tl-feature-section" id="features" aria-labelledby="feature-tabs-title">
      <div className="tl-container">
        <Reveal className="tl-section-heading">
          <span className="tl-eyebrow">Core modules</span>
          <h2 id="feature-tabs-title">Every workflow has a responsible owner.</h2>
          <p>
            The system is broad, but each module is shaped around the person who uses it most often.
          </p>
        </Reveal>

        <div className="tl-feature-tabs">
          <div className="tl-feature-list" role="tablist" aria-label="Landing feature tabs">
            {features.map((feature) => {
              const selected = feature.id === active.id;
              return (
                <button
                  aria-controls={`feature-panel-${feature.id}`}
                  aria-selected={selected}
                  className="tl-feature-tab"
                  id={`feature-tab-${feature.id}`}
                  key={feature.id}
                  onClick={() => setActiveId(feature.id)}
                  role="tab"
                  type="button"
                >
                  {selected && (
                    <motion.span
                      className="tl-feature-active"
                      layoutId="tl-feature-active"
                      transition={{ duration: reducedMotion ? 0 : 0.24, ease }}
                    />
                  )}
                  <span>{feature.eyebrow}</span>
                  <strong>{feature.title}</strong>
                </button>
              );
            })}
          </div>

          <div className="tl-feature-panel-shell">
            <AnimatePresence mode="wait">
              <motion.article
                animate={{ opacity: 1, x: 0 }}
                aria-labelledby={`feature-tab-${active.id}`}
                className="tl-feature-panel"
                exit={{ opacity: 0, x: -12 }}
                id={`feature-panel-${active.id}`}
                initial={{ opacity: 0, x: 12 }}
                key={active.id}
                role="tabpanel"
                transition={{ duration: reducedMotion ? 0.01 : 0.35, ease }}
              >
                <div className="tl-feature-copy">
                  <span>{active.eyebrow}</span>
                  <h3>{active.title}</h3>
                  <p>{active.description}</p>
                  <ul>
                    {active.bullets.map((bullet) => (
                      <li key={bullet}>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="tl-feature-preview">
                  <div className="tl-preview-top">
                    <span>{active.preview.lead}</span>
                    <strong>{active.preview.stat}</strong>
                  </div>
                  <div className="tl-preview-chart" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="tl-preview-rows">
                    {active.preview.rows.map((row) => (
                      <span key={row}>
                        <em />
                        {row}
                        <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    ))}
                  </div>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
