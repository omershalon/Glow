export const Colors = {
  primary: '#2D4A3E',
  primaryLight: '#4A7A6A',
  primaryDark: '#1E3329',
  secondary: '#C8573E',
  secondaryLight: '#E8795F',
  secondaryDark: '#A83E28',
  background: '#F2EDE4',
  backgroundDark: '#E8E2D8',
  card: '#EDE8DF',
  cardSubtle: '#E8E2D8',
  subtle: '#DDD7CD',
  subtleDeep: '#C8C2B8',
  text: '#1C1C1A',
  textSecondary: '#5A5A50',
  textMuted: '#8A8A7A',
  textLight: '#B0B0A0',
  border: '#D8D2C8',
  borderLight: '#E8E2D8',
  success: '#4CAF87',
  successLight: '#E8F7F1',
  warning: '#C8573E',
  warningLight: '#FAF0EC',
  error: '#C84040',
  errorLight: '#FDEAEA',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(28, 28, 26, 0.5)',
  gradientPrimary: ['#2D4A3E', '#1E3329'] as const,
  gradientSecondary: ['#C8573E', '#A83E28'] as const,
  gradientBackground: ['#F2EDE4', '#E8E2D8'] as const,
  gradientCard: ['#EDE8DF', '#E8E2D8'] as const,
  gradientGold: ['#C8573E', '#A83E28'] as const,
  skinOily: '#7CB9E8',
  skinDry: '#C8573E',
  skinCombination: '#9B59B6',
  skinSensitive: '#C8573E',
  skinNormal: '#4CAF87',
  severityMild: '#4CAF87',
  severityModerate: '#C8573E',
  severitySevere: '#C84040',
  verdictSuitable: '#4CAF87',
  verdictCaution: '#C8573E',
  verdictUnsuitable: '#C84040',
};

export const Fonts = {
  regular: 'NunitoSans-Regular',
  medium: 'NunitoSans-Medium',
  semibold: 'NunitoSans-SemiBold',
  bold: 'NunitoSans-Bold',
  extrabold: 'NunitoSans-ExtraBold',
};

export const Typography = {
  displayLarge: { fontFamily: Fonts.bold, fontSize: 36, lineHeight: 44, letterSpacing: -0.5 },
  displayMedium: { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 36, letterSpacing: -0.3 },
  displaySmall: { fontFamily: Fonts.semibold, fontSize: 24, lineHeight: 32, letterSpacing: -0.2 },
  headlineLarge: { fontFamily: Fonts.semibold, fontSize: 20, lineHeight: 28 },
  headlineMedium: { fontFamily: Fonts.semibold, fontSize: 18, lineHeight: 24 },
  headlineSmall: { fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 22 },
  bodyLarge: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18 },
  labelLarge: { fontFamily: Fonts.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontFamily: Fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontFamily: Fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.5 },
  caption: { fontFamily: Fonts.regular, fontSize: 11, lineHeight: 16, letterSpacing: 0.3 },
};

export const BorderRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 100, circle: 9999,
};

export const Shadows = {
  xs: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  xl: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
};

export const Spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, massive: 56,
};
