'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { CaseStudy } from '../../data/landing';
import AnimatedButton from '../ui/AnimatedButton';
import Reveal from '../motion/Reveal';

type ImpactCaseStudiesProps = {
  caseStudies: CaseStudy[];
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function ImpactCaseStudies({ caseStudies }: ImpactCaseStudiesProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const active = caseStudies[activeIndex] ?? caseStudies[0];

  if (!active) {
    return null;
  }

  const next = () => setActiveIndex((index) => (index + 1) % caseStudies.length);
  const previous = () => setActiveIndex((index) => (index - 1 + caseStudies.length) % caseStudies.length);

  return (
    <section className="tl-section tl-impact-section" id="impact" aria-labelledby="impact-title">
      <div className="tl-container">
        <Reveal className="tl-section-heading tl-impact-heading">
          <span className="tl-eyebrow">Impact scenarios</span>
          <h2 id="impact-title">Show the operating model before claiming outcomes.</h2>
          <p>
            These are clearly labeled product scenarios. Verified customer case studies can replace them when real
            approvals and metrics exist.
          </p>
        </Reveal>

        <div className="tl-impact-shell">
          <div className="tl-impact-controls" aria-label="Case study controls">
            <button aria-label="Previous scenario" onClick={previous} type="button">
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
            <span>
              {activeIndex + 1} / {caseStudies.length}
            </span>
            <button aria-label="Next scenario" onClick={next} type="button">
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>

          <motion.article
            animate={{ opacity: 1, x: 0 }}
            className="tl-impact-card"
            initial={{ opacity: 0, x: 16 }}
            key={active.title}
            transition={{ duration: reducedMotion ? 0.01 : 0.42, ease }}
          >
            <span className="tl-impact-category">{active.category}</span>
            <h3>{active.title}</h3>
            <p>{active.note}</p>
            <div className="tl-impact-metrics">
              {active.metrics.map((metric) => (
                <span key={metric.label}>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </span>
              ))}
            </div>
            <AnimatedButton href={active.href} variant="outline">
              View workflow
            </AnimatedButton>
          </motion.article>

          <div className="tl-impact-stack" aria-label="Choose a case study scenario">
            {caseStudies.map((study, index) => (
              <button
                aria-label={`Show ${study.title}`}
                className={index === activeIndex ? 'is-active' : ''}
                key={study.title}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                <span>{study.category}</span>
                <strong>{study.title}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
