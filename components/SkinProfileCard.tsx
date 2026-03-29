import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { SkinType, AcneType, Severity } from '@/lib/database.types';

interface SkinProfileCardProps {
  skinType: SkinType;
  acneType: AcneType;
  severity: Severity;
  analysisNotes?: string;
  style?: ViewStyle;
  compact?: boolean;
}

const SKIN_TYPE_CONFIG: Record<SkinType, { label: string; color: string; emoji: string }> = {
  oily: { label: 'Oily', color: '#7CB9E8', emoji: '💧' },
  dry: { label: 'Dry', color: '#F5A623', emoji: '🌵' },
  combination: { label: 'Combination', color: '#9B59B6', emoji: '⚖️' },
  sensitive: { label: 'Sensitive', color: '#E8547A', emoji: '🌸' },
  normal: { label: 'Normal', color: '#4CAF87', emoji: '✨' },
};

const ACNE_TYPE_CONFIG: Record<AcneType, { label: string; emoji: string }> = {
  hormonal: { label: 'Hormonal', emoji: '🔄' },
  cystic: { label: 'Cystic', emoji: '⚡' },
  comedonal: { label: 'Comedonal', emoji: '⚫' },
  fungal: { label: 'Fungal', emoji: '🍄' },
  inflammatory: { label: 'Inflammatory', emoji: '🔥' },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; gradientColors: readonly [string, string] }> = {
  mild: { label: 'Mild', color: Colors.severityMild, gradientColors: ['#E8F7F1', '#C8EDDF'] as const },
  moderate: { label: 'Moderate', color: Colors.severityModerate, gradientColors: ['#FFF3DC', '#FFE4A8'] as const },
  severe: { label: 'Severe', color: Colors.severitySevere, gradientColors: ['#FDEAEA', '#F9C5C5'] as const },
};

export function SkinProfileCard({
  skinType,
  acneType,
  severity,
  analysisNotes,
  style,
  compact = false,
}: SkinProfileCardProps) {
  const skinConfig = SKIN_TYPE_CONFIG[skinType];
  const acneConfig = ACNE_TYPE_CONFIG[acneType];
  const severityConfig = SEVERITY_CONFIG[severity];

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={['#FFF0F5', '#FFF8FB']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Skin Profile</Text>
          <LinearGradient
            colors={severityConfig.gradientColors}
            style={styles.severityBadge}
          >
            <Text style={[styles.severityText, { color: severityConfig.color }]}>
              {severityConfig.label}
            </Text>
          </LinearGradient>
        </View>

        {/* Chips row */}
        <View style={styles.chipsRow}>
          {/* Skin type */}
          <View style={[styles.chip, { backgroundColor: skinConfig.color + '15', borderColor: skinConfig.color }]}>
            <Text style={styles.chipEmoji}>{skinConfig.emoji}</Text>
            <View>
              <Text style={styles.chipSubLabel}>Skin Type</Text>
              <Text style={[styles.chipLabel, { color: skinConfig.color }]}>{skinConfig.label}</Text>
            </View>
          </View>

          {/* Acne type */}
          <View style={[styles.chip, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary }]}>
            <Text style={styles.chipEmoji}>{acneConfig.emoji}</Text>
            <View>
              <Text style={styles.chipSubLabel}>Acne Type</Text>
              <Text style={[styles.chipLabel, { color: Colors.primary }]}>{acneConfig.label}</Text>
            </View>
          </View>
        </View>

        {/* Analysis notes */}
        {!compact && analysisNotes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>AI Analysis</Text>
            <Text style={styles.notesText} numberOfLines={3}>{analysisNotes}</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  gradient: {
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.text,
  },
  severityBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  severityText: {
    ...Typography.labelMedium,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  chipEmoji: {
    fontSize: 22,
  },
  chipSubLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  chipLabel: {
    ...Typography.labelMedium,
    fontWeight: '700',
  },
  notesSection: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  notesLabel: {
    ...Typography.labelSmall,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
