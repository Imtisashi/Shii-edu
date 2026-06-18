'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useRef } from 'react';

export default function AnimatedBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 200 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const backgroundX = useTransform(x, [-0.5, 0.5], ['-20%', '20%']);
  const backgroundY = useTransform(y, [-0.5, 0.5], ['-20%', '20%']);

  function handleMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set((event.clientX - rect.left - rect.width / 2) / rect.width);
    mouseY.set((event.clientY - rect.top - rect.height / 2) / rect.height);
  }

  return (
    <div
      className="animated-background-container"
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="gradient-orb gradient-orb-1"
        style={{
          x: backgroundX,
          y: backgroundY,
        }}
      />
      <motion.div
        className="gradient-orb gradient-orb-2"
        style={{
          x: useTransform(backgroundX, (v) => -v * 0.8),
          y: useTransform(backgroundY, (v) => -v * 0.8),
        }}
      />
      <motion.div
        className="gradient-orb gradient-orb-3"
        style={{
          x: useTransform(backgroundX, (v) => v * 0.6),
          y: useTransform(backgroundY, (v) => v * 0.6),
        }}
      />
      <div className="grid-pattern" />
    </div>
  );
}