import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bus,
  CalendarCheck2,
  ClipboardCheck,
  FileCheck2,
  FileLock2,
  GraduationCap,
  Landmark,
  Layers3,
  Mail,
  MessageSquareText,
  Palette,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
  Workflow,
} from 'lucide-react';
import CinematicLandingStage from './components/CinematicLandingStage';
import AnimatedSignInLink from './components/AnimatedSignInLink';
import LandingRoleExplorer from './components/LandingRoleExplorer';
import PixelCampusArtifact from './components/PixelCampusArtifact';
import { routeMetadata, SITE } from './lib/site';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const description =
  'Shii-Edu is an institute-branded education operations workspace for academics, communication, payments, media, transport, and role-aware administration.';

export function generateMetadata() {
  return routeMetadata({
    description,
    path: '/',
    title: SITE.name,
  });
}

const workstreams = [
  {
    icon: CalendarCheck2,
    title: 'Academic rhythm',
    body: 'Attendance, routines, grades, assignments, notices, and reports stay connected to daily classroom work.',
  },
  {
    icon: MessageSquareText,
    title: 'Communication',
    body: 'Broadcasts, reminders, messages, and realtime updates carry the correct institute context.',
  },
  {
    icon: UploadCloud,
    title: 'Files and media',
    body: 'Gallery items, question papers, syllabi, profile images, and course files use scoped upload paths.',
  },
  {
    icon: Bus,
    title: 'Transport view',
    body: 'Drivers and operators get route visibility, live status, and controls without extra admin screens.',
  },
];

const roleGroups = [
  {
    icon: ShieldCheck,
    title: 'Superadmin',
    body: 'Provision institutes, review platform health, and recover workspaces from one governed surface.',
  },
  {
    icon: Landmark,
    title: 'Institute admin',
    body: 'Manage people, fees, notices, branding, schedules, imports, and operational controls.',
  },
  {
    icon: GraduationCap,
    title: 'Teachers',
    body: 'Take attendance, upload work, review routines, publish grades, and respond from focused views.',
  },
  {
    icon: Users,
    title: 'Students and parents',
    body: 'Read notices, routines, fees, reports, course progress, and transport updates in role-aware screens.',
  },
];

const featureGroups = [
  {
    icon: ClipboardCheck,
    title: 'Academics',
    items: ['Attendance', 'Routines', 'Assignments', 'Grades', 'Reports'],
  },
  {
    icon: MessageSquareText,
    title: 'Communication',
    items: ['Broadcasts', 'Notifications', 'Messages', 'Office hours'],
  },
  {
    icon: ReceiptText,
    title: 'Operations',
    items: ['Fee ledger', 'Manual receipts', 'User imports', 'Tier controls'],
  },
  {
    icon: BookOpen,
    title: 'Learning Library',
    items: ['Courses', 'Gallery', 'PYQ PDFs', 'Syllabus files'],
  },
  {
    icon: Bus,
    title: 'Transport',
    items: ['Driver console', 'Live fleet', 'Route status', 'Vehicle context'],
  },
  {
    icon: Sparkles,
    title: 'AI-powered review',
    items: ['Syllabus tutor', 'CSV mapping review', 'Smart compose', 'Substitute scheduling'],
  },
];

const uiScreenshots = [
  {
    accent: 'violet',
    icon: ShieldCheck,
    metrics: ['Tiers', 'Institutes', 'Audit'],
    role: 'Superadmin',
    rows: ['Feature access matrix', 'Institute health', 'Recovery queue'],
    title: 'Tier and institute control',
  },
  {
    accent: 'indigo',
    icon: Landmark,
    metrics: ['Fees', 'Payroll', 'Routes'],
    role: 'Admin',
    rows: ['Quick access panel', 'Teacher payroll monitor', 'Driver route assignment'],
    title: 'Operations dashboard',
  },
  {
    accent: 'teal',
    icon: GraduationCap,
    metrics: ['Roster', 'Grades', 'AI'],
    role: 'Teacher',
    rows: ['Attendance grid', 'Assignment upload', 'AI-powered syllabus review'],
    title: 'Classroom workspace',
  },
  {
    accent: 'slate',
    icon: BookOpen,
    metrics: ['Courses', 'Fees', 'PYQ'],
    role: 'Student',
    rows: ['Routine timeline', 'Course player', 'Report card preview'],
    title: 'Student portal',
  },
  {
    accent: 'emerald',
    icon: Users,
    metrics: ['Alerts', 'Fees', 'Fleet'],
    role: 'Parents',
    rows: ['Linked student view', 'Fee status', 'Institute notices'],
    title: 'Guardian companion',
  },
  {
    accent: 'amber',
    icon: Bus,
    metrics: ['Map', 'Route', 'Status'],
    role: 'Driver',
    rows: ['Live map panel', 'Assigned stops', 'Large route controls'],
    title: 'Route console',
  },
];

const differenceRows = [
  {
    title: 'Institute boundaries are structural.',
    body: 'Routes, uploads, payments, messages, and Supabase mirror data carry the institute ID instead of relying on loose UI filters.',
  },
  {
    title: 'Subscription tiers are controlled by Superadmin.',
    body: 'A campus can run Starter, Growth, or Complete, then override individual modules when a contract needs a special exception.',
  },
  {
    title: 'The brand follows the campus.',
    body: 'Admin theme choices travel to teachers, students, parents, and drivers with the same institute ID.',
  },
  {
    title: 'Roles do not inherit clutter.',
    body: 'Teacher, parent, student, and driver navigation only shows the tools that match their work and tier.',
  },
];

const trustRows = [
  ['Institute data boundary', 'Row-level policies keep each campus workspace scoped to its members.', 'Active'],
  ['Payment metadata', 'No raw card, CVV, UPI credential, or banking secret is stored.', 'Minimal'],
  ['Signed media uploads', 'Files are routed through institute and purpose-specific storage paths.', 'Scoped'],
  ['Public legal surface', 'Privacy, terms, robots, sitemap, metadata, and JSON-LD are server-rendered.', 'Ready'],
];

const legalRows = [
  ['Privacy Policy', 'DPDP aligned, COPPA-aware, processor and controller boundaries', '/privacy'],
  ['Terms of Service', 'Role access, uploads, AI, transport, indemnity, liability limits', '/terms'],
];

const onboardingMailto =
  'mailto:sashimiofficials@gmail.com?subject=Institute%20onboarding%20request&body=Hello%20Shii-Edu%20team%2C%0A%0APlease%20contact%20us%20about%20registering%20our%20institute.%0A%0AInstitute%20name%3A%0AContact%20person%3A%0APhone%3A';

function ShiiEduWordmark({ className = '' }) {
  return (
    <span className={`shii-wordmark ${className}`.trim()} aria-label="Shii-Edu">
      <span className="shii-wordmark-major">S</span>
      <span className="shii-wordmark-rest">HII-</span>
      <span className="shii-wordmark-major">E</span>
      <span className="shii-wordmark-rest">DU</span>
    </span>
  );
}

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
    <div className="landing-page landing-v2">
      <header className="landing-nav" aria-label="Primary">
        <a className="landing-brand" href="/" aria-label="Shii-Edu home">
          <img src="/icon.png" alt="" width="40" height="40" />
          <span>
            <strong><ShiiEduWordmark className="nav-wordmark" /></strong>
            <span>Institute workspace</span>
          </span>
        </a>

        <nav className="landing-links" aria-label="Home sections">
          <a href="#workspace">Workspace</a>
          <a href="#features">Features</a>
          <a href="#screenshots">Screenshots</a>
          <a href="#roles">Roles</a>
          <a href="#different">Different</a>
          <a href="#theme">Theme</a>
          <a href="#trust">Trust</a>
          <a href="#legal">Legal</a>
        </nav>

        <AnimatedSignInLink />
      </header>

      <main id="main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <div className="landing-kicker">
              <span className="status-dot" aria-hidden="true" />
              <span>Secure entry for real campus work</span>
            </div>
            <h1 id="landing-title"><ShiiEduWordmark className="hero-wordmark" /></h1>
            <p className="landing-hero-line">
              A precise operations platform for institutes that need attendance, routines, notices, fees, uploads,
              reports, transport, and role-aware administration under one branded workspace.
            </p>
            <div className="landing-actions">
              <a className="landing-primary-action" href="/roles">
                Login
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a className="landing-secondary-action" href="#workspace">
                Explore workspace
              </a>
            </div>
            <PixelCampusArtifact />
            <div className="landing-onboarding">
              <span>Is your institute not registered? Contact us to onboard.</span>
              <a className="landing-contact-action" href={onboardingMailto}>
                <Mail size={17} aria-hidden="true" />
                Contact for Registration
              </a>
            </div>
          </div>

          <CinematicLandingStage />
        </section>

        <section id="workspace" className="landing-band workspace-band" aria-labelledby="workspace-title">
          <div className="landing-section-head">
            <Layers3 size={22} aria-hidden="true" />
            <div>
              <h2 id="workspace-title">The day runs through one clean surface.</h2>
              <p>
                Shii-Edu keeps each school or college visible through workspace name, logo, colors, and role-specific
                navigation while shared infrastructure handles the heavy lifting.
              </p>
            </div>
          </div>
          <div className="workstream-grid">
            {workstreams.map(({ body, icon: Icon, title }) => (
              <article className="workstream-item" key={title}>
                <span className="workstream-icon">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="features" className="landing-band features-band" aria-labelledby="features-title">
          <div className="landing-section-head">
            <BadgeCheck size={22} aria-hidden="true" />
            <div>
              <h2 id="features-title">The full platform map, not a thin school app.</h2>
              <p>
                Shii-Edu covers academics, communication, finance, media, transport, and AI-powered review. Superadmin
                can turn these modules into institute tiers without changing code for every campus.
              </p>
            </div>
          </div>
          <div className="feature-map" aria-label="Shii-Edu feature groups">
            {featureGroups.map(({ icon: Icon, items, title }) => (
              <article className="feature-cluster" key={title}>
                <div className="feature-cluster-head">
                  <Icon size={19} aria-hidden="true" />
                  <h3>{title}</h3>
                </div>
                <div className="feature-pills">
                  {items.map((item) => <span key={item}>{item}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="screenshots" className="landing-band screenshot-band" aria-labelledby="screenshots-title">
          <div className="landing-section-head">
            <Sparkles size={22} aria-hidden="true" />
            <div>
              <h2 id="screenshots-title">Screenshots of every role UI.</h2>
              <p>
                Each screenshot frame maps to the surface Shii-Edu separates by role: platform control, institute admin,
                classroom work, student access, guardian updates, and driver transport.
              </p>
            </div>
          </div>
          <div className="ui-screenshot-grid" aria-label="Shii-Edu role UI screenshots">
            {uiScreenshots.map(({ accent, icon: Icon, metrics, role, rows, title }, index) => (
              <article
                className={`ui-shot ui-shot-${accent}`}
                key={role}
                style={{ '--shot-delay': `${index * 80}ms` }}
              >
                <div className="ui-shot-window">
                  <div className="ui-shot-topbar">
                    <span aria-hidden="true" />
                    <strong>{role}</strong>
                    <em>UI</em>
                  </div>
                  <div className="ui-shot-hero">
                    <span className="ui-shot-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <p>{title}</p>
                      <h3>{role} workspace</h3>
                    </div>
                  </div>
                  <div className="ui-shot-metrics">
                    {metrics.map((metric) => (
                      <span key={metric}>{metric}</span>
                    ))}
                  </div>
                  <div className="ui-shot-rows">
                    {rows.map((row) => (
                      <span key={row}>
                        <i aria-hidden="true" />
                        {row}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="explorer" className="landing-band explorer-band" aria-labelledby="explorer-title">
          <div className="landing-section-head">
            <Workflow size={22} aria-hidden="true" />
            <div>
              <h2 id="explorer-title">Pick a role and the surface changes shape.</h2>
              <p>
                The app is built around working roles, not one oversized menu. The home page mirrors that behavior so
                mobile visitors can understand the product by touching it.
              </p>
            </div>
          </div>
          <LandingRoleExplorer />
        </section>

        <section id="roles" className="landing-band roles-band" aria-labelledby="roles-title">
          <div className="landing-section-head">
            <Users size={22} aria-hidden="true" />
            <div>
              <h2 id="roles-title">Every role gets the amount of product it needs.</h2>
              <p>
                Admins need control, teachers need speed, parents need clarity, and drivers need route context. The
                application keeps those responsibilities separated.
              </p>
            </div>
          </div>
          <div className="role-lanes">
            {roleGroups.map(({ body, icon: Icon, title }) => (
              <article className="role-lane" key={title}>
                <Icon size={20} aria-hidden="true" />
                <span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </span>
              </article>
            ))}
          </div>
        </section>

        <section id="different" className="landing-band difference-band" aria-labelledby="different-title">
          <div className="landing-section-head">
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <h2 id="different-title">What separates Shii-Edu from generic education apps.</h2>
              <p>
                The product is opinionated about tenant boundaries, role-specific work, and subscription control. Those
                details matter when a real institute operates the system every day.
              </p>
            </div>
          </div>
          <div className="difference-grid">
            {differenceRows.map(({ body, title }) => (
              <article className="difference-row" key={title}>
                <span aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="theme" className="landing-band theme-band" aria-labelledby="theme-title">
          <div className="theme-copy">
            <Palette size={22} aria-hidden="true" />
            <div>
              <h2 id="theme-title">Admin theme changes travel with the institute.</h2>
              <p>
                The Brand Studio stores palette and logo choices against the institute record, so admins, teachers,
                students, parents, and drivers with the same institute ID see the same identity.
              </p>
            </div>
          </div>
          <div className="theme-panel" aria-hidden="true">
            <div className="theme-panel-top">
              <span />
              <strong>Brand Studio</strong>
              <em>Live</em>
            </div>
            <div className="theme-swatches">
              <span className="theme-swatch ink" />
              <span className="theme-swatch violet" />
              <span className="theme-swatch teal" />
              <span className="theme-swatch gold" />
            </div>
            <div className="theme-preview-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>

        <section id="trust" className="landing-band trust-band" aria-labelledby="trust-title">
          <div className="landing-section-head">
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <h2 id="trust-title">Trust is part of the interface.</h2>
              <p>
                Access boundaries, upload handling, payment limits, and legal pages are visible where they matter,
                without turning daily work into a security manual.
              </p>
            </div>
          </div>
          <div className="trust-table">
            {trustRows.map(([title, body, state]) => (
              <div className="trust-row" key={title}>
                <span>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </span>
                <em>{state}</em>
              </div>
            ))}
          </div>
        </section>

        <section id="legal" className="landing-band legal-band" aria-labelledby="legal-title">
          <div className="landing-section-head">
            <FileLock2 size={22} aria-hidden="true" />
            <div>
              <h2 id="legal-title">Public pages are ready to share.</h2>
              <p>
                The home page, policy pages, sitemap, robots file, and metadata render from the server for a stable
                public entry point.
              </p>
            </div>
          </div>
          <div className="legal-link-grid">
            {legalRows.map(([title, body, href]) => (
              <a className="legal-link-card" href={href} key={href}>
                <FileCheck2 size={18} aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
