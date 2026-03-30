import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, SkinType, AcneType, Severity, SubscriptionTier } from '@/lib/database.types';
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

const SEVERITY_COLORS: Record<Severity, string> = {
  mild: Colors.severityMild,
  moderate: Colors.severityModerate,
  severe: Colors.severitySevere,
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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

  const nextCheckIn = lastProgress
    ? addDays(new Date(lastProgress.created_at), 7)
    : null;
  const daysUntilCheckIn = nextCheckIn
    ? Math.max(0, differenceInDays(nextCheckIn, new Date()))
    : null;

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
      <LinearGradient
        colors={['#FFF0F5', '#FFE0ED']}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>
              {profile?.full_name?.split(' ')[0] || 'Beautiful'}
            </Text>
          </View>
          <TouchableOpacity style={styles.avatarButton}>
            <LinearGradient
              colors={[Colors.secondary, Colors.primary]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {(profile?.full_name || 'G')[0].toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtext}>
          {weekNumber
            ? `Week ${weekNumber} of your journey`
            : 'Ready to start your skin journey?'}
        </Text>
      </LinearGradient>

      {/* Main content */}
      <View style={styles.cardsContainer}>
        {/* Skin profile card OR CTA */}
        {skinProfile ? (
          <View style={[styles.card, styles.skinProfileCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Your Skin Profile</Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/scan')}
                style={styles.rescanButton}
              >
                <Text style={styles.rescanText}>Re-scan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.skinChipsRow}>
              <View style={[styles.skinChip, { backgroundColor: Colors.skinOily + '20' }]}>
                <Text style={styles.skinChipLabel}>Skin Type</Text>
                <Text style={[styles.skinChipValue, { color: Colors.skinOily }]}>
                  {SKIN_TYPE_LABELS[skinProfile.skin_type]}
                </Text>
              </View>
              <View style={[styles.skinChip, { backgroundColor: Colors.primary + '15' }]}>
                <Text style={styles.skinChipLabel}>Acne Type</Text>
                <Text style={[styles.skinChipValue, { color: Colors.primary }]}>
                  {ACNE_TYPE_LABELS[skinProfile.acne_type]}
                </Text>
              </View>
              <View style={[styles.skinChip, { backgroundColor: SEVERITY_COLORS[skinProfile.severity] + '20' }]}>
                <Text style={styles.skinChipLabel}>Severity</Text>
                <Text style={[styles.skinChipValue, { color: SEVERITY_COLORS[skinProfile.severity] }]}>
                  {skinProfile.severity.charAt(0).toUpperCase() + skinProfile.severity.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.analysisNotes} numberOfLines={3}>
              {skinProfile.analysis_notes}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.ctaCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.ctaEmoji}>📸</Text>
              <Text style={styles.ctaTitle}>Start Your Skin Scan</Text>
              <Text style={styles.ctaSubtext}>
                Take a selfie and get your personalized AI skin analysis in seconds
              </Text>
              <View style={styles.ctaButton}>
                <Text style={styles.ctaButtonText}>Scan Now →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Plan summary */}
        {plan ? (
          <TouchableOpacity
            style={[styles.card, styles.planCard]}
            onPress={() => router.push('/(tabs)/plan')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Your 4-Pillar Plan</Text>
              <Text style={styles.viewAll}>View All →</Text>
            </View>
            <View style={styles.pillarsGrid}>
              {[
                { icon: '🧴', label: 'Products', color: Colors.primary },
                { icon: '🥗', label: 'Diet', color: Colors.success },
                { icon: '🌿', label: 'Herbal', color: '#4CAF87' },
                { icon: '🧘', label: 'Lifestyle', color: Colors.secondary },
              ].map((pillar) => (
                <View key={pillar.label} style={styles.pillarItem}>
                  <View style={[styles.pillarIconBg, { backgroundColor: pillar.color + '15' }]}>
                    <Text style={styles.pillarIcon}>{pillar.icon}</Text>
                  </View>
                  <Text style={styles.pillarLabel}>{pillar.label}</Text>
                  <Text style={styles.pillarStatus}>Active</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ) : skinProfile ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(tabs)/plan')}
          >
            <LinearGradient
              colors={[Colors.secondary, '#E8547A']}
              style={styles.generatePlanCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.generatePlanEmoji}>✨</Text>
              <Text style={styles.generatePlanTitle}>Generate Your Plan</Text>
              <Text style={styles.generatePlanSubtext}>
                Get your personalized 4-pillar skincare plan
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {/* Quick action buttons */}
        {skinProfile && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickButton}
              onPress={() => router.push('/(tabs)/progress')}
              activeOpacity={0.85}
            >
              <Text style={styles.quickButtonEmoji}>📷</Text>
              <Text style={styles.quickButtonText}>Log Today's Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButtonPrimary]}
              onPress={() => router.push('/(tabs)/plan')}
              activeOpacity={0.85}
            >
              <Text style={styles.quickButtonEmoji}>📋</Text>
              <Text style={[styles.quickButtonText, styles.quickButtonTextPrimary]}>
                View Full Plan
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Routine count */}
        {plan && routineCount > 0 && (
          <TouchableOpacity
            style={styles.routineCountCard}
            onPress={() => router.push('/(tabs)/plan')}
            activeOpacity={0.85}
          >
            <Text style={styles.routineCountEmoji}>✅</Text>
            <Text style={styles.routineCountText}>
              You have <Text style={styles.routineCountNumber}>{routineCount}</Text>{' '}
              {routineCount === 1 ? 'item' : 'items'} in your routine
            </Text>
            <Text style={styles.routineCountArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Progress check-in card */}
        {skinProfile && (
          <TouchableOpacity
            style={[styles.card, styles.progressCard]}
            onPress={() => router.push('/(tabs)/progress')}
            activeOpacity={0.85}
          >
            <View style={styles.progressCardHeader}>
              <View>
                <Text style={styles.cardTitle}>Weekly Check-in</Text>
                <Text style={styles.progressSubtext}>
                  {daysUntilCheckIn === null
                    ? 'Log your first progress photo'
                    : daysUntilCheckIn === 0
                    ? 'Time for your check-in!'
                    : `Next check-in in ${daysUntilCheckIn} days`}
                </Text>
              </View>
              <View style={styles.checkInBadge}>
                <Text style={styles.checkInEmoji}>
                  {daysUntilCheckIn === 0 ? '🔔' : '📅'}
                </Text>
              </View>
            </View>
            {lastProgress && (
              <View style={styles.lastProgressRow}>
                <Text style={styles.lastProgressLabel}>Last logged: </Text>
                <Text style={styles.lastProgressDate}>
                  {format(new Date(lastProgress.created_at), 'MMM d, yyyy')}
                </Text>
                {lastProgress.improvement_percentage !== null && (
                  <Text style={styles.improvementBadge}>
                    +{lastProgress.improvement_percentage.toFixed(0)}% better
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Recent insights */}
        {plan && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's Insight</Text>
            <LinearGradient
              colors={['#FFF0F5', '#FFE0ED']}
              style={styles.insightCard}
            >
              <Text style={styles.insightEmoji}>💡</Text>
              <Text style={styles.insightText}>
                Based on your skin profile, incorporating niacinamide into your morning routine could help regulate sebum production and reduce pore appearance.
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Premium upgrade banner for free users */}
        {profile?.subscription_tier === 'free' && (
          <TouchableOpacity activeOpacity={0.9}>
            <LinearGradient
              colors={['#1A0A0F', '#3D1A28']}
              style={styles.premiumBanner}
            >
              <View style={styles.premiumContent}>
                <Text style={styles.premiumBadge}>PREMIUM</Text>
                <Text style={styles.premiumTitle}>Unlock Full Glow</Text>
                <Text style={styles.premiumFeatures}>
                  Unlimited scans • Weekly AI coaching • Advanced progress tracking
                </Text>
                <View style={styles.premiumPriceRow}>
                  <Text style={styles.premiumPrice}>$9.99</Text>
                  <Text style={styles.premiumPeriod}>/month</Text>
                </View>
              </View>
              <LinearGradient
                colors={[Colors.secondary, Colors.primary]}
                style={styles.upgradeButton}
              >
                <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
              </LinearGradient>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  headerGradient: {
    marginHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  greeting: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  userName: {
    ...Typography.displaySmall,
    color: Colors.text,
  },
  avatarButton: {
    borderRadius: BorderRadius.circle,
    ...Shadows.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...Typography.headlineMedium,
    color: Colors.white,
    fontWeight: '700',
  },
  headerSubtext: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  cardsContainer: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    ...Typography.headlineSmall,
    color: Colors.text,
  },
  viewAll: {
    ...Typography.labelMedium,
    color: Colors.primary,
  },
  skinProfileCard: {},
  rescanButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rescanText: {
    ...Typography.labelSmall,
    color: Colors.primary,
  },
  skinChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  skinChip: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  skinChipLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  skinChipValue: {
    ...Typography.labelSmall,
    fontWeight: '700',
  },
  analysisNotes: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  ctaCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  ctaEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  ctaTitle: {
    ...Typography.headlineLarge,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  ctaSubtext: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  ctaButtonText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },
  planCard: {},
  pillarsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pillarIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillarIcon: {
    fontSize: 22,
  },
  pillarLabel: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
  },
  pillarStatus: {
    ...Typography.caption,
    color: Colors.success,
    fontSize: 10,
  },
  generatePlanCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.md,
  },
  generatePlanEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  generatePlanTitle: {
    ...Typography.headlineMedium,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  generatePlanSubtext: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  progressCard: {},
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubtext: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: Spacing.xxs,
  },
  checkInBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInEmoji: {
    fontSize: 22,
  },
  lastProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  lastProgressLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  lastProgressDate: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
  },
  improvementBadge: {
    ...Typography.caption,
    color: Colors.success,
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
    fontWeight: '600',
  },
  insightCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    alignItems: 'flex-start',
  },
  insightEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  insightText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  premiumBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.lg,
  },
  premiumContent: {
    gap: Spacing.xs,
  },
  premiumBadge: {
    ...Typography.labelSmall,
    color: Colors.secondary,
    letterSpacing: 2,
  },
  premiumTitle: {
    ...Typography.displaySmall,
    color: Colors.white,
  },
  premiumFeatures: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  premiumPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: Spacing.xs,
  },
  premiumPrice: {
    ...Typography.displaySmall,
    color: Colors.secondary,
  },
  premiumPeriod: {
    ...Typography.bodyMedium,
    color: 'rgba(255,255,255,0.7)',
  },
  upgradeButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeButtonText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  quickButtonPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickButtonEmoji: {
    fontSize: 24,
  },
  quickButtonText: {
    ...Typography.labelSmall,
    color: Colors.text,
    textAlign: 'center',
  },
  quickButtonTextPrimary: {
    color: Colors.white,
  },
  routineCountCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.successLight,
  },
  routineCountEmoji: {
    fontSize: 20,
  },
  routineCountText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  routineCountNumber: {
    fontWeight: '700',
    color: Colors.success,
  },
  routineCountArrow: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
});
