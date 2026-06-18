'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

type ContainerTextFlipProps = {
  className?: string;
  intervalMs?: number;
  words: string[];
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function ContainerTextFlip({ className = '', intervalMs = 2200, words }: ContainerTextFlipProps) {
  const reducedMotion = useReducedMotion();
  const safeWords = useMemo(() => words.filter(Boolean), [words]);
  const [index, setIndex] = useState(0);
  const activeWord = safeWords[index % Math.max(safeWords.length, 1)] ?? '';

  useEffect(() => {
    if (reducedMotion || safeWords.length < 2) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeWords.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, reducedMotion, safeWords.length]);

  return (
    <span className={`tl-text-flip ${className}`.trim()} aria-label={safeWords.join(', ')}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : -16 }}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
          key={activeWord}
          transition={{ duration: reducedMotion ? 0.01 : 0.34, ease }}
        >
          {activeWord}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
