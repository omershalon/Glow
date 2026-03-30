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
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, RankedItem, AcneType } from '@/lib/database.types';

type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];
type Tab = 'picks' | 'routine';

const PILLAR_COLORS: Record<string, string> = {
  herbal:    '#8B7355',
  diet:      '#4A7C59',
  product:   '#4A6FA5',
  lifestyle: '#A55454',
};

const PILLAR_LABELS: Record<string, string> = {
  product:   'Skincare',
  diet:      'Diet & Nutrition',
  herbal:    'Herbal & Natural',
  lifestyle: 'Lifestyle',
};

const PILLAR_ICONS: Record<string, string> = {
  product:   '🧴',
  diet:      '🥗',
  herbal:    '🌿',
  lifestyle: '🏃',
};

const ACNE_ZONE: Record<AcneType, string> = {
  hormonal:     'JAWLINE',
  cystic:       'CHEEKS',
  comedonal:    'T-ZONE',
  fungal:       'FOREHEAD',
  inflammatory: 'CHEEKS',
};

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

  const groupedRoutine = routineItems.reduce<Record<string, RankedItem[]>>((acc, item) => {
    if (!acc[item.pillar]) acc[item.pillar] = [];
    acc[item.pillar].push(item);
    return acc;
  }, {});

  const doneCount = routineItems.filter((i) => doneToday.has(i.impact_rank)).length;
  const totalCount = routineItems.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  /* ── picks row renderer ── */
  const renderPickRow = (item: RankedItem) => {
    const added = routineRanks.has(item.impact_rank);
    const expanded = expandedRank === item.impact_rank;
    const color = PILLAR_COLORS[item.pillar] ?? Colors.primary;
    return (
      <View key={item.impact_rank}>
        <TouchableOpacity
          style={[styles.row, added && styles.rowAdded]}
          onPress={() => setExpandedRank(expanded ? null : item.impact_rank)}
          activeOpacity={0.7}
        >
          {/* left badge */}
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>
              {item.pillar.charAt(0).toUpperCase() + item.pillar.slice(1)}
            </Text>
          </View>

          {/* text */}
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            {!expanded && (
              <Text style={styles.rowRationale} numberOfLines={1}>{item.rationale}</Text>
            )}
          </View>

          {/* chevron */}
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>

          {/* add / check button */}
          <TouchableOpacity
            style={[styles.addBtn, added && styles.addBtnAdded]}
            onPress={() => toggleItem(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.addIcon, added && styles.addIconAdded]}>
              {added ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* expanded panel */}
        {expanded && (
          <View style={[styles.expandedPanel, added && styles.expandedPanelAdded]}>
            <Text style={styles.expandedRationale}>{item.rationale}</Text>
            <TouchableOpacity
              style={[styles.addToRoutineBtn, added && styles.addToRoutineBtnDone]}
              onPress={() => toggleItem(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.addToRoutineBtnText, added && styles.addToRoutineBtnTextDone]}>
                {added ? '✓ Remove from Routine' : '+ Add to My Routine'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider} />
      </View>
    );
  };

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
              {generating ? 'Generating…' : plan ? 'Refresh Plan' : 'Generate My Plan'}
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
      <LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.header}>
        {acneType && (
          <Text style={styles.acneLabel}>
            {acneType.toUpperCase()} ACNE · {ACNE_ZONE[acneType]}
          </Text>
        )}
        <Text style={styles.subheader}>
          Ranked by impact — tap any item to expand or add to your routine
        </Text>

        {/* tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'picks' && styles.tabActive]}
            onPress={() => setActiveTab('picks')}
          >
            <Text style={[styles.tabText, activeTab === 'picks' && styles.tabTextActive]}>
              Picks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'routine' && styles.tabActive]}
            onPress={() => setActiveTab('routine')}
          >
            <Text style={[styles.tabText, activeTab === 'routine' && styles.tabTextActive]}>
              My Routine{routineRanks.size > 0 ? ` (${routineRanks.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── PICKS TAB ── */}
      {activeTab === 'picks' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {rankedItems.map(renderPickRow)}
          <TouchableOpacity style={styles.regenRow} onPress={generatePlan} disabled={generating}>
            <Text style={styles.regenText}>
              {generating ? 'Generating…' : '↻  Regenerate plan'}
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
          <TouchableOpacity style={styles.switchTab} onPress={() => setActiveTab('picks')}>
            <Text style={styles.switchTabText}>View Picks →</Text>
          </TouchableOpacity>
        </View>

      ) : (

        /* ── ROUTINE TAB ── */
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>

          {/* progress header */}
          <View style={styles.todayHeader}>
            <View style={styles.todayInfo}>
              <Text style={styles.todayTitle}>Today's Routine</Text>
              <Text style={styles.todaySubtitle}>{doneCount} of {totalCount} completed</Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>

          {/* progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` as any }]} />
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
          {Object.entries(groupedRoutine).map(([pillar, items]) => (
            <View key={pillar} style={styles.pillarSection}>
              <View style={styles.pillarHeader}>
                <Text style={styles.pillarIcon}>{PILLAR_ICONS[pillar] ?? '•'}</Text>
                <Text style={[styles.pillarLabel, { color: PILLAR_COLORS[pillar] }]}>
                  {PILLAR_LABELS[pillar] ?? pillar}
                </Text>
              </View>

              {items.map((item) => {
                const done = doneToday.has(item.impact_rank);
                return (
                  <TouchableOpacity
                    key={item.impact_rank}
                    style={[styles.todoRow, done && styles.todoRowDone]}
                    onPress={() => toggleDone(item.impact_rank)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      done && { borderColor: PILLAR_COLORS[item.pillar], backgroundColor: PILLAR_COLORS[item.pillar] },
                    ]}>
                      {done && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.todoBody}>
                      <Text style={[styles.todoTitle, done && styles.todoTitleDone]}>
                        {item.title}
                      </Text>
                      <Text style={styles.todoRationale} numberOfLines={2}>
                        {item.rationale}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleItem(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeIcon}>×</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.switchTab} onPress={() => setActiveTab('picks')}>
            <Text style={styles.switchTabText}>+ Add more from Picks</Text>
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
  container:  { flex: 1, backgroundColor: Colors.background },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg },

  /* header */
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: 0 },
  acneLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: Spacing.xs },
  subheader: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.lg },

  /* tabs */
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { ...Typography.labelMedium, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  /* list */
  list:        { flex: 1 },
  listContent: { paddingBottom: 100 },

  /* picks row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.white,
  },
  rowAdded: { backgroundColor: '#F2FAF5' },

  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  rowBody:      { flex: 1, gap: 3 },
  rowTitle:     { ...Typography.labelLarge, color: Colors.text, lineHeight: 20 },
  rowRationale: { ...Typography.bodySmall, color: Colors.textMuted, lineHeight: 18 },

  chevron: { fontSize: 10, color: Colors.textMuted, flexShrink: 0 },

  addBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  addBtnAdded:  { borderColor: Colors.success, backgroundColor: Colors.success },
  addIcon:      { fontSize: 16, color: Colors.textMuted, lineHeight: 20 },
  addIconAdded: { color: Colors.white, fontSize: 14 },

  /* expanded panel */
  expandedPanel: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  expandedPanelAdded: { backgroundColor: '#F2FAF5' },
  expandedRationale: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  addToRoutineBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  addToRoutineBtnDone: { borderColor: Colors.success, backgroundColor: '#F2FAF5' },
  addToRoutineBtnText: { ...Typography.labelSmall, color: Colors.primary },
  addToRoutineBtnTextDone: { color: Colors.success },

  divider: { height: 1, backgroundColor: Colors.borderLight, marginLeft: Spacing.xxl },

  /* empty */
  emptyEmoji:    { fontSize: 52 },
  emptyTitle:    { ...Typography.headlineLarge, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  /* generate */
  generateBtn: { width: '100%', borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md, marginTop: Spacing.sm },
  generateGradient: { height: 54, justifyContent: 'center', alignItems: 'center' },
  generateBtnText: { ...Typography.headlineSmall, color: Colors.white },

  /* regen row */
  regenRow: { alignItems: 'center', paddingVertical: Spacing.xl },
  regenText: { ...Typography.bodySmall, color: Colors.textMuted },

  /* switch tab link */
  switchTab: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  switchTabText: { ...Typography.labelLarge, color: Colors.primary },

  /* ── routine / todo styles ── */
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  todayInfo: { gap: 4 },
  todayTitle: { ...Typography.headlineMedium, color: Colors.text },
  todaySubtitle: { ...Typography.bodySmall, color: Colors.textMuted },

  progressCircle: {
    width: 56, height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
  },
  progressPercent: { ...Typography.labelMedium, color: Colors.primary, fontWeight: '700' },

  progressBarBg: {
    height: 4,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.xxl,
    borderRadius: 2,
    marginBottom: Spacing.lg,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  allDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
    backgroundColor: '#F2FAF5',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  allDoneEmoji:   { fontSize: 32 },
  allDoneTitle:   { ...Typography.labelLarge, color: Colors.success },
  allDoneSubtext: { ...Typography.bodySmall, color: Colors.textMuted },

  pillarSection: {
    marginHorizontal: Spacing.xxl,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pillarIcon:  { fontSize: 16 },
  pillarLabel: { ...Typography.labelMedium, fontWeight: '700', letterSpacing: 0.5 },

  todoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  todoRowDone: { opacity: 0.55 },

  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 2,
  },
  checkmark: { fontSize: 12, color: Colors.white, fontWeight: '700' },

  todoBody:      { flex: 1, gap: 3 },
  todoTitle:     { ...Typography.labelMedium, color: Colors.text, lineHeight: 20 },
  todoTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  todoRationale: { ...Typography.caption, color: Colors.textMuted, lineHeight: 18 },
  removeIcon:    { fontSize: 20, color: Colors.textMuted, lineHeight: 24, paddingHorizontal: 4 },

  /* toast */
  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill, ...Shadows.lg,
  },
  toastText: { ...Typography.labelMedium, color: Colors.white },
});
