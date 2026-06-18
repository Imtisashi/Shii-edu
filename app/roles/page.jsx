import { routeMetadata } from '../lib/site';
import StudyDoodleField from '../components/StudyDoodleField';
import RoleAppShowcase from './RoleAppShowcase';
import Image from 'next/image';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const onboardingMailto = 'mailto:sashimiofficials@gmail.com?subject=Institute%20onboarding%20request';

export function generateMetadata() {
  return routeMetadata({
    description: 'Choose the right Shii-Edu entrance for Institute, Parents, or Driver access.',
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
      <StudyDoodleField className="role-doodle-field" />
      <nav className="role-choice-topbar" aria-label="Role page">
        <a className="role-choice-brand" href="/" aria-label="Shii-Edu home">
          <Image src="/shii-edu-logo.png" alt="Shii-Edu" width={160} height={50} style={{ objectFit: 'contain' }} />
          <span style={{ marginLeft: '1rem', borderLeft: '1px solid #ccc', paddingLeft: '1rem', display: 'flex', alignItems: 'center' }}>
            Choose your entrance
          </span>
        </a>
        <div className="role-choice-toplinks">
          <a href="/">Home</a>
          <a href="#register">Register</a>
        </div>
      </nav>

      <section className="role-choice-shell role-choice-shell-simplified">
        <div className="role-choice-intro-modern">
          <h1>Welcome to Shii-Edu.</h1>
          <p>
            Choose your entrance to securely sign in or download the mobile app.
          </p>
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
