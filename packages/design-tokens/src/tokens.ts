/**
 * Framework-agnostic design tokens.
 *
 * The palette is authored in OKLCH so that lightness is perceptually uniform across hues.
 * That gives us predictable dark-mode inversion and consistent contrast ratios between
 * the light and dark themes without hand-tuning dozens of hex values.
 *
 * `tokens.css` is the runtime source of truth consumed by the applications (CSS custom
 * properties, theme blocks and the Tailwind v4 `@theme` bridge). This module exists so
 * TypeScript code — charts, canvas previews, email-template placeholders, the branding
 * editor — can read the same values without parsing CSS.
 */

export const colorScales = {
  /** Primary brand hue. Deliberately violet-leaning: distinct from the blues and
   *  oranges used by the best-known CRMs. Replaceable via the branding config. */
  brand: {
    50: 'oklch(0.972 0.014 285)',
    100: 'oklch(0.938 0.030 285)',
    200: 'oklch(0.884 0.058 285)',
    300: 'oklch(0.808 0.098 285)',
    400: 'oklch(0.712 0.148 285)',
    500: 'oklch(0.628 0.196 285)',
    600: 'oklch(0.556 0.222 285)',
    700: 'oklch(0.484 0.203 285)',
    800: 'oklch(0.412 0.170 285)',
    900: 'oklch(0.352 0.135 285)',
    950: 'oklch(0.252 0.098 285)',
  },
  /** Secondary hue used for data-viz depth, gradients and illustration accents. */
  teal: {
    50: 'oklch(0.975 0.014 195)',
    100: 'oklch(0.940 0.032 195)',
    200: 'oklch(0.885 0.058 195)',
    300: 'oklch(0.808 0.078 195)',
    400: 'oklch(0.700 0.090 195)',
    500: 'oklch(0.600 0.093 195)',
    600: 'oklch(0.520 0.085 195)',
    700: 'oklch(0.440 0.072 195)',
    800: 'oklch(0.372 0.058 195)',
    900: 'oklch(0.312 0.046 195)',
    950: 'oklch(0.230 0.034 195)',
  },
  /** Warm accent for highlights, announcements, promotional callouts. */
  amber: {
    50: 'oklch(0.980 0.020 80)',
    100: 'oklch(0.950 0.048 80)',
    200: 'oklch(0.905 0.090 80)',
    300: 'oklch(0.862 0.122 78)',
    400: 'oklch(0.820 0.140 76)',
    500: 'oklch(0.780 0.152 74)',
    600: 'oklch(0.700 0.150 68)',
    700: 'oklch(0.600 0.132 62)',
    800: 'oklch(0.505 0.110 58)',
    900: 'oklch(0.420 0.090 55)',
    950: 'oklch(0.300 0.070 52)',
  },
  /** Cool, very slightly violet-tinted neutrals. Tinting the greys is what makes the
   *  interface feel designed rather than defaulted, while staying close enough to
   *  pure grey for dense tables and long-form reading. */
  neutral: {
    0: 'oklch(1 0 0)',
    25: 'oklch(0.991 0.002 285)',
    50: 'oklch(0.977 0.004 285)',
    100: 'oklch(0.955 0.006 285)',
    150: 'oklch(0.930 0.008 285)',
    200: 'oklch(0.900 0.010 285)',
    300: 'oklch(0.838 0.012 285)',
    400: 'oklch(0.742 0.014 285)',
    500: 'oklch(0.628 0.016 285)',
    600: 'oklch(0.520 0.018 285)',
    700: 'oklch(0.412 0.018 285)',
    800: 'oklch(0.312 0.016 285)',
    850: 'oklch(0.262 0.014 285)',
    900: 'oklch(0.212 0.012 285)',
    950: 'oklch(0.165 0.010 285)',
    1000: 'oklch(0.125 0.008 285)',
  },
} as const;

/**
 * Categorical chart palette. Ordered so that the first six colours stay distinguishable
 * for the most common forms of colour-vision deficiency (the sequence alternates
 * lightness, not just hue).
 */
export const chartPalette = [
  'oklch(0.556 0.222 285)', // brand violet
  'oklch(0.700 0.150 68)', // amber
  'oklch(0.600 0.093 195)', // teal
  'oklch(0.585 0.199 25)', // red
  'oklch(0.520 0.150 245)', // blue
  'oklch(0.596 0.135 155)', // green
  'oklch(0.620 0.180 330)', // magenta
  'oklch(0.480 0.120 300)', // deep violet
  'oklch(0.660 0.130 110)', // olive
  'oklch(0.540 0.060 220)', // slate blue
] as const;

export const chartPaletteDark = [
  'oklch(0.680 0.180 285)',
  'oklch(0.790 0.140 72)',
  'oklch(0.700 0.090 195)',
  'oklch(0.680 0.170 25)',
  'oklch(0.660 0.140 245)',
  'oklch(0.700 0.130 155)',
  'oklch(0.720 0.150 330)',
  'oklch(0.620 0.120 300)',
  'oklch(0.760 0.120 110)',
  'oklch(0.660 0.060 220)',
] as const;

/** Sequential ramps used for heat maps, funnel saturation and cohort grids. */
export const sequentialRamp = {
  brand: [colorScales.brand[100], colorScales.brand[200], colorScales.brand[300], colorScales.brand[400], colorScales.brand[500], colorScales.brand[600], colorScales.brand[700]],
  teal: [colorScales.teal[100], colorScales.teal[200], colorScales.teal[300], colorScales.teal[400], colorScales.teal[500], colorScales.teal[600], colorScales.teal[700]],
  amber: [colorScales.amber[100], colorScales.amber[200], colorScales.amber[300], colorScales.amber[400], colorScales.amber[500], colorScales.amber[600], colorScales.amber[700]],
} as const;

/**
 * Typography scale. Font families are tokenised so the branding configuration can swap
 * them, and so the same stack is applied on the marketing site and inside the CRM.
 */
export const typography = {
  fontFamily: {
    sans: "'InterVariable', 'Inter var', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Sans Arabic', 'Noto Sans Devanagari', sans-serif",
    display:
      "'InterDisplay', 'InterVariable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
    numeric: "'InterVariable', Inter, ui-sans-serif, system-ui, sans-serif",
  },
  fontSize: {
    '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
    xs: ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.006em' }],
    sm: ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0.003em' }],
    base: ['0.875rem', { lineHeight: '1.375rem', letterSpacing: '0em' }],
    md: ['0.9375rem', { lineHeight: '1.5rem', letterSpacing: '-0.002em' }],
    lg: ['1.0625rem', { lineHeight: '1.625rem', letterSpacing: '-0.006em' }],
    xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.012em' }],
    '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.018em' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.022em' }],
    '4xl': ['2.375rem', { lineHeight: '2.625rem', letterSpacing: '-0.026em' }],
    '5xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.03em' }],
    '6xl': ['3.75rem', { lineHeight: '4rem', letterSpacing: '-0.034em' }],
    '7xl': ['4.5rem', { lineHeight: '4.75rem', letterSpacing: '-0.038em' }],
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  /** Semantic roles keep marketing headings and CRM headings from drifting apart. */
  roles: {
    displayXl: { size: '6xl', weight: 'bold', tracking: '-0.034em' },
    displayLg: { size: '5xl', weight: 'bold', tracking: '-0.03em' },
    displayMd: { size: '4xl', weight: 'bold', tracking: '-0.026em' },
    headingXl: { size: '2xl', weight: 'semibold', tracking: '-0.018em' },
    headingLg: { size: 'xl', weight: 'semibold', tracking: '-0.012em' },
    headingMd: { size: 'lg', weight: 'semibold', tracking: '-0.006em' },
    headingSm: { size: 'md', weight: 'semibold', tracking: '-0.002em' },
    bodyLg: { size: 'md', weight: 'regular', tracking: '-0.002em' },
    body: { size: 'base', weight: 'regular', tracking: '0em' },
    bodySm: { size: 'sm', weight: 'regular', tracking: '0.003em' },
    label: { size: 'sm', weight: 'medium', tracking: '0.003em' },
    caption: { size: 'xs', weight: 'regular', tracking: '0.006em' },
    overline: { size: '2xs', weight: 'semibold', tracking: '0.08em' },
    metric: { size: '3xl', weight: 'semibold', tracking: '-0.022em' },
  },
} as const;

/** 4px-based spacing scale. `--spacing` itself is overridden per density mode. */
export const spacing = {
  unit: '0.25rem',
  scale: {
    0: '0rem',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    11: '2.75rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  },
} as const;

export const radius = {
  none: '0',
  xs: '0.1875rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.625rem',
  '2xl': '0.875rem',
  '3xl': '1.125rem',
  full: '9999px',
} as const;

/**
 * Elevation. Deliberately restrained — soft, wide, low-opacity shadows rather than
 * hard drop shadows, because the CRM stacks many surfaces inside a single viewport.
 * Dark mode replaces shadows with border/ring based separation (see tokens.css).
 */
export const shadow = {
  xs: '0 1px 2px 0 oklch(0.21 0.012 285 / 0.04)',
  sm: '0 1px 3px 0 oklch(0.21 0.012 285 / 0.07), 0 1px 2px -1px oklch(0.21 0.012 285 / 0.05)',
  md: '0 4px 8px -2px oklch(0.21 0.012 285 / 0.08), 0 2px 4px -2px oklch(0.21 0.012 285 / 0.05)',
  lg: '0 12px 20px -6px oklch(0.21 0.012 285 / 0.10), 0 4px 8px -4px oklch(0.21 0.012 285 / 0.06)',
  xl: '0 24px 40px -12px oklch(0.21 0.012 285 / 0.14), 0 8px 16px -8px oklch(0.21 0.012 285 / 0.08)',
  '2xl': '0 40px 64px -16px oklch(0.21 0.012 285 / 0.18), 0 12px 24px -12px oklch(0.21 0.012 285 / 0.10)',
  focusBrand: '0 0 0 3px oklch(0.556 0.222 285 / 0.28)',
  focusDanger: '0 0 0 3px oklch(0.585 0.199 25 / 0.28)',
  insetHairline: 'inset 0 0 0 1px oklch(0.212 0.012 285 / 0.06)',
} as const;

export const motion = {
  duration: {
    instant: '80ms',
    fast: '130ms',
    normal: '190ms',
    moderate: '260ms',
    slow: '400ms',
    deliberate: '620ms',
  },
  easing: {
    standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
    decelerate: 'cubic-bezier(0.16, 1, 0.3, 1)',
    accelerate: 'cubic-bezier(0.5, 0, 0.9, 0.4)',
    smooth: 'cubic-bezier(0.45, 1.2, 0.4, 1)',
    linear: 'linear',
  },
} as const;

/** Breakpoints follow the required device matrix in the brief (360 → 1920). */
export const breakpoints = {
  xs: '22.5rem', // 360px
  sm: '24.375rem', // 390px
  mobile: '26.875rem', // 430px
  tabletSm: '30rem', // 480px
  tablet: '48rem', // 768px
  tabletLg: '64rem', // 1024px
  laptop: '85.375rem', // 1366px
  desktop: '90rem', // 1440px
  wide: '120rem', // 1920px
} as const;

export const containers = {
  prose: '68ch',
  narrow: '48rem',
  content: '72rem',
  wide: '80rem',
  full: '90rem',
} as const;

export const zIndex = {
  base: '0',
  raised: '10',
  sticky: '20',
  header: '30',
  overlay: '40',
  drawer: '50',
  modal: '60',
  popover: '70',
  tooltip: '80',
  toast: '90',
  commandPalette: '100',
} as const;

export const iconSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
} as const;

/** Control and row metrics, all density-aware (see `--density-factor`). */
export const controlMetrics = {
  inputHeightSm: '1.75rem',
  inputHeightMd: '2.125rem',
  inputHeightLg: '2.5rem',
  buttonHeightSm: '1.75rem',
  buttonHeightMd: '2.125rem',
  buttonHeightLg: '2.5rem',
  tableRowComfortable: '2.75rem',
  tableRowCompact: '2.125rem',
  sidebarWidth: '16rem',
  sidebarWidthCollapsed: '3.5rem',
  topbarHeight: '3.5rem',
  drawerWidthSm: '20rem',
  drawerWidthMd: '30rem',
  drawerWidthLg: '42rem',
} as const;

/** Density modes drive `--spacing` and the metric overrides in tokens.css. */
export const densityModes = {
  comfortable: { factor: '1', spacing: '0.25rem', rowHeight: controlMetrics.tableRowComfortable },
  compact: { factor: '0.875', spacing: '0.21875rem', rowHeight: controlMetrics.tableRowCompact },
  spacious: { factor: '1.125', spacing: '0.28125rem', rowHeight: '3.25rem' },
} as const;

export const statusColors = {
  success: 'oklch(0.596 0.135 155)',
  warning: 'oklch(0.760 0.150 78)',
  danger: 'oklch(0.585 0.199 25)',
  info: 'oklch(0.628 0.150 245)',
  neutral: colorScales.neutral[500],
} as const;

/** Which accent overrides a tenant may pick in the branding editor. */
export const accentPresets = [
  { id: 'violet', label: 'Aurora', hex: '#6d4aff', oklch: colorScales.brand[600] },
  { id: 'teal', label: 'Lagoon', hex: '#0e7c86', oklch: colorScales.teal[600] },
  { id: 'blue', label: 'Cobalt', hex: '#2f5fd8', oklch: 'oklch(0.556 0.180 262)' },
  { id: 'emerald', label: 'Grove', hex: '#1d8f6a', oklch: 'oklch(0.560 0.120 165)' },
  { id: 'amber', label: 'Ember', hex: '#c2760a', oklch: colorScales.amber[600] },
  { id: 'rose', label: 'Coral', hex: '#c8405f', oklch: 'oklch(0.560 0.180 12)' },
  { id: 'slate', label: 'Graphite', hex: '#475569', oklch: 'oklch(0.440 0.030 264)' },
] as const;

export const designTokens = {
  colorScales,
  chartPalette,
  chartPaletteDark,
  sequentialRamp,
  typography,
  spacing,
  radius,
  shadow,
  motion,
  breakpoints,
  containers,
  zIndex,
  iconSize,
  controlMetrics,
  densityModes,
  statusColors,
  accentPresets,
} as const;

export type DesignTokens = typeof designTokens;
export type DensityMode = keyof typeof densityModes;
export type AccentPresetId = (typeof accentPresets)[number]['id'];
export type ChartPalette = readonly string[];
