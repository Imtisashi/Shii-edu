'use client';

import type { MouseEventHandler, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

type AnimatedButtonProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function AnimatedButton({
  children,
  className = '',
  href,
  icon,
  onClick,
  size = 'md',
  variant = 'primary',
}: AnimatedButtonProps) {
  const reducedMotion = useReducedMotion();
  const classes = ['tl-button', `tl-button-${variant}`, `tl-button-${size}`, className]
    .filter(Boolean)
    .join(' ');
  const motionProps = reducedMotion
    ? {}
    : {
        whileHover: { y: -2, scale: 1.01 },
        whileTap: { scale: 0.98 },
        transition: { duration: 0.18, ease },
      };
  const buttonIcon = icon ?? <ArrowRight size={16} aria-hidden="true" />;

  if (href) {
    return (
      <motion.a className={classes} href={href} {...motionProps}>
        <span className="tl-button-label">{children}</span>
        <span className="tl-button-icon">{buttonIcon}</span>
      </motion.a>
    );
  }

  return (
    <motion.button className={classes} onClick={onClick} type="button" {...motionProps}>
      <span className="tl-button-label">{children}</span>
      <span className="tl-button-icon">{buttonIcon}</span>
    </motion.button>
  );
}
