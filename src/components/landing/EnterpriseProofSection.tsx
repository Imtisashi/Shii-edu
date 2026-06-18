import { Fingerprint, Layers3, MapPinned, ReceiptText, Sparkles, UsersRound } from 'lucide-react';
import type { ProofCard } from '../../data/landing';
import Reveal from '../motion/Reveal';

type EnterpriseProofSectionProps = {
  cards: ProofCard[];
};

const iconMap = {
  fingerprint: Fingerprint,
  layers: Layers3,
  receipt: ReceiptText,
  route: MapPinned,
  spark: Sparkles,
  users: UsersRound,
};

export default function EnterpriseProofSection({ cards }: EnterpriseProofSectionProps) {
  return (
    <section className="tl-section tl-proof-section" id="enterprise-proof" aria-labelledby="proof-title">
      <div className="tl-container">
        <Reveal className="tl-section-heading">
          <span className="tl-eyebrow">Governance</span>
          <h2 id="proof-title">The controls are built into the workflow.</h2>
          <p>
            Subscription access, institute boundaries, file handling, AI usage, and transport records are designed as
            operational controls, not afterthoughts.
          </p>
        </Reveal>

        <div className="tl-proof-grid">
          {cards.map((card, index) => {
            const Icon = iconMap[card.icon];
            return (
              <Reveal className="tl-proof-card" delay={index * 0.04} key={card.title}>
                <span className="tl-proof-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
