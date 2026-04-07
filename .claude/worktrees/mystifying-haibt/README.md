# Glow — AI Skincare App

Personalized skin analysis, routines, and recommendations powered by Claude AI.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (iOS & Android) |
| Routing | Expo Router (file-based) |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| AI | Claude claude-opus-4-6 via Supabase Edge Functions |
| Language | TypeScript throughout |

## Features

- **AI Skin Scan** — Take a selfie; Claude Vision identifies skin type, acne type, and severity
- **4-Pillar Plan** — Personalized plan: Products, Diet, Herbal Remedies, Lifestyle
- **Product Scanner** — Scan any product barcode to check ingredient compatibility
- **Weekly Progress** — Log weekly photos; AI tracks improvement and annotates zones
- **Routine Adaptation** — Plan evolves as skin improves

## Project Structure

```
glow/
├── app/
│   ├── _layout.tsx              # Root layout, auth redirect
│   ├── (auth)/
│   │   ├── login.tsx            # Login screen
│   │   ├── register.tsx         # Registration
│   │   └── onboarding.tsx       # 4-step onboarding wizard
│   └── (tabs)/
│       ├── index.tsx            # Home dashboard
│       ├── scan.tsx             # Face scan + AI analysis
│       ├── plan.tsx             # 4-pillar personalized plan
│       ├── scanner.tsx          # Barcode product scanner
│       └── progress.tsx         # Weekly progress tracking
├── components/
│   ├── GradientButton.tsx       # Brand gradient button
│   ├── LoadingOverlay.tsx       # Animated loading screen
│   ├── PillarCard.tsx           # Plan pillar card
│   ├── ProgressChart.tsx        # SVG severity line chart
│   └── SkinProfileCard.tsx      # Skin analysis result card
├── lib/
│   ├── supabase.ts              # Supabase client
│   ├── database.types.ts        # TypeScript DB types
│   └── theme.ts                 # Brand colors, typography, spacing
└── supabase/
    ├── config.toml              # Local dev config
    ├── migrations/
    │   └── 001_initial_schema.sql  # All tables, RLS, triggers
    └── functions/
        ├── analyze-skin/        # Claude Vision → skin analysis
        ├── generate-plan/       # Claude → 4-pillar plan
        ├── scan-product/        # Claude → ingredient check
        └── track-progress/      # Claude Vision → progress score
```

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo@latest`
- Supabase CLI: `brew install supabase/tap/supabase`
- Anthropic API key (from console.anthropic.com)

### 1. Install Dependencies

```bash
cd /Users/omer/glow
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy your **Project URL** and **anon key** from Settings → API

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Database Migration

In the Supabase Dashboard → SQL Editor, paste and run:
```
supabase/migrations/001_initial_schema.sql
```

Or via CLI:
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

### 5. Set Edge Function Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 6. Deploy Edge Functions

```bash
supabase functions deploy analyze-skin
supabase functions deploy generate-plan
supabase functions deploy scan-product
supabase functions deploy track-progress
```

### 7. Run the App

```bash
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android) or press `i` for iOS simulator / `a` for Android.

## Edge Functions

All AI processing runs in Supabase Edge Functions (Deno runtime), calling Claude directly.

| Function | Input | Output |
|---|---|---|
| `analyze-skin` | Base64 JPEG | `{skin_type, acne_type, severity, analysis_notes}` |
| `generate-plan` | `skin_profile_id` | Complete 4-pillar plan saved to DB |
| `scan-product` | `barcode, user_id` | `{verdict, reason, flagged_ingredients}` |
| `track-progress` | Base64 JPEG + `user_id` | `{severity_score, improvement_percentage, zones}` |

All functions use `claude-opus-4-6` with `thinking: { type: 'adaptive' }`.

## Database Schema

```
profiles          — user accounts, subscription tier
skin_profiles     — AI scan results
personalized_plans — 4-pillar plan (JSONB columns)
progress_photos   — weekly check-in photos + AI scores
product_scans     — barcode scan history + verdicts
onboarding_data   — age, acne history, allergies, concerns
```

All tables have Row Level Security (RLS) — users can only access their own data.

## Monetization

- **Free tier**: 1 skin scan, view plan, 3 product scans
- **Premium ($9.99/month)**: Unlimited scans, progress tracking, plan adaptation
- **Affiliate**: Product links with 8–15% commission

## Brand

- Primary: `#E8547A` (rose)
- Secondary: `#F5A623` (gold)
- Background: `#FFF0F5` (blush)
- Text: `#1A0A0F` (near-black)
