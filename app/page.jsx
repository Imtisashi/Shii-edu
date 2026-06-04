import {
  Bus,
  FileCheck2,
  FileLock2,
  GraduationCap,
  Landmark,
  Layers3,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { routeMetadata, SITE } from './lib/site';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const description =
  'Edu-shii gives each institute a secure operations workspace for academics, communication, payments, media, transport, and role-aware administration.';

export function generateMetadata() {
  return routeMetadata({
    description,
    path: '/',
    title: SITE.name,
  });
}

const systems = [
  ['Institute data boundary', 'Row-level policies keep each campus workspace scoped to its members.', 'Active'],
  ['Payment metadata', 'No raw card, CVV, UPI credential, or banking secret is stored.', 'Minimal'],
  ['Signed media uploads', 'Files are routed through institute and purpose-specific storage paths.', 'Scoped'],
  ['Realtime communication', 'Broadcast and message channels are bound to institute topics.', 'Checked'],
];

const roles = [
  {
    icon: ShieldCheck,
    title: 'Superadmin',
    points: ['Institute provisioning', 'Platform-wide audit', 'Workspace recovery controls'],
  },
  {
    icon: Landmark,
    title: 'Institute Admin',
    points: ['Users, fees, notices', 'Branding and schedule control', 'Bulk import governance'],
  },
  {
    icon: GraduationCap,
    title: 'Teacher',
    points: ['Attendance and grades', 'Assignments and course media', 'AI-assisted routine review'],
  },
  {
    icon: Users,
    title: 'Student and Parent',
    points: ['Routine, notices, fees', 'Course progress', 'Transport and reports'],
  },
  {
    icon: Bus,
    title: 'Driver',
    points: ['Route visibility', 'Location updates', 'Operational status only'],
  },
  {
    icon: LockKeyhole,
    title: 'Server APIs',
    points: ['Firebase and Supabase bridge', 'Stripe webhook verification', 'Server-side AI prompts'],
  },
];

const legalRows = [
  ['Privacy Policy', 'DPDP aligned, COPPA-aware, processor/controller boundaries', '/privacy'],
  ['Terms of Service', 'Role access, uploads, AI, transport, indemnity, liability limits', '/terms'],
];

const readinessItems = [
  ['Role-aware', 'Superadmin, admin, teacher, student, parent, and driver views stay separated by responsibility.'],
  ['Institute-branded', 'Workspace color, name, and logo can follow each school or college identity.'],
  ['Server-rendered public pages', 'SEO, legal, robots, sitemap, and metadata load through the Next.js App Router.'],
];

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    applicationCategory: 'EducationalApplication',
    dateModified: SITE.updatedAt,
    description,
    name: SITE.name,
    url: SITE.origin,
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand-lockup">
          <img className="brand-mark" src="/assets/images/icon.png" alt="" width="40" height="40" />
          <div className="brand-text">
            <span className="brand-name">Edu-shii</span>
            <span className="brand-mode">Institute operations</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Public sections">
          <a className="nav-link" href="#operations" aria-current="page">
            <Layers3 size={16} aria-hidden="true" />
            Operations
          </a>
          <a className="nav-link" href="#roles">
            <Users size={16} aria-hidden="true" />
            Role gates
          </a>
          <a className="nav-link" href="#pipeline">
            <RadioTower size={16} aria-hidden="true" />
            Pipeline
          </a>
          <a className="nav-link" href="#legal">
            <FileLock2 size={16} aria-hidden="true" />
            Legal
          </a>
        </nav>

        <div className="sidebar-note">
          <strong>SSR public surface</strong>
          <span>Rendered by Next.js App Router with semantic sections, metadata, sitemap, and JSON-LD.</span>
        </div>
      </aside>

      <main id="main" className="main">
        <div className="topbar">
          <span className="topbar-title">Production readiness console</span>
          <div className="topbar-actions">
            <a className="button secondary" href="/privacy">
              <FileLock2 size={16} aria-hidden="true" />
              View privacy policy
            </a>
            <a className="button" href="/terms">
              <FileCheck2 size={16} aria-hidden="true" />
              View terms
            </a>
          </div>
        </div>

        <div className="content">
          <section id="operations" className="hero-console" aria-labelledby="operations-title">
            <div className="hero-copy">
              <div className="status-line">
                <span className="status-dot" aria-hidden="true" />
                <span>Institute operations workspace</span>
                <span aria-hidden="true">/</span>
                <span>Last reviewed {SITE.updatedAt}</span>
              </div>
              <h1 id="operations-title">A cleaner control room for every campus.</h1>
              <p className="baseline-copy">
                Edu-shii gives schools and colleges one structured workspace for users, attendance, routines, fees,
                media, messages, AI assistance, and transport. The interface keeps each institute visible while the data
                boundary stays quiet and firm.
              </p>
              <div className="readiness-list" aria-label="Readiness summary">
                {readinessItems.map(([title, body]) => (
                  <div className="readiness-item" key={title}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>
                      <strong>{title}</strong>
                      <span>{body}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div id="pipeline" className="panel" aria-labelledby="pipeline-title">
              <div className="panel-header">
                <h2 id="pipeline-title">Readiness Gates</h2>
                <span className="badge success">Active</span>
              </div>
              <div className="panel-body">
                {systems.map(([title, meta, state]) => (
                  <div className="system-row" key={title}>
                    <span>
                      <span className="row-title">{title}</span>
                      <span className="row-meta">{meta}</span>
                    </span>
                    <span className="badge success">{state}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="roles" className="section-band" aria-labelledby="roles-title">
            <div className="section-head">
              <div>
                <h2 id="roles-title">Role Boundaries</h2>
                <p>Each person lands in a workflow shaped by institute membership and daily responsibility.</p>
              </div>
              <span className="badge">RBAC mapped to RLS</span>
            </div>
            <div className="grid">
              {roles.map(({ icon: Icon, points, title }) => (
                <article className="role-card" key={title}>
                  <span className="role-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <ul className="role-list">
                    {points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="grid" aria-label="Operational workflow standards">
            <article className="drawer-spec">
              <h2>Daily Workflows</h2>
              <p>
                Attendance, routines, grades, assignments, notices, reports, and fees are grouped by role so users can
                move directly to the next useful task.
              </p>
            </article>
            <article className="toast-spec">
              <h2>Communication</h2>
              <p>
                Broadcasts, messages, reminders, and realtime updates keep institute context visible without exposing
                unrelated campus data.
              </p>
            </article>
            <article className="drawer-spec">
              <h2>Files and Media</h2>
              <p>
                Gallery items, documents, question papers, syllabi, and profile images use scoped upload paths before
                storage or processor handoff.
              </p>
            </article>
          </section>

          <section id="legal" className="panel" aria-labelledby="legal-title">
            <div className="panel-header">
              <h2 id="legal-title">Legal Surface</h2>
              <span className="badge warning">Counsel review advised</span>
            </div>
            <div className="panel-body">
              {legalRows.map(([title, meta, href]) => (
                <a className="legal-row" href={href} key={href}>
                  <span>
                    <span className="row-title">{title}</span>
                    <span className="row-meta">{meta}</span>
                  </span>
                  <span className="badge">Open</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
