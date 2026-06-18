import { ArrowRight } from 'lucide-react';
import type { ResourceCard } from '../../data/landing';
import Reveal from '../motion/Reveal';

type ResourcesSectionProps = {
  resources: ResourceCard[];
};

export default function ResourcesSection({ resources }: ResourcesSectionProps) {
  return (
    <section className="tl-section tl-resource-section" id="resources" aria-labelledby="resources-title">
      <div className="tl-container">
        <Reveal className="tl-section-heading">
          <span className="tl-eyebrow">Resources</span>
          <h2 id="resources-title">Helpful guides and information</h2>
          <p>
            Find clear, practical resources to help you understand Shii-Edu and make the best decision
            for your institute. No jargon, just helpful information.
          </p>
        </Reveal>

        <div className="tl-resource-grid">
          {resources.map((resource, index) => (
            <Reveal className="tl-resource-card" delay={index * 0.04} key={resource.title}>
              <span>{resource.category}</span>
              <h3>{resource.title}</h3>
              <p>{resource.summary}</p>
              <a href={resource.href}>
                {resource.cta}
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
