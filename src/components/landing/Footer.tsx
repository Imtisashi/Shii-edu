import type { landingContent } from '../../data/landing';
import Wordmark from './Wordmark';

type FooterProps = {
  footer: typeof landingContent.footer;
};

export default function Footer({ footer }: FooterProps) {
  return (
    <footer className="tl-footer">
      <div className="tl-container tl-footer-grid">
        <div className="tl-footer-brand">
          <Wordmark compact />
          <p>Institute operations for academics, fees, files, communication, transport, and role-aware access.</p>
        </div>
        {footer.columns.map((column) => (
          <div className="tl-footer-column" key={column.title}>
            <h2>{column.title}</h2>
            {column.links.map((link) => (
              <a href={link.href} key={link.label}>
                {link.label}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="tl-container tl-footer-bottom">
        <span>© {new Date().getFullYear()} Shii-Edu</span>
        <span>Built for governed institute workflows.</span>
      </div>
    </footer>
  );
}
