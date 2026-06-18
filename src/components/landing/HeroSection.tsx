import { Mail, Users, CreditCard, Truck, Brain } from 'lucide-react';
import type { landingContent } from '../../data/landing';
import AnimatedButton from '../ui/AnimatedButton';
import BackgroundLines from './BackgroundLines';
import ContainerTextFlip from './ContainerTextFlip';
import ProductMockup from './ProductMockup';
import Wordmark from './Wordmark';

type HeroSectionProps = {
  hero: typeof landingContent.hero;
  mockup: typeof landingContent.mockup;
};

export default function HeroSection({ hero, mockup }: HeroSectionProps) {
  return (
    <section className="tl-hero" aria-labelledby="landing-title">
      <BackgroundLines />
      <div className="tl-hero-background" aria-hidden="true">
        {/* Original geometric shapes */}
        <span className="tl-pencil tl-pencil-one" />
        <span className="tl-pencil tl-pencil-two" />
        <span className="tl-book-shape" />

        {/* Additional welcoming, organic shapes */}
        <span className="tl-welcoming-shape tl-welcoming-one" aria-label="Welcoming shape" />
        <span className="tl-welcoming-shape tl-welcoming-two" aria-label="Welcoming shape" />
        <span className="tl-welcoming-shape tl-welcoming-three" aria-label="Welcoming shape" />
      </div>

      <div className="tl-container tl-hero-grid">
        <div className="tl-hero-copy">
          <span className="tl-eyebrow">{hero.badge}</span>
          <h1 id="landing-title">{hero.title}</h1>
          <div className="tl-hero-flip-line" aria-label={`Built to keep ${hero.flipWords.join(', ')} in sync`}>
            Built to keep <ContainerTextFlip words={hero.flipWords} /> in sync.
          </div>
          <p>{hero.description}</p>
          <div className="tl-hero-actions">
            <AnimatedButton href={hero.primaryCta.href} size="lg">
              {hero.primaryCta.label}
            </AnimatedButton>
            <AnimatedButton href={hero.secondaryCta.href} size="lg" variant="secondary">
              {hero.secondaryCta.label}
            </AnimatedButton>
          </div>
          <div className="tl-contact-strip" id="contact">
            <span>{hero.contactCta.text}</span>
            <a href={hero.contactCta.href}>
              <Mail size={16} aria-hidden="true" />
              {hero.contactCta.label}
            </a>
          </div>
        </div>

        <div className="tl-hero-visual">
          <div className="tl-hero-brand-card" aria-label="Shii-Edu product brand">
            <Wordmark />
            <span>Role-specific software for serious campus work.</span>
          </div>
          <div className="tl-hero-pulse-panel" aria-label="Live product signals">
            <span>
              <Users size={14} aria-hidden="true" className="tl-hero-pulse-icon" />
              Role sync
            </span>
            <span>
              <CreditCard size={14} aria-hidden="true" className="tl-hero-pulse-icon" />
              Fee review
            </span>
            <span>
              <Truck size={14} aria-hidden="true" className="tl-hero-pulse-icon" />
              Route handoff
            </span>
          </div>
          <ProductMockup mockup={mockup} />
          <div className="tl-hero-metrics" aria-label="Product highlights">
            {hero.metrics.map((metric, index) => {
              // Define icons for each metric based on label
              const iconMap: Record<string, any> = {
                'installable role apps': Users,
                'monthly plans from': CreditCard,
                'Max AI report tier': Brain,
              };

              const Icon = iconMap[metric.label] || Users;

              return (
                <span key={metric.label} className="tl-hero-metric-item">
                  <Icon size={16} aria-hidden="true" className="tl-hero-metric-icon" />
                  <span className="tl-hero-metric-value">{metric.value}</span>
                  <small className="tl-hero-metric-label">{metric.label}</small>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
