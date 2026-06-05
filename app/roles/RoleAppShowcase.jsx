'use client';

import { useMemo, useState } from 'react';
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
    installHref: '/manifest-institute.webmanifest',
    key: 'institute',
    label: 'Institute',
    soft: '#F1F0FF',
    title: 'Institute command workspace',
    body: 'For admins, teachers, and students who need a campus-branded workspace with academic, finance, media, and communication controls.',
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
    installHref: '/manifest-parents.webmanifest',
    key: 'parents',
    label: 'Parents',
    soft: '#ECFDF5',
    title: 'Parent companion app',
    body: 'For guardians who need a clear view of student notices, fees, messages, academic updates, and transport visibility.',
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
    installHref: '/manifest-driver.webmanifest',
    key: 'driver',
    label: 'Driver',
    soft: '#FFF7ED',
    title: 'Driver route console',
    body: 'For drivers who need large controls, route assignments, status updates, and live location sharing without admin clutter.',
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

export default function RoleAppShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRole = roles[activeIndex];
  const trackStyle = useMemo(
    () => ({
      '--role-accent': activeRole.accent,
      '--role-soft': activeRole.soft,
      transform: `translate3d(-${activeIndex * 100}%, 0, 0)`,
    }),
    [activeIndex, activeRole]
  );

  return (
    <section
      aria-label="Choose a Shii-Edu role app"
      className="role-app-showcase"
      style={{
        '--role-accent': activeRole.accent,
        '--role-soft': activeRole.soft,
      }}
    >
      <div className="role-app-nav" role="tablist" aria-label="Role app selector">
        {roles.map(({ icon: Icon, key, label }, index) => (
          <button
            aria-controls={`role-app-panel-${key}`}
            aria-selected={index === activeIndex}
            className="role-app-tab"
            id={`role-app-tab-${key}`}
            key={key}
            onClick={() => setActiveIndex(index)}
            role="tab"
            style={{ '--role-accent': roles[index].accent, '--role-soft': roles[index].soft }}
            type="button"
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="role-app-viewport">
        <div className="role-app-track" style={trackStyle}>
          {roles.map((role, slideIndex) => {
            const RoleIcon = role.icon;
            return (
              <article
                aria-hidden={slideIndex !== activeIndex}
                aria-labelledby={`role-app-tab-${role.key}`}
                className="role-app-slide"
                id={`role-app-panel-${role.key}`}
                inert={slideIndex !== activeIndex ? '' : undefined}
                key={role.key}
                role="tabpanel"
                style={{ '--role-accent': role.accent, '--role-soft': role.soft }}
                tabIndex={slideIndex === activeIndex ? 0 : -1}
              >
                <div className="role-app-copy">
                  <span className="role-app-kicker">
                    <RoleIcon size={18} aria-hidden="true" />
                    {role.label} app
                  </span>
                  <h1>{role.title}</h1>
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
                    Open auth
                    <ArrowRight size={17} aria-hidden="true" />
                  </a>
                  <RoleInstallButton
                    accent={role.accent}
                    label={`Shii-Edu ${role.label}`}
                    manifestHref={role.installHref}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
