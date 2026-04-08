# Animation & Living UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Glow app feel premium and alive with an indigo floor background, staggered card entrances, breathing glows, feel-good particle/ring bursts, and a streak counter.

**Architecture:** All animations use React Native's built-in `Animated` API (zero new deps). Three new shared components (`ParticleBurst`, `GlowRingPulse`, `StreakCounter`) use an imperative `trigger()` ref API so any screen can fire them. `ScreenBackground` is upgraded once and covers all screens globally.

**Tech Stack:** React Native `Animated`, `expo-linear-gradient`, `react-native-svg` (already installed), `expo-haptics` (already installed), Supabase JS client (already installed)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `components/ScreenBackground.tsx` | Indigo floor gradient + noise overlay |
| Create | `components/ParticleBurst.tsx` | 8-dot purple particle burst, imperative ref |
| Create | `components/GlowRingPulse.tsx` | 3 expanding ring pulse, imperative ref |
| Create | `components/StreakCounter.tsx` | Streak calc + animated flame display |
| Modify | `app/(tabs)/index.tsx` | Card stagger, hero glow, stat count-up, streak, button spring |
| Modify | `app/(tabs)/progress.tsx` | Calendar stagger, logged-day glow, particle burst on save |
| Modify | `app/(tabs)/plan.tsx` | Tip card stagger, celebration on add-to-routine, shimmer |
| Modify | `components/ProgressChart.tsx` | Animated line self-draw on mount |

---

## Task 1: Indigo Floor Background

**Files:**
- Modify: `components/ScreenBackground.tsx`

- [ ] **Step 1: Replace flat background with LinearGradient + noise**

Replace the entire file content:

```tsx
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Filter, FeTurbulence, Rect } from 'react-native-svg';

type Preset = 'home' | 'plan' | 'scan' | 'progress' | 'shop';

export default function ScreenBackground({ preset: _ }: { preset: Preset }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#08080F', '#100830', '#1A0845']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle noise grain overlay */}
      <Svg style={[StyleSheet.absoluteFill, { opacity: 0.04 }]}>
        <Filter id="noise">
          <FeTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
        </Filter>
        <Rect width="100%" height="100%" filter="url(#noise)" />
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ScreenBackground.tsx
git commit -m "feat: indigo floor gradient background with noise grain"
```

---

## Task 2: ParticleBurst Component

**Files:**
- Create: `components/ParticleBurst.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const COLORS = ['#7C5CFC', '#A78BFA', '#C4B5FD', '#5B21B6', '#7C5CFC', '#A78BFA', '#C4B5FD', '#5B21B6'];
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const TRAVEL = 28;
const DURATION = 600;

export interface ParticleBurstHandle {
  trigger: () => void;
}

const ParticleBurst = forwardRef<ParticleBurstHandle>((_, ref) => {
  const anims = useRef(ANGLES.map(() => ({
    pos: new Animated.ValueXY({ x: 0, y: 0 }),
    opacity: new Animated.Value(0),
  }))).current;

  useImperativeHandle(ref, () => ({
    trigger() {
      // Reset all
      anims.forEach(a => {
        a.pos.setValue({ x: 0, y: 0 });
        a.opacity.setValue(1);
      });

      const animations = anims.map((a, i) => {
        const rad = (ANGLES[i] * Math.PI) / 180;
        const tx = Math.round(Math.cos(rad) * TRAVEL);
        const ty = Math.round(Math.sin(rad) * TRAVEL);
        return Animated.parallel([
          Animated.timing(a.pos, {
            toValue: { x: tx, y: ty },
            duration: DURATION,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(DURATION * 0.4),
            Animated.timing(a.opacity, {
              toValue: 0,
              duration: DURATION * 0.6,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      Animated.stagger(18, animations).start();
    },
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: COLORS[i] },
            {
              opacity: a.opacity,
              transform: [{ translateX: a.pos.x }, { translateY: a.pos.y }],
            },
          ]}
        />
      ))}
    </View>
  );
});

ParticleBurst.displayName = 'ParticleBurst';
export default ParticleBurst;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 0,
    height: 0,
    zIndex: 100,
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 2,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/ParticleBurst.tsx
git commit -m "feat: add ParticleBurst component with imperative trigger ref"
```

---

## Task 3: GlowRingPulse Component

**Files:**
- Create: `components/GlowRingPulse.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const RING_COUNT = 3;
const STAGGER_MS = 200;
const DURATION = 800;

export interface GlowRingPulseHandle {
  trigger: () => void;
}

const GlowRingPulse = forwardRef<GlowRingPulseHandle>((_, ref) => {
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => ({
      scale: new Animated.Value(0.8),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useImperativeHandle(ref, () => ({
    trigger() {
      rings.forEach(r => {
        r.scale.setValue(0.8);
        r.opacity.setValue(0.7);
      });

      const animations = rings.map(r =>
        Animated.parallel([
          Animated.timing(r.scale, {
            toValue: 2.2,
            duration: DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(r.opacity, {
            toValue: 0,
            duration: DURATION,
            useNativeDriver: true,
          }),
        ])
      );

      Animated.stagger(STAGGER_MS, animations).start();
    },
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              opacity: r.opacity,
              transform: [{ scale: r.scale }],
            },
          ]}
        />
      ))}
    </View>
  );
});

GlowRingPulse.displayName = 'GlowRingPulse';
export default GlowRingPulse;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 0,
    height: 0,
    zIndex: 99,
  },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(124,92,252,0.6)',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/GlowRingPulse.tsx
git commit -m "feat: add GlowRingPulse component with imperative trigger ref"
```

---

## Task 4: StreakCounter Component

**Files:**
- Create: `components/StreakCounter.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { format, subDays, isSameDay } from 'date-fns';
import { Colors, Fonts } from '@/lib/theme';

async function computeStreak(userId: string): Promise<number> {
  // Gather all activity dates from both tables
  const [scans, photos] = await Promise.all([
    supabase
      .from('skin_profiles')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('progress_photos')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const allDates = [
    ...((scans.data ?? []).map(r => new Date(r.created_at))),
    ...((photos.data ?? []).map(r => new Date(r.created_at))),
  ];

  if (allDates.length === 0) return 0;

  // Deduplicate to unique calendar days
  const uniqueDays = Array.from(
    new Set(allDates.map(d => format(d, 'yyyy-MM-dd')))
  ).sort().reverse(); // newest first

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Streak must include today or yesterday to still be active
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0;

  let streak = 0;
  let cursor = uniqueDays[0] === today ? new Date() : subDays(new Date(), 1);

  for (const dayStr of uniqueDays) {
    const expected = format(cursor, 'yyyy-MM-dd');
    if (dayStr === expected) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }

  return streak;
}

export default function StreakCounter() {
  const [streak, setStreak] = useState(0);
  const [isNewDay, setIsNewDay] = useState(false);
  const flameScale = useRef(new Animated.Value(1)).current;
  const pulseLoop  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const count = await computeStreak(user.id);
      setStreak(count);

      // Check if today already has an entry (meaning streak just extended today)
      const { data: todayScans } = await supabase
        .from('skin_profiles')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', format(new Date(), 'yyyy-MM-dd'))
        .limit(1);
      const { data: todayPhotos } = await supabase
        .from('progress_photos')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', format(new Date(), 'yyyy-MM-dd'))
        .limit(1);

      const actedToday = (todayScans?.length ?? 0) > 0 || (todayPhotos?.length ?? 0) > 0;
      setIsNewDay(actedToday && count > 0);
    })();
  }, []);

  useEffect(() => {
    if (isNewDay) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(flameScale, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(flameScale, { toValue: 1,    duration: 400, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      flameScale.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [isNewDay, flameScale]);

  if (streak === 0) return null;

  return (
    <View style={styles.row}>
      <Animated.Text style={[styles.flame, { transform: [{ scale: flameScale }] }]}>🔥</Animated.Text>
      <Text style={styles.count}>{streak}</Text>
      <Text style={styles.label}>DAY STREAK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(124,92,252,0.12)',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(124,92,252,0.25)',
    alignSelf: 'flex-start',
  },
  flame: {
    fontSize: 14,
  },
  count: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.semibold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/StreakCounter.tsx
git commit -m "feat: add StreakCounter component with Supabase streak calculation"
```

---

## Task 5: Animated ProgressChart

**Files:**
- Modify: `components/ProgressChart.tsx`

- [ ] **Step 1: Add animated line draw to ProgressChart**

At the top of the file, add the import for `useEffect` and `useRef`:

```tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing } from '@/lib/theme';
```

- [ ] **Step 2: Add animated clip mask inside ProgressChart**

Replace the `export function ProgressChart(...)` function with this full updated version. The key change is adding a `progressAnim` that drives a `ClipPath` rect width from 0 → full, making the line appear to draw from left to right:

```tsx
export function ProgressChart({ data, height = 200 }: ProgressChartProps) {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const chartWidth = SCREEN_WIDTH - 48 - 32;
  const chartHeight = height;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false, // drives SVG width, needs JS driver
    }).start();
  }, [data]);

  if (data.length < 2) {
    return (
      <View style={styles.insufficientData}>
        <Text style={styles.insufficientText}>
          Log at least 2 progress photos to see your chart
        </Text>
      </View>
    );
  }

  const innerWidth  = chartWidth  - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = chartHeight - CHART_PADDING.top  - CHART_PADDING.bottom;
  const minY   = Math.min(...data.map((d) => d.y));
  const maxY   = Math.max(...data.map((d) => d.y));
  const yRange = maxY - minY || 1;

  const scaleX = (i: number) => (i / (data.length - 1)) * innerWidth + CHART_PADDING.left;
  const scaleY = (val: number) => ((maxY - val) / yRange) * innerHeight + CHART_PADDING.top;

  const buildPath = () => {
    const points = data.map((d, i) => ({ x: scaleX(i), y: scaleY(d.y) }));
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = (points[i - 1].x + points[i].x) / 2;
      const cp2y = points[i].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  const buildFill = () => {
    const points = data.map((d, i) => ({ x: scaleX(i), y: scaleY(d.y) }));
    if (points.length === 0) return '';
    let path = `M ${points[0].x} ${chartHeight - CHART_PADDING.bottom}`;
    path += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = (points[i - 1].x + points[i].x) / 2;
      const cp2y = points[i].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i].x} ${points[i].y}`;
    }
    path += ` L ${points[points.length - 1].x} ${chartHeight - CHART_PADDING.bottom} Z`;
    return path;
  };

  const linePath = buildPath();
  const fillPath = buildFill();

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => minY + (yRange * i) / (yTicks - 1));

  // Animated clip width
  const clipWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, chartWidth],
  });

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.primary} stopOpacity="0.3" />
            <Stop offset="1" stopColor={Colors.primary} stopOpacity="0.02" />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {yTickValues.map((val, i) => {
          const y = scaleY(val);
          return (
            <React.Fragment key={i}>
              <Line x1={CHART_PADDING.left} y1={y} x2={chartWidth - CHART_PADDING.right} y2={y}
                stroke={Colors.borderLight} strokeWidth={1} strokeDasharray="4 4" />
              <SvgText x={CHART_PADDING.left - 6} y={y + 4} fontSize={10} fill={Colors.textMuted} textAnchor="end">
                {val.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill — always visible */}
        <Path d={fillPath} fill="url(#areaGradient)" />

        {/* Animated clip group for line + dots */}
        <Animated.View style={{ width: clipWidth, height: chartHeight, overflow: 'hidden', position: 'absolute' }}>
          <Svg width={chartWidth} height={chartHeight}>
            <Path d={linePath} stroke={Colors.primary} strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((point, i) => {
              const cx = scaleX(i);
              const cy = scaleY(point.y);
              return (
                <React.Fragment key={i}>
                  <Circle cx={cx} cy={cy} r={5} fill={Colors.white} stroke={Colors.primary} strokeWidth={2} />
                  <Circle cx={cx} cy={cy} r={2.5} fill={Colors.primary} />
                  <SvgText x={cx} y={chartHeight - 4} fontSize={10} fill={Colors.textMuted} textAnchor="middle">
                    {point.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </Animated.View>
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>Severity Score</Text>
        </View>
        <Text style={styles.legendNote}>Lower is better</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ProgressChart.tsx
git commit -m "feat: animate ProgressChart line drawing left-to-right on mount"
```

---

## Task 6: Home Screen Animations

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Add stagger entrance for post-scan dashboard cards**

At the top of `HomeScreen`, add these new refs and a `useEffect` that runs after `loaded` becomes true. Add imports for `useEffect` and `useRef` if not already present (they are not — add them):

Change the import line:
```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
```

Then inside `HomeScreen`, after the existing `useState` declarations, add:

```tsx
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
```

- [ ] **Step 2: Wrap each post-scan card with its entrance anim and add hero glow**

In the post-scan `return`, wrap each major section in its animated card. Replace the `<TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/(tabs)/scan')}>` scan card block with:

```tsx
{/* ── Scan Result Hero Card ── */}
<Animated.View style={{ opacity: cardAnims[0].opacity, transform: [{ translateY: cardAnims[0].translateY }] }}>
  <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/(tabs)/scan')}>
    <LinearGradient
      colors={['#3B1FA3', '#1E0F5C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.scanCard}
    >
      {/* Breathing inner glow */}
      <Animated.View
        pointerEvents="none"
        style={[s.heroInnerGlow, { opacity: heroGlowOpacity }]}
      />
      {/* existing card content unchanged */}
      <View style={s.scanCardTop}>
        <View style={s.confidenceBadge}>
          <View style={s.confidenceDot} />
          <Text style={s.confidenceText}>confidence high</Text>
        </View>
        {scanAgoLabel && <Text style={s.scanAgoText}>{scanAgoLabel}</Text>}
      </View>
      <Text style={s.scanCardLabel}>Today's scan result</Text>
      <Text style={s.scanCardTitle}>
        {skinLabel}{skinProfile.acne_type ? ` with\n${skinProfile.acne_type} acne` : ''}
      </Text>
      <Text style={s.scanCardDesc}>{skinDesc}</Text>
      <View style={s.metricsRow}>
        <MetricPill label="Skin" value={skinLabel} color={Colors.skinOily} />
        {skinProfile.severity && (
          <MetricPill label="Severity" value={capitalize(skinProfile.severity)} color={getSeverityColor(skinProfile.severity)} />
        )}
        {skinProfile.acne_type && (
          <MetricPill label="Acne" value={capitalize(skinProfile.acne_type)} color={Colors.primaryLight} />
        )}
      </View>
      <View style={s.zoneRow}>
        <ZoneDot color="#2DD4BF" label="oil" />
        <ZoneDot color="#FCD34D" label="spots" />
        <ZoneDot color="#A78BFA" label={skinProfile.acne_type ?? 'acne'} />
      </View>
      <View style={s.scanCardCta}>
        <Text style={s.scanCardCtaText}>View full analysis</Text>
        <ChevronRight size={14} color="rgba(255,255,255,0.6)" />
      </View>
    </LinearGradient>
  </TouchableOpacity>
</Animated.View>
```

Add the inner glow style to the StyleSheet:
```tsx
heroInnerGlow: {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: '60%',
  borderRadius: 20,
  backgroundColor: 'rgba(124,92,252,0.15)',
},
```

- [ ] **Step 3: Wrap quick actions row, routine card, and progress card in stagger anims**

Wrap `<View style={s.quickRow}>` in `<Animated.View style={{ opacity: cardAnims[1].opacity, transform: [{ translateY: cardAnims[1].translateY }] }}>`.

Wrap the routine card `{plan && (...)}` block in `<Animated.View style={{ opacity: cardAnims[2].opacity, transform: [{ translateY: cardAnims[2].translateY }] }}>`.

Wrap the progress card in `<Animated.View style={{ opacity: cardAnims[3].opacity, transform: [{ translateY: cardAnims[3].translateY }] }}>`.

- [ ] **Step 4: Add StreakCounter below the header**

Import `StreakCounter` at the top of the file:
```tsx
import StreakCounter from '@/components/StreakCounter';
```

In the post-scan dashboard `return`, after `{Header}` and before the scan card, add:
```tsx
<Animated.View style={[{ opacity: cardAnims[4].opacity, transform: [{ translateY: cardAnims[4].translateY }] }, { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md }]}>
  <StreakCounter />
</Animated.View>
```

- [ ] **Step 5: Wire stat count-up to the severity display**

`severityAnim` drives an interpolated label. In the `MetricPill` for Severity inside the scan card, replace the static value with an `Animated.Text` that reads from `severityAnim`. Add a helper just before the return inside the post-scan block:

```tsx
// Animated severity score display (0 → actual)
const severityScore = skinProfile.severity === 'mild' ? 3
  : skinProfile.severity === 'moderate' ? 6 : 9;
```

Then pass `severityAnim` as a prop to a local `AnimatedMetricPill` — or simply replace that one `MetricPill` with:

```tsx
<View style={s.metricPill}>
  <Text style={s.metricLabel}>Score</Text>
  <Animated.Text style={[s.metricValue, { color: getSeverityColor(skinProfile.severity) }]}>
    {severityAnim.interpolate({ inputRange: [0, 10], outputRange: ['0', '10'] })
      // Note: for display, use a listener instead of interpolate on Text.
      // Replace with a useState that tracks the anim value:
    }
  </Animated.Text>
</View>
```

Because `Animated.Text` with string interpolation is awkward, use a simple `useState` listener approach. Add this inside `HomeScreen` after `severityAnim` is declared:

```tsx
const [displayScore, setDisplayScore] = useState(0);
useEffect(() => {
  const id = severityAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
  return () => severityAnim.removeListener(id);
}, [severityAnim]);
```

Then in the scan card metrics row, add one more pill:
```tsx
<MetricPill label="Score" value={`${displayScore}/10`} color={getSeverityColor(skinProfile.severity)} />
```

- [ ] **Step 6: Add button press spring to quick action cards**

Replace the three `<TouchableOpacity style={s.quickCard} activeOpacity={0.8} ...>` instances with spring-scaled versions. First add scale anims:

```tsx
const quickScales = useRef([
  new Animated.Value(1),
  new Animated.Value(1),
  new Animated.Value(1),
]).current;

const springPress   = (anim: Animated.Value) => Animated.spring(anim, { toValue: 0.94, tension: 120, friction: 8,  useNativeDriver: true }).start();
const springRelease = (anim: Animated.Value) => Animated.spring(anim, { toValue: 1,    tension: 120, friction: 8,  useNativeDriver: true }).start();
```

Then wrap each quick card:
```tsx
<Animated.View style={{ transform: [{ scale: quickScales[0] }] }}>
  <TouchableOpacity
    style={s.quickCard}
    activeOpacity={1}
    onPressIn={() => springPress(quickScales[0])}
    onPressOut={() => springRelease(quickScales[0])}
    onPress={() => router.push('/(tabs)/plan')}
  >
    {/* existing content */}
  </TouchableOpacity>
</Animated.View>
```
Repeat for indices 1 and 2 (Re-scan, Coach).

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: home screen stagger entrance, hero glow, stat count-up, streak counter, button spring"
```

---

## Task 7: Progress Screen Animations

**Files:**
- Modify: `app/(tabs)/progress.tsx`

- [ ] **Step 1: Add calendar row stagger on mount**

At the top of `ProgressScreen`, after existing state declarations, add:

```tsx
// Calendar row entrance anims — 6 rows max
const calRowAnims = useRef(
  Array.from({ length: 6 }, () => new Animated.Value(0))
).current;

useEffect(() => {
  if (loading) return;
  calRowAnims.forEach(a => a.setValue(0));
  Animated.stagger(40, calRowAnims.map(a =>
    Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true })
  )).start();
}, [loading]);
```

- [ ] **Step 2: Apply row anim to calendar grid rows**

In the calendar grid render, chunk the `calendarDays` into groups of 7 (one row per week) and wrap each row's `View` with an `Animated.View`. Replace the flat `calendarDays.map(...)` with:

```tsx
{/* Chunk days into rows of 7 */}
{Array.from({ length: Math.ceil((paddingCells.length + calendarDays.length) / 7) }, (_, rowIdx) => {
  const startCell = rowIdx * 7;
  const allCells  = [...paddingCells.map(() => null), ...calendarDays];
  const rowCells  = allCells.slice(startCell, startCell + 7);
  const rowAnim   = calRowAnims[Math.min(rowIdx, calRowAnims.length - 1)];
  return (
    <Animated.View
      key={rowIdx}
      style={{ flexDirection: 'row', opacity: rowAnim, transform: [{ translateY: rowAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}
    >
      {rowCells.map((day, cellIdx) => {
        if (!day) return <View key={`pad-${cellIdx}`} style={styles.dayCell} />;
        const key        = format(day, 'yyyy-MM-dd');
        const dayPhotos  = photosByDate[key] ?? [];
        const latestDayPhoto = dayPhotos[0] ?? null;
        const hasPhotos  = dayPhotos.length > 0;
        const isToday    = isSameDay(day, new Date());
        return (
          <TouchableOpacity
            key={key}
            style={styles.dayCell}
            onPress={() => { if (!latestDayPhoto) return; setSelectedDay(day); expandFromCell(key, latestDayPhoto); }}
            activeOpacity={hasPhotos ? 0.7 : 1}
          >
            <View
              ref={(ref) => { if (hasPhotos) cellRefs.current[key] = ref; }}
              style={[
                styles.dayCellCircle,
                hasPhotos && styles.dayCellLogged,
                isToday && !hasPhotos && styles.dayCellToday,
                isToday && hasPhotos && styles.dayCellTodayLogged,
              ]}
            >
              {hasPhotos && latestDayPhoto?.image_url ? (
                <Image source={{ uri: latestDayPhoto.image_url }} style={styles.dayCellThumb} />
              ) : null}
              <Text style={[
                styles.dayCellNumber,
                hasPhotos && styles.dayCellNumberLogged,
                isToday && !hasPhotos && styles.dayCellNumberToday,
              ]}>
                {format(day, 'd')}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
})}
```

Also remove the original `{paddingCells.map(...)}` and `{calendarDays.map(...)}` blocks that are now replaced.

- [ ] **Step 3: Enhance logged-day glow style**

In the `StyleSheet` of `progress.tsx`, find `dayCellLogged` and update it to include a purple glow tint:

```tsx
dayCellLogged: {
  backgroundColor: 'rgba(124,92,252,0.25)',
  borderWidth: 1.5,
  borderColor: 'rgba(124,92,252,0.5)',
},
```

This makes every calendar day with a photo glow with a soft purple ring.

- [ ] **Step 4: Add ParticleBurst to progress screen and fire on save**

Add import at top:
```tsx
import ParticleBurst, { ParticleBurstHandle } from '@/components/ParticleBurst';
```

Add ref inside the component:
```tsx
const burstRef = useRef<ParticleBurstHandle>(null);
```

In `logProgressPhoto`, after `await fetchPhotos();` and before the `finally` block, add:
```tsx
burstRef.current?.trigger();
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

Add the `<ParticleBurst ref={burstRef} />` component inside the main `Animated.View` return, just before `</Animated.View>`:
```tsx
<ParticleBurst ref={burstRef} />
```

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/progress.tsx
git commit -m "feat: progress screen calendar row stagger, logged-day glow, particle burst on save"
```

---

## Task 8: Plan Screen Animations

**Files:**
- Modify: `app/(tabs)/plan.tsx`

- [ ] **Step 1: Add tip card stagger entrance**

Import `useEffect` if not present (it is already). Add stagger anims after existing state in `PlanScreen`:

```tsx
// Tip stagger anims — keyed by impact_rank
const tipAnimsRef = useRef<Record<number, { opacity: Animated.Value; translateY: Animated.Value }>>({}).current;

const getOrCreateTipAnim = (rank: number) => {
  if (!tipAnimsRef[rank]) {
    tipAnimsRef[rank] = {
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(16),
    };
  }
  return tipAnimsRef[rank];
};

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
```

- [ ] **Step 2: Wrap each tip card in its stagger anim**

In the `items.map((item) => {...})` block inside the picks tab, wrap the `<TouchableOpacity style={...pickCard...}>` with:

```tsx
{items.map((item) => {
  const added     = routineRanks.has(item.impact_rank);
  const cardScale = cardScaleAnims[item.impact_rank];
  const bubbles   = getBubbles(item.impact_rank);
  const tipAnim   = getOrCreateTipAnim(item.impact_rank);
  return (
    <Animated.View
      key={item.impact_rank}
      style={{ opacity: tipAnim.opacity, transform: [{ translateY: tipAnim.translateY }] }}
    >
      <TouchableOpacity
        style={[styles.pickCard, { overflow: 'hidden' }, added && { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.35)' }]}
        onPress={() => setSelectedPick(item)}
        activeOpacity={0.7}
      >
        {/* existing card innards unchanged */}
      </TouchableOpacity>
    </Animated.View>
  );
})}
```

- [ ] **Step 3: Add GlowRingPulse and ParticleBurst on add-to-routine**

Add imports:
```tsx
import ParticleBurst, { ParticleBurstHandle } from '@/components/ParticleBurst';
import GlowRingPulse, { GlowRingPulseHandle } from '@/components/GlowRingPulse';
```

Add refs inside `PlanScreen`:
```tsx
const burstRef = useRef<ParticleBurstHandle>(null);
const glowRef  = useRef<GlowRingPulseHandle>(null);
```

In `toggleItem`, after `setRoutineRanks(...)` for the **add** case (not remove), add:
```tsx
burstRef.current?.trigger();
glowRef.current?.trigger();
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

Add both components inside the main `Animated.View` return, just before closing:
```tsx
<ParticleBurst ref={burstRef} />
<GlowRingPulse ref={glowRef} />
```

- [ ] **Step 4: Add routine tab shimmer on first load**

Add a shimmer anim ref:
```tsx
const shimmerAnim   = useRef(new Animated.Value(0)).current;
const shimmerRanRef = useRef(false);
```

When routine tab first becomes active:
```tsx
useEffect(() => {
  if (activeTab !== 'routine' || shimmerRanRef.current) return;
  shimmerRanRef.current = true;
  Animated.timing(shimmerAnim, {
    toValue: 1,
    duration: 900,
    useNativeDriver: true,
  }).start();
}, [activeTab]);
```

In the routine tab's card list, wrap each card in:
```tsx
<Animated.View
  style={{
    opacity: shimmerAnim,
    transform: [{ translateX: shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
  }}
>
  {/* existing routine card */}
</Animated.View>
```

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/plan.tsx
git commit -m "feat: plan screen tip stagger, routine shimmer, particle burst and glow ring on add-to-routine"
```

---

## Task 9: Smoke Test

- [ ] **Step 1: Run the app and verify each screen**

```bash
npx expo start
```

Check each screen:
- **All screens**: Background should be dark sky → deep indigo (not flat black)
- **Home**: Cards should stagger in on load. Hero scan card should have a subtle breathing glow. StreakCounter appears if user has scanned/logged on consecutive days.
- **Progress**: Calendar rows animate in row by row. Logging a photo triggers particle burst.
- **Plan**: Switching to Tips tab staggers cards in. Adding a tip to routine triggers glow rings + particle burst.
- **ProgressChart**: Chart line should draw left to right when it first renders with ≥2 data points.

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: living UI animations — background, stagger, glow, particles, streak"
```
