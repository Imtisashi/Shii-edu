'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, MoveUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

type StatefulButtonProps = {
  children: ReactNode;
  className?: string;
  href: string;
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function StatefulButton({ children, className = '', href }: StatefulButtonProps) {
  const [armed, setArmed] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!armed) return undefined;
    const timeout = window.setTimeout(() => setArmed(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [armed]);

  return (
    <motion.a
      className={['tl-stateful-button', armed ? 'is-armed' : '', className].filter(Boolean).join(' ')}
      href={href}
      onClick={() => setArmed(true)}
      transition={{ duration: reducedMotion ? 0.01 : 0.18, ease }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
    >
      <span className="tl-stateful-button-label">{armed ? 'Opening email' : children}</span>
      <span className="tl-stateful-button-icon">
        {armed ? <Check size={15} aria-hidden="true" /> : <MoveUpRight size={15} aria-hidden="true" />}
      </span>
    </motion.a>
  );
}
