export const Colors = {
  primary: '#E8547A',
  primaryLight: '#F07A99',
  primaryDark: '#C43A60',
  secondary: '#F5A623',
  secondaryLight: '#F7BA52',
  secondaryDark: '#D4881A',
  background: '#FFF0F5',
  backgroundDark: '#FFE0ED',
  card: '#FFFFFF',
  cardSubtle: '#FFF8FB',
  subtle: '#F8D7E3',
  subtleDeep: '#F0B8CC',
  text: '#1A0A0F',
  textSecondary: '#7A4A57',
  textMuted: '#B08090',
  textLight: '#D4B0BC',
  border: '#F0D0DC',
  borderLight: '#FAE8EF',
  success: '#4CAF87',
  successLight: '#E8F7F1',
  warning: '#F5A623',
  warningLight: '#FFF3DC',
  error: '#E84545',
  errorLight: '#FDEAEA',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(26, 10, 15, 0.5)',
  gradientPrimary: ['#E8547A', '#C43A60'] as const,
  gradientSecondary: ['#F5A623', '#E8547A'] as const,
  gradientBackground: ['#FFF0F5', '#FFE0ED'] as const,
  gradientCard: ['#FFFFFF', '#FFF8FB'] as const,
  gradientGold: ['#F7BA52', '#F5A623'] as const,

  // Skin type colors
  skinOily: '#7CB9E8',
  skinDry: '#F5A623',
  skinCombination: '#9B59B6',
  skinSensitive: '#E8547A',
  skinNormal: '#4CAF87',

  // Severity colors
  severityMild: '#4CAF87',
  severityModerate: '#F5A623',
  severitySevere: '#E84545',

  // Verdict colors
  verdictSuitable: '#4CAF87',
  verdictCaution: '#F5A623',
  verdictUnsuitable: '#E84545',
};

export const Typography = {
  displayLarge: {
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  displaySmall: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  headlineLarge: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  headlineMedium: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  headlineSmall: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  labelLarge: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 100,
  circle: 9999,
};

export const Shadows = {
  xs: {
    shadowColor: '#E8547A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#E8547A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#E8547A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#E8547A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#E8547A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 56,
};
