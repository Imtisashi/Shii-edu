import './globals.css';
import { SITE } from './lib/site';
import { SubscriptionProvider } from './components/SubscriptionProvider';

export const viewport = {
  colorScheme: 'light dark',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
};

export const metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE.name,
  },
  applicationName: SITE.name,
};

export default function RootLayout({ children }) {
  return (
    <SubscriptionProvider>
      <html lang="en">
        <body>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          {children}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE.organizationJsonLd) }}
          />
        </body>
      </html>
    </SubscriptionProvider>
  );
}
