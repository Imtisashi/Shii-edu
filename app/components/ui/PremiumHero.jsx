'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

export function PremiumHero() {
  const words = ['attendance', 'fees', 'routes', 'reports', 'payroll'];
  const [currentWord, setCurrentWord] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const glowX = useTransform(x, [-0.5, 0.5], ['-100px', '100px']);
  const glowY = useTransform(y, [-0.5, 0.5], ['-100px', '100px']);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWord((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [words.length]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const rect = document.body.getBoundingClientRect();
      mouseX.set((e.clientX - window.innerWidth / 2) / window.innerWidth);
      mouseY.set((e.clientY - window.innerHeight / 2) / window.innerHeight);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section className="premium-hero">
      <div className="premium-hero-bg" aria-hidden="true">
        <motion.div
          className="premium-hero-glow"
          style={{
            x: glowX,
            y: glowY,
          }}
        />
        <div className="premium-hero-grid" />
      </div>

      <div className="premium-hero-content">
        <motion.div
          className="premium-hero-badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="premium-hero-badge-dot" />
          Built for serious institute operations
        </motion.div>

        <motion.h1
          className="premium-hero-title"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          The campus operating system for{' '}
          <span className="premium-hero-word-container">
            {words.map((word, index) => (
              <motion.span
                key={word}
                className="premium-hero-word"
                initial={{ opacity: 0, y: 40, rotateX: -90 }}
                animate={{
                  opacity: currentWord === index ? 1 : 0,
                  y: currentWord === index ? 0 : -40,
                  rotateX: currentWord === index ? 0 : 90,
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: currentWord === index ? 'relative' : 'absolute',
                }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        <motion.p
          className="premium-hero-description"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Shii-Edu coordinates academics, fees, payroll, parent support, transport,
          files, notices, and bounded AI reports inside role-specific apps.
        </motion.p>

        <motion.div
          className="premium-hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <motion.button
            className="premium-hero-cta-primary"
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <span>Get Started</span>
            <motion.svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ x: isHovered ? 4 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </motion.svg>
          </motion.button>

          <motion.button
            className="premium-hero-cta-secondary"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            View Pricing
          </motion.button>
        </motion.div>

        <motion.div
          className="premium-hero-metrics"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {[
            { value: '3', label: 'installable role apps' },
            { value: 'Rs. 3k', label: 'monthly plans from' },
            { value: '1', label: 'Max AI report tier' },
          ].map((metric, index) => (
            <motion.div
              key={metric.label}
              className="premium-hero-metric"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="premium-hero-visual" aria-hidden="true">
        <motion.div
          className="premium-hero-card premium-hero-card-1"
          initial={{ opacity: 0, x: 60, rotateY: -15 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="premium-hero-card-icon premium-hero-card-icon-violet">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <strong>Live Dashboard</strong>
            <span>Real-time metrics</span>
          </div>
        </motion.div>

        <motion.div
          className="premium-hero-card premium-hero-card-2"
          initial={{ opacity: 0, x: 40, rotateY: 15 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="premium-hero-card-icon premium-hero-card-icon-teal">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <strong>Attendance</strong>
            <span>Synced daily</span>
          </div>
        </motion.div>

        <motion.div
          className="premium-hero-card premium-hero-card-3"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <div className="premium-hero-card-icon premium-hero-card-icon-amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <strong>Fees</strong>
            <span>Bulk allocation</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}