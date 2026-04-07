import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Shadows, Spacing } from '@/lib/theme';

interface PillarCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
}

export function PillarCard({ children, style, accentColor }: PillarCardProps) {
  return (
    <View style={[styles.card, accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : {}, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.sm,
  },
});
