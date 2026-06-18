'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const evidenceItems = [
  {
    quote: 'Role entrances point to real institute, parent, and driver login routes instead of placeholder cards.',
    name: 'Role access',
    role: 'Verified launch check',
    avatar: '01',
  },
  {
    quote: 'Feature access is stored with institute settings and enforced by server-side subscription helpers.',
    name: 'Entitlements',
    role: 'Verified launch check',
    avatar: '02',
  },
  {
    quote: 'Payment flows are routed through processor metadata; raw card, CVV, UPI PIN, and banking passwords are not collected.',
    name: 'Finance safety',
    role: 'Legal and security check',
    avatar: '03',
  },
  {
    quote: 'Public claims avoid fake names, fake institutes, fake analytics, and fake testimonials until references are verified.',
    name: 'Proof honesty',
    role: 'Launch-content check',
    avatar: '04',
  },
];

export default function LaunchEvidenceSlider() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const paginate = useCallback((newDirection) => {
    setDirection(newDirection);
    setCurrent((prev) => (prev + newDirection + evidenceItems.length) % evidenceItems.length);
  }, []);

  const variants = {
    enter: (nextDirection) => ({
      x: nextDirection > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (nextDirection) => ({
      x: nextDirection < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="testimonial-slider">
      <div className="testimonial-container">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="testimonial-card"
          >
            <div className="testimonial-quote-icon">
              <Quote size={32} aria-hidden="true" />
            </div>
            <blockquote className="testimonial-text">
              {evidenceItems[current].quote}
            </blockquote>
            <div className="testimonial-author">
              <div className="testimonial-avatar">
                {evidenceItems[current].avatar}
              </div>
              <div className="testimonial-author-info">
                <strong>{evidenceItems[current].name}</strong>
                <span>{evidenceItems[current].role}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="testimonial-nav">
        <button
          className="testimonial-nav-btn"
          onClick={() => paginate(-1)}
          aria-label="Previous launch check"
          type="button"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="testimonial-dots">
          {evidenceItems.map((_, index) => (
            <button
              key={index}
              className={`testimonial-dot ${index === current ? 'active' : ''}`}
              onClick={() => {
                setDirection(index > current ? 1 : -1);
                setCurrent(index);
              }}
              aria-label={`Go to launch check ${index + 1}`}
              type="button"
            />
          ))}
        </div>
        <button
          className="testimonial-nav-btn"
          onClick={() => paginate(1)}
          aria-label="Next launch check"
          type="button"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
