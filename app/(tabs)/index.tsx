import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  Image,
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
import StreakCounter from '@/components/StreakCounter';
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

  // ── Entrance stagger anims ──
  const cardAnims = useRef(
    Array.from({ length: 5 }, () => ({
      opacity:     new Animated.Value(0),
      translateY:  new Animated.Value(18),
    }))
  ).current;

  // Hero glow breathing anim
  const heroGlowOpacity = useRef(new Animated.Value(0.4)).current;
  const heroGlowLoop    = useRef<Animated.CompositeAnimation | null>(null);

  // Stat count-up
  const severityAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  // Button spring scales
  const quickScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  const springPress   = (anim: Animated.Value) => Animated.spring(anim, { toValue: 0.94, tension: 120, friction: 8, useNativeDriver: true }).start();
  const springRelease = (anim: Animated.Value) => Animated.spring(anim, { toValue: 1,    tension: 120, friction: 8, useNativeDriver: true }).start();

  useEffect(() => {
    const id = severityAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
    return () => severityAnim.removeListener(id);
  }, [severityAnim]);

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

  useEffect(() => {
    if (!loaded) return;

    // Stagger cards in
    Animated.stagger(60,
      cardAnims.map(a =>
        Animated.parallel([
          Animated.timing(a.opacity,    { toValue: 1,  duration: 400, useNativeDriver: true }),
          Animated.spring(a.translateY, { toValue: 0,  tension: 60, friction: 8, useNativeDriver: true }),
        ])
      )
    ).start();

    // Hero glow breathing loop
    heroGlowLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(heroGlowOpacity, { toValue: 0.8, duration: 1500, useNativeDriver: true }),
        Animated.timing(heroGlowOpacity, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    );
    heroGlowLoop.current.start();

    // Stat count-up
    if (skinProfile?.severity) {
      const target = skinProfile.severity === 'mild' ? 3 : skinProfile.severity === 'moderate' ? 6 : 9;
      Animated.timing(severityAnim, { toValue: target, duration: 800, useNativeDriver: false }).start();
    }

    return () => { heroGlowLoop.current?.stop(); };
  }, [loaded, skinProfile]);

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
          style={{ flex: 1, backgroundColor: Colors.background }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
        >
          {Header}

          {/* ── Scan Result Hero Card ── */}
          <Animated.View style={{ opacity: cardAnims[0].opacity, transform: [{ translateY: cardAnims[0].translateY }] }}>
            <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/(tabs)/scan')}>
              <LinearGradient
                colors={['#5B35D5', '#3B1FA3']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.scanCard}
              >
                <Animated.View pointerEvents="none" style={[s.heroInnerGlow, { opacity: heroGlowOpacity }]} />

                {/* Label + Streak row */}
                <View style={s.scanCardTopRow}>
                  <Text style={s.scanCardLabel}>Today's scan result</Text>
                  <StreakCounter compact />
                </View>

                {/* Condition title */}
                <Text style={s.scanCardTitle}>
                  {skinLabel}{skinProfile.acne_type ? ` with ${skinProfile.acne_type} acne` : ''}
                </Text>

                {/* Analysis notes */}
                {skinProfile.analysis_notes ? (
                  <Text style={s.scanCardDesc} numberOfLines={4}>{skinProfile.analysis_notes}</Text>
                ) : (
                  <Text style={s.scanCardDesc}>{skinDesc}</Text>
                )}

                {/* Photo + Metrics row */}
                <View style={s.photoMetricsRow}>
                  {skinProfile.photo_url ? (
                    <Image source={{ uri: skinProfile.photo_url }} style={s.scanFacePhoto} resizeMode="cover" />
                  ) : (
                    <View style={[s.scanFacePhoto, s.scanFacePhotoPlaceholder]} />
                  )}
                  <View style={s.metricsStack}>
                    <View style={s.metricRow}>
                      <Text style={s.metricRowLabel}>Breakouts</Text>
                      <Text style={[s.metricRowValue, { color: getSeverityColor(skinProfile.severity) }]}>{capitalize(skinProfile.severity ?? 'mild')}</Text>
                    </View>
                    <View style={s.metricRow}>
                      <Text style={s.metricRowLabel}>Oil</Text>
                      <Text style={[s.metricRowValue, { color: skinProfile.skin_type === 'oily' ? '#FCD34D' : skinProfile.skin_type === 'combination' ? '#FCD34D' : Colors.textSecondary }]}>
                        {skinProfile.skin_type === 'oily' ? 'High' : skinProfile.skin_type === 'combination' ? 'Medium' : skinProfile.skin_type === 'dry' ? 'Low' : 'Normal'}
                      </Text>
                    </View>
                    <View style={s.metricRow}>
                      <Text style={s.metricRowLabel}>Redness</Text>
                      <Text style={[s.metricRowValue, { color: skinProfile.skin_type === 'sensitive' ? '#F87171' : Colors.textSecondary }]}>
                        {skinProfile.skin_type === 'sensitive' ? 'High' : skinProfile.severity === 'severe' ? 'High' : skinProfile.severity === 'moderate' ? 'Medium' : 'Low'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Zone indicators */}
                {(() => {
                  const zones = (skinProfile as any).zones as Record<string, { severity: string; note: string }> | null;
                  if (!zones || Object.keys(zones).length === 0) return null;
                  const ZONE_COLOR: Record<string, string> = { clear: '#4ADE80', mild: '#FCD34D', moderate: '#FB923C', severe: '#F87171' };
                  const ZONE_LABELS: Record<string, string> = { forehead: 'Forehead', left_cheek: 'Left Cheek', right_cheek: 'Right Cheek', nose: 'Nose', chin: 'Chin', jawline: 'Jawline' };
                  return (
                    <View style={s.zonesSection}>
                      <Text style={s.zonesSectionLabel}>ZONES</Text>
                      <View style={s.zoneChips}>
                        {Object.entries(zones).filter(([k]) => ZONE_LABELS[k]).map(([key, val]) => (
                          <View key={key} style={s.zoneChip}>
                            <View style={[s.zoneChipDot, { backgroundColor: ZONE_COLOR[val.severity] ?? '#A78BFA' }]} />
                            <Text style={s.zoneChipText}>{ZONE_LABELS[key]}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })()}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Quick Actions Row ── */}
          <Animated.View style={{ opacity: cardAnims[1].opacity, transform: [{ translateY: cardAnims[1].translateY }] }}>
            <View style={s.quickRow}>
              <Animated.View style={{ transform: [{ scale: quickScales[0] }] }}>
                <TouchableOpacity
                  style={s.quickCard}
                  activeOpacity={1}
                  onPressIn={() => springPress(quickScales[0])}
                  onPressOut={() => springRelease(quickScales[0])}
                  onPress={() => router.push('/(tabs)/plan')}
                >
                  <View style={s.quickIconCircle}>
                    <PlanGridIcon size={18} color={Colors.primaryLight} />
                  </View>
                  <Text style={s.quickCardTitle}>Skin Plan</Text>
                  <Text style={s.quickCardSub}>Your game plan</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: quickScales[1] }] }}>
                <TouchableOpacity
                  style={s.quickCard}
                  activeOpacity={1}
                  onPressIn={() => springPress(quickScales[1])}
                  onPressOut={() => springRelease(quickScales[1])}
                  onPress={() => router.push('/(tabs)/scan')}
                >
                  <View style={s.quickIconCircle}>
                    <ScanLineIcon size={18} color={Colors.primaryLight} />
                  </View>
                  <Text style={s.quickCardTitle}>Re-scan</Text>
                  <Text style={s.quickCardSub}>Update results</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: quickScales[2] }] }}>
                <TouchableOpacity
                  style={s.quickCard}
                  activeOpacity={1}
                  onPressIn={() => springPress(quickScales[2])}
                  onPressOut={() => springRelease(quickScales[2])}
                  onPress={() => router.push('/coach')}
                >
                  <View style={s.quickIconCircle}>
                    <ChatBubbleIcon size={18} color={Colors.primaryLight} />
                  </View>
                  <Text style={s.quickCardTitle}>Coach</Text>
                  <Text style={s.quickCardSub}>Ask anything</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>


          {/* ── Progress card ── */}
          <Animated.View style={{ opacity: cardAnims[3].opacity, transform: [{ translateY: cardAnims[3].translateY }] }}>
            <TouchableOpacity style={s.progressCard} activeOpacity={0.88} onPress={() => router.push('/(tabs)/progress')}>
              <View style={s.progressCardHeader}>
                <Text style={s.progressCardTitle}>Track your progress</Text>
                <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
              </View>
              <Text style={s.progressCardSub}>
                Log photos to see how your skin changes over time
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 90 }} />
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
        style={{ backgroundColor: Colors.background }}
        overScrollMode="never"
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
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  heroInnerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderRadius: 20,
    backgroundColor: 'rgba(124,92,252,0.2)',
  },
  scanCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  scanCardLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  scanCardTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 26,
    color: Colors.white,
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: Spacing.sm,
  },
  scanCardDesc: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  photoMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'stretch',
  },
  scanFacePhoto: {
    width: 110,
    height: 130,
    borderRadius: BorderRadius.lg,
  },
  scanFacePhotoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metricsStack: {
    flex: 1,
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  metricRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  metricRowLabel: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  metricRowValue: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: Colors.white,
  },
  zonesSection: {
    marginTop: Spacing.xs,
  },
  zonesSectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  zoneChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
  },
  zoneChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneChipText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  // Legacy — kept for ZoneDot/MetricPill used elsewhere
  zoneDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  zoneDotLabel: { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  metricPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 11, paddingVertical: 6, borderRadius: BorderRadius.pill },
  metricLabel: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  metricValue: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.white },
  metricsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: Spacing.lg },
  zoneRow: { flexDirection: 'row', gap: 12, marginBottom: Spacing.xl },
  scanCardCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scanCardCtaText: { fontFamily: Fonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  scanAgoText: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.5)' },

  /* Quick actions */
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quickCard: {
    width: Math.floor((SW - Spacing.xl * 2 - Spacing.sm * 2) / 3),
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
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
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
