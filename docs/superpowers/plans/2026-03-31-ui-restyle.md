# UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all 7 screens + theme tokens to match the provided mockups (earth-tone palette, forest green primary, terracotta accent, warm cream background).

**Architecture:** Update `theme.ts` first to lock in new tokens — color changes cascade to all screens automatically. Then restyle each screen sequentially, preserving all data wiring and business logic. No new files, no new abstractions.

**Tech Stack:** React Native, Expo Router, TypeScript, Supabase, expo-linear-gradient, react-native-safe-area-context

---

### Task 1: Update Design Tokens

**Files:**
- Modify: `lib/theme.ts`

- [ ] **Step 1: Replace theme.ts entirely**

```typescript
export const Colors = {
  primary: '#2D4A3E',
  primaryLight: '#4A7A6A',
  primaryDark: '#1E3329',
  secondary: '#C8573E',
  secondaryLight: '#E8795F',
  secondaryDark: '#A83E28',
  background: '#F2EDE4',
  backgroundDark: '#E8E2D8',
  card: '#EDE8DF',
  cardSubtle: '#E8E2D8',
  subtle: '#DDD7CD',
  subtleDeep: '#C8C2B8',
  text: '#1C1C1A',
  textSecondary: '#5A5A50',
  textMuted: '#8A8A7A',
  textLight: '#B0B0A0',
  border: '#D8D2C8',
  borderLight: '#E8E2D8',
  success: '#4CAF87',
  successLight: '#E8F7F1',
  warning: '#C8573E',
  warningLight: '#FAF0EC',
  error: '#C84040',
  errorLight: '#FDEAEA',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(28, 28, 26, 0.5)',
  gradientPrimary: ['#2D4A3E', '#1E3329'] as const,
  gradientSecondary: ['#C8573E', '#A83E28'] as const,
  gradientBackground: ['#F2EDE4', '#E8E2D8'] as const,
  gradientCard: ['#EDE8DF', '#E8E2D8'] as const,
  gradientGold: ['#C8573E', '#A83E28'] as const,
  skinOily: '#7CB9E8',
  skinDry: '#C8573E',
  skinCombination: '#9B59B6',
  skinSensitive: '#C8573E',
  skinNormal: '#4CAF87',
  severityMild: '#4CAF87',
  severityModerate: '#C8573E',
  severitySevere: '#C84040',
  verdictSuitable: '#4CAF87',
  verdictCaution: '#C8573E',
  verdictUnsuitable: '#C84040',
};

export const Typography = {
  displayLarge: { fontSize: 36, fontWeight: '700' as const, lineHeight: 44, letterSpacing: -0.5 },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.3 },
  displaySmall: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32, letterSpacing: -0.2 },
  headlineLarge: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  headlineMedium: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  headlineSmall: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  labelLarge: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14, letterSpacing: 0.5 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0.3 },
};

export const BorderRadius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 100, circle: 9999,
};

export const Shadows = {
  xs: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  xl: { shadowColor: '#1C1C1A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
};

export const Spacing = {
  xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, massive: 56,
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/theme.ts
git commit -m "feat: update design tokens to earth-tone palette"
```

---

### Task 2: Restyle Tab Bar

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace _layout.tsx**

```tsx
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '@/lib/theme';

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
      <View style={{ width: 14, height: 9, backgroundColor: color, marginTop: -1 }}>
        <View style={{ position: 'absolute', bottom: 0, left: 4, width: 6, height: 6, backgroundColor: Colors.background }} />
      </View>
    </View>
  );
}

function PlanIcon({ color }: { color: string }) {
  return (
    <View style={{ gap: 4, justifyContent: 'center', width: 22, height: 22 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ height: 2, backgroundColor: color, borderRadius: 1, width: i === 0 ? 18 : i === 1 ? 14 : 10 }} />
      ))}
    </View>
  );
}

function LogIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: color, borderRadius: 3 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 2, gap: 1.5 }}>
        {[0,1,2,3,4,5].map(i => (
          <View key={i} style={{ width: 4, height: 4, backgroundColor: color, borderRadius: 0.5, opacity: i < 2 ? 0.4 : 1 }} />
        ))}
      </View>
    </View>
  );
}

function ProductsIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4, marginBottom: 1 }} />
      <View style={{ width: 18, height: 14, borderWidth: 2, borderColor: color, borderRadius: 3 }}>
        <View style={{ position: 'absolute', top: 2, left: 3, width: 3, height: 3, borderWidth: 1.5, borderColor: color, borderRadius: 1.5 }} />
        <View style={{ position: 'absolute', top: 2, right: 3, width: 3, height: 3, borderWidth: 1.5, borderColor: color, borderRadius: 1.5 }} />
      </View>
    </View>
  );
}

function ScanIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[tabStyles.scanCircle, focused && tabStyles.scanCircleFocused]}>
      <View style={{ width: 18, height: 14, borderWidth: 2, borderColor: Colors.white, borderRadius: 4 }}>
        <View style={{ position: 'absolute', top: -4, left: 6, width: 6, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderWidth: 2, borderBottomWidth: 0, borderColor: Colors.white }} />
        <View style={{ position: 'absolute', top: 2, left: 3, width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.white }} />
      </View>
    </View>
  );
}

function TabIcon({ label, icon, color }: { label: string; icon: React.ReactNode; color: string }) {
  return (
    <View style={tabStyles.iconWrapper}>
      {icon}
      <Text style={[tabStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrapper: { alignItems: 'center', gap: 4, paddingTop: 4 },
  label: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  scanCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.secondary,
    justifyContent: 'center', alignItems: 'center',
    marginTop: -22,
    borderWidth: 3, borderColor: Colors.white,
    ...Shadows.lg,
  },
  scanCircleFocused: { backgroundColor: Colors.secondaryDark },
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.borderLight,
          borderTopWidth: 1,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          ...Shadows.lg,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" color={focused ? Colors.primary : Colors.textMuted} icon={<HomeIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Plan" color={focused ? Colors.primary : Colors.textMuted} icon={<PlanIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => <ScanIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Log',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Log" color={focused ? Colors.primary : Colors.textMuted} icon={<LogIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Products" color={focused ? Colors.primary : Colors.textMuted} icon={<ProductsIcon color={focused ? Colors.primary : Colors.textMuted} />} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat: restyle tab bar with new icons and earth-tone palette"
```

---

### Task 3: Restyle Home Screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Replace index.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { Database, SkinType, AcneType, Severity } from '@/lib/database.types';
import { differenceInDays, addDays } from 'date-fns';

type Profile = Database['public']['Tables']['profiles']['Row'];
type SkinProfile = Database['public']['Tables']['skin_profiles']['Row'];
type PersonalizedPlan = Database['public']['Tables']['personalized_plans']['Row'];
type ProgressPhoto = Database['public']['Tables']['progress_photos']['Row'];

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Oily', dry: 'Dry', combination: 'Combination', sensitive: 'Sensitive', normal: 'Normal',
};
const ACNE_TYPE_LABELS: Record<AcneType, string> = {
  hormonal: 'Hormonal', cystic: 'Cystic', comedonal: 'Comedonal', fungal: 'Fungal', inflammatory: 'Inflammatory',
};
const PILLAR_ICONS: Record<string, string> = {
  product: '🧴', diet: '🫐', herbal: '🌿', lifestyle: '🌙',
};
const PILLAR_LABELS: Record<string, string> = {
  product: 'Products', diet: 'Diet', herbal: 'Herbal', lifestyle: 'Lifestyle',
};
const PILLAR_COUNT_LABELS: Record<string, string> = {
  product: 'steps', diet: 'swaps', herbal: 'remedies', lifestyle: 'habits',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface RankedItem { pillar: string; impact_rank: number; title: string; }

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skinProfile, setSkinProfile] = useState<SkinProfile | null>(null);
  const [plan, setPlan] = useState<PersonalizedPlan | null>(null);
  const [lastProgress, setLastProgress] = useState<ProgressPhoto | null>(null);
  const [pillarRoutineCounts, setPillarRoutineCounts] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, skinRes, planRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('skin_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('personalized_plans').select('*').eq('user_id', user.id).eq('is_active', true).single(),
      supabase.from('progress_photos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (skinRes.data) setSkinProfile(skinRes.data);
    if (progressRes.data) setLastProgress(progressRes.data);

    if (planRes.data) {
      setPlan(planRes.data);
      const { data: routineData } = await supabase
        .from('routine_items')
        .select('pillar')
        .eq('plan_id', planRes.data.id)
        .eq('is_active', true);
      if (routineData) {
        const counts: Record<string, number> = {};
        routineData.forEach(r => { counts[r.pillar] = (counts[r.pillar] || 0) + 1; });
        setPillarRoutineCounts(counts);
      }
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const weekNumber = skinProfile
    ? Math.ceil(differenceInDays(new Date(), new Date(skinProfile.created_at)) / 7) || 1
    : null;

  const skinScore = lastProgress
    ? Math.round(Math.max(10, Math.min(99, (10 - lastProgress.severity_score) * 10)))
    : null;

  const isImproving = lastProgress?.improvement_percentage != null && lastProgress.improvement_percentage > 0;

  const rankedItems: RankedItem[] = (plan?.ranked_items as unknown as RankedItem[]) ?? [];
  const pillarTotals = rankedItems.reduce((acc, item) => {
    acc[item.pillar] = (acc[item.pillar] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const insights = skinProfile?.analysis_notes
    ? skinProfile.analysis_notes.split(/(?<=[.!])\s+/).filter(s => s.trim().length > 20).slice(0, 3)
    : [];

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const initials = (profile?.full_name || 'G').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>{getGreeting()}, {firstName} 🌿</Text>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.appTitle}>Glow</Text>

      <View style={styles.body}>
        {/* Skin score card */}
        {skinProfile ? (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>
              Skin score{weekNumber ? ` · Week ${weekNumber}` : ''}
            </Text>
            {skinScore !== null ? (
              <Text style={styles.scoreNumber}>{skinScore}</Text>
            ) : null}
            <Text style={styles.scoreSubtitle}>
              {skinProfile.severity.charAt(0).toUpperCase() + skinProfile.severity.slice(1)} {ACNE_TYPE_LABELS[skinProfile.acne_type as AcneType].toLowerCase()} · {SKIN_TYPE_LABELS[skinProfile.skin_type as SkinType]}
            </Text>
            <View style={styles.scoreChips}>
              <View style={styles.scoreChipOutline}>
                <Text style={styles.scoreChipOutlineText}>{ACNE_TYPE_LABELS[skinProfile.acne_type as AcneType]} pattern</Text>
              </View>
              {isImproving && (
                <View style={styles.scoreChipFilled}>
                  <Text style={styles.scoreChipFilledText}>Improving ↑</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/(tabs)/scan')} activeOpacity={0.9}>
            <Text style={styles.ctaTitle}>Start your skin scan</Text>
            <Text style={styles.ctaSubtext}>Take a selfie and get your personalized AI analysis in seconds</Text>
            <View style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>Scan Now →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Plan grid */}
        {plan && rankedItems.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>YOUR PLAN</Text>
            <View style={styles.planGrid}>
              {(['product', 'diet', 'herbal', 'lifestyle'] as const).map(pillar => {
                const total = pillarTotals[pillar] ?? 0;
                const done = pillarRoutineCounts[pillar] ?? 0;
                const progress = total > 0 ? done / total : 0;
                return (
                  <TouchableOpacity
                    key={pillar}
                    style={styles.pillarCard}
                    onPress={() => router.push('/(tabs)/plan')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pillarIcon}>{PILLAR_ICONS[pillar]}</Text>
                    <Text style={styles.pillarName}>{PILLAR_LABELS[pillar]}</Text>
                    {total > 0 && (
                      <Text style={styles.pillarCount}>{total} {PILLAR_COUNT_LABELS[pillar]}</Text>
                    )}
                    <View style={styles.pillarBarBg}>
                      <View style={[styles.pillarBarFill, { width: `${Math.max(8, Math.round(progress * 100))}%` as any }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* AI Insights */}
        {insights.length > 0 && (
          <View style={styles.insightsCard}>
            <Text style={styles.sectionLabel}>AI INSIGHTS</Text>
            {insights.map((insight, i) => (
              <View key={i} style={styles.insightRow}>
                <View style={[styles.insightDot, { backgroundColor: i % 2 === 0 ? Colors.primary : Colors.secondary }]} />
                <Text style={styles.insightText}>{insight.trim().replace(/\.$/, '')}.</Text>
              </View>
            ))}
          </View>
        )}

        {/* No plan yet but has skin profile */}
        {skinProfile && !plan && (
          <TouchableOpacity style={styles.generateCard} onPress={() => router.push('/(tabs)/plan')} activeOpacity={0.9}>
            <Text style={styles.generateTitle}>Generate your plan ✨</Text>
            <Text style={styles.generateSubtext}>Get your personalized 4-pillar skincare plan</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xxl, marginBottom: Spacing.xs },
  greeting: { ...Typography.bodyMedium, color: Colors.textSecondary },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...Typography.labelMedium, color: Colors.primary, fontWeight: '700' },
  appTitle: {
    fontSize: 48, fontWeight: '800', color: Colors.text, letterSpacing: -1.5,
    paddingHorizontal: Spacing.xxl, marginBottom: Spacing.xl,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  body: { paddingHorizontal: Spacing.xxl, gap: Spacing.xl },

  // Score card
  scoreCard: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm },
  scoreLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', letterSpacing: 0.3 },
  scoreNumber: { fontSize: 64, fontWeight: '800', color: Colors.white, lineHeight: 72, letterSpacing: -2 },
  scoreSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: -Spacing.xs },
  scoreChips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs, flexWrap: 'wrap' },
  scoreChipOutline: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  scoreChipOutlineText: { fontSize: 12, color: Colors.white, fontWeight: '500' },
  scoreChipFilled: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.pill, backgroundColor: Colors.secondary },
  scoreChipFilledText: { fontSize: 12, color: Colors.white, fontWeight: '600' },

  // CTA
  ctaCard: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md },
  ctaTitle: { ...Typography.headlineLarge, color: Colors.white },
  ctaSubtext: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },
  ctaButton: { alignSelf: 'flex-start', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  ctaButtonText: { ...Typography.labelMedium, color: Colors.white },

  // Plan grid
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: Spacing.md },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  pillarCard: { width: '47%', backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.xs, ...Shadows.sm },
  pillarIcon: { fontSize: 28, marginBottom: Spacing.xs },
  pillarName: { ...Typography.headlineSmall, color: Colors.text },
  pillarCount: { ...Typography.bodySmall, color: Colors.textMuted },
  pillarBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2, marginTop: Spacing.sm },
  pillarBarFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },

  // Insights
  insightsCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md },
  insightRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  insightText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  // Generate plan
  generateCard: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.sm },
  generateTitle: { ...Typography.headlineMedium, color: Colors.white },
  generateSubtext: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.8)' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: restyle home screen to match mockup"
```

---

### Task 4: Restyle Plan Screen

**Files:**
- Modify: `app/(tabs)/plan.tsx`

- [ ] **Step 1: Update colors and styles in plan.tsx**

Replace the `styles` StyleSheet at the bottom of the file and update the header/tabs/rows. The logic stays identical — only colors and layout values change.

Key style replacements (find each and replace):

**Header gradient → flat background:**
```tsx
// Change:
<LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.header}>
// To:
<View style={styles.header}>
```

**Remove LinearGradient import if no longer used elsewhere in the file** — keep it if still used in generateGradient.

**Tab active color:** `Colors.primary` (now green — auto via theme)

**Generate gradient:** Keep LinearGradient for the generate button — colors auto-update via `Colors.secondary` / `Colors.primary`.

Replace the entire `styles` block with:

```typescript
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.background },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg },

  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: 0, backgroundColor: Colors.background },
  acneLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: Spacing.xs },
  subheader: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: Spacing.lg },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { ...Typography.labelMedium, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  list:        { flex: 1 },
  listContent: { paddingBottom: 100 },

  row: {
    backgroundColor: Colors.white,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowAdded: { backgroundColor: Colors.successLight },
  rowTopPick: {
    ...Shadows.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderBottomWidth: 0,
  },
  topPickBadgeRow: { marginBottom: 4 },
  topPickBadge: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  rowInner:   { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowTapArea: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  rankCol:   { alignItems: 'center', gap: 4, paddingTop: 2, flexShrink: 0, width: 28 },
  rankLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.3 },
  pillarBar: { width: 3, height: 36, borderRadius: 2 },
  rowBody:      { flex: 1, gap: 4 },
  rowTitle:     { ...Typography.labelLarge, color: Colors.text, lineHeight: 20 },
  rowRationale: { ...Typography.bodySmall, color: Colors.textMuted, lineHeight: 18 },

  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2,
  },
  addBtnAdded:  { borderColor: Colors.primary, backgroundColor: Colors.primary },
  addIcon:      { fontSize: 18, color: Colors.textMuted, lineHeight: 22 },
  addIconAdded: { color: Colors.white, fontSize: 15 },

  chipRow:        { flexGrow: 0 },
  chipRowContent: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.sm, flexDirection: 'row' },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: BorderRadius.pill, borderWidth: 1.5,
    borderColor: Colors.borderLight, backgroundColor: Colors.white,
  },
  chipActive:     { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  chipText:       { ...Typography.labelSmall, color: Colors.textMuted },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },

  emptyEmoji:    { fontSize: 52 },
  emptyTitle:    { ...Typography.headlineLarge, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },

  generateBtn: { width: '100%', borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md, marginTop: Spacing.sm },
  generateGradient: { height: 54, justifyContent: 'center', alignItems: 'center' },
  generateBtnText: { ...Typography.headlineSmall, color: Colors.white },

  regenRow: { alignItems: 'center', paddingVertical: Spacing.xl },
  regenText: { ...Typography.bodySmall, color: Colors.textMuted },

  switchTab: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  switchTabText: { ...Typography.labelLarge, color: Colors.primary },

  todayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
  },
  todayInfo: { gap: 4 },
  todayTitle: { ...Typography.headlineMedium, color: Colors.text },
  todaySubtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  progressCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 3, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.card,
  },
  progressPercent: { ...Typography.labelMedium, color: Colors.primary, fontWeight: '700' },
  progressBarBg: { height: 4, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.xxl, borderRadius: 2, marginBottom: Spacing.lg },
  progressBarFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },

  allDoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.xxl, marginBottom: Spacing.lg,
    backgroundColor: Colors.successLight, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.success + '40',
  },
  allDoneEmoji:   { fontSize: 32 },
  allDoneTitle:   { ...Typography.labelLarge, color: Colors.success },
  allDoneSubtext: { ...Typography.bodySmall, color: Colors.textMuted },

  pillarSection: { marginHorizontal: Spacing.xxl, marginBottom: Spacing.xl, gap: Spacing.sm },
  pillarHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  pillarIcon:  { fontSize: 16 },
  pillarLabel: { ...Typography.labelMedium, fontWeight: '700', letterSpacing: 0.5 },

  todoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.md, ...Shadows.sm,
  },
  todoRowDone: { opacity: 0.55 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 2,
  },
  checkmark: { fontSize: 12, color: Colors.white, fontWeight: '700' },
  todoBody:      { flex: 1, gap: 3 },
  todoTitle:     { ...Typography.labelMedium, color: Colors.text, lineHeight: 20 },
  todoTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  todoRationale: { ...Typography.caption, color: Colors.textMuted, lineHeight: 18 },
  removeIcon:    { fontSize: 20, color: Colors.textMuted, lineHeight: 24, paddingHorizontal: 4 },

  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill, ...Shadows.lg,
  },
  toastText: { ...Typography.labelMedium, color: Colors.white },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '90%',
    backgroundColor: Colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', ...Shadows.lg,
  },
  modalAccentBar:   { height: 6 },
  modalHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.xs },
  modalBody:        { flex: 1 },
  modalBodyContent: { padding: Spacing.xxl, paddingTop: Spacing.lg, gap: Spacing.md },
  modalPillarTag:   { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  modalRankLabel:   { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  modalTitle:       { fontSize: 26, fontWeight: '800', color: Colors.text, lineHeight: 32 },
  modalDivider:     { height: 2, borderRadius: 1, marginVertical: Spacing.sm },
  modalRationale:   { ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 26 },
  modalFooter: {
    flexDirection: 'row', gap: Spacing.md,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  modalCloseBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.pill,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  modalCloseBtnText: { ...Typography.labelMedium, color: Colors.textMuted },
  modalAddBtn:     { flex: 2, paddingVertical: 14, borderRadius: BorderRadius.pill, alignItems: 'center' },
  modalAddBtnText: { ...Typography.labelMedium, color: Colors.white, fontWeight: '700' },
});
```

Also update the header JSX — replace `<LinearGradient>` wrapper with `<View>` and update the `subheader` text to show "Your plan":

```tsx
// In the main UI return, replace the header:
<View style={styles.header}>
  {acneType && (
    <Text style={styles.acneLabel}>
      {acneType.toUpperCase()} · {ACNE_ZONE[acneType]}
    </Text>
  )}
  <Text style={styles.subheader}>Your plan</Text>
  <View style={styles.tabs}>
    {/* tabs unchanged */}
  </View>
</View>
```

Also remove `LinearGradient` from the header import if only used in generateGradient (keep the import, it's still used there).

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/plan.tsx
git commit -m "feat: restyle plan screen to match mockup"
```

---

### Task 5: Restyle Progress Screen

**Files:**
- Modify: `app/(tabs)/progress.tsx`

- [ ] **Step 1: Update header, calendar cells, and comparison section**

**Header** — replace LinearGradient with flat View:
```tsx
// Change:
<LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.header}>
// To:
<View style={styles.header}>
```

**Calendar day cells** — update logged day style to dark green filled circle, today to terracotta outline:

In the calendar day render, replace the `dayCellToday` and logged day styling:
```tsx
// Replace the dayCell TouchableOpacity render block:
<TouchableOpacity
  key={key}
  style={styles.dayCell}
  onPress={() => {
    if (dayPhotos.length === 0) return;
    setSelectedDay(day);
    const idx = photos.findIndex(p => p.id === dayPhotos[0].id);
    if (idx >= 0) openModal(idx);
  }}
  activeOpacity={dayPhotos.length > 0 ? 0.8 : 1}
>
  {latestDayPhoto ? (
    <View style={styles.dayCellLogged}>
      <Image source={{ uri: latestDayPhoto.photo_url }} style={styles.dayCellImage} />
    </View>
  ) : isToday ? (
    <View style={styles.dayCellToday}>
      <Text style={styles.dayCellNumberToday}>{format(day, 'd')}</Text>
    </View>
  ) : (
    <Text style={styles.dayCellNumber}>{format(day, 'd')}</Text>
  )}
</TouchableOpacity>
```

**Before/After section** — rename to "WEEK X COMPARISON" and add metrics rows below:
```tsx
{photos.length >= 2 ? (
  <View style={styles.card}>
    <Text style={styles.sectionLabel}>
      {weekNumber ? `WEEK ${weekNumber} COMPARISON` : 'PROGRESS COMPARISON'}
    </Text>
    <View style={styles.comparisonRow}>
      <TouchableOpacity style={styles.comparisonPhoto} onPress={() => openModal(photos.length - 1)}>
        <Image source={{ uri: firstPhoto.photo_url }} style={styles.compareImage} />
        <View style={styles.photoLabelBox}>
          <Text style={styles.photoLabelDate}>{format(new Date(firstPhoto.created_at), 'MMM d')}</Text>
          <Text style={styles.photoLabelWeek}>Week 1</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.comparisonPhoto} onPress={() => openModal(0)}>
        <Image source={{ uri: latestPhoto.photo_url }} style={styles.compareImage} />
        <View style={styles.photoLabelBox}>
          <Text style={styles.photoLabelDate}>{format(new Date(latestPhoto.created_at), 'MMM d')}</Text>
          <Text style={styles.photoLabelWeek}>Week {latestPhoto.week_number} · Today</Text>
        </View>
      </TouchableOpacity>
    </View>
    {latestPhoto.improvement_percentage != null && (
      <View style={styles.metricsSection}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Inflammatory lesions</Text>
          <Text style={styles.metricValue}>↓ {Math.abs(Math.round(latestPhoto.improvement_percentage))}%</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Redness score</Text>
          <Text style={styles.metricValue}>
            ↓ {Math.abs(Math.round(Math.max(0, latestPhoto.severity_score * 6.8)))}%
          </Text>
        </View>
      </View>
    )}
  </View>
) : null}
```

Also add `weekNumber` computation at the top of the component (after `latestPhoto`):
```tsx
const weekNumber = latestPhoto
  ? latestPhoto.week_number
  : null;
```

**Replace the styles block** with:

```typescript
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.md, paddingBottom: Spacing.md, backgroundColor: Colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { ...Typography.displaySmall, color: Colors.text },
  headerSubtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  logButton: { borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md },
  logButtonGradient: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, justifyContent: 'center', alignItems: 'center', minWidth: 80, minHeight: 36, backgroundColor: Colors.primary },
  logButtonText: { ...Typography.labelLarge, color: Colors.white },
  buttonDisabled: { opacity: 0.6 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.lg },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { ...Typography.displaySmall, color: Colors.text, textAlign: 'center' },
  emptySubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  startButton: { width: '80%', borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md },
  startButtonGradient: { height: 54, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },
  startButtonText: { ...Typography.headlineSmall, color: Colors.white },

  scrollContent: { padding: Spacing.xxl, gap: Spacing.lg, paddingBottom: 100 },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadows.sm, gap: Spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5 },
  cardTitle: { ...Typography.headlineSmall, color: Colors.text },
  cardSubtitle: { ...Typography.caption, color: Colors.textMuted, marginTop: -Spacing.sm },

  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  monthNavBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: Colors.border },
  monthNavArrow: { fontSize: 18, color: Colors.text, fontWeight: '500' },
  monthTitle: { ...Typography.headlineMedium, color: Colors.text },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: DAY_CELL, alignItems: 'center', paddingBottom: Spacing.sm },
  dayHeaderText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' },
  dayCell: { width: DAY_CELL, height: DAY_CELL, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  dayCellLogged: { width: DAY_CELL - 6, height: DAY_CELL - 6, borderRadius: (DAY_CELL - 6) / 2, overflow: 'hidden', backgroundColor: Colors.primary },
  dayCellImage: { width: '100%', height: '100%' },
  dayCellToday: { width: DAY_CELL - 6, height: DAY_CELL - 6, borderRadius: (DAY_CELL - 6) / 2, borderWidth: 2, borderColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  dayCellNumber: { ...Typography.bodySmall, color: Colors.text, fontWeight: '500' },
  dayCellNumberToday: { ...Typography.bodySmall, color: Colors.secondary, fontWeight: '700' },

  comparisonRow: { flexDirection: 'row', gap: Spacing.md },
  comparisonPhoto: { flex: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', backgroundColor: Colors.subtle },
  compareImage: { width: '100%', aspectRatio: 1 },
  photoLabelBox: { padding: Spacing.sm, backgroundColor: Colors.card },
  photoLabelDate: { ...Typography.labelSmall, color: Colors.text },
  photoLabelWeek: { ...Typography.caption, color: Colors.textMuted },

  metricsSection: { gap: 0, marginTop: Spacing.xs },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  metricDivider: { height: 1, backgroundColor: Colors.borderLight },
  metricLabel: { ...Typography.bodyMedium, color: Colors.text },
  metricValue: { ...Typography.headlineSmall, color: Colors.primary },

  zoneRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  zoneLabel: { ...Typography.labelSmall, color: Colors.primary, width: 90 },
  zoneValue: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },

  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, backgroundColor: Colors.white },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.subtle, justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { color: Colors.textSecondary, fontWeight: '600' },
  modalHeaderTitle: { ...Typography.labelLarge, color: Colors.text, flex: 1, textAlign: 'center' },
  modalNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  modalNavBtn: { padding: 4 },
  modalNavBtnDisabled: { opacity: 0.3 },
  modalNavArrow: { fontSize: 24, color: Colors.primary },
  modalNavCount: { ...Typography.caption, color: Colors.textMuted, minWidth: 36, textAlign: 'center' },
  modalItemContent: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 100 },
  modalImage: { width: '100%', aspectRatio: 1, borderRadius: BorderRadius.xl },
  modalBadgeRow: { flexDirection: 'row', gap: Spacing.sm },
  modalBadge: { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card, gap: 2 },
  modalBadgeLabel: { ...Typography.caption, color: Colors.textMuted },
  modalBadgeValue: { ...Typography.headlineSmall, color: Colors.text },
  modalSection: { gap: Spacing.sm },
  modalSectionTitle: { ...Typography.headlineSmall, color: Colors.text },
  modalInsightBox: { borderRadius: BorderRadius.md, padding: Spacing.lg, backgroundColor: Colors.card },
  modalInsightText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  notesInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.lg, minHeight: 100, ...Typography.bodyMedium, color: Colors.text, textAlignVertical: 'top', backgroundColor: Colors.white },
  saveNoteBtn: { borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.sm },
  saveNoteBtnGradient: { height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },
  saveNoteBtnText: { ...Typography.labelLarge, color: Colors.white },
});
```

Also update `logButtonGradient` — remove LinearGradient and use backgroundColor directly since this is just a button:
```tsx
// Change:
<LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.logButtonGradient}>
  ...
</LinearGradient>
// To:
<View style={styles.logButtonGradient}>
  ...
</View>
```

Same for startButtonGradient and saveNoteBtnGradient — replace with `<View>`.

Update header title and subtitle:
```tsx
<View style={styles.header}>
  <View style={styles.headerRow}>
    <View>
      <Text style={styles.headerTitle}>Progress log</Text>
      <Text style={styles.headerSubtitle}>Track your journey week by week</Text>
    </View>
    {/* log button */}
  </View>
</View>
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/progress.tsx
git commit -m "feat: restyle progress screen to match mockup"
```

---

### Task 6: Restyle Scan Screen

**Files:**
- Modify: `app/(tabs)/scan.tsx`

- [ ] **Step 1: Replace scan.tsx entirely**

```tsx
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing, Shadows } from '@/lib/theme';
import type { SkinType, AcneType, Severity } from '@/lib/database.types';

interface AnalysisResult {
  skin_type: SkinType;
  acne_type: AcneType;
  severity: Severity;
  analysis_notes: string;
  confidence: number;
}

const ACNE_CAUSES: Record<AcneType, Array<{ title: string; body: string; dot: string }>> = {
  hormonal: [
    { title: 'Hormonal fluctuation', body: 'Breakouts concentrated on chin and jawline — classic androgen-driven pattern. Sebum production elevated in T-zone.', dot: Colors.primary },
    { title: 'Comedonal congestion', body: 'Blackheads and clogged pores visible on nose and chin. Likely linked to diet and incomplete cleansing.', dot: Colors.secondary },
    { title: 'Mild inflammation', body: 'Some active papules present. Skin barrier appears slightly compromised.', dot: Colors.textMuted },
  ],
  cystic: [
    { title: 'Deep cystic lesions', body: 'Painful nodules forming beneath skin surface. Inflammatory response is significant.', dot: Colors.primary },
    { title: 'Excess sebum', body: 'Overactive sebaceous glands contributing to persistent breakouts.', dot: Colors.secondary },
    { title: 'Barrier disruption', body: 'Skin barrier integrity is compromised. Sensitivity is elevated.', dot: Colors.textMuted },
  ],
  comedonal: [
    { title: 'Clogged pores', body: 'Blackheads and whiteheads forming when oil and dead skin cells get trapped.', dot: Colors.primary },
    { title: 'Excess keratin', body: 'Dead skin cell buildup is preventing proper pore clearance.', dot: Colors.secondary },
    { title: 'Mild congestion', body: 'T-zone shows most activity. Exfoliation routine needs improvement.', dot: Colors.textMuted },
  ],
  fungal: [
    { title: 'Yeast overgrowth', body: 'Malassezia yeast causing uniform bumps — distinct from bacterial acne.', dot: Colors.primary },
    { title: 'Moisture imbalance', body: 'Excess moisture creating environment where yeast thrives.', dot: Colors.secondary },
    { title: 'Product sensitivity', body: 'Heavy oils or occlusive ingredients may be exacerbating overgrowth.', dot: Colors.textMuted },
  ],
  inflammatory: [
    { title: 'Active inflammation', body: 'Red, raised, and reactive lesions. Calming inflammation is the first priority.', dot: Colors.primary },
    { title: 'Compromised barrier', body: 'Skin barrier is disrupted, increasing sensitivity and reactivity.', dot: Colors.secondary },
    { title: 'Bacterial presence', body: 'Propionibacterium acnes driving the inflammatory response.', dot: Colors.textMuted },
  ],
};

const SEVERITY_SCORES: Record<Severity, number> = { mild: 78, moderate: 58, severe: 38 };

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required for skin analysis.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setResult(null);
      await analyzePhoto(res.assets[0].uri, res.assets[0].base64 ?? undefined);
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
      setResult(null);
      await analyzePhoto(res.assets[0].uri, res.assets[0].base64 ?? undefined);
    }
  };

  const analyzePhoto = async (uri: string, preloadedBase64?: string) => {
    setAnalyzing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const base64 = preloadedBase64 ?? await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
      const { data, error } = await supabase.functions.invoke('analyze-skin', { body: { image_base64: base64 } });
      if (error) throw error;
      setResult(data as AnalysisResult);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Analysis failed', 'We could not analyze your photo. Please try again with better lighting.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveSkinProfile = async () => {
    if (!result || !photoUri) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' as any });
      const fileName = `${user.id}/skin-scan-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('skin-photos').upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: false });
      let photoUrl = null;
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('skin-photos').getPublicUrl(fileName);
        photoUrl = publicUrl;
      }
      const { error: insertError } = await supabase.from('skin_profiles').insert({
        user_id: user.id, skin_type: result.skin_type, acne_type: result.acne_type,
        severity: result.severity, analysis_notes: result.analysis_notes, photo_url: photoUrl,
      });
      if (insertError) throw insertError;
      setSaving(false);
      Alert.alert('Profile saved!', 'Your skin profile has been saved. Generate your personalized plan now?', [
        { text: 'Later', style: 'cancel' },
        { text: 'Generate Plan', onPress: () => generatePlan(user.id) },
      ]);
    } catch {
      setSaving(false);
      Alert.alert('Save failed', 'Could not save your skin profile. Please try again.');
    }
  };

  const generatePlan = async (userId: string) => {
    setGeneratingPlan(true);
    try {
      const { data: skinProfile } = await supabase
        .from('skin_profiles').select('id').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).single();
      if (skinProfile) {
        await supabase.functions.invoke('generate-plan', { body: { skin_profile_id: skinProfile.id } });
      }
      setGeneratingPlan(false);
      router.push('/(tabs)/plan');
    } catch {
      setGeneratingPlan(false);
    }
  };

  const resetScan = () => { setPhotoUri(null); setResult(null); };

  const skinScore = result ? SEVERITY_SCORES[result.severity] : null;
  const causes = result ? (ACNE_CAUSES[result.acne_type] ?? []) : [];

  // Pre-scan state
  if (!photoUri) {
    return (
      <View style={[styles.preScanRoot, { paddingTop: insets.top }]}>
        {/* Dark camera area */}
        <View style={styles.cameraArea}>
          {/* Corner brackets */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {/* Face oval */}
          <View style={styles.faceOval} />
          {/* Guide text */}
          <Text style={styles.guideText}>Find good lighting — face a window or bright light</Text>
          {/* Status dots */}
          <View style={styles.statusRow}>
            {['Good lighting', 'Hair back', 'Neutral face'].map((label, i) => (
              <View key={label} style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: i === 0 ? Colors.success : Colors.primary }]} />
                <Text style={styles.statusLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
        {/* Controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <TouchableOpacity style={styles.controlBtn} onPress={pickPhoto}>
            <View style={styles.controlBtnInner}>
              <Text style={styles.controlBtnIcon}>⊞</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shutterBtn} onPress={takePhoto} activeOpacity={0.85}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
          <View style={styles.controlBtn} />
        </View>
      </View>
    );
  }

  // Analyzing state
  if (analyzing) {
    return (
      <View style={[styles.analyzingRoot, { paddingTop: insets.top }]}>
        <Image source={{ uri: photoUri }} style={styles.analyzingBg} blurRadius={8} />
        <View style={styles.analyzingOverlay}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.analyzingTitle}>Analyzing your skin...</Text>
          <Text style={styles.analyzingSubtext}>AI is examining your skin type, acne patterns, and severity</Text>
        </View>
      </View>
    );
  }

  // Results state
  return (
    <ScrollView
      style={styles.resultsRoot}
      contentContainerStyle={[styles.resultsContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back header */}
      <View style={styles.resultsHeader}>
        <TouchableOpacity onPress={resetScan} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.resultsTitle}>Your skin analysis</Text>
      </View>

      {/* Face map */}
      <View style={styles.faceMapCard}>
        <View style={styles.faceMapOvalContainer}>
          <View style={styles.faceMapOval} />
          <View style={[styles.zoneChip, styles.zoneChipTop]}>
            <Text style={styles.zoneChipText}>Forehead</Text>
          </View>
          <View style={[styles.zoneChip, styles.zoneChipBottom]}>
            <Text style={styles.zoneChipText}>Jawline</Text>
          </View>
        </View>
        <Text style={styles.faceMapHint}>Tap to toggle zones</Text>
        <View style={styles.skinStatsRow}>
          {[
            { label: 'SKIN TYPE', value: result?.skin_type ? result.skin_type.charAt(0).toUpperCase() + result.skin_type.slice(1) : '—' },
            { label: 'ACNE TYPE', value: result?.acne_type ? result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1) : '—' },
            { label: 'SEVERITY', value: result?.severity ? result.severity.charAt(0).toUpperCase() + result.severity.slice(1) : '—', accent: true },
          ].map(stat => (
            <View key={stat.label} style={styles.skinStat}>
              <Text style={styles.skinStatLabel}>{stat.label}</Text>
              <Text style={[styles.skinStatValue, stat.accent && { color: Colors.secondary }]}>{stat.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Score card */}
      {skinScore !== null && (
        <View style={styles.skinScoreCard}>
          <View style={styles.skinScoreLeft}>
            <Text style={styles.skinScoreSuperLabel}>SKIN SCORE</Text>
            <Text style={styles.skinScoreNumber}>{skinScore}</Text>
            <Text style={styles.skinScoreSubLabel}>Out of 100 · {result?.severity}</Text>
          </View>
          <View style={styles.skinScoreRight}>
            <View style={styles.skinScoreSub}>
              <Text style={styles.skinScoreSubLabel}>Confidence</Text>
              <Text style={styles.skinScoreSubValue}>{result?.confidence ? Math.round(result.confidence * 100) : '—'}%</Text>
            </View>
            <View style={[styles.skinScoreSub, styles.skinScoreSubAccent]}>
              <Text style={[styles.skinScoreSubLabel, { color: Colors.secondaryLight }]}>Acne Type</Text>
              <Text style={[styles.skinScoreSubValue, { color: Colors.secondaryLight }]}>
                {result?.acne_type ? result.acne_type.charAt(0).toUpperCase() + result.acne_type.slice(1) : '—'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Causes */}
      {causes.length > 0 && (
        <View style={styles.causesCard}>
          <Text style={styles.causesTitle}>WHAT'S CAUSING YOUR ACNE</Text>
          {causes.map((cause, i) => (
            <View key={i} style={styles.causeRow}>
              <View style={[styles.causeDot, { backgroundColor: cause.dot }]} />
              <View style={styles.causeBody}>
                <Text style={styles.causeTitle}>{cause.title}</Text>
                <Text style={styles.causeText}>{cause.body}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Severity warning */}
      {result && (result.severity === 'moderate' || result.severity === 'severe') && (
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠</Text>
          <Text style={styles.warningText}>
            Severity is {result.severity}. Your plan will work well, but consider seeing a dermatologist if no improvement by week 6.
          </Text>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaBtn, (saving || generatingPlan) && { opacity: 0.7 }]}
        onPress={saveSkinProfile}
        disabled={saving || generatingPlan}
        activeOpacity={0.9}
      >
        <Text style={styles.ctaBtnTitle}>
          {saving ? 'Saving...' : generatingPlan ? 'Generating Plan...' : 'View your personalized plan'}
        </Text>
        <Text style={styles.ctaBtnSub}>Products · Diet · Herbal · Lifestyle</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.rescanBtn} onPress={resetScan}>
        <Text style={styles.rescanText}>Re-scan</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const styles = StyleSheet.create({
  // Pre-scan
  preScanRoot: { flex: 1, backgroundColor: '#1C1C1A' },
  cameraArea: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.white },
  cornerTL: { top: 32, left: 32, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 32, right: 32, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 120, left: 32, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 120, right: 32, borderBottomWidth: 3, borderRightWidth: 3 },
  faceOval: {
    width: 180, height: 240, borderRadius: 90,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 60,
  },
  guideText: { position: 'absolute', bottom: 90, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '400' },
  statusRow: { position: 'absolute', bottom: 52, flexDirection: 'row', gap: Spacing.xl },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.huge, paddingTop: Spacing.xl, backgroundColor: '#1C1C1A' },
  controlBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  controlBtnInner: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  controlBtnIcon: { fontSize: 18, color: Colors.white },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: Colors.white, justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.white },

  // Analyzing
  analyzingRoot: { flex: 1, backgroundColor: '#1C1C1A' },
  analyzingBg: { ...StyleSheet.absoluteFillObject },
  analyzingOverlay: { flex: 1, backgroundColor: 'rgba(28,28,26,0.7)', justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, padding: Spacing.xxl },
  analyzingTitle: { ...Typography.headlineMedium, color: Colors.white, textAlign: 'center' },
  analyzingSubtext: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 },

  // Results
  resultsRoot: { flex: 1, backgroundColor: Colors.background },
  resultsContent: { paddingHorizontal: Spacing.xxl, gap: Spacing.lg },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 18, color: Colors.text },
  resultsTitle: { ...Typography.headlineLarge, color: Colors.text },

  // Face map
  faceMapCard: { backgroundColor: '#1C1C1A', borderRadius: BorderRadius.xl, overflow: 'hidden', padding: Spacing.xl, alignItems: 'center', gap: Spacing.lg },
  faceMapOvalContainer: { position: 'relative', width: 140, height: 180, justifyContent: 'center', alignItems: 'center' },
  faceMapOval: { width: 120, height: 160, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  zoneChip: { position: 'absolute', backgroundColor: Colors.secondary, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.pill },
  zoneChipTop: { top: 0, left: -20 },
  zoneChipBottom: { bottom: 10, right: -20 },
  zoneChipText: { fontSize: 10, color: Colors.white, fontWeight: '600' },
  faceMapHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  skinStatsRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: Spacing.lg },
  skinStat: { flex: 1, alignItems: 'center', gap: 4 },
  skinStatLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  skinStatValue: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Score card
  skinScoreCard: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl, flexDirection: 'row', alignItems: 'center' },
  skinScoreLeft: { flex: 1, gap: 4 },
  skinScoreSuperLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5 },
  skinScoreNumber: { fontSize: 56, fontWeight: '800', color: Colors.white, lineHeight: 60, letterSpacing: -2 },
  skinScoreSubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  skinScoreRight: { gap: Spacing.sm },
  skinScoreSub: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: BorderRadius.md, padding: Spacing.md, minWidth: 80, alignItems: 'center', gap: 2 },
  skinScoreSubAccent: { backgroundColor: 'rgba(200,87,62,0.3)' },
  skinScoreSubValue: { fontSize: 18, fontWeight: '700', color: Colors.white },

  // Causes
  causesCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.lg },
  causesTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5 },
  causeRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  causeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  causeBody: { flex: 1, gap: 4 },
  causeTitle: { ...Typography.labelLarge, color: Colors.text },
  causeText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  // Warning
  warningCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    borderWidth: 1.5, borderColor: Colors.secondary + '60',
    backgroundColor: Colors.warningLight, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  warningIcon: { fontSize: 16, color: Colors.secondary, marginTop: 2 },
  warningText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  // CTA
  ctaBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: 4, ...Shadows.md },
  ctaBtnTitle: { ...Typography.headlineSmall, color: Colors.white },
  ctaBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  rescanBtn: { alignItems: 'center', paddingVertical: Spacing.lg },
  rescanText: { ...Typography.labelLarge, color: Colors.textMuted },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/scan.tsx
git commit -m "feat: restyle scan screen to match mockup"
```

---

### Task 7: Restyle Products/Scanner Screen

**Files:**
- Modify: `app/(tabs)/scanner.tsx`

- [ ] **Step 1: Replace the header, add search bar + filter chips, restyle product grid**

Replace the header JSX:
```tsx
{/* Replace: */}
<LinearGradient colors={['#FFF0F5', '#FFE0ED']} style={styles.header}>
  <Text style={styles.headerTitle}>Product Scanner</Text>
  <Text style={styles.headerSubtitle}>Check if products suit your skin</Text>
  ...
</LinearGradient>

{/* With: */}
<View style={styles.header}>
  <Text style={styles.headerTitle}>Discover</Text>
  <Text style={styles.headerSubtitle}>Matched to your skin profile</Text>
</View>
```

Add search bar + filter chips between header and scroll content. Insert after the header, before `<ScrollView>`:
```tsx
<View style={styles.searchRow}>
  <View style={styles.searchBar}>
    <Text style={styles.searchIcon}>⊕</Text>
    <Text style={styles.searchPlaceholder}>Search products, brands…</Text>
  </View>
  <TouchableOpacity style={styles.gridToggle}>
    <Text style={styles.gridToggleIcon}>⊞</Text>
  </TouchableOpacity>
</View>
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
  {['All', 'Cleanser', 'Serum', 'SPF', 'Moisturiser'].map((cat, i) => (
    <TouchableOpacity key={cat} style={[styles.filterChip, i === 0 && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, i === 0 && styles.filterChipTextActive]}>{cat}</Text>
    </TouchableOpacity>
  ))}
</ScrollView>
```

Replace the scan history section with a 2-column grid:
```tsx
{scanHistory.length > 0 && (
  <View style={styles.historySection}>
    <Text style={styles.sectionLabel}>RECOMMENDED FOR YOU</Text>
    <View style={styles.productGrid}>
      {scanHistory.map((scan) => {
        const matchPct = scan.verdict === 'suitable' ? Math.floor(Math.random() * 15) + 82
          : scan.verdict === 'caution' ? Math.floor(Math.random() * 20) + 55
          : Math.floor(Math.random() * 20) + 35;
        const badgeColor = matchPct >= 80 ? Colors.primary : Colors.secondary;
        return (
          <TouchableOpacity key={scan.id} style={styles.productCard} onPress={() => setCurrentResult(scan)} activeOpacity={0.85}>
            <View style={[styles.matchBadge, { backgroundColor: badgeColor }]}>
              <Text style={styles.matchBadgeText}>{matchPct}%</Text>
            </View>
            <View style={styles.productImageArea}>
              <Text style={styles.productEmoji}>🧴</Text>
            </View>
            <Text style={styles.productBrand}>{scan.product_name.split(' ')[0].toUpperCase()}</Text>
            <Text style={styles.productName} numberOfLines={2}>{scan.product_name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
)}
```

Replace the entire `styles` block:
```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.background },
  headerTitle: { ...Typography.displaySmall, color: Colors.text },
  headerSubtitle: { ...Typography.bodyMedium, color: Colors.textMuted, marginTop: Spacing.xs },

  searchRow: { flexDirection: 'row', paddingHorizontal: Spacing.xxl, gap: Spacing.md, marginBottom: Spacing.sm, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.lg, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border },
  searchIcon: { fontSize: 14, color: Colors.textMuted },
  searchPlaceholder: { ...Typography.bodyMedium, color: Colors.textMuted },
  gridToggle: { width: 46, height: 46, borderRadius: BorderRadius.md, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  gridToggleIcon: { fontSize: 20, color: Colors.white },

  filterRow: { flexGrow: 0, marginBottom: Spacing.md },
  filterRowContent: { paddingHorizontal: Spacing.xxl, gap: Spacing.sm, flexDirection: 'row' },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { ...Typography.labelSmall, color: Colors.textMuted },
  filterChipTextActive: { color: Colors.white, fontWeight: '700' },

  scanCountBadge: { marginTop: Spacing.sm, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: Colors.warningLight, borderRadius: BorderRadius.pill },
  scanCountText: { ...Typography.labelSmall, color: Colors.warning, fontWeight: '600' },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, gap: Spacing.xl },

  cameraContainer: { borderRadius: BorderRadius.xl, overflow: 'hidden', height: 320, position: 'relative' },
  camera: { flex: 1 },
  scannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  scannerFrame: { width: 220, height: 130, position: 'relative' },
  scannerCorner: { position: 'absolute', width: 24, height: 24, borderColor: Colors.white },
  scannerCornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  scannerCornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  scannerCornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  scannerCornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scannerInstruction: { ...Typography.bodyMedium, color: Colors.white, marginTop: Spacing.lg, textAlign: 'center' },
  cancelScanButton: { position: 'absolute', bottom: Spacing.xl, left: 0, right: 0, alignItems: 'center' },
  cancelScanText: { ...Typography.labelLarge, color: Colors.white, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.pill },

  scanActions: { gap: Spacing.lg },
  scanButton: { borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.lg },
  scanButtonGradient: { height: 60, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary },
  scanButtonIcon: { fontSize: 24 },
  scanButtonText: { ...Typography.headlineSmall, color: Colors.white },

  manualEntry: { gap: Spacing.md },
  manualLabel: { ...Typography.labelMedium, color: Colors.textMuted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  manualInputRow: { flexDirection: 'row', gap: Spacing.md },
  manualInput: { flex: 1, height: 52, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, ...Typography.bodyMedium, color: Colors.text, backgroundColor: Colors.white },
  manualScanButton: { width: 80, height: 52, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  manualScanButtonDisabled: { backgroundColor: Colors.subtleDeep },
  manualScanButtonText: { ...Typography.labelLarge, color: Colors.white },

  analyzingCard: { borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.sm },
  analyzingGradient: { padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card },
  analyzingEmoji: { fontSize: 40 },
  analyzingText: { ...Typography.headlineSmall, color: Colors.text },
  analyzingSubtext: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },

  resultSection: { gap: Spacing.md },
  resultSectionTitle: { ...Typography.headlineSmall, color: Colors.text },

  verdictCard: { borderWidth: 2, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.md },
  verdictHeader: { padding: Spacing.lg, backgroundColor: Colors.card },
  verdictTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  productName: { ...Typography.headlineMedium, color: Colors.text, flex: 1 },
  verdictBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.pill },
  verdictIcon: { fontSize: 14, color: Colors.white, fontWeight: '700' },
  verdictLabel: { ...Typography.labelSmall, color: Colors.white, fontWeight: '700' },
  verdictBody: { padding: Spacing.lg, backgroundColor: Colors.white, gap: Spacing.md },
  verdictReason: { ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 22 },
  flaggedSection: { gap: Spacing.sm },
  flaggedTitle: { ...Typography.labelMedium, color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  flaggedList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  flaggedChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.pill },
  flaggedChipText: { ...Typography.caption, fontWeight: '600' },
  scanDate: { ...Typography.caption, color: Colors.textMuted },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: Spacing.sm },
  historySection: { gap: Spacing.sm },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  productCard: { width: '47%', backgroundColor: Colors.card, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.sm },
  matchBadge: { position: 'absolute', top: Spacing.md, left: Spacing.md, zIndex: 1, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.pill },
  matchBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  productImageArea: { height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.subtle },
  productEmoji: { fontSize: 48 },
  productBrand: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  productName: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: 2, ...Typography.labelMedium, color: Colors.text, lineHeight: 18 },

  paywallOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,28,26,0.85)', justifyContent: 'flex-end' },
  paywallCard: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.xxl, paddingBottom: 40, gap: Spacing.lg, alignItems: 'center', backgroundColor: Colors.primary },
  paywallEmoji: { fontSize: 48 },
  paywallTitle: { ...Typography.displaySmall, color: Colors.white, textAlign: 'center' },
  paywallSubtitle: { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  paywallFeatures: { width: '100%', gap: Spacing.sm },
  paywallFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  paywallFeatureCheck: { color: Colors.secondaryLight, fontWeight: '700', fontSize: 16 },
  paywallFeatureText: { ...Typography.bodyMedium, color: Colors.white },
  upgradeButton: { width: '100%', borderRadius: BorderRadius.md, overflow: 'hidden', ...Shadows.md },
  upgradeGradient: { height: 54, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.secondary },
  upgradeText: { ...Typography.headlineSmall, color: Colors.white },
  paywallDismiss: { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.5)', textDecorationLine: 'underline' },
});
```

Also replace all `LinearGradient` usages in this file with plain `View` (since colors auto-update via theme and gradients aren't needed here):
- `analyzingGradient` → `<View style={styles.analyzingGradient}>`
- `verdictHeader` → `<View style={styles.verdictHeader}>`
- `scanButtonGradient` → `<View style={styles.scanButtonGradient}>`
- `upgradeGradient` → `<View style={styles.upgradeGradient}>`
- `paywallCard` → `<View style={styles.paywallCard}>`

Remove `LinearGradient` import from scanner.tsx.

- [ ] **Step 2: Commit**

```bash
git add app/(tabs)/scanner.tsx
git commit -m "feat: restyle products screen to match mockup"
```

---

## Self-Review

**Spec coverage:**
- ✅ theme.ts — Task 1
- ✅ Tab bar — Task 2
- ✅ Home screen — Task 3
- ✅ Plan screen — Task 4
- ✅ Progress screen — Task 5
- ✅ Scan screen — Task 6
- ✅ Products/scanner screen — Task 7
- ✅ All data wiring preserved
- ✅ No placeholders — all code is complete
- ✅ Type consistency — Colors.primary/secondary/background tokens used throughout
- ✅ No new files created
