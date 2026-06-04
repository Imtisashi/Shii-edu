import { FileWarning } from 'lucide-react';

export default function NotFound() {
  return (
    <main id="main" className="legal-page">
      <article className="legal-layout">
        <header className="legal-header">
          <span className="badge warning">
            <FileWarning size={14} aria-hidden="true" />
            Not found
          </span>
          <h1>Page not found</h1>
          <p>The requested Shii-Edu route is not available on the public SSR surface.</p>
          <a className="button" href="/">
            Return to operations
          </a>
        </header>
      </article>
    </main>
  );
}
