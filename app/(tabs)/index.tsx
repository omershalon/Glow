import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path, Rect, Polyline } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Colors, BorderRadius, Spacing, Shadows, Fonts } from '@/lib/theme';
import ScreenBackground from '@/components/ScreenBackground';
import { HomeSkeleton } from '@/components/SkeletonLoader';
import { useTabTransition } from '@/hooks/useTabTransition';
import type { Database, SkinType, Severity } from '@/lib/database.types';
import { differenceInDays } from 'date-fns';

type Profile          = Database['public']['Tables']['profiles']['Row'];
type SkinProfile      = Database['public']['Tables']['skin_profiles']['Row'];
type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];

const { width: SW } = Dimensions.get('window');

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Oily', dry: 'Dry', combination: 'Combination', sensitive: 'Sensitive', normal: 'Normal',
};
const SKIN_TYPE_DESC: Record<SkinType, string> = {
  oily:        'excess sebum production, prone to breakouts',
  dry:         'tight feeling, flakiness, needs hydration',
  combination: 'oily T-zone with dry cheeks',
  sensitive:   'reactive skin, prone to redness',
  normal:      'balanced, minimal concerns',
};


function ChevronRight({ size = 14, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ScanLineIcon({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={5} width={20} height={16} rx={3} stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={13} r={4.5} stroke={color} strokeWidth={1.8} />
      <Rect x={8.5} y={2} width={7} height={4} rx={1} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function ChatBubbleIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

function PlanGridIcon({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} fill="none" />
      <Rect x={13} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} fill="none" />
      <Rect x={3} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} fill="none" />
      <Rect x={13} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

function MiniWaveChart() {
  return (
    <Svg width={64} height={32} viewBox="0 0 64 32">
      <Polyline
        points="2,28 12,20 22,24 34,10 44,16 58,4"
        fill="none"
        stroke="rgba(167,139,250,0.8)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ── Zone dot component ── */
function ZoneDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.zoneDotRow}>
      <View style={[s.zoneDot, { backgroundColor: color }]} />
      <Text style={s.zoneDotLabel}>{label}</Text>
    </View>
  );
}

/* ── Metric pill ── */
function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.metricPill}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function getSeverityColor(sev?: Severity | null): string {
  if (sev === 'mild')     return Colors.severityMild;
  if (sev === 'moderate') return Colors.severityModerate;
  if (sev === 'severe')   return Colors.severitySevere;
  return Colors.textMuted;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { animatedStyle } = useTabTransition();
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [skinProfile,  setSkinProfile]  = useState<SkinProfile | null>(null);
  const [plan,         setPlan]         = useState<PersonalizedPlan | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);
  const [loaded,       setLoaded]       = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).single() as any;
    const skinRes    = await supabase.from('skin_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single() as any;
    const planRes    = await supabase.from('personalized_plans').select('*').eq('user_id', user.id).eq('is_active', true).single() as any;
    if (profileRes.data) setProfile(profileRes.data);
    if (skinRes.data)    setSkinProfile(skinRes.data);
    if (planRes.data)    setPlan(planRes.data);
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile as any)?.email?.[0]?.toUpperCase() ?? '?';

  const daysSinceScan = skinProfile
    ? differenceInDays(new Date(), new Date(skinProfile.created_at))
    : null;
  const scanAgoLabel = daysSinceScan != null
    ? daysSinceScan === 0 ? 'Today' : daysSinceScan === 1 ? '1d ago' : `${daysSinceScan}d ago`
    : null;

  /* ── Shared Header ── */
  const Header = (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={s.headerBrand}>
        <Text style={s.headerBrandText}>SkinX</Text>
      </View>
      <View style={s.headerRight}>
        <TouchableOpacity
          style={s.avatarBtn}
          onPress={() => router.push('/profile')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={[Colors.primaryLight, Colors.primary]} style={s.avatarGradient}>
            <Text style={s.avatarText}>{initials}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ── Skeleton while loading ── */
  if (!loaded) {
    return (
      <Animated.View style={[s.root, animatedStyle]}>
        <ScreenBackground preset="home" />
        <View style={{ paddingTop: insets.top + 12 }} />
        <HomeSkeleton />
      </Animated.View>
    );
  }

  /* ══════════════════════
     POST-SCAN DASHBOARD
     ══════════════════════ */
  if (loaded && skinProfile) {
    const skinLabel = SKIN_TYPE_LABELS[skinProfile.skin_type] ?? skinProfile.skin_type;
    const skinDesc  = SKIN_TYPE_DESC[skinProfile.skin_type] ?? '';


    return (
      <Animated.View style={[s.root, animatedStyle]}>
        <ScreenBackground preset="home" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
        >
          {Header}

          {/* ── Scan Result Hero Card ── */}
          <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/(tabs)/scan')}>
            <LinearGradient
              colors={['#3B1FA3', '#1E0F5C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.scanCard}
            >
              {/* Top badges */}
              <View style={s.scanCardTop}>
                <View style={s.confidenceBadge}>
                  <View style={s.confidenceDot} />
                  <Text style={s.confidenceText}>confidence high</Text>
                </View>
                {scanAgoLabel && (
                  <Text style={s.scanAgoText}>{scanAgoLabel}</Text>
                )}
              </View>

              {/* Label */}
              <Text style={s.scanCardLabel}>Today's scan result</Text>

              {/* Condition title */}
              <Text style={s.scanCardTitle}>
                {skinLabel}{skinProfile.acne_type ? ` with\n${skinProfile.acne_type} acne` : ''}
              </Text>

              {/* Description */}
              <Text style={s.scanCardDesc}>
                {skinDesc}
              </Text>

              {/* Metric pills row */}
              <View style={s.metricsRow}>
                <MetricPill label="Skin" value={skinLabel} color={Colors.skinOily} />
                {skinProfile.severity && (
                  <MetricPill label="Severity" value={capitalize(skinProfile.severity)} color={getSeverityColor(skinProfile.severity)} />
                )}
                {skinProfile.acne_type && (
                  <MetricPill label="Acne" value={capitalize(skinProfile.acne_type)} color={Colors.primaryLight} />
                )}
              </View>

              {/* Zone indicators */}
              <View style={s.zoneRow}>
                <ZoneDot color="#2DD4BF" label="oil" />
                <ZoneDot color="#FCD34D" label="spots" />
                <ZoneDot color="#A78BFA" label={skinProfile.acne_type ?? 'acne'} />
              </View>

              {/* Bottom CTA */}
              <View style={s.scanCardCta}>
                <Text style={s.scanCardCtaText}>View full analysis</Text>
                <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Quick Actions Row ── */}
          <View style={s.quickRow}>
            <TouchableOpacity style={s.quickCard} activeOpacity={0.8} onPress={() => router.push('/(tabs)/plan')}>
              <View style={s.quickIconCircle}>
                <PlanGridIcon size={18} color={Colors.primaryLight} />
              </View>
              <Text style={s.quickCardTitle}>Skin Plan</Text>
              <Text style={s.quickCardSub}>Your game plan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.quickCard} activeOpacity={0.8} onPress={() => router.push('/(tabs)/scan')}>
              <View style={s.quickIconCircle}>
                <ScanLineIcon size={18} color={Colors.primaryLight} />
              </View>
              <Text style={s.quickCardTitle}>Re-scan</Text>
              <Text style={s.quickCardSub}>Update results</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.quickCard} activeOpacity={0.8} onPress={() => router.push('/coach')}>
              <View style={s.quickIconCircle}>
                <ChatBubbleIcon size={18} color={Colors.primaryLight} />
              </View>
              <Text style={s.quickCardTitle}>Coach</Text>
              <Text style={s.quickCardSub}>Ask anything</Text>
            </TouchableOpacity>
          </View>

          {/* ── Routine Preview ── */}
          {plan && (
            <TouchableOpacity style={s.routineCard} activeOpacity={0.88} onPress={() => router.push('/(tabs)/plan')}>
              <View style={s.routineCardHeader}>
                <Text style={s.routineCardTitle}>Your skin's game plan</Text>
                <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
              </View>
              <Text style={s.routineCardSub}>
                Built from your scan — tap to see your full routine
              </Text>
              <View style={s.routineProgress}>
                <MiniWaveChart />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Progress card ── */}
          <TouchableOpacity style={s.progressCard} activeOpacity={0.88} onPress={() => router.push('/(tabs)/progress')}>
            <View style={s.progressCardHeader}>
              <Text style={s.progressCardTitle}>Track your progress</Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={s.progressCardSub}>
              Log photos to see how your skin changes over time
            </Text>
          </TouchableOpacity>

          <View style={{ height: 110 }} />
        </ScrollView>


      </Animated.View>
    );
  }

  /* ══════════════════════
     PRE-SCAN HERO
     ══════════════════════ */
  return (
    <Animated.View style={[s.root, { flex: 1 }, animatedStyle]}>
      <ScreenBackground preset="home" />
      {Header}

      <ScrollView
        contentContainerStyle={s.heroContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
      >
        {/* Subtle purple glow behind hero text */}
        <View style={s.heroGlow} pointerEvents="none" />

        <View style={s.heroTextBlock}>
          <Text style={s.heroSubtitle}>
            Personalized scan results, routine, and progress in one place
          </Text>
          <Text style={s.heroTitle}>
            {'The Skin Coach\nFor Clearer Skin'}
          </Text>
          <Text style={s.heroBody}>
            Scan your face, see what is going on, and get a plan that feels calm, premium, and actually made for your skin.
          </Text>
        </View>

        <TouchableOpacity
          style={s.heroCta}
          activeOpacity={0.88}
          onPress={() => router.push('/(tabs)/scan')}
        >
          <Text style={s.heroCtaText}>Scan My Skin</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </Animated.View>
  );
}

function capitalize(s?: string | null) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBrandText: {
    fontFamily: Fonts.extrabold,
    fontSize: 28,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  avatarGradient: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },

  /* Scan card */
  scanCard: {
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  scanCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
  },
  confidenceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  confidenceText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  scanAgoText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  scanCardLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.xs,
  },
  scanCardTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 28,
    color: Colors.white,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  scanCardDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
    marginBottom: Spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: Spacing.lg,
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
  },
  metricLabel: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  metricValue: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: Colors.white,
  },
  zoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  zoneDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneDotLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  scanCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanCardCtaText: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },

  /* Quick actions */
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: 6,
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,92,252,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  quickCardTitle: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    color: Colors.white,
  },
  quickCardSub: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: Colors.textMuted,
  },

  /* Routine card */
  routineCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.md,
  },
  routineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  routineCardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  routineCardSub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  routineProgress: {
    marginTop: Spacing.md,
    opacity: 0.7,
  },

  /* Progress card */
  progressCard: {
    backgroundColor: 'rgba(124,92,252,0.09)',
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.2)',
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressCardTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  progressCardSub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  fabGradient: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Pre-scan hero ── */
  heroContent: {
    paddingHorizontal: Spacing.xl,
    flex: 1,
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    left: SW * 0.1,
    width: SW * 0.8,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(91,33,182,0.18)',
  },
  heroTextBlock: {
    marginTop: Spacing.massive,
    marginBottom: Spacing.xxxl,
  },
  heroSubtitle: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: Spacing.lg,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 42,
    color: Colors.white,
    lineHeight: 48,
    letterSpacing: -1.2,
    marginBottom: Spacing.xl,
  },
  heroBody: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  heroCta: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.pill,
    paddingVertical: 18,
    paddingHorizontal: Spacing.xxxl,
    alignSelf: 'center',
    ...Shadows.xl,
  },
  heroCtaText: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.background,
    letterSpacing: 0.2,
  },
});
