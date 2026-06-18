import type { landingContent } from '../../data/landing';
import Reveal from '../motion/Reveal';

type FutureOfWorkSectionProps = {
  editorial: typeof landingContent.editorial;
};

export default function FutureOfWorkSection({ editorial }: FutureOfWorkSectionProps) {
  return (
    <section className="tl-section tl-editorial-section" aria-labelledby="future-work-title">
      <div className="tl-container tl-editorial-grid">
        <Reveal className="tl-editorial-copy">
          <span className="tl-eyebrow">{editorial.eyebrow}</span>
          <h2 id="future-work-title">{editorial.title}</h2>
          <p>{editorial.body}</p>
        </Reveal>

        <div className="tl-editorial-cards">
          {editorial.cards.map((card, index) => (
            <Reveal className="tl-editorial-card" delay={index * 0.06} key={card.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
