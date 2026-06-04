import React, { createContext, useContext, useMemo } from 'react';
import { Platform } from 'react-native';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAspectRatioLayout, type AspectRatioLayout } from '../hooks/useAspectRatioLayout';
import {
  getInstitutionBrandingPalette,
  normalizeBrandInstitutionType,
  type BrandThemeMode,
} from '../constants/institutionBrandingPalettes';
import { useInstitution } from './InstitutionContext';

export const EDGE_BACKGROUND = '#09090B';

type UnknownRecord = Record<string, unknown>;

export type RootLayoutPalette = {
  accent: string;
  accentSoft: string;
  amber: string;
  amberSoft: string;
  bronze: string;
  bronzeSoft: string;
  card: string;
  cardStrong: string;
  cyan: string;
  cyanSoft: string;
  deepBlue: string;
  deepBlueSoft: string;
  emerald: string;
  emeraldSoft: string;
  hairline: string;
  header: string;
  muted: string;
  overlay: string;
  page: string;
  pageElevated: string;
  success: string;
  successSoft: string;
  tabBar: string;
  text: string;
  textSoft: string;
  warning: string;
  warningSoft: string;
  violet: string;
  violetSoft: string;
};

export type RootLayoutBrand = {
  accentColor: string;
  backgroundColor: string;
  instituteId: string | null;
  institutionType: 'COLLEGE' | 'PLATFORM' | 'SCHOOL';
  logoUrl: string | null;
  mode: BrandThemeMode;
  name: string;
  paletteId: string;
  primaryColor: string;
  secondaryColor: string;
  source: 'auth-profile' | 'default' | 'firestore';
};

type RootLayoutRadii = {
  button: number;
  card: number;
  control: number;
  hero: number;
  pill: number;
};

type RootLayoutSpacing = {
  gutter: number;
  pageX: number;
  section: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

type RootLayoutTypography = {
  caption: string;
  display: string;
  label: string;
  title: string;
};

type RootLayoutMotion = {
  spring: {
    damping: number;
    mass: number;
    stiffness: number;
  };
  softSpring: {
    damping: number;
    mass: number;
    stiffness: number;
  };
};

type RootLayoutControls = {
  buttonHeight: number;
  iconButtonSize: number;
  inputHeight: number;
  touchTarget: number;
};

type RootLayoutWebCssVariables = Record<`--edu-${string}`, string>;

type RootLayoutNativeWindTokens = {
  colors: {
    edu: {
      accent: string;
      background: string;
      border: string;
      card: string;
      muted: string;
      primary: string;
      secondary: string;
      text: string;
    };
  };
};

export type RootLayoutContextValue = {
  brand: RootLayoutBrand;
  colors: RootLayoutPalette;
  controls: RootLayoutControls;
  insets: EdgeInsets;
  isCompact: boolean;
  isDesktop: boolean;
  isTablet: boolean;
  layout: AspectRatioLayout;
  maxContentWidth: number;
  motion: RootLayoutMotion;
  nativeWindTokens: RootLayoutNativeWindTokens;
  radii: RootLayoutRadii;
  scale: AspectRatioLayout['scale'];
  scaleFont: AspectRatioLayout['scaleFont'];
  scaleHeight: AspectRatioLayout['scaleHeight'];
  scaleWidth: AspectRatioLayout['scaleWidth'];
  spacing: RootLayoutSpacing;
  typography: RootLayoutTypography;
  viewport: {
    aspectRatio: number;
    fontScale: number;
    height: number;
    orientation: AspectRatioLayout['orientation'];
    width: number;
  };
  webCssVariables: RootLayoutWebCssVariables;
};

const SEMANTIC_COLORS = {
  amber: '#F7C948',
  bronze: '#B7791F',
  emerald: '#16A34A',
  success: '#34D399',
  warning: '#FBBF24',
  violet: '#A78BFA',
} as const;

const HEX_COLOR_PATTERN = /^#?([0-9A-F]{3}|[0-9A-F]{6})$/i;

const asRecord = (value: unknown): UnknownRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as UnknownRecord;
};

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
};

const expandHex = (hex: string): string => {
  const compact = hex.replace('#', '').toUpperCase();
  if (compact.length === 6) return `#${compact}`;
  return `#${compact.split('').map((character) => character.repeat(2)).join('')}`;
};

const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value.trim())) return fallback;
  return expandHex(value.trim());
};

const hexToRgb = (hex: string) => {
  const normalized = expandHex(hex).slice(1);
  return {
    blue: Number.parseInt(normalized.slice(4, 6), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    red: Number.parseInt(normalized.slice(0, 2), 16),
  };
};

const rgbToHex = (red: number, green: number, blue: number): string => {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
};

const mixHex = (from: string, to: string, amount: number): string => {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const ratio = Math.min(Math.max(amount, 0), 1);

  return rgbToHex(
    start.red + (end.red - start.red) * ratio,
    start.green + (end.green - start.green) * ratio,
    start.blue + (end.blue - start.blue) * ratio
  );
};

const relativeLuminance = (hex: string): number => {
  const { blue, green, red } = hexToRgb(hex);
  const convert = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return convert(red) * 0.2126 + convert(green) * 0.7152 + convert(blue) * 0.0722;
};

const contrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

const ensureVisibleAccent = (color: string, background: string): string => {
  if (contrastRatio(color, background) >= 3) return color;

  const adjustmentTarget = relativeLuminance(background) > 0.45 ? '#000000' : '#FFFFFF';
  for (const amount of [0.18, 0.28, 0.38, 0.48, 0.58, 0.68]) {
    const candidate = mixHex(color, adjustmentTarget, amount);
    if (contrastRatio(candidate, background) >= 3) return candidate;
  }

  return adjustmentTarget === '#000000' ? '#0F172A' : '#F8FAFC';
};

const readThemeField = (sources: UnknownRecord[], ...keys: string[]): unknown => {
  for (const source of sources) {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) return source[key];
    }
  }

  return undefined;
};

const buildBrand = (
  rawInstituteData: unknown,
  rawProfile: unknown,
  institutionSource: unknown
): RootLayoutBrand => {
  const instituteData = asRecord(rawInstituteData);
  const profile = asRecord(rawProfile);
  const settings = asRecord(instituteData.settings);
  const branding = asRecord(instituteData.branding);
  const settingsBranding = asRecord(settings.branding);
  const theme = asRecord(instituteData.theme);
  const settingsTheme = asRecord(settings.theme);
  const sources = [branding, settingsBranding, theme, settingsTheme, settings, instituteData];
  const rawInstitutionType = pickString(
    instituteData.institutionType,
    instituteData.type,
    profile.institutionType
  )?.toUpperCase();
  const institutionType = normalizeBrandInstitutionType(rawInstitutionType);
  const configuredPaletteId = readThemeField(sources, 'paletteId', 'palette');
  const defaultBrand = getInstitutionBrandingPalette(configuredPaletteId, institutionType);

  const primaryColor = normalizeHexColor(
    readThemeField(sources, 'primaryColor', 'primary'),
    defaultBrand.primaryColor
  );
  const secondaryColor = normalizeHexColor(
    readThemeField(sources, 'secondaryColor', 'secondary'),
    defaultBrand.secondaryColor
  );
  const accentColor = normalizeHexColor(
    readThemeField(sources, 'accentColor', 'accent'),
    defaultBrand.accentColor
  );
  const requestedBackground = normalizeHexColor(
    readThemeField(sources, 'backgroundColor', 'background', 'pageColor'),
    defaultBrand.backgroundColor
  );
  const configuredMode = pickString(
    readThemeField(sources, 'mode', 'themeMode', 'colorScheme')
  )?.toLowerCase();
  const mode: BrandThemeMode = configuredMode === 'light' || configuredMode === 'dark'
    ? configuredMode
    : relativeLuminance(requestedBackground) > 0.45
      ? 'light'
      : defaultBrand.mode;
  const logoUrl = pickString(
    readThemeField(sources, 'logoUrl', 'logoURL', 'logo', 'photoURL')
  );
  const instituteId = pickString(
    instituteData.instituteId,
    instituteData.id,
    profile.instituteId
  );
  const name = pickString(
    instituteData.name,
    instituteData.instituteName,
    profile.instituteName,
    defaultBrand.name
  ) as string;
  const hasInstituteBrand = Object.keys(instituteData).length > 0;
  const source = institutionSource === 'firestore'
    ? 'firestore'
    : hasInstituteBrand
      ? 'auth-profile'
      : 'default';

  return {
    accentColor,
    backgroundColor: requestedBackground,
    instituteId,
    institutionType,
    logoUrl,
    mode,
    name,
    paletteId: defaultBrand.id,
    primaryColor,
    secondaryColor,
    source,
  };
};

const buildPalette = (brand: RootLayoutBrand): RootLayoutPalette => {
  const page = brand.backgroundColor;
  const isLight = brand.mode === 'light';
  const primary = ensureVisibleAccent(brand.primaryColor, page);
  const secondary = ensureVisibleAccent(brand.secondaryColor, page);
  const accent = ensureVisibleAccent(brand.accentColor, page);
  const semantic = isLight
    ? {
      amber: '#B45309',
      bronze: '#92400E',
      emerald: '#047857',
      success: '#047857',
      violet: '#7C3AED',
      warning: '#B45309',
    }
    : SEMANTIC_COLORS;
  const cardBase = isLight
    ? '#FFFFFF'
    : mixHex('#111113', primary, 0.035);
  const cardStrong = isLight
    ? '#FFFFFF'
    : mixHex('#18181B', primary, 0.04);
  const elevatedBase = isLight
    ? mixHex('#F8FAFC', primary, 0.018)
    : mixHex('#09090B', primary, 0.045);
  const solidSoft = (color: string, amount: number) => (
    mixHex(isLight ? '#F8FAFC' : elevatedBase, color, amount)
  );

  return {
    accent,
    accentSoft: solidSoft(accent, isLight ? 0.1 : 0.18),
    amber: semantic.amber,
    amberSoft: solidSoft(semantic.amber, isLight ? 0.09 : 0.14),
    bronze: semantic.bronze,
    bronzeSoft: solidSoft(semantic.bronze, isLight ? 0.09 : 0.14),
    card: cardBase,
    cardStrong,
    cyan: secondary,
    cyanSoft: solidSoft(secondary, isLight ? 0.1 : 0.16),
    deepBlue: primary,
    deepBlueSoft: solidSoft(primary, isLight ? 0.09 : 0.18),
    emerald: semantic.emerald,
    emeraldSoft: solidSoft(semantic.emerald, isLight ? 0.09 : 0.14),
    hairline: isLight ? '#CBD5E1' : '#243044',
    header: page,
    muted: isLight ? '#64748B' : '#8EA4C8',
    overlay: isLight ? '#F1F5F9' : '#0F172A',
    page,
    pageElevated: elevatedBase,
    success: semantic.success,
    successSoft: solidSoft(semantic.success, isLight ? 0.09 : 0.14),
    tabBar: page,
    text: isLight ? '#0F172A' : '#F8FAFC',
    textSoft: isLight ? '#475569' : '#B9C6DD',
    violet: semantic.violet,
    violetSoft: solidSoft(semantic.violet, isLight ? 0.09 : 0.14),
    warning: semantic.warning,
    warningSoft: solidSoft(semantic.warning, isLight ? 0.09 : 0.14),
  };
};

const buildWebCssVariables = (
  brand: RootLayoutBrand,
  colors: RootLayoutPalette
): RootLayoutWebCssVariables => ({
  '--edu-accent': colors.accent,
  '--edu-background': colors.page,
  '--edu-border': colors.hairline,
  '--edu-brand-primary': brand.primaryColor,
  '--edu-brand-secondary': brand.secondaryColor,
  '--edu-card': colors.card,
  '--edu-color-scheme': brand.mode,
  '--edu-header': colors.header,
  '--edu-muted': colors.muted,
  '--edu-tab-bar': colors.tabBar,
  '--edu-text': colors.text,
});

const buildNativeWindTokens = (
  brand: RootLayoutBrand,
  colors: RootLayoutPalette
): RootLayoutNativeWindTokens => ({
  colors: {
    edu: {
      accent: colors.accent,
      background: colors.page,
      border: colors.hairline,
      card: colors.card,
      muted: colors.muted,
      primary: brand.primaryColor,
      secondary: brand.secondaryColor,
      text: colors.text,
    },
  },
});

const typography: RootLayoutTypography = Platform.select({
  web: {
    caption: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    label: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    title: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },
  default: {
    caption: 'System',
    display: 'System',
    label: 'System',
    title: 'System',
  },
}) as RootLayoutTypography;

const motion: RootLayoutMotion = {
  spring: {
    damping: 28,
    mass: 0.6,
    stiffness: 420,
  },
  softSpring: {
    damping: 30,
    mass: 0.6,
    stiffness: 360,
  },
};

const RootLayoutContext = createContext<RootLayoutContextValue | null>(null);

export function RootLayoutProvider({ children }: { children: React.ReactNode }) {
  const layout = useAspectRatioLayout();
  const insets = useSafeAreaInsets();
  const {
    instituteData,
    profile,
    source: institutionSource,
  } = useInstitution();
  const { isCompact, isDesktop, isTablet } = layout;

  const brand = useMemo(
    () => buildBrand(instituteData, profile, institutionSource),
    [instituteData, institutionSource, profile]
  );

  const colors = useMemo(() => buildPalette(brand), [brand]);

  const spacing = useMemo<RootLayoutSpacing>(() => {
    return {
      gutter: layout.space(isCompact ? 10 : 12, { min: 8, max: 18 }),
      pageX: layout.horizontalPadding,
      section: layout.space(isCompact ? 20 : 26, { min: 18, max: 36 }),
      sm: layout.space(8, { min: 7, max: 11 }),
      md: layout.space(12, { min: 10, max: 16 }),
      lg: layout.space(16, { min: 14, max: 22 }),
      xl: layout.space(22, { min: 18, max: 30 }),
      xxl: layout.space(32, { min: 26, max: 42 }),
    };
  }, [isCompact, layout]);

  const radii = useMemo<RootLayoutRadii>(() => ({
    button: layout.scale(8, { min: 6, max: 8 }),
    card: layout.scale(8, { min: 6, max: 8 }),
    control: layout.scale(8, { min: 6, max: 8 }),
    hero: layout.scale(8, { min: 6, max: 8 }),
    pill: 8,
  }), [layout]);

  const controls = useMemo<RootLayoutControls>(() => ({
    buttonHeight: layout.buttonHeight,
    iconButtonSize: layout.iconButtonSize,
    inputHeight: layout.inputHeight,
    touchTarget: layout.touchTarget,
  }), [layout.buttonHeight, layout.iconButtonSize, layout.inputHeight, layout.touchTarget]);

  const nativeWindTokens = useMemo(
    () => buildNativeWindTokens(brand, colors),
    [brand, colors]
  );

  const webCssVariables = useMemo(
    () => buildWebCssVariables(brand, colors),
    [brand, colors]
  );

  const value = useMemo<RootLayoutContextValue>(() => ({
    brand,
    colors,
    controls,
    insets,
    isCompact,
    isDesktop,
    isTablet,
    layout,
    maxContentWidth: layout.maxContentWidth,
    motion,
    nativeWindTokens,
    radii,
    scale: layout.scale,
    scaleFont: layout.scaleFont,
    scaleHeight: layout.scaleHeight,
    scaleWidth: layout.scaleWidth,
    spacing,
    typography,
    viewport: {
      aspectRatio: layout.aspectRatio,
      fontScale: layout.fontScale,
      height: layout.height,
      orientation: layout.orientation,
      width: layout.width,
    },
    webCssVariables,
  }), [
    brand,
    colors,
    controls,
    insets,
    isCompact,
    isDesktop,
    isTablet,
    layout,
    nativeWindTokens,
    radii,
    spacing,
    webCssVariables,
  ]);

  return (
    <RootLayoutContext.Provider value={value}>
      {children}
    </RootLayoutContext.Provider>
  );
}

export function useRootLayout() {
  const context = useContext(RootLayoutContext);

  if (!context) {
    throw new Error('useRootLayout must be used within RootLayoutProvider');
  }

  return context;
}
