'use client';

import { motion } from 'motion/react';
import {
  BookOpenCheck,
  CreditCard,
  MapPinned,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from './MotionComponents';

const features = [
  {
    icon: Users,
    title: 'Parents get clarity, not a training manual.',
    description: 'Parent screens stay simple while admins get the tools to help families who are not comfortable with apps.',
    color: 'violet',
    bullets: ['Today, My Child, Fees, Help', 'Parent-link readiness checks', 'Office support path'],
  },
  {
    icon: BookOpenCheck,
    title: 'Teaching records stay connected.',
    description: 'Academic work is grouped by class, section, department, semester, teacher, and student visibility.',
    color: 'teal',
    bullets: ['Routines and attendance', 'Assignments and grades', 'Reports and learning files'],
  },
  {
    icon: CreditCard,
    title: 'Fee work starts with cohorts.',
    description: 'Finance teams can assign fees in groups, reconcile offline payments, and review dues without repeating the same form.',
    color: 'amber',
    bullets: ['Whole institute allocation', 'Class, section, semester scopes', 'Offline payment marking'],
  },
  {
    icon: MapPinned,
    title: 'Bus routing belongs on a map.',
    description: 'Transport records use map points and readable route labels so drivers and parents see the same assignment.',
    color: 'violet',
    bullets: ['Origin and destination coordinates', 'Driver assignment', 'Parent route visibility'],
  },
  {
    icon: MessageSquare,
    title: 'Broadcasts can collect answers.',
    description: 'Announcements can ask for structured responses when teachers or admins need choices, votes, or short opinions.',
    color: 'teal',
    bullets: ['MCQ inputs', 'Voting prompts', 'Opinion collection'],
  },
  {
    icon: Sparkles,
    title: 'AI works inside defined tools.',
    description: 'Max institutes get a bounded admin agent for approved reports and exports, not open-ended database access.',
    color: 'amber',
    bullets: ['Attendance risk reports', 'Fee follow-up exports', 'Audited daily AI limits'],
  },
];

export default function PremiumFeatures() {
  return (
    <section className="premium-features">
      <div className="premium-features-header">
        <FadeIn>
          <span className="premium-features-eyebrow">Platform capabilities</span>
          <h2 className="premium-features-title">
            Everything institutes need after launch.
          </h2>
          <p className="premium-features-subtitle">
            A complete set of modules for academics, finance, transport, parent support, and bounded AI tools.
          </p>
        </FadeIn>
      </div>

      <StaggerContainer className="premium-features-grid">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <StaggerItem key={feature.title}>
              <motion.div
                className={`premium-feature-card premium-feature-${feature.color}`}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.2 }}
              >
                <div className={`premium-feature-icon premium-feature-icon-${feature.color}`}>
                  <Icon size={24} />
                </div>
                <h3 className="premium-feature-title">{feature.title}</h3>
                <p className="premium-feature-description">{feature.description}</p>
                <ul className="premium-feature-bullets">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </section>
  );
}