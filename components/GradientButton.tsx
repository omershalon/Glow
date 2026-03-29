import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';

interface GradientButtonProps {
  onPress: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'gold' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  labelStyle?: TextStyle;
  icon?: string;
}

const VARIANT_GRADIENTS: Record<string, readonly [string, string]> = {
  primary: [Colors.primary, Colors.primaryDark] as const,
  secondary: [Colors.secondary, Colors.primary] as const,
  gold: [Colors.secondaryLight, Colors.secondary] as const,
  dark: ['#1A0A0F', '#3D1A28'] as const,
};

const SIZE_CONFIG = {
  sm: { height: 40, paddingHorizontal: Spacing.lg, fontSize: 14 },
  md: { height: 52, paddingHorizontal: Spacing.xl, fontSize: 16 },
  lg: { height: 60, paddingHorizontal: Spacing.xxl, fontSize: 18 },
};

export function GradientButton({
  onPress,
  label,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  style,
  labelStyle,
  icon,
}: GradientButtonProps) {
  const gradientColors = VARIANT_GRADIENTS[variant];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.button,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={disabled ? ['#D0D0D0', '#B0B0B0'] : gradientColors}
        style={[
          styles.gradient,
          { height: sizeConfig.height, paddingHorizontal: sizeConfig.paddingHorizontal },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <>
            {icon && <Text style={styles.icon}>{icon}</Text>}
            <Text
              style={[
                styles.label,
                { fontSize: sizeConfig.fontSize },
                labelStyle,
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  disabled: {
    opacity: 0.6,
  },
  gradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    ...Typography.headlineSmall,
    color: Colors.white,
    fontWeight: '600',
  },
});
