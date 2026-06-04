import {
  ArrowRight,
  Bus,
  CalendarCheck2,
  FileCheck2,
  FileLock2,
  GraduationCap,
  Landmark,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import { routeMetadata, SITE } from './lib/site';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const description =
  'Edu-shii is an institute-branded education operations workspace for academics, communication, payments, media, transport, and role-aware administration.';

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
    body: 'Attendance, routines, grades, assignments, notices, and reports stay close to the people who run them each day.',
  },
  {
    icon: MessageSquareText,
    title: 'Communication',
    body: 'Broadcasts, reminders, messages, and realtime updates carry institute context without exposing unrelated campus data.',
  },
  {
    icon: UploadCloud,
    title: 'Files and media',
    body: 'Gallery items, question papers, syllabi, profile images, and course files use scoped upload paths before storage.',
  },
  {
    icon: Bus,
    title: 'Transport view',
    body: 'Drivers and operators get route visibility, location updates, and status controls without unnecessary admin surface area.',
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
    body: 'Manage people, fees, notices, branding, schedules, and import controls for one campus identity.',
  },
  {
    icon: GraduationCap,
    title: 'Teachers',
    body: 'Handle attendance, assignments, grades, course media, and routine review from focused teaching views.',
  },
  {
    icon: Users,
    title: 'Students and parents',
    body: 'Read notices, routines, fees, reports, course progress, and transport updates in their own role view.',
  },
];

const trustRows = [
  ['Institute data boundary', 'Row-level policies keep each campus workspace scoped to its members.', 'Active'],
  ['Payment metadata', 'No raw card, CVV, UPI credential, or banking secret is stored.', 'Minimal'],
  ['Signed media uploads', 'Files are routed through institute and purpose-specific storage paths.', 'Scoped'],
  ['Legal pages', 'Privacy, terms, robots, sitemap, metadata, and JSON-LD are server-rendered.', 'Ready'],
];

const legalRows = [
  ['Privacy Policy', 'DPDP aligned, COPPA-aware, processor/controller boundaries', '/privacy'],
  ['Terms of Service', 'Role access, uploads, AI, transport, indemnity, liability limits', '/terms'],
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
    <div className="landing-page">
      <header className="landing-nav" aria-label="Primary">
        <a className="landing-brand" href="/" aria-label="Edu-shii home">
          <img src="/assets/images/icon.png" alt="" width="40" height="40" />
          <span>
            <strong>Edu-shii</strong>
            <span>Institute workspace</span>
          </span>
        </a>

        <nav className="landing-links" aria-label="Landing sections">
          <a href="#workspace">Workspace</a>
          <a href="#roles">Roles</a>
          <a href="#trust">Trust</a>
          <a href="#legal">Legal</a>
        </nav>

        <a className="landing-login" href="/login">
          <LockKeyhole size={16} aria-hidden="true" />
          Institute login
        </a>
      </header>

      <main id="main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <video
            className="landing-hero-media"
            src="/assets/videos/cosmic-campus.mp4"
            poster="/assets/images/icon.png"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <div className="landing-hero-scrim" aria-hidden="true" />
          <div className="landing-hero-content">
            <div className="landing-kicker">
              <span className="status-dot" aria-hidden="true" />
              <span>Institute-led education operations</span>
              <span aria-hidden="true">/</span>
              <span>Last reviewed {SITE.updatedAt}</span>
            </div>
            <h1 id="landing-title">Edu-shii</h1>
            <p>
              A campus-owned workspace for attendance, routines, notices, fees, uploads, messages, reports, transport,
              and role-aware administration.
            </p>
            <div className="landing-actions">
              <a className="landing-primary-action" href="/login">
                Open institute login
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a className="landing-secondary-action" href="#workspace">
                Explore workspace
              </a>
            </div>
          </div>
        </section>

        <section id="workspace" className="landing-band workspace-band" aria-labelledby="workspace-title">
          <div className="landing-section-head">
            <Layers3 size={22} aria-hidden="true" />
            <div>
              <h2 id="workspace-title">One operational surface, branded by the institute.</h2>
              <p>
                Edu-shii keeps each school or college visible through workspace name, logo, colors, and role-specific
                navigation while the shared platform does the heavy lifting behind the scenes.
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

        <section id="roles" className="landing-band roles-band" aria-labelledby="roles-title">
          <div className="landing-section-head">
            <Users size={22} aria-hidden="true" />
            <div>
              <h2 id="roles-title">Every role gets the right amount of product.</h2>
              <p>
                Admins need control, teachers need speed, parents need clarity, and drivers need only the route view.
                Edu-shii keeps those responsibilities separate.
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
                The landing page, policy pages, sitemap, robots file, and metadata render from the server for a stable
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
