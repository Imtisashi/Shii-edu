'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  Bus,
  GraduationCap,
  Landmark,
  ShieldCheck,
  Users,
} from 'lucide-react';

const rolePanels = [
  {
    key: 'admin',
    icon: Landmark,
    label: 'Admin',
    title: 'Operational control without a cluttered control room.',
    body: 'Admins manage users, fees, broadcasts, routines, brand settings, reports, and feature access from role-aware surfaces.',
    checks: ['Tier-aware quick actions', 'Institute theme ownership', 'Scoped finance and user APIs'],
    stack: ['Users', 'Ledger', 'Brand', 'Reports'],
  },
  {
    key: 'teacher',
    icon: GraduationCap,
    label: 'Teacher',
    title: 'Fast classroom work, fewer unrelated screens.',
    body: 'Teachers see the roster, routine, assignments, grades, messages, and learning tools their institute has enabled.',
    checks: ['Rosters mirror class structure', 'Uploads follow storage rules', 'AI stays syllabus-bound'],
    stack: ['Attendance', 'Routine', 'Assignments', 'Grades'],
  },
  {
    key: 'student',
    icon: Users,
    label: 'Student',
    title: 'A clean learner view for the current institute.',
    body: 'Students get grades, attendance, courses, notices, fees, media, and transport only when the institute subscribes to those modules.',
    checks: ['No cross-institute links', 'Mobile-first dashboard actions', 'Feature-gated tabs'],
    stack: ['Grades', 'Courses', 'Fees', 'PYQs'],
  },
  {
    key: 'parent',
    icon: Bell,
    label: 'Parent',
    title: 'Updates that stay tied to the linked student.',
    body: 'Parents receive fee, alert, message, and fleet views without seeing internal admin tools or unrelated institute data.',
    checks: ['Linked-student context', 'Office-hour messaging', 'Payment metadata boundaries'],
    stack: ['Alerts', 'Fees', 'Messages', 'Fleet'],
  },
  {
    key: 'driver',
    icon: Bus,
    label: 'Driver',
    title: 'Transport work stays separate from campus admin.',
    body: 'Drivers get live route controls and communication only when Transport is active for the institute.',
    checks: ['Route-specific console', 'Location sharing boundary', 'Drawer access to profile'],
    stack: ['Route', 'Vehicle', 'Status', 'Messages'],
  },
];

export default function LandingRoleExplorer() {
  const [selectedRole, setSelectedRole] = useState(rolePanels[0].key);
  const activePanel = useMemo(
    () => rolePanels.find((panel) => panel.key === selectedRole) || rolePanels[0],
    [selectedRole]
  );
  const ActiveIcon = activePanel.icon;

  return (
    <div className="role-explorer-shell">
      <div className="role-selector" role="tablist" aria-label="Explore Shii-Edu by role">
        {rolePanels.map(({ icon: Icon, key, label }) => (
          <button
            aria-controls={`role-panel-${key}`}
            aria-selected={selectedRole === key}
            className="role-selector-button"
            id={`role-tab-${key}`}
            key={key}
            onClick={() => setSelectedRole(key)}
            role="tab"
            type="button"
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <article
        aria-labelledby={`role-tab-${activePanel.key}`}
        className="role-explorer-panel"
        id={`role-panel-${activePanel.key}`}
        key={activePanel.key}
        role="tabpanel"
      >
        <div className="role-panel-copy">
          <span className="role-panel-icon">
            <ActiveIcon size={22} aria-hidden="true" />
          </span>
          <h3>{activePanel.title}</h3>
          <p>{activePanel.body}</p>
          <ul>
            {activePanel.checks.map((check) => (
              <li key={check}>
                <ShieldCheck size={15} aria-hidden="true" />
                {check}
              </li>
            ))}
          </ul>
        </div>

        <div className="role-panel-preview" aria-hidden="true">
          <div className="role-preview-top">
            <span />
            <strong>{activePanel.label} portal</strong>
          </div>
          <div className="role-preview-stack">
            {activePanel.stack.map((item, index) => (
              <span
                key={item}
                style={{ '--stack-delay': `${index * 42}ms` }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
