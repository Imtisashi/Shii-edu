export type BrandInstitutionType = 'COLLEGE' | 'PLATFORM' | 'SCHOOL';
export type BrandThemeMode = 'dark' | 'light';

export type InstitutionBrandingPalette = {
  accentColor: string;
  backgroundColor: string;
  description: string;
  id: string;
  mode: BrandThemeMode;
  name: string;
  primaryColor: string;
  secondaryColor: string;
};

export const INSTITUTION_BRANDING_PALETTES: InstitutionBrandingPalette[] = [
  {
    id: 'verdant-campus',
    name: 'Verdant Campus',
    description: 'Confident teal and living green.',
    mode: 'dark',
    primaryColor: '#0F766E',
    secondaryColor: '#22C55E',
    accentColor: '#5EEAD4',
    backgroundColor: '#09090B',
  },
  {
    id: 'ocean-scholar',
    name: 'Ocean Scholar',
    description: 'Academic blue with crisp cyan.',
    mode: 'dark',
    primaryColor: '#1D4ED8',
    secondaryColor: '#06B6D4',
    accentColor: '#67E8F9',
    backgroundColor: '#09090B',
  },
  {
    id: 'royal-campus',
    name: 'Royal Campus',
    description: 'Regal violet with a gold signal.',
    mode: 'dark',
    primaryColor: '#7C3AED',
    secondaryColor: '#F59E0B',
    accentColor: '#C4B5FD',
    backgroundColor: '#09090B',
  },
  {
    id: 'crimson-honor',
    name: 'Crimson Honor',
    description: 'Ceremonial red with warm gold.',
    mode: 'dark',
    primaryColor: '#B91C1C',
    secondaryColor: '#F59E0B',
    accentColor: '#FCA5A5',
    backgroundColor: '#09090B',
  },
  {
    id: 'graphite-signal',
    name: 'Graphite Signal',
    description: 'Neutral charcoal with clear sky blue.',
    mode: 'dark',
    primaryColor: '#0284C7',
    secondaryColor: '#64748B',
    accentColor: '#7DD3FC',
    backgroundColor: '#09090B',
  },
  {
    id: 'rose-copper',
    name: 'Rose and Copper',
    description: 'Editorial rose balanced by copper.',
    mode: 'dark',
    primaryColor: '#BE185D',
    secondaryColor: '#B45309',
    accentColor: '#FDA4AF',
    backgroundColor: '#09090B',
  },
  {
    id: 'ivory-academy',
    name: 'Ivory Academy',
    description: 'Flat white with navy and heritage gold.',
    mode: 'light',
    primaryColor: '#1E3A8A',
    secondaryColor: '#B7791F',
    accentColor: '#92400E',
    backgroundColor: '#F8FAFC',
  },
  {
    id: 'porcelain-sky',
    name: 'Porcelain Sky',
    description: 'Flat white-blue with scholarly depth.',
    mode: 'light',
    primaryColor: '#1D4ED8',
    secondaryColor: '#0369A1',
    accentColor: '#0E7490',
    backgroundColor: '#F8FAFC',
  },
  {
    id: 'mint-paper',
    name: 'Mint Paper',
    description: 'Flat white with confident teal.',
    mode: 'light',
    primaryColor: '#0F766E',
    secondaryColor: '#15803D',
    accentColor: '#047857',
    backgroundColor: '#F8FAFC',
  },
  {
    id: 'blush-ledger',
    name: 'Blush Ledger',
    description: 'Flat white with editorial burgundy.',
    mode: 'light',
    primaryColor: '#9F1239',
    secondaryColor: '#B45309',
    accentColor: '#BE123C',
    backgroundColor: '#F8FAFC',
  },
];

export const DEFAULT_PALETTE_BY_TYPE: Record<BrandInstitutionType, string> = {
  COLLEGE: 'ivory-academy',
  PLATFORM: 'porcelain-sky',
  SCHOOL: 'mint-paper',
};

export const normalizeBrandInstitutionType = (value: unknown): BrandInstitutionType => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'COLLEGE') return 'COLLEGE';
  if (normalized === 'PLATFORM') return 'PLATFORM';
  return 'SCHOOL';
};

export const getInstitutionBrandingPalette = (
  paletteId: unknown,
  institutionType: unknown
): InstitutionBrandingPalette => {
  const normalizedId = String(paletteId || '').trim().toLowerCase();
  const fallbackId = DEFAULT_PALETTE_BY_TYPE[normalizeBrandInstitutionType(institutionType)];

  return INSTITUTION_BRANDING_PALETTES.find((palette) => palette.id === normalizedId) ||
    INSTITUTION_BRANDING_PALETTES.find((palette) => palette.id === fallbackId) ||
    INSTITUTION_BRANDING_PALETTES[0];
};
