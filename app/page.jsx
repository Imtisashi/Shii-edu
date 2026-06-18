import EnhancedLanding from './components/EnhancedLanding';
import { landingJsonLd } from '../src/data/landing';
import { routeMetadata, SITE } from './lib/site';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const description =
  'Shii-Edu is a premium institute operations platform for academics, fees, communication, files, transport, and role-aware administration.';

export function generateMetadata() {
  return routeMetadata({
    description,
    path: '/',
    title: SITE.name,
  });
}

export default function HomePage() {
  return (
    <>
      <EnhancedLanding />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...landingJsonLd,
            description,
            url: SITE.origin,
          }),
        }}
        type="application/ld+json"
      />
    </>
  );
}
