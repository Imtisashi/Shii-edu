const INSTITUTION_BRANDING_PALETTES = Object.freeze({
  'verdant-campus': Object.freeze({
    id: 'verdant-campus',
    name: 'Verdant Campus',
    mode: 'dark',
    primaryColor: '#0F766E',
    secondaryColor: '#22C55E',
    accentColor: '#5EEAD4',
    backgroundColor: '#020A0A',
  }),
  'ocean-scholar': Object.freeze({
    id: 'ocean-scholar',
    name: 'Ocean Scholar',
    mode: 'dark',
    primaryColor: '#1D4ED8',
    secondaryColor: '#06B6D4',
    accentColor: '#67E8F9',
    backgroundColor: '#020617',
  }),
  'royal-campus': Object.freeze({
    id: 'royal-campus',
    name: 'Royal Campus',
    mode: 'dark',
    primaryColor: '#7C3AED',
    secondaryColor: '#F59E0B',
    accentColor: '#C4B5FD',
    backgroundColor: '#070511',
  }),
  'crimson-honor': Object.freeze({
    id: 'crimson-honor',
    name: 'Crimson Honor',
    mode: 'dark',
    primaryColor: '#B91C1C',
    secondaryColor: '#F59E0B',
    accentColor: '#FCA5A5',
    backgroundColor: '#0D0505',
  }),
  'graphite-signal': Object.freeze({
    id: 'graphite-signal',
    name: 'Graphite Signal',
    mode: 'dark',
    primaryColor: '#0284C7',
    secondaryColor: '#64748B',
    accentColor: '#7DD3FC',
    backgroundColor: '#02030A',
  }),
  'rose-copper': Object.freeze({
    id: 'rose-copper',
    name: 'Rose and Copper',
    mode: 'dark',
    primaryColor: '#BE185D',
    secondaryColor: '#B45309',
    accentColor: '#FDA4AF',
    backgroundColor: '#0D050A',
  }),
  'ivory-academy': Object.freeze({
    id: 'ivory-academy',
    name: 'Ivory Academy',
    mode: 'light',
    primaryColor: '#1E3A8A',
    secondaryColor: '#B7791F',
    accentColor: '#92400E',
    backgroundColor: '#FFFDF7',
  }),
  'porcelain-sky': Object.freeze({
    id: 'porcelain-sky',
    name: 'Porcelain Sky',
    mode: 'light',
    primaryColor: '#1D4ED8',
    secondaryColor: '#0369A1',
    accentColor: '#0E7490',
    backgroundColor: '#F8FBFF',
  }),
  'mint-paper': Object.freeze({
    id: 'mint-paper',
    name: 'Mint Paper',
    mode: 'light',
    primaryColor: '#0F766E',
    secondaryColor: '#15803D',
    accentColor: '#047857',
    backgroundColor: '#F6FFFB',
  }),
  'blush-ledger': Object.freeze({
    id: 'blush-ledger',
    name: 'Blush Ledger',
    mode: 'light',
    primaryColor: '#9F1239',
    secondaryColor: '#B45309',
    accentColor: '#BE123C',
    backgroundColor: '#FFF8FA',
  }),
});

const DEFAULT_PALETTE_BY_TYPE = Object.freeze({
  COLLEGE: 'royal-campus',
  PLATFORM: 'graphite-signal',
  SCHOOL: 'verdant-campus',
});

const normalizeInstitutionType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'COLLEGE') return 'COLLEGE';
  if (normalized === 'PLATFORM') return 'PLATFORM';
  return 'SCHOOL';
};

const getDefaultPaletteId = (institutionType) => (
  DEFAULT_PALETTE_BY_TYPE[normalizeInstitutionType(institutionType)]
);

const getBrandingPalette = (paletteId, institutionType) => {
  const cleanPaletteId = String(paletteId || '').trim().toLowerCase();
  return INSTITUTION_BRANDING_PALETTES[cleanPaletteId] ||
    INSTITUTION_BRANDING_PALETTES[getDefaultPaletteId(institutionType)];
};

const createBrandingPayload = ({ paletteId, institutionType, logoUrl = null }) => {
  const palette = getBrandingPalette(paletteId, institutionType);
  return {
    paletteId: palette.id,
    paletteName: palette.name,
    mode: palette.mode,
    primaryColor: palette.primaryColor,
    secondaryColor: palette.secondaryColor,
    accentColor: palette.accentColor,
    backgroundColor: palette.backgroundColor,
    logoUrl: logoUrl || null,
  };
};

module.exports = {
  DEFAULT_PALETTE_BY_TYPE,
  INSTITUTION_BRANDING_PALETTES,
  createBrandingPayload,
  getBrandingPalette,
  getDefaultPaletteId,
  normalizeInstitutionType,
};
