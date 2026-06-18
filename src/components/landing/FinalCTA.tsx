import { Mail } from 'lucide-react';
import type { landingContent } from '../../data/landing';
import AnimatedButton from '../ui/AnimatedButton';
import Reveal from '../motion/Reveal';
import Wordmark from './Wordmark';

type FinalCTAProps = {
  contact: typeof landingContent.hero.contactCta;
  primary: typeof landingContent.hero.primaryCta;
};

export default function FinalCTA({ contact, primary }: FinalCTAProps) {
  return (
    <section className="tl-final-cta" aria-labelledby="final-cta-title">
      <div className="tl-container">
        <Reveal className="tl-final-shell">
          <div>
            <Wordmark />
            <h2 id="final-cta-title">Ready to get started?</h2>
            <p>
              Begin with a beautiful welcome page that guides everyone to their perfect workspace.
              It&apos;s simple, intuitive, and designed to make your institute feel right at home.
            </p>
          </div>
          <div className="tl-final-actions">
            <AnimatedButton href={primary.href} size="lg">
              {primary.label}
            </AnimatedButton>
            <AnimatedButton href={contact.href} icon={<Mail size={16} aria-hidden="true" />} size="lg" variant="secondary">
              {contact.label}
            </AnimatedButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
