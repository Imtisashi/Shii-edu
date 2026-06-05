const configuredOrigins = String(process.env.APP_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const productionOrigin = configuredOrigins.find((origin) => /^https:\/\/.+/i.test(origin));

export const SITE = {
  name: 'Shii-Edu',
  origin: process.env.NEXT_PUBLIC_APP_ORIGIN || productionOrigin || 'https://shii-edu.vercel.app',
  description:
    'Shii-Edu is an education operations platform for institute administration, academics, fees, media, notices, and transport workflows.',
  updatedAt: '2026-06-04',
};

SITE.organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  applicationCategory: 'EducationalApplication',
  dateModified: SITE.updatedAt,
  description: SITE.description,
  name: SITE.name,
  operatingSystem: 'Web, iOS, Android',
  url: SITE.origin,
};

export function routeMetadata({ description, path, title, type = 'website' }) {
  const url = `${SITE.origin}${path}`;
  const fullTitle = title === SITE.name ? SITE.name : `${title} | ${SITE.name}`;

  return {
    alternates: {
      canonical: url,
    },
    description,
    icons: {
      apple: '/icon.png',
      icon: [
        {
          type: 'image/png',
          url: '/icon.png',
        },
      ],
      shortcut: '/icon.png',
    },
    metadataBase: new URL(SITE.origin),
    openGraph: {
      description,
      images: [
        {
          alt: `${SITE.name} app icon`,
          height: 512,
          url: '/icon.png',
          width: 512,
        },
      ],
      siteName: SITE.name,
      title: fullTitle,
      type,
      url,
    },
    robots: {
      follow: true,
      index: true,
    },
    title: fullTitle,
    twitter: {
      card: 'summary',
      description,
      images: ['/icon.png'],
      title: fullTitle,
    },
  };
}

export function absoluteUrl(path) {
  return `${SITE.origin}${path}`;
}
