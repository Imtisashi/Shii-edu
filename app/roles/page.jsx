import { routeMetadata } from '../lib/site';
import RoleAppShowcase from './RoleAppShowcase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const onboardingMailto = 'mailto:sashimiofficials@gmail.com?subject=Institute%20onboarding%20request';
const isolationPoints = [
  ['Unique install identity', 'Each role has its own manifest ID, app name, icon, start URL, and Android launcher entry.'],
  ['Locked app scope', 'Installed apps launch inside /app/institute, /app/parents, or /app/driver instead of one shared shell.'],
  ['Role-only access', 'The app shell and login screen expose the selected role only, then server-backed auth checks the account role.'],
];

export function generateMetadata() {
  return routeMetadata({
    description: 'Choose the Shii-Edu role app for Institute, Parents, or Driver access.',
    path: '/roles',
    title: 'Choose your role',
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
      <nav className="role-choice-topbar" aria-label="Role page">
        <a className="role-choice-brand" href="/" aria-label="Shii-Edu home">
          <img src="/icon.png" alt="" width="44" height="44" />
          <span>
            <ShiiEduWordmark />
            <span>Three role apps</span>
          </span>
        </a>
        <div className="role-choice-toplinks">
          <a href="/">Home</a>
          <a href="#register">Register</a>
        </div>
      </nav>

      <section className="role-choice-shell">
        <div className="role-choice-intro">
          <span>Installable role workspaces</span>
          <h1>Choose your role.</h1>
          <p>
            Institute, Parents, and Driver users land in different auth flows, manifests, notification contexts, and
            app surfaces. Each one stays white, crisp, and tuned for the work that role actually does.
          </p>
        </div>

        <div className="role-choice-isolation" aria-label="PWA isolation checks">
          {isolationPoints.map(([title, copy]) => (
            <div className="role-choice-isolation-cell" key={title}>
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          ))}
        </div>

        <RoleAppShowcase />

        <footer className="role-choice-register" id="register">
          <span>
            <strong>Is your institute not registered?</strong>
            <em>Contact us to onboard your campus before creating role accounts.</em>
          </span>
          <a href={onboardingMailto}>Contact for Registration</a>
        </footer>
      </section>
    </main>
  );
}
