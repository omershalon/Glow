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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, RankedItem, AcneType } from '@/lib/database.types';

type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];
type Tab = 'picks' | 'routine';

const PILLAR_ICONS: Record<string, string> = {
  product:   '🧴',
  diet:      '🥗',
  herbal:    '🌿',
  lifestyle: '🌙',
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

  const [plan,         setPlan]         = useState<PersonalizedPlan | null>(null);
  const [acneType,     setAcneType]     = useState<AcneType | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>('picks');
  const [routineRanks, setRoutineRanks] = useState<Set<number>>(new Set());
  const [routineIdMap, setRoutineIdMap] = useState<Record<number, string>>({});
  const [expandedRank, setExpandedRank] = useState<number | null>(null);
  const [doneToday,    setDoneToday]    = useState<Set<number>>(new Set());

  const toastAnim  = useRef(new Animated.Value(0)).current;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !plan) return;

    if (routineRanks.has(item.impact_rank)) {
      const id = routineIdMap[item.impact_rank];
      await supabase.from('routine_items').update({ is_active: false }).eq('id', id);
      setRoutineRanks((p) => { const s = new Set(p); s.delete(item.impact_rank); return s; });
      setRoutineIdMap((p) => { const m = { ...p }; delete m[item.impact_rank]; return m; });
      setDoneToday((p) => { const s = new Set(p); s.delete(item.impact_rank); return s; });
    } else {
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
        setRoutineRanks((p) => new Set([...p, item.impact_rank]));
        setRoutineIdMap((p) => ({ ...p, [item.impact_rank]: data.id as string }));
        showToast();
      }
    }
  };

  /* ── toggle done today ── */
  const toggleDone = (rank: number) => {
    setDoneToday((prev) => {
      const s = new Set(prev);
      if (s.has(rank)) s.delete(rank); else s.add(rank);
      return s;
    });
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
    try {
      const { error } = await supabase.functions.invoke('generate-plan', {
        body: { skin_profile_id: skinProfile.id },
      });
      if (error) throw error;
      setRoutineRanks(new Set());
      setRoutineIdMap({});
      setDoneToday(new Set());
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

  const groupedPicks = groupByPillar(rankedItems);
  const groupedRoutine = groupByPillar(routineItems);

  const doneCount = routineItems.filter((i) => doneToday.has(i.impact_rank)).length;
  const totalCount = routineItems.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  /* ── empty / loading states ── */
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!plan || rankedItems.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyEmoji}>📋</Text>
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
      </View>
    );
  }

  /* ── main UI ── */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            style={[styles.pillTab, activeTab === 'picks' && styles.pillTabActive]}
            onPress={() => setActiveTab('picks')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillTabText, activeTab === 'picks' && styles.pillTabTextActive]}>
              Picks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillTab, activeTab === 'routine' && styles.pillTabActive]}
            onPress={() => setActiveTab('routine')}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillTabText, activeTab === 'routine' && styles.pillTabTextActive]}>
              My Routine{routineRanks.size > 0 ? ` (${routineRanks.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── PICKS TAB ── */}
      {activeTab === 'picks' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {groupedPicks.map(([pillar, items]) => (
            <View key={pillar} style={styles.pillarSection}>
              <View style={styles.pillarHeader}>
                <Text style={styles.pillarIcon}>{PILLAR_ICONS[pillar] ?? '•'}</Text>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[pillar] ?? pillar.toUpperCase()}</Text>
              </View>

              {items.map((item) => {
                const added = routineRanks.has(item.impact_rank);
                return (
                  <View key={item.impact_rank}>
                    <TouchableOpacity
                      style={styles.pickCard}
                      onPress={() => setExpandedRank(expandedRank === item.impact_rank ? null : item.impact_rank)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pickCardBody}>
                        <Text style={styles.pickTitle}>{item.title}</Text>
                        <Text style={styles.pickSubtitle} numberOfLines={1}>{item.rationale}</Text>
                      </View>
                      <View style={styles.pickCardRight}>
                        <Text style={styles.pickChevron}>{'›'}</Text>
                        <TouchableOpacity
                          style={[styles.circleBtn, added && styles.circleBtnAdded]}
                          onPress={() => toggleItem(item)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.circleBtnIcon, added && styles.circleBtnIconAdded]}>
                            {added ? '✓' : '+'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {/* expanded detail */}
                    {expandedRank === item.impact_rank && (
                      <View style={styles.expandedPanel}>
                        <Text style={styles.expandedRationale}>{item.rationale}</Text>
                        <TouchableOpacity
                          style={[styles.expandedBtn, added && styles.expandedBtnAdded]}
                          onPress={() => toggleItem(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.expandedBtnText, added && styles.expandedBtnTextAdded]}>
                            {added ? '✓ Remove from Routine' : '+ Add to My Routine'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
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
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>Nothing added yet</Text>
          <Text style={styles.emptySubtitle}>
            Go to Picks and tap + on anything you want to start doing
          </Text>
          <TouchableOpacity style={styles.addMoreLink} onPress={() => setActiveTab('picks')}>
            <Text style={styles.addMoreText}>+ Add more from Picks</Text>
          </TouchableOpacity>
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
              <Text style={styles.allDoneEmoji}>🎉</Text>
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
                <Text style={styles.pillarIcon}>{PILLAR_ICONS[pillar] ?? '•'}</Text>
                <Text style={styles.pillarLabel}>{PILLAR_LABELS[pillar] ?? pillar.toUpperCase()}</Text>
              </View>

              {items.map((item) => {
                const done = doneToday.has(item.impact_rank);
                return (
                  <View key={item.impact_rank} style={styles.routineCard}>
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
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.addMoreLink} onPress={() => setActiveTab('picks')}>
            <Text style={styles.addMoreText}>+ Add more from Picks</Text>
          </TouchableOpacity>
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
        <Text style={styles.toastText}>Added to My Routine ✓</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg },

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
  pillarIcon: { fontSize: 16 },
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
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    color: Colors.borderLight,
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
    backgroundColor: Colors.white,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    marginTop: -Spacing.md,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: Colors.borderLight,
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

  /* ── routine card ── */
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    backgroundColor: '#F2FAF5',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  allDoneEmoji: { fontSize: 32 },
  allDoneTitle: { ...Typography.labelLarge, color: Colors.success },
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
  emptyEmoji: { fontSize: 52 },
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
});
