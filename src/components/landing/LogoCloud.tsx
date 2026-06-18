import type { landingContent } from '../../data/landing';
import {
  ShieldCheck,
  CreditCard,
  Banknote,
  Map,
  Users,
  Upload,
  Brain,
  Palette,
  Settings,
  Code,
} from 'lucide-react';

type LogoCloudProps = {
  logos: typeof landingContent.logos;
};

export default function LogoCloud({ logos }: LogoCloudProps) {
  // Map capability names to appropriate icons
  const capabilityIcons: Record<string, any> = {
    'Role access': ShieldCheck,
    'Bulk fees': CreditCard,
    'Payroll': Banknote,
    'Route maps': Map,
    'Parent desk': Users,
    'Secure uploads': Upload,
    'AI reports': Brain,
    'Custom theme': Palette,
    'Max subdomain': Settings,
  };

  return (
    <section className="tl-logo-cloud" aria-labelledby="logo-cloud-title">
      <div className="tl-container">
        <div className="tl-logo-cloud-head">
          <span className="tl-eyebrow">{logos.eyebrow}</span>
          <p id="logo-cloud-title">
            See what&apos;s possible with Shii-Edu. Each capability is designed to make
            your institute&apos;s daily work smoother and more effective.
          </p>
        </div>
        <div className="tl-capability-board" aria-label="Product capability areas">
          {logos.items.map((name, index) => {
            const Icon = capabilityIcons[name] || Code; // Default to Code if no match
            return (
              <span className="tl-capability-item" key={name}>
                <div className="tl-capability-icon">
                  <Icon size={16} aria-hidden="true" />
                </div>
                <div className="tl-capability-text">
                  <small>{String(index + 1).padStart(2, '0')}</small>
                  <strong>{name}</strong>
                </div>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
