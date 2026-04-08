# Animation & Living UI Design
**Date:** 2026-04-07
**Status:** Approved

## Overview
Make the Glow app feel premium and alive. Style is "Premium & Alive" — ambient glow, depth, and satisfying micro-interactions. No distracting motion; everything feels intentional and polished.

---

## Background (All Screens)

**Style:** Indigo Floor
**Implementation:** Replace the current `ScreenBackground` component with a full-screen `LinearGradient` using `expo-linear-gradient`:
- Colors: `['#08080F', '#100830', '#1A0845']`
- Direction: top to bottom (`start={x:0,y:0}` → `end={x:0,y:1}`)
- A subtle SVG noise texture overlay at ~4% opacity sits on top for grain/depth

Applied globally — one component change covers every screen.

---

## Screens

### Home (`app/(tabs)/index.tsx`)
- **Card stagger entrance:** All cards fade in + slide up on mount. 60ms delay between each card. Spring easing (`tension: 60, friction: 8`).
- **Hero card breathing glow:** The main skin result card has an inner glow whose opacity pulses from 0.4 → 0.8 on a 3-second `Animated.loop`.
- **Stat number count-up:** Severity score and week number animate from 0 to their actual value on entrance (~800ms).
- **Streak counter:** Displayed below the header. Shows 🔥 + consecutive day count. Reads scan/progress dates from Supabase to compute streak. Flame icon pulses gently on a new streak day.
- **Button press spring:** All primary buttons scale `1 → 0.94 → 1` on press using `Animated.spring`.

### Progress (`app/(tabs)/progress.tsx`)
- **Calendar row stagger:** Calendar day cells animate in row by row on mount (fade, 40ms between rows).
- **Logged day glow:** Days that have a progress photo get a soft purple ring glow (`rgba(124,92,252,0.4)` border + subtle background tint).
- **Chart self-draw:** The severity chart line animates from left to right on load using a stroke-dashoffset animation (~1s duration).
- **Particle burst on save:** When a new progress photo is successfully saved, `ParticleBurst` fires.

### Plan (`app/(tabs)/plan.tsx`)
- **Tip card stagger:** Tip cards fade in + slide up with 50ms stagger between each on mount/tab switch.
- **Add-to-routine celebration:** When a tip is added to the routine:
  - `GlowRingPulse` fires from the `+` button position
  - `ParticleBurst` fires from the same position
- **Routine tab shimmer:** On first load of the Routine tab, a shimmer sweep passes across each card once.

---

## Shared Feel-Good Components

### `ParticleBurst`
- **Trigger:** Imperative ref API — `burstRef.current.trigger()`
- **Animation:** 8 dots radiate outward from a centre point and fade out over 600ms
- **Colors:** `#7C5CFC`, `#A78BFA`, `#C4B5FD`, `#5B21B6` (alternating)
- **Dot shape:** 7×7px, borderRadius 2 (slight square)
- **Directions:** 8 evenly spaced angles (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
- **Travel distance:** 28px from centre
- **Fires on:** Progress photo saved, tip added to routine

### `GlowRingPulse`
- **Trigger:** Same imperative ref API — `glowRef.current.trigger()`
- **Animation:** 3 concentric rings expand from scale 0.8 → 2.2 and fade to 0, with 200ms stagger between rings
- **Color:** `rgba(124,92,252,0.6)` → transparent
- **Duration:** ~800ms per ring
- **Fires on:** Tip added to routine, progress photo saved

### `StreakCounter`
- **Location:** Home screen, below the header row
- **Data:** Queries `progress_photos` and `skin_profiles` tables ordered by `created_at` to compute consecutive days
- **Display:** 🔥 flame emoji + number + "DAY STREAK" label
- **Animation:** Flame pulses (`scale 1 → 1.15 → 1`, 0.8s loop) on the day a new streak is reached; otherwise static
- **Zero state:** Hidden when streak is 0 (first day)

---

## Technical Approach

- **Animation library:** React Native built-in `Animated` API only — no new dependencies
- **Stagger:** `Animated.stagger(delay, animations[])`
- **Loops:** `Animated.loop(Animated.sequence([...]))`
- **Parallel bursts:** `Animated.parallel([...])` for multi-dot particle bursts
- **Spring press:** `Animated.spring(scaleAnim, { toValue, useNativeDriver: true })`
- **All animations:** `useNativeDriver: true` throughout for 60fps performance
- **New files:** `components/ParticleBurst.tsx`, `components/GlowRingPulse.tsx`, `components/StreakCounter.tsx`
- **Modified files:** `components/ScreenBackground.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/progress.tsx`, `app/(tabs)/plan.tsx`
