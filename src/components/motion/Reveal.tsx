'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function Reveal({ children, className = '', delay = 0, once = true }: RevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      transition={{ delay, duration: reducedMotion ? 0.2 : 0.65, ease }}
      viewport={{ amount: 0.18, once }}
      whileInView={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
