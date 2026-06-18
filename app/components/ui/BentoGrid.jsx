'use client';

import { motion } from 'motion/react';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function BentoCard({
  children,
  className = '',
  colSpan = 1,
  rowSpan = 1,
  glowColor = 'rgba(79, 70, 229, 0.15)',
  ...props
}) {
  return (
    <motion.div
      className={`bento-card ${className}`}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        '--glow-color': glowColor,
      }}
      variants={itemVariants}
      whileHover={{
        y: -4,
        boxShadow: `0 20px 40px -12px var(--glow-color)`,
      }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function BentoGrid({ children, className = '' }) {
  return <div className={`bento-grid ${className}`}>{children}</div>;
}

export function BentoFeatureIcon({ children, className = '', color = 'violet' }) {
  const colorMap = {
    violet: 'bg-violet-100 text-violet-600 border-violet-200',
    blue: 'bg-blue-100 text-blue-600 border-blue-200',
    amber: 'bg-amber-100 text-amber-600 border-amber-200',
    teal: 'bg-teal-100 text-teal-600 border-teal-200',
    emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    rose: 'bg-rose-100 text-rose-600 border-rose-200',
  };

  return (
    <div className={`bento-icon ${colorMap[color]} ${className || ''}`}>
      {children}
    </div>
  );
}

export function BentoCardHeader({ children, className = '' }) {
  return <div className={`bento-card-header ${className}`}>{children}</div>;
}

export function BentoCardTitle({ children, className = '' }) {
  return <h3 className={`bento-card-title ${className}`}>{children}</h3>;
}

export function BentoCardDescription({ children, className = '' }) {
  return <p className={`bento-card-description ${className}`}>{children}</p>;
}

export function BentoCardContent({ children, className = '' }) {
  return <div className={`bento-card-content ${className}`}>{children}</div>;
}

export function BentoCardFooter({ children, className = '' }) {
  return <div className={`bento-card-footer ${className}`}>{children}</div>;
}