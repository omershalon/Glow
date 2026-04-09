import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { useTabTransition } from '@/hooks/useTabTransition';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import ScreenBackground from '@/components/ScreenBackground';
import { PlanSkeleton } from '@/components/SkeletonLoader';
import type { Database, RankedItem, AcneType } from '@/lib/database.types';
import PickDetailModal from '@/components/PickDetailModal';
import ParticleBurst, { ParticleBurstHandle } from '@/components/ParticleBurst';
import GlowRingPulse, { GlowRingPulseHandle } from '@/components/GlowRingPulse';

type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];
type Tab = 'picks' | 'routine';

type IconComponent = (props: { size?: number; color?: string }) => JSX.Element;

/* ── SVG Icon Components ── */
function BottleIcon({ size = 16, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={2} width={6} height={3} rx={1} stroke={color} strokeWidth={2} fill="none" />
      <Path
        d="M8 7h8l1 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l1-4z"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
      <Line x1={8} y1={14} x2={16} y2={14} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function SaladIcon({ size = 16, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
      <Path
        d="M12 7c-1 0-2.5 1.5-2.5 3.5S11 14 12 14s2.5-1.5 2.5-3.5S13 7 12 7z"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      <Line x1={12} y1={7} x2={12} y2={14} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function LeafIcon({ size = 16, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 21c0 0 1-8 6-13s11-5 11-5-1 8-6 13-11 5-11 5z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M6 21c3-3 6-7 11-11"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MoonIcon({ size = 16, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}


function ClipboardIcon({ size = 16, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4} width={14} height={17} rx={2} stroke={color} strokeWidth={2} fill="none" />
      <Rect x={9} y={2} width={6} height={4} rx={1} stroke={color} strokeWidth={1.5} fill="none" />
      <Line x1={9} y1={10} x2={15} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={9} y1={14} x2={15} y2={14} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function StarIcon({ size = 16, color = Colors.text }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const PILLAR_ICONS: Record<string, IconComponent> = {
  product:   BottleIcon,
  diet:      SaladIcon,
  herbal:    LeafIcon,
  lifestyle: MoonIcon,
};

const PILLAR_LABELS: Record<string, string> = {
  product:   'SKINCARE',
  diet:      'DIET',
  herbal:    'HERBAL',
  lifestyle: 'LIFESTYLE',
};

const PILLAR_ORDER = ['product', 'diet', 'herbal', 'lifestyle'];

const ACNE_LABELS: Record<AcneType, string> = {
  hormonal:     'HORMONAL',
  cystic:       'CYSTIC',
  comedonal:    'COMEDONAL',
  fungal:       'FUNGAL',
  inflammatory: 'INFLAMMATORY',
};

/* ── Progress Ring Component ── */
function ProgressRing({ progress, size = 56, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.borderLight}
          strokeWidth={strokeWidth}
          fill="none"
        />
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
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
    </View>
  );
}

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { animatedStyle } = useTabTransition();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [plan,         setPlan]         = useState<PersonalizedPlan | null>(null);
  const [acneType,     setAcneType]     = useState<AcneType | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>('routine');
  const [routineRanks, setRoutineRanks] = useState<Set<number>>(new Set());
  const cardScaleAnims = useRef<Record<number, Animated.Value>>({}).current;

  // Individual small bubbles per card
  const BUBBLE_COUNT = 12;
  const bubbleConfigs = useRef<Record<number, Array<{
    anim: Animated.Value;
    x: number; y: number; size: number; delay: number;
  }>>>({}).current;

  function getBubbles(rank: number) {
    if (!bubbleConfigs[rank]) {
      bubbleConfigs[rank] = Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
        anim: new Animated.Value(0),
        // Spread from right side (where + button is) toward left
        x: -(Math.random() * 280 + 20),
        y: (Math.random() - 0.5) * 80,
        size: 10 + Math.random() * 24,
        delay: i * 35 + Math.random() * 40,
      }));
    }
    return bubbleConfigs[rank];
  }
  const [routineIdMap, setRoutineIdMap] = useState<Record<number, string>>({});
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [selectedPick, setSelectedPick] = useState<RankedItem | null>(null);
  const [doneToday,    setDoneToday]    = useState<Set<number>>(new Set());
  const [pillarFilter, setPillarFilter] = useState<string>('all');

  const toastAnim  = useRef(new Animated.Value(0)).current;

  // Tip stagger anims — keyed by impact_rank
  const tipAnimsRef = useRef<Record<number, { opacity: Animated.Value; translateY: Animated.Value }>>({}).current;

  const getOrCreateTipAnim = (rank: number) => {
    if (!tipAnimsRef[rank]) {
      tipAnimsRef[rank] = {
        opacity:    new Animated.Value(1),
        translateY: new Animated.Value(0),
      };
    }
    return tipAnimsRef[rank];
  };

  // Shimmer for routine tab
  const shimmerAnim   = useRef(new Animated.Value(0)).current;
  const shimmerRanRef = useRef(false);

  // Particle burst and glow ring refs
  const burstRef = useRef<ParticleBurstHandle>(null);
  const glowRef  = useRef<GlowRingPulseHandle>(null);

  // Confetti
  const CONFETTI_COUNT = 30;
  const CONFETTI_COLORS = ['#C8573E', '#2D4A3E', '#C8A050', '#4CAF87', '#7CB9E8', '#E8547A'];
  const confettiAnims = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      anim: new Animated.Value(0),
      x: Math.random() * Dimensions.get('window').width,
      drift: (Math.random() - 0.5) * 200,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * 360,
    }))
  ).current;
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = () => {
    // Randomize positions each time
    confettiAnims.forEach(c => {
      c.x = Math.random() * Dimensions.get('window').width;
      c.drift = (Math.random() - 0.5) * 200;
      c.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      c.anim.setValue(0);
    });
    setShowConfetti(true);
    Animated.stagger(20,
      confettiAnims.map(c =>
        Animated.timing(c.anim, { toValue: 1, duration: 1200 + Math.random() * 600, useNativeDriver: true })
      )
    ).start(() => setShowConfetti(false));
  };
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── data loading ── */
  const fetchPlan = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [planRes, skinRes] = await Promise.all([
      supabase
        .from('personalized_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('skin_profiles')
        .select('acne_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const planData = planRes.data ?? null;
    setPlan(planData);
    if (skinRes.data) setAcneType(skinRes.data.acne_type as AcneType);

    if (planData) {
      const { data: routineData } = await supabase
        .from('routine_items')
        .select('id, impact_rank')
        .eq('plan_id', planData.id)
        .eq('is_active', true);

      if (routineData) {
        const ranks = new Set(routineData.map((r) => r.impact_rank as number));
        const idMap: Record<number, string> = {};
        routineData.forEach((r) => { idMap[r.impact_rank as number] = r.id as string; });
        setRoutineRanks(ranks);
        setRoutineIdMap(idMap);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  useEffect(() => { if (params.tab === 'picks') setActiveTab('picks'); }, [params.tab]);

  // Fire stagger when picks tab becomes active and items are loaded
  const prevTabRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeTab !== 'picks' || loading) return;
    if (prevTabRef.current === 'picks') return;
    prevTabRef.current = 'picks';

    const rankedItems: RankedItem[] = (plan?.ranked_items as unknown as RankedItem[]) ?? [];
    const allAnims = rankedItems.map(item => {
      const a = getOrCreateTipAnim(item.impact_rank);
      a.opacity.setValue(0);
      a.translateY.setValue(16);
      return Animated.parallel([
        Animated.timing(a.opacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(a.translateY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      ]);
    });

    Animated.stagger(50, allAnims).start();
  }, [activeTab, loading, plan]);

  // Shimmer effect for routine tab on first load
  useEffect(() => {
    if (activeTab !== 'routine' || shimmerRanRef.current) return;
    shimmerRanRef.current = true;
    Animated.timing(shimmerAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  /* ── toast ── */
  const showToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  /* ── add / remove routine item ── */
  const toggleItem = async (item: RankedItem) => {
    if (!plan) return;

    // Squish the card
    if (!cardScaleAnims[item.impact_rank]) cardScaleAnims[item.impact_rank] = new Animated.Value(1);
    Animated.sequence([
      Animated.spring(cardScaleAnims[item.impact_rank], { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(cardScaleAnims[item.impact_rank], { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();

    if (routineRanks.has(item.impact_rank)) {
      // Optimistic remove
      setRoutineRanks((p) => { const s = new Set(p); s.delete(item.impact_rank); return s; });
      setDoneToday((p) => { const s = new Set(p); s.delete(item.impact_rank); return s; });
      const id = routineIdMap[item.impact_rank];
      setRoutineIdMap((p) => { const m = { ...p }; delete m[item.impact_rank]; return m; });
      (supabase.from('routine_items') as any).update({ is_active: false }).eq('id', id);
    } else {
      // Optimistic add — update UI immediately
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRoutineRanks((p) => new Set([...p, item.impact_rank]));
      showToast();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('routine_items')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          pillar: item.pillar,
          title: item.title,
          rationale: item.rationale,
          impact_rank: item.impact_rank,
          is_active: true,
        })
        .select('id')
        .single();

      if (data) {
        setRoutineIdMap((p) => ({ ...p, [item.impact_rank]: data.id as string }));
      }
    }
  };

  /* ── toggle done today ── */
  const toggleDone = (rank: number) => {
    const wasChecked = doneToday.has(rank);
    setDoneToday((prev) => {
      const s = new Set(prev);
      if (s.has(rank)) s.delete(rank); else s.add(rank);
      return s;
    });
    if (!wasChecked) triggerConfetti();
  };

  /* ── generate ── */
  const generatePlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: skinProfile } = await supabase
      .from('skin_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!skinProfile) {
      Alert.alert(
        'Scan required',
        'Complete a skin scan first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Scan Now', onPress: () => router.push('/(tabs)/scan') },
        ]
      );
      return;
    }

    setGenerating(true);
    // Clear old data immediately so user sees it's refreshing
    setPlan(null);
    setRoutineRanks(new Set());
    setRoutineIdMap({});
    setDoneToday(new Set());
    try {
      const { error } = await supabase.functions.invoke('generate-plan', {
        body: { skin_profile_id: skinProfile.id },
      });
      if (error) throw error;
      await fetchPlan();
    } catch (err) {
      console.error('generate-plan error:', err);
      Alert.alert('Error', 'Could not generate your plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };


  /* ── derived data ── */
  const rankedItems: RankedItem[] = (plan?.ranked_items as unknown as RankedItem[]) ?? [];
  const routineItems = rankedItems.filter((i) => routineRanks.has(i.impact_rank));

  const groupByPillar = (items: RankedItem[]) => {
    const grouped: Record<string, RankedItem[]> = {};
    items.forEach((item) => {
      if (!grouped[item.pillar]) grouped[item.pillar] = [];
      grouped[item.pillar].push(item);
    });
    // Sort by PILLAR_ORDER
    const sorted: [string, RankedItem[]][] = [];
    PILLAR_ORDER.forEach((p) => {
      if (grouped[p]) sorted.push([p, grouped[p]]);
    });
    return sorted;
  };

  const groupedTips = groupByPillar(rankedItems);
  const groupedRoutine = groupByPillar(routineItems);

  const doneCount = routineItems.filter((i) => doneToday.has(i.impact_rank)).length;
  const totalCount = routineItems.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  /* ── empty / loading states ── */
  if (loading) {
    return (
      <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle]}>
        <ScreenBackground preset="plan" />
        <PlanSkeleton />
      </Animated.View>
    );
  }

  if (!plan || rankedItems.length === 0) {
    return (
      <Animated.View style={[styles.container, styles.centered, { paddingTop: insets.top }, animatedStyle]}>
        <ScreenBackground preset="plan" />
        <View style={styles.emptyIconWrap}>
          <ClipboardIcon size={52} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>
          {plan ? 'Plan needs refresh' : 'No plan yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {plan
            ? 'Tap below to generate your recommendations'
            : 'Complete a skin scan, then generate your plan'}
        </Text>
        <TouchableOpacity
          style={[styles.generateBtn, generating && { opacity: 0.65 }]}
          onPress={generatePlan}
          disabled={generating}
        >
          <LinearGradient
            colors={[Colors.secondary, Colors.primary]}
            style={styles.generateGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.generateBtnText}>
              {generating ? 'Generating...' : plan ? 'Refresh Plan' : 'Generate My Plan'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  /* ── main UI ── */
  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top }, animatedStyle]}>
      <ScreenBackground preset="plan" />
      {/* header */}
      <View style={styles.header}>
        {acneType && (
          <Text style={styles.acneLabel}>
            {ACNE_LABELS[acneType]} {'\u00B7'} COMBINATION
          </Text>
        )}
        <Text style={styles.headerTitle}>Your plan</Text>

        {/* pill toggle */}
        <View style={styles.pillToggle}>
          <TouchableOpacity
            style={[styles.pillTab, activeTab === 'routine' && styles.pillTabActive]}
            onPress={() => setActiveTab('routine')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillTabText, activeTab === 'routine' && styles.pillTabTextActive]}>
              My Routine{routineRanks.size > 0 ? ` (${routineRanks.size})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillTab, activeTab === 'picks' && styles.pillTabActive]}
            onPress={() => setActiveTab('picks')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillTabText, activeTab === 'picks' && styles.pillTabTextActive]}>
              Tips
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── PICKS TAB ── */}
      {activeTab === 'picks' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {groupedTips
            .map(([pillar, items]) => (
            <View key={pillar} style={styles.pillarSection}>
              <View style={styles.pillarHeader}>
                <View style={styles.pillarIcon}>
                  {PILLAR_ICONS[pillar]
                    ? PILLAR_ICONS[pillar]({ size: 16, color: Colors.textMuted })
                    : <Text style={{ fontSize: 16, color: Colors.textMuted }}>{'•'}</Text>}
                </View>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[pillar] ?? pillar.toUpperCase()}</Text>
              </View>

              {items.map((item) => {
                const added = routineRanks.has(item.impact_rank);
                if (!cardScaleAnims[item.impact_rank]) cardScaleAnims[item.impact_rank] = new Animated.Value(1);
                const cardScale = cardScaleAnims[item.impact_rank];
                const tipAnim = getOrCreateTipAnim(item.impact_rank);
                return (
                  <Animated.View
                    key={item.impact_rank}
                    style={{ opacity: tipAnim.opacity, transform: [{ translateY: tipAnim.translateY }, { scale: cardScale }] }}
                  >
                    <TouchableOpacity
                      style={[styles.pickCard, added && { backgroundColor: 'rgba(124, 92, 252, 0.15)', borderColor: 'rgba(124, 92, 252, 0.45)' }]}
                      onPress={() => setSelectedPick(item)}
                      onPressIn={() => Animated.spring(cardScale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start()}
                      onPressOut={() => Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
                      activeOpacity={1}
                    >
                      <View style={styles.pickCardBody}>
                        <Text style={styles.pickTitle}>{item.title}</Text>
                        <Text style={styles.pickSubtitle} numberOfLines={1}>{item.rationale}</Text>
                      </View>
                      <View style={styles.pickCardRight}>
                        <TouchableOpacity
                          style={[styles.circleBtn, added && styles.circleBtnAdded]}
                          onPress={() => toggleItem(item)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          {added ? (
                            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                              <Path d="M2 7l3.5 3.5L12 3" stroke={Colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                          ) : (
                            <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                              <Path d="M7 2v10M2 7h10" stroke={Colors.textMuted} strokeWidth={2} strokeLinecap="round" />
                            </Svg>
                          )}
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.regenRow} onPress={generatePlan} disabled={generating}>
            <Text style={styles.regenText}>
              {generating ? 'Generating...' : '↻  Regenerate plan'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

      ) : routineItems.length === 0 ? (

        /* ── ROUTINE EMPTY ── */
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={3} width={18} height={18} rx={3} stroke={Colors.white} strokeWidth={2} fill="none" />
              <Line x1={7} y1={8}  x2={17} y2={8}  stroke={Colors.white} strokeWidth={1.8} strokeLinecap="round" />
              <Line x1={7} y1={12} x2={17} y2={12} stroke={Colors.white} strokeWidth={1.8} strokeLinecap="round" />
              <Line x1={7} y1={16} x2={17} y2={16} stroke={Colors.white} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.emptyTitle}>Nothing added yet</Text>
          <Text style={styles.emptySubtitle}>
            Go to Tips and tap + on anything you want to start doing
          </Text>
        </View>

      ) : (

        /* ── ROUTINE TAB ── */
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>

          {/* progress header */}
          <View style={styles.routineHeader}>
            <View style={styles.routineHeaderLeft}>
              <Text style={styles.routineTitle}>Today's Routine</Text>
              <Text style={styles.routineSubtitle}>{doneCount} of {totalCount} completed</Text>
            </View>
            <ProgressRing progress={progress} size={56} strokeWidth={4} />
          </View>

          {/* all done banner */}
          {doneCount === totalCount && totalCount > 0 && (
            <View style={styles.allDoneCard}>
              <View style={styles.allDoneIconWrap}>
                <StarIcon size={32} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.allDoneTitle}>All done for today!</Text>
                <Text style={styles.allDoneSubtext}>Consistency is everything — keep it up</Text>
              </View>
            </View>
          )}

          {/* grouped by pillar */}
          {groupedRoutine.map(([pillar, items]) => (
            <View key={pillar} style={styles.pillarSection}>
              <View style={styles.pillarHeader}>
                <View style={styles.pillarIcon}>
                  {PILLAR_ICONS[pillar]
                    ? PILLAR_ICONS[pillar]({ size: 16, color: Colors.textMuted })
                    : <Text style={{ fontSize: 16, color: Colors.textMuted }}>{'•'}</Text>}
                </View>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[pillar] ?? pillar.toUpperCase()}</Text>
              </View>

              {items.map((item) => {
                const done = doneToday.has(item.impact_rank);
                return (
                  <Animated.View
                    key={item.impact_rank}
                    style={{
                      opacity: shimmerAnim,
                      transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
                    }}
                  >
                    <View style={styles.routineCard}>
                      <TouchableOpacity
                        style={styles.routineCardInner}
                        onPress={() => toggleDone(item.impact_rank)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, done && styles.checkboxDone]}>
                          {done && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={[styles.routineItemTitle, done && styles.routineItemTitleDone]}>
                          {item.title}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toggleItem(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeIcon}>×</Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          ))}

        </ScrollView>
      )}

      {/* toast */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toastAnim,
            transform: [{
              translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
            }],
          },
        ]}
      >
        <Text style={styles.toastText}>Added to My Routine</Text>
      </Animated.View>

      {/* Confetti */}
      {showConfetti && (
        <View style={styles.confettiContainer} pointerEvents="none">
          {confettiAnims.map((c, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: c.x,
                top: -20,
                width: c.size,
                height: c.size * 0.6,
                backgroundColor: c.color,
                borderRadius: 2,
                transform: [
                  { translateY: c.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Dimensions.get('window').height + 50] }) },
                  { translateX: c.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, c.drift, c.drift * 1.2] }) },
                  { rotate: c.anim.interpolate({ inputRange: [0, 1], outputRange: [`${c.rotation}deg`, `${c.rotation + 720}deg`] }) },
                ],
                opacity: c.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              }}
            />
          ))}
        </View>
      )}
      {/* Pick detail modal */}
      <PickDetailModal
        visible={!!selectedPick}
        pick={selectedPick}
        onClose={() => setSelectedPick(null)}
        onToggleRoutine={toggleItem}
        isInRoutine={selectedPick ? routineRanks.has(selectedPick.impact_rank) : false}
      />
      <ParticleBurst ref={burstRef} />
      <GlowRingPulse ref={glowRef} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg, paddingBottom: 80 },

  /* ── header ── */
  header: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  acneLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: Spacing.lg,
  },

  /* ── pill toggle ── */
  pillToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 3,
  },
  pillTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
  },
  pillTabActive: {
    backgroundColor: Colors.primary,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  pillTabTextActive: {
    color: Colors.white,
  },

  /* ── list ── */
  list: { flex: 1 },
  listContent: { paddingBottom: 100 },

  /* filter chips */
  filterChipRow: { flexGrow: 0 },
  filterChipContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.white,
  },

  /* ── pillar sections ── */
  pillarSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  pillarIcon: { width: 16, height: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  pillarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  /* ── pick card ── */
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickCardBody: {
    flex: 1,
    gap: 4,
  },
  pickTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 22,
  },
  pickSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  pickCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginLeft: Spacing.md,
  },
  pickChevron: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnAdded: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  circleBtnIcon: {
    fontSize: 20,
    color: Colors.textMuted,
    lineHeight: 24,
  },
  circleBtnIconAdded: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  /* ── expanded panel ── */
  expandedPanel: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    marginTop: -Spacing.md,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  expandedRationale: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  expandedBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  expandedBtnAdded: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  expandedBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  expandedBtnTextAdded: {
    color: Colors.white,
  },

  /* ── routine header ── */
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  routineHeaderLeft: { gap: 4 },
  routineTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  routineSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  /* ── routine card — matches pickCard style ── */
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routineCardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxDone: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkmark: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '700',
  },
  routineItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  routineItemTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  removeIcon: {
    fontSize: 22,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.sm,
  },

  /* ── all done ── */
  allDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  allDoneIconWrap: { width: 32, height: 32, alignItems: 'center' as const, justifyContent: 'center' as const },
  allDoneTitle: { ...Typography.labelLarge, color: Colors.primary },
  allDoneSubtext: { ...Typography.bodySmall, color: Colors.textMuted },

  /* ── add more link ── */
  addMoreLink: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },

  /* ── regen ── */
  regenRow: { alignItems: 'center', paddingVertical: Spacing.xl },
  regenText: { ...Typography.bodySmall, color: Colors.textMuted },

  /* ── empty state ── */
  emptyIconWrap: { width: 52, height: 52, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: Spacing.sm },
  emptyTitle: { ...Typography.headlineLarge, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  /* ── generate ── */
  generateBtn: { width: '100%', borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md, marginTop: Spacing.sm },
  generateGradient: { height: 54, justifyContent: 'center', alignItems: 'center' },
  generateBtnText: { ...Typography.headlineSmall, color: Colors.white },

  /* ── toast ── */
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    ...Shadows.lg,
  },
  toastText: { ...Typography.labelMedium, color: Colors.white },

  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});
