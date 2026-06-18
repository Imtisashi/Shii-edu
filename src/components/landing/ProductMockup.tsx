'use client';

import { useState } from 'react';
import type { PointerEvent } from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { Bell, Check, MapPinned, Search, Sparkles } from 'lucide-react';
import type { landingContent } from '../../data/landing';

type ProductMockupProps = {
  mockup: typeof landingContent.mockup;
};

export default function ProductMockup({ mockup }: ProductMockupProps) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const rawX = useSpring(0, { damping: 20, stiffness: 140 });
  const rawY = useSpring(0, { damping: 20, stiffness: 140 });
  const rotateX = useTransform(rawY, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(rawX, [-0.5, 0.5], [-4, 4]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === 'touch') {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    rawX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    rawY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  };

  const resetPointer = () => {
    setHovered(false);
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="tl-product-stage"
      initial={false}
      transition={{ duration: reducedMotion ? 0.2 : 0.85, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="tl-product-shell"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={resetPointer}
        onPointerMove={handlePointerMove}
        style={reducedMotion ? undefined : { rotateX, rotateY }}
      >
        <div className="tl-product-frame">
          <div className="tl-product-sidebar" aria-hidden="true">
            <span className="is-active" />
            <span />
            <span />
            <span />
          </div>
          <div className="tl-product-main">
            <div className="tl-product-top">
              <span>
                <strong>{mockup.workspace}</strong>
                <small>{mockup.status}</small>
              </span>
              <div className="tl-product-search">
                <Search size={15} aria-hidden="true" />
                <span>Find a student, route, or notice</span>
              </div>
              <button aria-label="Open notifications" type="button">
                <Bell size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="tl-product-grid">
              {mockup.cards.map((card, index) => (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={`tl-product-card tl-product-${card.tone}`}
                  initial={false}
                  key={card.label}
                  transition={{ delay: reducedMotion ? 0 : 0.18 + index * 0.08, duration: 0.52 }}
                >
                  <small>{card.label}</small>
                  <strong>{card.value}</strong>
                  <span />
                </motion.div>
              ))}
            </div>

            <div className="tl-product-route-card" aria-label="Route handoff preview">
              <div className="tl-route-map" aria-hidden="true">
                <span className="tl-route-node tl-route-start" />
                <span className="tl-route-line" />
                <span className="tl-route-node tl-route-end" />
              </div>
              <span>
                <small>Transport handoff</small>
                <strong>Admin to Driver to Parent</strong>
              </span>
              <em>Ready</em>
            </div>

            <div className="tl-product-workflow">
              <div className="tl-product-workflow-head">
                <span>Today&apos;s work</span>
                <em>Synced</em>
              </div>
              {mockup.activity.map((item) => (
                <div className="tl-product-row" key={item}>
                  <span>
                    <Check size={12} aria-hidden="true" />
                  </span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={reducedMotion ? undefined : { y: hovered ? -8 : [0, -7, 0] }}
        className="tl-float-card tl-float-ai"
        transition={{ duration: hovered ? 0.24 : 5.2, repeat: hovered ? 0 : Infinity }}
      >
        <Sparkles size={17} aria-hidden="true" />
        <span>AI powered review</span>
      </motion.div>

      <motion.div
        animate={reducedMotion ? undefined : { y: hovered ? -6 : [0, 6, 0] }}
        className="tl-float-card tl-float-route"
        transition={{ duration: hovered ? 0.24 : 5.6, repeat: hovered ? 0 : Infinity }}
      >
        <MapPinned size={17} aria-hidden="true" />
        <span>Route assigned</span>
      </motion.div>
    </motion.div>
  );
}
