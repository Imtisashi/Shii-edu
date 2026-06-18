'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, X } from 'lucide-react';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import type { UiFeatureCard } from '../../data/landing';

type ExpandableFeatureCardsProps = {
  cards: UiFeatureCard[];
};

const ease = [0.16, 1, 0.3, 1] as const;

function WorkflowDemo({ card }: { card: UiFeatureCard }) {
  return (
    <div className="tl-workflow-demo" aria-label={`${card.kicker} product demo`}>
      <div className="tl-workflow-demo-top">
        {card.demo.stats.map((stat) => (
          <span key={stat.label}>
            <strong>{stat.value}</strong>
            <small>{stat.label}</small>
          </span>
        ))}
      </div>
      <div className="tl-workflow-demo-action">{card.demo.primary}</div>
      <div className="tl-workflow-demo-rows">
        {card.demo.rows.map((row) => (
          <span key={`${row.label}-${row.value}`}>
            <em>{row.status}</em>
            <strong>{row.label}</strong>
            <small>{row.value}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ExpandableFeatureCards({ cards }: ExpandableFeatureCardsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const activeCard = cards.find((card) => card.id === activeId) ?? null;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setActiveId(null), []);

  useOutsideClick(panelRef, () => {
    if (activeId) {
      close();
    }
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [close]);

  useEffect(() => {
    document.body.style.overflow = activeCard ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeCard]);

  return (
    <div className="tl-expandable-wrap">
      <div className="tl-expandable-grid" aria-label="Inside app feature previews">
        {cards.map((card, index) => (
          <motion.button
            aria-label={`Open ${card.title}`}
            className={`tl-expandable-card tl-expandable-card-${card.tone}`}
            key={card.id}
            onClick={() => setActiveId(card.id)}
            style={{ '--card-index': index } as CSSProperties & { '--card-index': number }}
            type="button"
            whileHover={reducedMotion ? undefined : { y: -4 }}
            whileTap={reducedMotion ? undefined : { scale: 0.985 }}
          >
            <span className="tl-expandable-kicker">{card.kicker}</span>
            <strong>{card.title}</strong>
            <p>{card.summary}</p>
            <span className="tl-expandable-open">
              Open workflow
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {activeCard && (
          <motion.div
            animate={{ opacity: 1 }}
            className="tl-expandable-overlay"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.16 }}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-labelledby={`expanded-${activeCard.id}`}
              aria-modal="true"
              className={`tl-expandable-panel tl-expandable-panel-${activeCard.tone}`}
              exit={{
                opacity: 0,
                scale: reducedMotion ? 1 : 0.985,
                y: reducedMotion ? 0 : 18,
              }}
              initial={{
                opacity: 0,
                scale: reducedMotion ? 1 : 0.985,
                y: reducedMotion ? 0 : 22,
              }}
              ref={panelRef}
              role="dialog"
              transition={{ duration: reducedMotion ? 0.01 : 0.28, ease }}
            >
              <button aria-label="Close expanded feature" className="tl-expandable-close" onClick={close} type="button">
                <X size={18} aria-hidden="true" />
              </button>
              <div className="tl-expandable-panel-copy">
                <span>{activeCard.kicker}</span>
                <h3 id={`expanded-${activeCard.id}`}>{activeCard.title}</h3>
                <p>{activeCard.detail}</p>
              </div>
              <div className="tl-expandable-panel-preview" aria-label={`${activeCard.title} workflow details`}>
                <WorkflowDemo card={activeCard} />
                <div className="tl-expandable-steps">
                  {activeCard.steps.map((step, index) => (
                    <span key={step}>
                      <em>{String(index + 1).padStart(2, '0')}</em>
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
