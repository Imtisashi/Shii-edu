'use client';

import { motion, useReducedMotion } from 'motion/react';
import {
  Bell,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Route,
  ShieldCheck,
  Users2,
} from 'lucide-react';

const ease = [0.22, 1, 0.36, 1];

const timeline = [
  ['07:40', 'Morning attendance locks to teacher rosters'],
  ['10:15', 'Fee ledger reconciles live payment metadata'],
  ['14:30', 'Transport view opens for assigned routes'],
];

const metrics = [
  { icon: Users2, label: 'Roles', value: '6' },
  { icon: ShieldCheck, label: 'Tenant scope', value: 'RLS' },
  { icon: CreditCard, label: 'Raw card data', value: '0' },
];

export default function CinematicLandingStage() {
  const reduceMotion = useReducedMotion();
  const entrance = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : {
      initial: { scale: 0.985, y: 14 },
      animate: { scale: 1, y: 0 },
      transition: { duration: 0.8, ease },
    };

  return (
    <motion.div
      aria-label="Animated Shii-Edu product preview"
      className="cinematic-stage"
      {...entrance}
    >
      <div className="cinematic-video-frame" aria-hidden="true">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/assets/images/icon.png"
          src="/assets/videos/cosmic-campus.mp4"
        />
      </div>

      <motion.div
        className="cinematic-dashboard"
        animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
        transition={reduceMotion ? undefined : { duration: 8, ease: 'easeInOut', repeat: Infinity }}
      >
        <div className="cinematic-topbar">
          <span />
          <strong>Institute command</strong>
          <Bell size={18} aria-hidden="true" />
        </div>

        <div className="cinematic-hero-card">
          <div>
            <span>Active workspace</span>
            <h2>St. Mira College</h2>
          </div>
          <CheckCircle2 size={24} aria-hidden="true" />
        </div>

        <div className="cinematic-metrics">
          {metrics.map(({ icon: Icon, label, value }) => (
            <div className="cinematic-metric" key={label}>
              <Icon size={17} aria-hidden="true" />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="cinematic-timeline">
          {timeline.map(([time, label]) => (
            <div className="cinematic-timeline-row" key={time}>
              <span>{time}</span>
              <p>{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="cinematic-floating-card card-one"
        animate={reduceMotion ? undefined : { x: [0, 8, 0], y: [0, -5, 0] }}
        transition={reduceMotion ? undefined : { duration: 7, ease: 'easeInOut', repeat: Infinity }}
      >
        <CalendarCheck2 size={18} aria-hidden="true" />
        <span>Routine synced</span>
      </motion.div>

      <motion.div
        className="cinematic-floating-card card-two"
        animate={reduceMotion ? undefined : { x: [0, -7, 0], y: [0, 6, 0] }}
        transition={reduceMotion ? undefined : { duration: 7.5, ease: 'easeInOut', repeat: Infinity }}
      >
        <Route size={18} aria-hidden="true" />
        <span>Route live</span>
      </motion.div>
    </motion.div>
  );
}
