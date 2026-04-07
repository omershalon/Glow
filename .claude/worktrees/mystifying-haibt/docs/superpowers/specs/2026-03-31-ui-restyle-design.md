# UI Restyle Design — Glow
Date: 2026-03-31

## Overview
Full visual restyle of the Glow app to match provided mockups. Earth-tone design system replaces the current pink palette. All data wiring stays intact — only the visual layer changes. No new files or abstractions.

## Approach
Option C: Update `theme.ts` first to lock in new design tokens, then restyle each screen sequentially.

---

## 1. Design Tokens (lib/theme.ts)

| Token | Old | New |
|---|---|---|
| background | `#FFF0F5` (pink cream) | `#F2EDE4` (warm cream) |
| primary | `#E8547A` (rose) | `#2D4A3E` (forest green) |
| primaryDark | `#C43A60` | `#1E3329` |
| primaryLight | `#F07A99` | `#4A7A6A` |
| secondary / accent | `#F5A623` (amber) | `#C8573E` (terracotta) |
| card | `#FFFFFF` | `#EDE8DF` (cream card) |
| cardSubtle | `#FFF8FB` | `#E8E2D8` |
| subtle | `#F8D7E3` | `#DDD7CD` |
| text | `#1A0A0F` | `#1C1C1A` |
| textSecondary | `#7A4A57` | `#5A5A50` |
| textMuted | `#B08090` | `#8A8A7A` |
| border | `#F0D0DC` | `#D8D2C8` |
| borderLight | `#FAE8EF` | `#E8E2D8` |
| Shadows | pink-tinted | neutral gray `#1C1C1A` |

Success/warning/error colors remain the same.

---

## 2. Tab Bar (_layout.tsx)

- Replace emoji icons with Unicode line symbols:
  - Home: `⌂` → label "Home"
  - Plan: list icon (three lines) → label "Plan"
  - Scan: camera icon → label "Scan" (center, elevated orange circle)
  - Progress/Log: calendar icon → label "Log"
  - Products/Scanner: grid icon → label "Products"
- Center Scan button: terracotta (`#C8573E`) filled circle, elevated 20pt above bar, white camera symbol
- Inactive icons: `#8A8A7A`, active: `#2D4A3E` (or terracotta for center)
- Tab bar background: white, no colored shadow

---

## 3. Home Screen (app/(tabs)/index.tsx)

**Layout (top to bottom):**
1. Greeting row: "Good morning, [Name] 🌿" (body text) + profile initial circle (outlined, no gradient)
2. "Glow" — large bold title (fontSize 48, fontWeight 800, serif-adjacent)
3. **Skin Score Card** (dark green `#2D4A3E` bg):
   - "Skin score · Week X" label
   - Score number (large, white)
   - Pill tags: acne type · skin type (muted white text)
   - "Hormonal pattern" chip (dark outline) + "Improving ↑" chip (terracotta fill) — derived from `skin_profile`
   - Only shown when `skinProfile` exists
4. **"YOUR PLAN"** section label + 2×2 grid of pillar cards:
   - Each card: emoji icon, name, step count from `routine_items`, green progress bar
   - Tapping navigates to plan screen
   - Only shown when `plan` exists
5. **"AI INSIGHTS"** card:
   - Bullet points from `skin_profile.analysis_notes` (split by sentence or newline)
   - Green dot bullet, orange dot bullet alternating
   - Only shown when `skinProfile` exists and `analysis_notes` is non-empty
6. If no skin profile: single CTA card to start scan
7. No premium banner (removed from this screen)

---

## 4. Plan Screen (app/(tabs)/plan.tsx)

**Header:**
- Subtitle: `[ACNE_TYPE] · [SKIN_TYPE]` in small caps (from skin profile)
- Title: "Your plan"
- Tabs: "Picks" | "My Routine (N)" — same segmented control, dark green active

**Picks tab:**
- Sections grouped by pillar (Skincare / Diet / Herbal / Lifestyle)
- Each section: emoji + pillar label header, then rows
- Each row: title + subtitle (rationale, truncated), right side: dark green checkmark circle if added, `+` circle if not
- Tapping row still opens detail modal

**My Routine tab:**
- "Today's Routine" + "X of Y completed" + progress ring (top right)
- Sections grouped by pillar (same headers)
- Each row: circular checkbox (filled green when done, strikethrough title), × to remove
- "＋ Add more from Picks" link at bottom

---

## 5. Progress Screen (app/(tabs)/progress.tsx)

**Header:** "Progress log" title + "Track your journey week by week" subtitle. No gradient.

**Calendar:**
- Month nav: `‹` / `›` arrows, month title
- Day cells: dark green filled circle for logged days, terracotta outline circle for today, plain number otherwise
- Tapping a logged day opens the existing detail modal

**Below calendar (when ≥2 photos):**
- Section label "WEEK X COMPARISON" (current week)
- Two cards side by side: first photo (Week 1 · date) and latest photo (Week X · Today)
- Photos show actual images from Supabase storage
- Metric rows below: "Inflammatory lesions ↓ X%" and "Redness score ↓ X%" from `improvement_percentage` and `severity_score` delta — only shown when real data exists

---

## 6. Scan Screen (app/(tabs)/scan.tsx)

**Pre-scan state (no photo yet):**
- Full dark background (`#1C1C1A`)
- Face oval in center with corner bracket markers
- Dot annotations (decorative, static — actual dots come from analysis result)
- Instruction text: "Find good lighting — face a window or bright light"
- Three status dots at bottom: "Good lighting" / "Hair back" / "Neutral face"
- Bottom controls: flip camera icon (left), large white shutter button (center), gallery icon (right)
- Back arrow top-left, "Skin Scan" title top-center

**Post-scan results state ("Your skin analysis"):**
- Back arrow header
- Face map section (dark bg card): face oval with zone label chips (Forehead, Jawline, etc.), tap to toggle zones
- Stats row: SKIN TYPE / ACNE TYPE / SEVERITY
- Dark green score card: "SKIN SCORE" + number, "Out of 100 · [severity]", Lesion count + Redness sub-cards
- "WHAT'S CAUSING YOUR ACNE" section: bullet list from `analysis_notes` with colored dots
- Severity warning card (terracotta border) if moderate/severe
- Dark green CTA button: "View your personalized plan · Products · Diet · Herbal · Lifestyle"

---

## 7. Products/Scanner Screen (app/(tabs)/scanner.tsx)

**Header:** "Discover" title + "Matched to your skin profile" subtitle.

**Search bar** (existing `manualBarcode` input repurposed visually): rounded pill, search icon left, grid toggle button right (terracotta).

**Category filter chips:** All / Cleanser / Serum / SPF / Moisturiser — horizontal scroll, dark green active chip.

**Product grid (2 columns):**
- Scan history items rendered as product cards with match % badge (top-left, green if >80%, orange if 60-80%)
- Card: cream bg, product emoji/icon, brand name (small caps), product name
- "Scan Barcode" button at top to trigger camera (keeps existing functionality)

**Color overhaul:** All pink references → new palette.

---

## Constraints
- No new files
- No changes to data fetching, Supabase queries, or business logic
- System fonts only
- All conditional rendering based on real data (no placeholders when data is absent)
