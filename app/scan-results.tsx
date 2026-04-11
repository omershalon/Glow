import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect as SvgRect, Text as SvgText, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/lib/theme';
import ScreenBackground from '@/components/ScreenBackground';
import { loadScanSession } from '@/lib/scan-api';
import type {
  ScanSession,
  ViewAngle,
  ReviewedDetection,
  ZoneBreakdown,
  Recommendation,
  SkinPlan,
  SkinPlanRoutineStep,
  SkinPlanWeeklyTreatment,
} from '@/lib/scan-types';
import { CLASS_COLORS as COLORS } from '@/lib/scan-types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 48;
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.33;

const VIEW_LABELS: Record<ViewAngle, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
};

const SEVERITY_BAR_COLORS: Record<string, string> = {
  mild: Colors.success,
  moderate: Colors.warning,
  severe: Colors.error,
};

export default function ScanResultsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<ScanSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewAngle>('front');

  useEffect(() => {
    if (sessionId) {
      loadScanSession(sessionId).then((data) => {
        setSession(data);
        setLoading(false);
      });
    }
  }, [sessionId]);

  if (loading || !session) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ScreenBackground preset="scan" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  if (session.status === 'failed') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ScreenBackground preset="scan" />
        <Text style={[styles.loadingText, { fontSize: 40, marginBottom: 12 }]}>😔</Text>
        <Text style={[styles.headerTitle, { marginBottom: 8 }]}>Scan Failed</Text>
        <Text style={[styles.loadingText, { textAlign: 'center', paddingHorizontal: 40 }]}>
          Something went wrong analyzing your scan. Please try again.
        </Text>
        <TouchableOpacity style={[styles.ctaButton, { marginTop: 24, paddingHorizontal: 40 }]} onPress={() => router.back()}>
          <Text style={styles.ctaText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUrl =
    activeView === 'front' ? session.front_image_url :
    activeView === 'left' ? session.left_image_url :
    session.right_image_url;

  const detections: ReviewedDetection[] =
    session.reviewed_detections?.[activeView] ?? [];

  const allDetections = Object.values(session.reviewed_detections ?? {}).flat() as ReviewedDetection[];
  const confirmedCount = allDetections.filter((d) => d.status === 'confirmed').length;
  const aiAddedCount = allDetections.filter((d) => d.status === 'added').length;

  // Group detections by class for the count list
  const classCounts: Record<string, { count: number; source: string }> = {};
  for (const d of allDetections) {
    if (d.status === 'removed') continue;
    const key = d.className;
    if (!classCounts[key]) classCounts[key] = { count: 0, source: d.source };
    classCounts[key].count++;
    if (d.source === 'ai' && classCounts[key].source === 'model') {
      classCounts[key].source = 'Model + AI';
    } else if (classCounts[key].source !== 'Model + AI') {
      classCounts[key].source = d.source === 'model' ? 'Model confirmed' : 'AI identified';
    }
  }

  const severity = session.severity ?? 'moderate';
  const severityScore = session.severity_score ?? 50;

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground preset="scan" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Line x1={19} y1={12} x2={5} y2={12} stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
              <Line x1={12} y1={5} x2={5} y2={12} stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
              <Line x1={12} y1={19} x2={5} y2={12} stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Scan Results</Text>
            <Text style={styles.headerDate}>
              {new Date(session.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* View angle tabs */}
        <View style={styles.viewTabs}>
          {(['front', 'left', 'right'] as ViewAngle[]).map((angle) => (
            <TouchableOpacity
              key={angle}
              style={[styles.viewTab, activeView === angle && styles.viewTabActive]}
              onPress={() => setActiveView(angle)}
            >
              <Text style={[styles.viewTabText, activeView === angle && styles.viewTabTextActive]}>
                {VIEW_LABELS[angle]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Image with bounding box overlay */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.scanImage} resizeMode="cover" />
          <Svg style={StyleSheet.absoluteFill} width={IMAGE_WIDTH} height={IMAGE_HEIGHT}>
            {detections.filter((d) => d.status !== 'removed').map((d, i) => {
              const color = COLORS[d.className] ?? '#FFFFFF';
              // Scale bbox from original image coords to display coords.
              // The image is rendered with resizeMode="cover", so we use a single
              // scale factor (max of both axes) and apply the crop offset.
              const dims = (session.model_detections as any)?.image_dimensions?.[activeView];
              const imgW = dims?.width ?? 1280;
              const imgH = dims?.height ?? 1280;
              const scale = Math.max(IMAGE_WIDTH / imgW, IMAGE_HEIGHT / imgH);
              const offsetX = (IMAGE_WIDTH - imgW * scale) / 2;
              const offsetY = (IMAGE_HEIGHT - imgH * scale) / 2;
              const x = d.bbox[0] * scale + offsetX;
              const y = d.bbox[1] * scale + offsetY;
              const w = (d.bbox[2] - d.bbox[0]) * scale;
              const h = (d.bbox[3] - d.bbox[1]) * scale;

              return (
                <SvgRect
                  key={i}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={d.source === 'ai' ? '6,3' : undefined}
                  fill="transparent"
                  rx={4}
                />
              );
            })}
          </Svg>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Model detected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: Colors.primary, borderStyle: 'dashed' }]} />
              <Text style={styles.legendText}>AI identified</Text>
            </View>
          </View>
        </View>

        {/* Severity summary card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#2D1B69', '#1A0F3D']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)} Acne
              </Text>
              <Text style={styles.summarySpots}>
                {session.total_spots ?? 0} spots across 3 views
              </Text>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_BAR_COLORS[severity] + '30' }]}>
              <Text style={[styles.severityBadgeText, { color: SEVERITY_BAR_COLORS[severity] }]}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </Text>
            </View>
          </View>

          {/* Severity bar */}
          <View style={styles.severityBar}>
            <View style={[styles.severityFill, { width: `${severityScore}%`, backgroundColor: SEVERITY_BAR_COLORS[severity] }]} />
          </View>
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabel}>Clear</Text>
            <Text style={styles.severityLabel}>Mild</Text>
            <Text style={styles.severityLabel}>Moderate</Text>
            <Text style={styles.severityLabel}>Severe</Text>
          </View>

          {/* Description */}
          {session.description && (
            <Text style={styles.summaryDesc}>{session.description}</Text>
          )}

          {/* Stat chips */}
          <View style={styles.statChips}>
            <View style={styles.statChip}>
              <Text style={styles.statChipIcon}>✅</Text>
              <Text style={styles.statChipText}>{confirmedCount} confirmed</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipIcon}>🔍</Text>
              <Text style={styles.statChipText}>{aiAddedCount} possible</Text>
            </View>
            {session.primary_acne_type && (
              <View style={styles.statChip}>
                <Text style={styles.statChipIcon}>🎯</Text>
                <Text style={styles.statChipText}>
                  {session.primary_acne_type.charAt(0).toUpperCase() + session.primary_acne_type.slice(1)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Detection type breakdown */}
        <Text style={styles.sectionTitle}>ACNE MAP</Text>
        <View style={styles.typeList}>
          {Object.entries(classCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([className, { count, source }]) => (
              <View key={className} style={styles.typeRow}>
                <View style={[styles.typeDot, { backgroundColor: COLORS[className] ?? '#888' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeName}>
                    {className.charAt(0).toUpperCase() + className.slice(1)}
                  </Text>
                </View>
                <View style={styles.typeCountCol}>
                  <Text style={styles.typeCount}>{count}</Text>
                  <Text style={styles.typeSource}>{source}</Text>
                </View>
              </View>
            ))}
        </View>

        {/* Zone breakdown */}
        {session.zone_breakdown && session.zone_breakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ZONE BREAKDOWN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneScroll}>
              {(session.zone_breakdown as ZoneBreakdown[]).map((zone, i) => (
                <View key={i} style={styles.zoneCard}>
                  <Text style={styles.zoneCardTitle}>{zone.zone.replace(/_/g, ' ').toUpperCase()}</Text>
                  <Text style={styles.zoneCardCount}>{zone.spot_count}</Text>
                  <Text style={styles.zoneCardTypes}>{zone.primary_types.join(' · ')}</Text>
                  <View style={[styles.zoneBar, { backgroundColor: SEVERITY_BAR_COLORS[zone.severity] ?? Colors.textMuted }]} />
                  <Text style={styles.zoneCardNote}>{zone.note}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Skin insights */}
        {session.skin_insights && (
          <>
            <Text style={styles.sectionTitle}>SKIN INSIGHTS</Text>
            <View style={styles.insightsGrid}>
              <View style={styles.insightCard}>
                <Text style={styles.insightLabel}>SKIN TYPE</Text>
                <Text style={styles.insightValue}>{(session.skin_insights as any).skin_type}</Text>
              </View>
              <View style={styles.insightCard}>
                <Text style={styles.insightLabel}>MOISTURE</Text>
                <Text style={styles.insightValue}>{(session.skin_insights as any).moisture}</Text>
              </View>
            </View>
            {(session.skin_insights as any).key_observations?.map((obs: string, i: number) => (
              <Text key={i} style={styles.observationText}>• {obs}</Text>
            ))}
          </>
        )}

        {/* Recommendations */}
        {session.recommendations && (session.recommendations as Recommendation[]).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
            {(session.recommendations as Recommendation[]).map((rec, i) => (
              <View key={i} style={[styles.recCard, { borderLeftColor: rec.priority === 'high' ? Colors.error : rec.priority === 'medium' ? Colors.warning : Colors.success }]}>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            ))}
          </>
        )}

        {/* Skin Plan */}
        {session.skin_plan && (
          <>
            <Text style={styles.sectionTitle}>YOUR SKIN PLAN</Text>
            {(session.skin_plan as SkinPlan).morning_routine?.length > 0 && (
              <View style={styles.planSection}>
                <Text style={styles.planSectionTitle}>☀️  Morning Routine</Text>
                {(session.skin_plan as SkinPlan).morning_routine.map((step: SkinPlanRoutineStep, i: number) => (
                  <View key={i} style={styles.planStep}>
                    <View style={styles.planStepNum}><Text style={styles.planStepNumText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planStepTitle}>{step.step}</Text>
                      <Text style={styles.planStepReason}>{step.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {(session.skin_plan as SkinPlan).evening_routine?.length > 0 && (
              <View style={styles.planSection}>
                <Text style={styles.planSectionTitle}>🌙  Evening Routine</Text>
                {(session.skin_plan as SkinPlan).evening_routine.map((step: SkinPlanRoutineStep, i: number) => (
                  <View key={i} style={styles.planStep}>
                    <View style={styles.planStepNum}><Text style={styles.planStepNumText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planStepTitle}>{step.step}</Text>
                      <Text style={styles.planStepReason}>{step.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {(session.skin_plan as SkinPlan).weekly_treatments?.length > 0 && (
              <View style={styles.planSection}>
                <Text style={styles.planSectionTitle}>📅  Weekly Treatments</Text>
                {(session.skin_plan as SkinPlan).weekly_treatments.map((t: SkinPlanWeeklyTreatment, i: number) => (
                  <View key={i} style={styles.planStep}>
                    <View style={styles.planStepNum}><Text style={styles.planStepNumText}>{i + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planStepTitle}>{t.treatment} — {t.frequency}</Text>
                      <Text style={styles.planStepReason}>{t.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/plan')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>+ Build My Skin Plan</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xxl },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...Typography.headlineLarge, color: Colors.text, textAlign: 'center' },
  headerDate: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  // View tabs
  viewTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  viewTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.cardGlass,
    alignItems: 'center',
  },
  viewTabActive: {
    backgroundColor: Colors.primary,
  },
  viewTabText: { ...Typography.labelMedium, color: Colors.textSecondary },
  viewTabTextActive: { color: '#FFFFFF' },

  // Image
  imageContainer: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scanImage: {
    width: '100%',
    height: '100%',
  },
  legend: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendLine: { width: 20, height: 2, borderRadius: 1 },
  legendText: { ...Typography.caption, color: 'rgba(255,255,255,0.8)' },

  // Summary card
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  summaryTitle: { ...Typography.displaySmall, color: Colors.text },
  summarySpots: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  severityBadge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill },
  severityBadgeText: { ...Typography.labelMedium },
  severityBar: { height: 6, backgroundColor: Colors.cardGlass, borderRadius: 3, marginBottom: Spacing.xs },
  severityFill: { height: 6, borderRadius: 3 },
  severityLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  severityLabel: { ...Typography.caption, color: Colors.textMuted },
  summaryDesc: { ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  statChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.cardGlass,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  statChipIcon: { fontSize: 14 },
  statChipText: { ...Typography.labelSmall, color: Colors.textSecondary },

  // Type list
  sectionTitle: { ...Typography.labelMedium, color: Colors.textMuted, letterSpacing: 2, marginBottom: Spacing.lg },
  typeList: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  typeName: { ...Typography.headlineSmall, color: Colors.text },
  typeCountCol: { alignItems: 'flex-end' },
  typeCount: { ...Typography.displaySmall, color: Colors.text },
  typeSource: { ...Typography.caption, color: Colors.textMuted },

  // Zone breakdown
  zoneScroll: { marginBottom: Spacing.xxl },
  zoneCard: {
    width: 180,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoneCardTitle: { ...Typography.labelSmall, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  zoneCardCount: { ...Typography.displayMedium, color: Colors.text },
  zoneCardTypes: { ...Typography.caption, color: Colors.primary, marginBottom: Spacing.sm },
  zoneBar: { height: 3, borderRadius: 2, marginBottom: Spacing.sm },
  zoneCardNote: { ...Typography.caption, color: Colors.textSecondary },

  // Insights
  insightsGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  insightCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightLabel: { ...Typography.labelSmall, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  insightValue: { ...Typography.headlineSmall, color: Colors.primary },
  observationText: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.sm, marginLeft: Spacing.sm },

  // Recommendations
  recCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  recTitle: { ...Typography.headlineSmall, color: Colors.text, marginBottom: Spacing.xs },
  recDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  // Skin Plan
  planSection: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planSectionTitle: { ...Typography.headlineSmall, color: Colors.text, marginBottom: Spacing.md },
  planStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  planStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  planStepNumText: { ...Typography.labelSmall, color: Colors.primary },
  planStepTitle: { ...Typography.bodyMedium, color: Colors.text },
  planStepReason: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  // CTA
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  ctaText: { ...Typography.headlineSmall, color: '#FFFFFF' },
});
