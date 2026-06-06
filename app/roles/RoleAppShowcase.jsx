'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Bus,
  CalendarCheck2,
  Landmark,
  MapPinned,
  ReceiptText,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react';
import RoleInstallButton from './RoleInstallButton';

const roles = [
  {
    accent: '#4F46E5',
    authHref: '/auth/institute',
    icon: Landmark,
    ink: '#312E81',
    installHref: '/manifest-institute.webmanifest',
    installStartUrl: '/app/institute',
    key: 'institute',
    label: 'Institute',
    soft: '#F1F0FF',
    title: 'Institute command workspace',
    body: 'A campus-branded workspace for academic operations, finance, people, media, and controlled admin work.',
    features: ['Teacher and student workflows', 'Fee and payroll visibility', 'Brand and tier controls'],
    previewTitle: 'Institute console',
    previewRows: [
      ['Attendance', 'Live roster sync'],
      ['Fees', 'Payment tracking'],
      ['Uploads', 'Scoped media'],
    ],
  },
  {
    accent: '#0F766E',
    authHref: '/auth/parents',
    icon: Users,
    ink: '#134E4A',
    installHref: '/manifest-parents.webmanifest',
    installStartUrl: '/app/parents',
    key: 'parents',
    label: 'Parents',
    soft: '#E7FAF4',
    title: 'Parent companion app',
    body: 'A focused guardian view for student notices, fees, messages, academic updates, and transport status.',
    features: ['Linked-student updates', 'Fee reminders', 'Notice and message center'],
    previewTitle: 'Parent view',
    previewRows: [
      ['Notice', 'Science trip consent'],
      ['Fees', 'June tuition due'],
      ['Route', 'Bus arriving nearby'],
    ],
  },
  {
    accent: '#B45309',
    authHref: '/auth/driver',
    icon: Bus,
    ink: '#7C2D12',
    installHref: '/manifest-driver.webmanifest',
    installStartUrl: '/app/driver',
    key: 'driver',
    label: 'Driver',
    soft: '#FFF6E7',
    title: 'Driver route console',
    body: 'A field-first route surface with live location sharing, assigned stops, and large readable controls.',
    features: ['Map-first route surface', 'Assigned destinations', 'Large field controls'],
    previewTitle: 'Route console',
    previewRows: [
      ['Current', 'North gate pickup'],
      ['Next', 'Library road stop'],
      ['Status', 'Location sharing on'],
    ],
  },
];

const previewIcons = [CalendarCheck2, ReceiptText, MapPinned];

const clampRoleIndex = (index) => (index + roles.length) % roles.length;
const pageThemeVariables = [
  '--role-page-accent',
  '--role-page-ink',
  '--role-page-soft',
  '--role-page-rgb',
];

const roleRgb = {
  driver: '180 83 9',
  institute: '79 70 229',
  parents: '15 118 110',
};

export default function RoleAppShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef(null);
  const touchStartX = useRef(null);
  const activeRole = roles[activeIndex];
  const activeStyle = useMemo(
    () => ({
      '--role-accent': activeRole.accent,
      '--role-ink': activeRole.ink,
      '--role-soft': activeRole.soft,
    }),
    [activeRole]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.roleTheme = activeRole.key;
    root.style.setProperty('--role-page-accent', activeRole.accent);
    root.style.setProperty('--role-page-ink', activeRole.ink);
    root.style.setProperty('--role-page-soft', activeRole.soft);
    root.style.setProperty('--role-page-rgb', roleRgb[activeRole.key]);
  }, [activeRole]);

  useEffect(() => () => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    delete root.dataset.roleTheme;
    pageThemeVariables.forEach((variable) => root.style.removeProperty(variable));
  }, []);

  const focusTab = useCallback((index) => {
    const nextIndex = clampRoleIndex(index);
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      document.getElementById(`role-app-tab-${roles[nextIndex].key}`)?.focus();
    });
  }, []);

  const handleTabKeyDown = useCallback((event, index) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(roles.length - 1);
    }
  }, [focusTab]);

  const handleBoardPointerMove = useCallback((event) => {
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const segment = rect.width / roles.length;
    const nextIndex = Math.max(0, Math.min(roles.length - 1, Math.floor((event.clientX - rect.left) / segment)));
    if (nextIndex !== activeIndex) setActiveIndex(nextIndex);
  }, [activeIndex]);

  const handlePointerSwipe = useCallback((clientX) => {
    if (pointerStartX.current === null) return;
    const delta = clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(delta) < 42) return;
    setActiveIndex((current) => clampRoleIndex(current + (delta < 0 ? -1 : 1)));
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 42) return;
    setActiveIndex((current) => clampRoleIndex(current + (delta < 0 ? -1 : 1)));
  }, []);

  return (
    <>
      <div className="role-choice-watermark" aria-hidden="true">
        {activeRole.label}
      </div>
      <section
        aria-label="Choose a Shii-Edu role app"
        className="role-app-showcase role-app-game"
        style={activeStyle}
      >
        <div className="role-app-nav" aria-label="Role app selector">
          {roles.map(({ icon: Icon, installStartUrl, key, label, soft, accent, ink }, index) => (
            <button
              aria-controls={`role-app-card-${key}`}
              aria-pressed={index === activeIndex}
              className="role-app-tab"
              id={`role-app-tab-${key}`}
              key={key}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              onClick={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              style={{ '--role-accent': accent, '--role-ink': ink, '--role-soft': soft }}
              type="button"
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <small>{installStartUrl.replace(/^\/app\//, '').replace(/\/$/, '')}</small>
            </button>
          ))}
        </div>

      <div
        className="role-app-board"
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
        onPointerDown={(event) => {
          if (typeof window === 'undefined' || window.matchMedia('(pointer: fine)').matches) return;
          pointerStartX.current = event.clientX;
        }}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={(event) => handlePointerSwipe(event.clientX)}
        onTouchEnd={handleTouchEnd}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
      >
        {roles.map((role, index) => {
          const RoleIcon = role.icon;
          const selected = index === activeIndex;
          const distance = index - activeIndex;
          const absoluteDistance = Math.abs(distance);
          return (
            <article
              aria-labelledby={`role-app-tab-${role.key}`}
              className={[
                'role-app-card',
                selected ? 'is-active' : 'is-dimmed',
                distance < 0 ? 'is-before' : '',
                distance > 0 ? 'is-after' : '',
              ].filter(Boolean).join(' ')}
              id={`role-app-card-${role.key}`}
              key={role.key}
              style={{
                '--role-accent': role.accent,
                '--role-abs-distance': absoluteDistance,
                '--role-ink': role.ink,
                '--role-layer': 8 - absoluteDistance,
                '--role-scale': 1 - absoluteDistance * 0.055,
                '--role-soft': role.soft,
                '--role-shift-x': `${distance * 52}px`,
                '--role-shift-y': `${absoluteDistance * 22}px`,
              }}
              tabIndex={selected ? 0 : -1}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
            >
              <div className="role-app-card-copy">
                <span className="role-app-kicker">
                  <RoleIcon size={18} aria-hidden="true" />
                  {role.label} app
                </span>
                <h2>{role.title}</h2>
                <p>{role.body}</p>
                <div className="role-app-feature-list" aria-label={`${role.label} app features`}>
                  {role.features.map((feature) => (
                    <span key={feature}>
                      <ShieldCheck size={15} aria-hidden="true" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div className="role-app-preview" aria-hidden="true">
                <div className="role-app-preview-bar">
                  <span />
                  <strong>{role.previewTitle}</strong>
                  <Bell size={17} />
                </div>
                <div className="role-app-preview-hero">
                  <RoleIcon size={24} />
                  <span>{role.label}</span>
                </div>
                <div className="role-app-preview-list">
                  {role.previewRows.map(([label, value], rowIndex) => {
                    const PreviewIcon = previewIcons[rowIndex] || Route;
                    return (
                      <span key={label}>
                        <PreviewIcon size={16} />
                        <strong>{label}</strong>
                        <em>{value}</em>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="role-app-actions">
                <a className="role-choice-open" href={role.authHref}>
                  Sign in as {role.label}
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                <RoleInstallButton
                  accent={role.accent}
                  label={`Shii-Edu ${role.label}`}
                  manifestHref={role.installHref}
                  startUrl={role.installStartUrl}
                />
              </div>
            </article>
          );
        })}
      </div>
      </section>
    </>
  );
}
