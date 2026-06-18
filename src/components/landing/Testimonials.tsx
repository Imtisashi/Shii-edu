import type { Testimonial } from '../../data/landing';
import Reveal from '../motion/Reveal';

type TestimonialsProps = {
  testimonials: Testimonial[];
};

export default function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <section className="tl-section tl-testimonial-section" aria-labelledby="testimonial-title">
      <div className="tl-container">
        <Reveal className="tl-section-heading">
          <span className="tl-eyebrow">Example voice</span>
          <h2 id="testimonial-title">Use this area for approved institute feedback.</h2>
          <p>
            Until real references are approved, these cards demonstrate the intended tone and layout without presenting
            fake customers as proof.
          </p>
        </Reveal>

        <div className="tl-testimonial-grid">
          {testimonials.map((item, index) => (
            <Reveal className="tl-testimonial-card" delay={index * 0.05} key={item.role}>
              <span>{item.tag}</span>
              <blockquote>{item.quote}</blockquote>
              <footer>
                <em aria-hidden="true">{item.role.slice(0, 2).toUpperCase()}</em>
                <strong>{item.role}</strong>
              </footer>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
