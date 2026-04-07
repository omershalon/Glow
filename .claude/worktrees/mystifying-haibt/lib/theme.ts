export const Colors = {
  // Core backgrounds
  background:    '#08080F',
  backgroundAlt: '#0D0D1A',
  card:          '#111120',
  cardGlass:     'rgba(255,255,255,0.06)',
  subtle:        'rgba(255,255,255,0.04)',
  subtleDeep:    'rgba(255,255,255,0.09)',

  // Primary – violet-purple
  primary:      '#7C5CFC',
  primaryLight: '#A78BFA',
  primaryDark:  '#5B21B6',

  // Secondary – soft lavender
  secondary:      '#A78BFA',
  secondaryLight: '#C4B5FD',
  secondaryDark:  '#7C3AED',

  // Text
  text:          '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.62)',
  textMuted:     'rgba(255,255,255,0.35)',
  textLight:     'rgba(255,255,255,0.18)',

  // Borders
  border:      'rgba(255,255,255,0.09)',
  borderLight: 'rgba(255,255,255,0.05)',

  // Status
  success:      '#34D399',
  successLight: 'rgba(52,211,153,0.15)',
  warning:      '#FCD34D',
  warningLight: 'rgba(252,211,77,0.15)',
  error:        '#F87171',
  errorLight:   'rgba(248,113,113,0.15)',

  // Utilities
  white:   '#FFFFFF',
  black:   '#000000',
  overlay: 'rgba(0,0,0,0.65)',

  // Gradients
  gradientPrimary:    ['#7C5CFC', '#5B21B6'] as const,
  gradientSecondary:  ['#A78BFA', '#7C3AED'] as const,
  gradientBackground: ['#08080F', '#0D0D1A'] as const,
  gradientCard:       ['#2D1B69', '#1A0F3D'] as const,
  gradientGold:       ['#FCD34D', '#F59E0B'] as const,

  // Scan result card gradient
  gradientScan: ['#4C1D95', '#2D1B69'] as const,

  // Zone / metric indicators
  skinOily:        '#2DD4BF',
  skinDry:         '#FCD34D',
  skinCombination: '#A78BFA',
  skinSensitive:   '#F87171',
  skinNormal:      '#34D399',
  severityMild:    '#34D399',
  severityModerate: '#FCD34D',
  severitySevere:  '#F87171',
  verdictSuitable:   '#34D399',
  verdictCaution:    '#FCD34D',
  verdictUnsuitable: '#F87171',
};

export const Fonts = {
  regular:   'DMSans_400Regular',
  medium:    'DMSans_500Medium',
  semibold:  'DMSans_600SemiBold',
  bold:      'DMSans_700Bold',
  extrabold: 'DMSans_700Bold',
};

export const Typography = {
  displayLarge:  { fontFamily: Fonts.extrabold, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  displayMedium: { fontFamily: Fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  displaySmall:  { fontFamily: Fonts.bold,      fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  headlineLarge: { fontFamily: Fonts.bold,      fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  headlineMedium:{ fontFamily: Fonts.semibold,  fontSize: 18, lineHeight: 24 },
  headlineSmall: { fontFamily: Fonts.semibold,  fontSize: 16, lineHeight: 22 },
  bodyLarge:     { fontFamily: Fonts.regular,   fontSize: 16, lineHeight: 24 },
  bodyMedium:    { fontFamily: Fonts.regular,   fontSize: 14, lineHeight: 21 },
  bodySmall:     { fontFamily: Fonts.regular,   fontSize: 12, lineHeight: 18 },
  labelLarge:    { fontFamily: Fonts.semibold,  fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium:   { fontFamily: Fonts.semibold,  fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall:    { fontFamily: Fonts.medium,    fontSize: 11, lineHeight: 14, letterSpacing: 0.5 },
  caption:       { fontFamily: Fonts.regular,   fontSize: 11, lineHeight: 16, letterSpacing: 0.3 },
};

export const BorderRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 100, circle: 9999,
};

export const Shadows = {
  xs: { shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,  elevation: 1 },
  sm: { shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,  elevation: 2 },
  md: { shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 },
  lg: { shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 8 },
  xl: { shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 12}, shadowOpacity: 0.28, shadowRadius: 32, elevation: 12 },
};

export const Spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, massive: 56,
};
