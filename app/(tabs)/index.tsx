import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, SkinType, AcneType, Severity } from '@/lib/database.types';
import { differenceInDays, addDays, format } from 'date-fns';

type Profile = Database['public']['Tables']['profiles']['Row'];
type SkinProfile = Database['public']['Tables']['skin_profiles']['Row'];
type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];
type ProgressPhoto = Database['public']['Tables']['progress_photos']['Row'];

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Oily',
  dry: 'Dry',
  combination: 'Combination',
  sensitive: 'Sensitive',
  normal: 'Normal',
};

const ACNE_TYPE_LABELS: Record<AcneType, string> = {
  hormonal: 'Hormonal',
  cystic: 'Cystic',
  comedonal: 'Comedonal',
  fungal: 'Fungal',
  inflammatory: 'Inflammatory',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Score arc component
function ScoreArc({ score, size = 140, strokeWidth = 10 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score / 100, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={Colors.borderLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={Colors.primary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={styles.scoreNumber}>{score}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [plan, setPlan] = useState<PersonalizedPlan | null>(null);
  const [lastProgress, setLastProgress] = useState<ProgressPhoto | null>(null);
  const [routineCount, setRoutineCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, skinRes, planRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('skin_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('personalized_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single(),
      supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (skinRes.data) setSkinProfile(skinRes.data);
    if (planRes.data) {
      setPlan(planRes.data);
      const { count } = await supabase
        .from('routine_items')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', planRes.data.id)
        .eq('is_active', true);
      setRoutineCount(count ?? 0);
    }
    if (progressRes.data) setLastProgress(progressRes.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const weekNumber = skinProfile
    ? Math.ceil(differenceInDays(new Date(), new Date(skinProfile.created_at)) / 7) || 1
    : null;

  const hasScore = lastProgress?.severity_score != null;
  const displayScore = hasScore
    ? Math.round(100 - lastProgress!.severity_score)
    : null;

  const severityLabel = skinProfile
    ? `${skinProfile.severity.charAt(0).toUpperCase() + skinProfile.severity.slice(1)} ${ACNE_TYPE_LABELS[skinProfile.acne_type]}`
    : null;

  const skinTypeLabel = skinProfile
    ? SKIN_TYPE_LABELS[skinProfile.skin_type]
    : null;

  const firstName = profile?.full_name?.split(' ')[0] || 'Beautiful';

  const pillars = [
    { icon: '\uD83E\uDDF4', label: 'Products' },
    { icon: '\uD83E\uDD57', label: 'Diet' },
    { icon: '\uD83C\uDF3F', label: 'Herbal' },
    { icon: '\uD83E\uDDD8', label: 'Lifestyle' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Greeting header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {getGreeting()}, {firstName}
          </Text>
          <Text style={styles.appTitle}>Glow</Text>
        </View>
        <Text style={styles.leafIcon}>{'\uD83C\uDF3F'}</Text>
      </View>

      {/* Skin Score Card — only shows with real data */}
      {skinProfile && (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>
            {displayScore != null ? 'Skin score' : 'Your skin profile'}{weekNumber ? ` \u00B7 Week ${weekNumber}` : ''}
          </Text>
          {displayScore != null ? (
            <View style={styles.scoreArcContainer}>
              <ScoreArc score={displayScore} />
            </View>
          ) : (
            <View style={styles.noScoreContainer}>
              <Text style={styles.noScoreText}>Complete a progress check-in to get your score</Text>
            </View>
          )}
          <Text style={styles.scoreSkinType}>
            {severityLabel} {skinTypeLabel ? `\u00B7 ${skinTypeLabel}` : ''}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badgePrimary}>
              <Text style={styles.badgePrimaryText}>
                {ACNE_TYPE_LABELS[skinProfile.acne_type]} pattern
              </Text>
            </View>
            {lastProgress?.improvement_percentage != null && (
              <View style={styles.badgeSecondary}>
                <Text style={styles.badgeSecondaryText}>
                  Improving {lastProgress.improvement_percentage.toFixed(1)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* YOUR PLAN section — only when plan exists */}
      {plan ? (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>YOUR PLAN</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillarsRow}
          >
            {pillars.map((pillar) => (
              <TouchableOpacity
                key={pillar.label}
                style={styles.pillarCard}
                onPress={() => router.push('/(tabs)/plan')}
                activeOpacity={0.8}
              >
                <Text style={styles.pillarIcon}>{pillar.icon}</Text>
                <Text style={styles.pillarLabel}>{pillar.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* QUICK ACTIONS section */}
      {skinProfile && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/scan')} activeOpacity={0.8}>
              <Text style={styles.quickActionIcon}>📸</Text>
              <Text style={styles.quickActionLabel}>New Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/progress')} activeOpacity={0.8}>
              <Text style={styles.quickActionIcon}>📊</Text>
              <Text style={styles.quickActionLabel}>Log Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/plan')} activeOpacity={0.8}>
              <Text style={styles.quickActionIcon}>📋</Text>
              <Text style={styles.quickActionLabel}>My Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(tabs)/scanner')} activeOpacity={0.8}>
              <Text style={styles.quickActionIcon}>🔍</Text>
              <Text style={styles.quickActionLabel}>Products</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* YOUR JOURNEY section — show analysis notes if available */}
      {skinProfile?.analysis_notes && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>YOUR ANALYSIS</Text>
          <View style={styles.analysisCard}>
            <Text style={styles.analysisText}>{skinProfile.analysis_notes}</Text>
          </View>
        </View>
      )}

      {/* Welcome CTA for new users — only after data loaded and truly no profile */}
      {loaded && !skinProfile && (
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeIconRow}>
              <Text style={styles.welcomeIcon}>🧴</Text>
              <Text style={styles.welcomeIcon}>🥗</Text>
              <Text style={styles.welcomeIcon}>🌿</Text>
              <Text style={styles.welcomeIcon}>🧘</Text>
            </View>
            <Text style={styles.welcomeTitle}>Your skin journey{'\n'}starts here</Text>
            <Text style={styles.welcomeSubtext}>
              Take a quick selfie and our AI will analyze your skin type, acne patterns, and create a personalized 4-pillar plan just for you.
            </Text>
            <TouchableOpacity
              style={styles.welcomeButton}
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/scan')}
            >
              <Text style={styles.welcomeButtonText}>Scan My Skin</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.welcomeSteps}>
            {[
              { num: '1', label: 'Take a selfie', desc: 'Our AI analyzes your skin' },
              { num: '2', label: 'Get your plan', desc: 'Products, diet, herbal & lifestyle' },
              { num: '3', label: 'Track progress', desc: 'Weekly check-ins & insights' },
            ].map((step) => (
              <View key={step.num} style={styles.welcomeStep}>
                <View style={styles.welcomeStepNum}>
                  <Text style={styles.welcomeStepNumText}>{step.num}</Text>
                </View>
                <View style={styles.welcomeStepBody}>
                  <Text style={styles.welcomeStepLabel}>{step.label}</Text>
                  <Text style={styles.welcomeStepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Generate Plan CTA */}
      {skinProfile && !plan && (
        <TouchableOpacity
          style={styles.generatePlanCard}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/plan')}
        >
          <Text style={styles.generatePlanEmoji}>✨</Text>
          <Text style={styles.generatePlanTitle}>Generate Your Plan</Text>
          <Text style={styles.generatePlanSubtext}>
            Your scan is done — now get your personalized 4-pillar skincare plan
          </Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  greeting: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginBottom: Spacing.xxs,
  },
  appTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  leafIcon: {
    fontSize: 28,
    marginTop: Spacing.xs,
  },

  // Score card
  scoreCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  scoreLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: Spacing.md,
  },
  scoreArcContainer: {
    marginVertical: Spacing.md,
  },
  scoreNumber: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.text,
  },
  noScoreContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  noScoreText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  scoreSkinType: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  badgePrimary: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.pill,
  },
  badgePrimaryText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },
  badgeSecondary: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.pill,
  },
  badgeSecondaryText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
  },

  // Section
  section: {
    marginTop: Spacing.xxl,
  },
  sectionHeader: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.md,
  },

  // Pillar cards
  pillarsRow: {
    gap: Spacing.sm,
  },
  pillarCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    minWidth: 90,
    ...Shadows.xs,
  },
  pillarIcon: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  pillarLabel: {
    ...Typography.labelSmall,
    color: Colors.text,
    fontWeight: '600',
  },

  // Quick actions
  quickActionsRow: {
    gap: Spacing.sm,
  },
  quickActionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: Spacing.sm,
  },
  quickActionLabel: {
    ...Typography.labelSmall,
    color: Colors.text,
    fontWeight: '600',
  },

  // Analysis card
  analysisCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  analysisText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Welcome section (no skin profile)
  welcomeSection: {
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  welcomeCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  welcomeIconRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  welcomeIcon: {
    fontSize: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 32,
  },
  welcomeSubtext: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeButton: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.sm,
  },
  welcomeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },

  welcomeSteps: {
    gap: Spacing.md,
  },
  welcomeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  welcomeStepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  welcomeStepNumText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  welcomeStepBody: {
    flex: 1,
    gap: 2,
  },
  welcomeStepLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  welcomeStepDesc: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Generate plan card
  generatePlanCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  generatePlanEmoji: {
    fontSize: 36,
  },
  generatePlanTitle: {
    ...Typography.headlineMedium,
    color: Colors.white,
  },
  generatePlanSubtext: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
