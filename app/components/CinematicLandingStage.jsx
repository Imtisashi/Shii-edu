'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Route,
  ShieldCheck,
  Users2,
} from 'lucide-react';

const stageModes = [
  {
    key: 'admin',
    label: 'Admin',
    workspace: 'Institute workspace',
    title: 'Institute command',
    icon: ShieldCheck,
    metrics: [
      { icon: Users2, label: 'Role apps', value: '5' },
      { icon: ShieldCheck, label: 'Tenant scope', value: 'Locked' },
      { icon: CreditCard, label: 'Card data', value: '0 raw' },
    ],
    timeline: [
      ['07:40', 'Attendance opens against teacher rosters'],
      ['10:15', 'Fee ledger separates online and offline receipts'],
      ['14:30', 'Route control writes map points for drivers'],
    ],
  },
  {
    key: 'teacher',
    label: 'Teacher',
    workspace: 'Classroom desk',
    title: 'Teaching rhythm',
    icon: BookOpenCheck,
    metrics: [
      { icon: CalendarCheck2, label: 'Routine', value: 'Today' },
      { icon: Users2, label: 'Roster', value: 'Scoped' },
      { icon: ShieldCheck, label: 'Uploads', value: 'Signed' },
    ],
    timeline: [
      ['08:10', 'Take attendance from the assigned class list'],
      ['11:20', 'Upload homework under institute storage'],
      ['15:00', 'Review notices without admin clutter'],
    ],
  },
  {
    key: 'route',
    label: 'Transport',
    workspace: 'Assigned route',
    title: 'Map route live',
    icon: Route,
    metrics: [
      { icon: Route, label: 'Assigned', value: '1' },
      { icon: CheckCircle2, label: 'Fallback', value: 'Shown' },
      { icon: ShieldCheck, label: 'Vehicle', value: 'Assigned' },
    ],
    timeline: [
      ['06:50', 'Admin assigns origin and destination coordinates'],
      ['07:05', 'Parents see assigned route before GPS starts'],
      ['07:15', 'Driver opens a large-control route surface'],
    ],
  },
];

export default function CinematicLandingStage() {
  const [activeKey, setActiveKey] = useState(stageModes[0].key);
  const activeMode = useMemo(
    () => stageModes.find((mode) => mode.key === activeKey) || stageModes[0],
    [activeKey]
  );
  const ActiveIcon = activeMode.icon;

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
          <strong>{activeMode.title}</strong>
          <Bell size={18} aria-hidden="true" />
        </div>

        <div className="cinematic-mode-tabs" role="tablist" aria-label="Preview mode">
          {stageModes.map((mode) => (
            <button
              aria-selected={mode.key === activeKey}
              className="cinematic-mode-tab"
              key={mode.key}
              onClick={() => setActiveKey(mode.key)}
              role="tab"
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="cinematic-hero-card" key={`${activeMode.key}-hero`}>
          <div>
            <span>Active workspace</span>
            <h2>{activeMode.workspace}</h2>
          </div>
          <ActiveIcon size={24} aria-hidden="true" />
        </div>

        <div className="cinematic-metrics">
          {activeMode.metrics.map(({ icon: Icon, label, value }, index) => (
            <div className="cinematic-metric" key={label} style={{ '--metric-delay': `${index * 58}ms` }}>
              <Icon size={17} aria-hidden="true" />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="cinematic-timeline" key={`${activeMode.key}-timeline`}>
          {activeMode.timeline.map(([time, label], index) => (
            <div className="cinematic-timeline-row" key={time} style={{ '--timeline-delay': `${index * 70}ms` }}>
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
