'use client';

import {
  Bell,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Route,
  ShieldCheck,
  Users2,
} from 'lucide-react';

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
  return (
    <div
      aria-label="Animated Shii-Edu product preview"
      className="cinematic-stage"
    >
      <div className="cinematic-video-frame" aria-hidden="true">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/icon.png"
          src="/assets/videos/cosmic-campus.mp4"
        />
      </div>

      <div className="cinematic-dashboard">
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
      </div>

      <div className="cinematic-floating-card card-one">
        <CalendarCheck2 size={18} aria-hidden="true" />
        <span>Routine synced</span>
      </div>

      <div className="cinematic-floating-card card-two">
        <Route size={18} aria-hidden="true" />
        <span>Route live</span>
      </div>
    </div>
  );
}
