import { ArrowRight, BadgeCheck, Bus, Landmark, Users } from 'lucide-react';
import { routeMetadata, SITE } from '../lib/site';
import RoleInstallButton from './RoleInstallButton';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const roles = [
  {
    accent: '#635BFF',
    href: '/auth/institute',
    icon: Landmark,
    installHref: '/manifest-institute.webmanifest',
    label: 'Institute',
    title: 'Institute workspace',
    body: 'For admins, teachers, and students who need attendance, routines, notices, fees, uploads, reports, and role-specific tools.',
    features: ['Admin and teacher workflows', 'Student academic access', 'Institute-branded workspace'],
  },
  {
    accent: '#0F766E',
    href: '/auth/parents',
    icon: Users,
    installHref: '/manifest-parents.webmanifest',
    label: 'Parents',
    title: 'Parent access',
    body: 'For parents and guardians checking fee status, notices, student updates, messages, and transport visibility.',
    features: ['Linked student updates', 'Fee and notice visibility', 'Focused guardian console'],
  },
  {
    accent: '#B45309',
    href: '/auth/driver',
    icon: Bus,
    installHref: '/manifest-driver.webmanifest',
    label: 'Driver',
    title: 'Driver route console',
    body: 'For drivers managing route status, assigned destinations, live location sharing, and field-ready transport actions.',
    features: ['Map-first route view', 'Assigned destination list', 'Large accessible controls'],
  },
];

export function generateMetadata() {
  return routeMetadata({
    description: 'Choose the Shii-Edu role app for Institute, Parents, or Driver access.',
    path: '/roles',
    title: 'Choose role',
  });
}

function ShiiEduWordmark() {
  return (
    <span className="shii-wordmark role-choice-wordmark" aria-label="Shii-Edu">
      <span className="shii-wordmark-major">S</span>
      <span className="shii-wordmark-rest">HII-</span>
      <span className="shii-wordmark-major">E</span>
      <span className="shii-wordmark-rest">DU</span>
    </span>
  );
}

export default function RoleChoicePage() {
  return (
    <main id="main" className="role-choice-page">
      <section className="container-xxl role-choice-shell">
        <div className="row g-3 align-items-stretch">
          <div className="col-12 col-xl-5">
            <div className="role-choice-hero h-100">
              <a className="role-choice-brand" href="/" aria-label="Shii-Edu home">
                <img src="/icon.png" alt="" width="44" height="44" />
                <span>
                  <ShiiEduWordmark />
                  <span>Role selection</span>
                </span>
              </a>
              <div className="role-choice-copy">
                <div className="role-choice-status">
                  <BadgeCheck size={17} aria-hidden="true" />
                  Three installable app identities
                </div>
                <h1>Choose the Shii-Edu app that matches your account.</h1>
                <p>
                  Institute, Parents, and Driver access use separate start URLs and manifests. Pick the correct role so
                  the installed app opens directly into the right auth flow.
                </p>
              </div>
              <div className="role-choice-note">
                <strong>Need institute registration?</strong>
                <a href="mailto:sashimiofficials@gmail.com?subject=Institute%20onboarding%20request">
                  Contact for Registration
                </a>
              </div>
            </div>
          </div>
          <div className="col-12 col-xl-7">
            <div className="row g-3">
              {roles.map(({ accent, body, features, href, icon: Icon, installHref, label, title }) => (
                <div className="col-12" key={label}>
                  <article className="role-choice-card" style={{ '--role-accent': accent }}>
                    <div className="role-choice-card-icon">
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <div className="role-choice-card-copy">
                      <span>{label}</span>
                      <h2>{title}</h2>
                      <p>{body}</p>
                      <div className="role-choice-feature-row" aria-label={`${label} features`}>
                        {features.map((feature) => <em key={feature}>{feature}</em>)}
                      </div>
                    </div>
                    <div className="role-choice-actions">
                      <a className="role-choice-open" href={href}>
                        Open auth
                        <ArrowRight size={17} aria-hidden="true" />
                      </a>
                      <RoleInstallButton accent={accent} label={`Shii-Edu ${label}`} manifestHref={installHref} />
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
