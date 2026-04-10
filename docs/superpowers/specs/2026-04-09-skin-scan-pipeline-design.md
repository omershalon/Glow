# Skin Scan Pipeline — Design Spec

## Overview

Full skin-scan pipeline combining on-device YOLO object detection with Gemini AI review. The pipeline captures 3 facial images (front, left, right), runs an Ultralytics YOLO model on-device for acne detection, sends results to Gemini for review and analysis, then displays comprehensive results with skincare recommendations.

## Core Constraints

- **Ultralytics model runs on-device** — not through a hosted API
- **Model config**: `imgsz=1280`, `conf=0.2`
- **3 images per session**: front, left side, right side
- **Ultralytics is the primary detector** — Gemini is the review + explanation layer
- **Gemini may add missed spots**, correct misclassifications only when fully certain, otherwise keep YOLO results unchanged
- **Cross-platform**: iOS + Android

## Detection Classes

6 acne/skin classes, ordered by model training index:

| Index | Class       |
|-------|-------------|
| 0     | blackheads  |
| 1     | dark spot   |
| 2     | nodules     |
| 3     | papules     |
| 4     | pustules    |
| 5     | whiteheads  |

## Architecture

### Pipeline Flow

```
Capture 3 photos (front, left, right)
        │
        ▼
Run YOLO on each image (on-device, native module)
        │
        ▼
Collect detections per image (bbox, class, confidence)
        │
        ▼
Upload originals (base64) + detection JSON to Edge Function
        │
        ▼
Edge Function sends to Gemini API:
  - 3 original images
  - Structured detection JSON per image
  - Review instructions
        │
        ▼
Gemini returns:
  - Reviewed/augmented detections
  - Overall skin analysis
  - Zone breakdown
  - Skin insights
  - Skincare plan + product recommendations
        │
        ▼
Store in database, return to app
        │
        ▼
Display results with SVG bounding box overlays
```

### Component Breakdown

#### 1. Expo Native Module: `yolo-detector`

Location: `modules/yolo-detector/`

**Purpose**: Run YOLO inference on-device using platform-native ML frameworks.

**Model formats**:
- iOS: CoreML (`.mlpackage`) — uses Apple Neural Engine / GPU
- Android: TFLite (`.tflite`) — uses GPU delegate / NNAPI

**Model conversion** (one-time build step):
```bash
# iOS
yolo export model=yolo26m1280.pt format=coreml imgsz=1280

# Android
yolo export model=yolo26m1280.pt format=tflite imgsz=1280
```

**Module structure**:
```
modules/yolo-detector/
├── expo-module.config.json
├── index.ts                    # JS API
├── src/
│   └── YoloDetectorModule.ts   # TypeScript definitions
├── ios/
│   ├── YoloDetectorModule.swift    # CoreML inference
│   └── ImagePreprocessor.swift     # Image → CVPixelBuffer
├── android/
│   ├── YoloDetectorModule.kt      # TFLite inference
│   └── ImagePreprocessor.kt       # Image → ByteBuffer
└── models/                     # Converted model files (gitignored, bundled at build)
    ├── yolo-acne.mlpackage     # iOS
    └── yolo-acne.tflite        # Android
```

**JS API**:
```typescript
interface Detection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] in pixels
  classIndex: number;                      // 0-5
  className: string;                       // e.g. "papules"
  confidence: number;                      // 0.0-1.0
}

interface DetectionResult {
  detections: Detection[];
  imageWidth: number;
  imageHeight: number;
  inferenceTimeMs: number;
}

// Run detection on a single image
function detect(imageUri: string): Promise<DetectionResult>;
```

**Native implementation details**:

iOS (Swift + CoreML):
1. Load image from URI using `UIImage`
2. Resize to 1280×1280 using `vImage` or Core Graphics
3. Convert to `CVPixelBuffer` (RGB, float32, normalized 0-1)
4. Run CoreML prediction
5. Post-process: decode YOLO output grid → boxes, apply NMS (IoU threshold 0.45, max 300 detections), filter by conf ≥ 0.2
6. Return Detection array to JS via Expo Modules bridge

Android (Kotlin + TFLite):
1. Load image from URI using `BitmapFactory`
2. Resize to 1280×1280
3. Convert to `ByteBuffer` (RGB, float32, normalized 0-1)
4. Run TFLite interpreter inference
5. Post-process: decode YOLO output → boxes, NMS (IoU threshold 0.45, max 300 detections), filter by conf ≥ 0.2
6. Return Detection array to JS via Expo Modules bridge

**Model bundling**: Model files are included in the native app bundle:
- iOS: added to Xcode project resources
- Android: placed in `assets/` directory
- Files are gitignored; included via build configuration

#### 2. Supabase Edge Function: `gemini-review-scan`

Location: `supabase/functions/gemini-review-scan/index.ts`

**Input payload**:
```typescript
{
  user_id: string;
  images: {
    front: string;   // base64
    left: string;    // base64
    right: string;   // base64
  };
  detections: {
    front: Detection[];
    left: Detection[];
    right: Detection[];
  };
  image_dimensions: {
    front: { width: number; height: number };
    left: { width: number; height: number };
    right: { width: number; height: number };
  };
}
```

**Gemini prompt structure**:

The prompt sends Gemini:
1. The 3 original images as inline image parts
2. Structured detection JSON showing what the model found per image
3. Instructions:
   - Review each detection for accuracy
   - Identify spots/types the model missed (the model rarely has false positives but sometimes misses spots)
   - Correct misclassifications only when fully certain
   - Otherwise keep model results unchanged
   - Generate overall analysis, zone breakdown, insights, plan

**Gemini response schema** (structured JSON output):
```typescript
{
  reviewed_detections: {
    front: ReviewedDetection[];
    left: ReviewedDetection[];
    right: ReviewedDetection[];
  };
  summary: {
    severity: "mild" | "moderate" | "severe";
    severity_score: number;          // 0-100
    total_spots: number;
    confirmed_spots: number;         // model detections kept
    ai_added_spots: number;          // new spots Gemini found
    ai_corrected_spots: number;      // model detections Gemini changed
    primary_acne_type: string;
    description: string;             // 2-3 sentence overview
  };
  zone_breakdown: {
    zone: string;                    // "chin", "forehead", "left_cheek", etc.
    spot_count: number;
    primary_types: string[];
    severity: string;
    note: string;                    // brief insight
  }[];
  skin_insights: {
    skin_type: string;
    moisture: string;
    key_observations: string[];
  };
  recommendations: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    category: "product" | "lifestyle" | "professional";
    product_keywords?: string[];     // for matching to product catalog
  }[];
  skin_plan: {
    morning_routine: { step: string; product_type: string; reason: string }[];
    evening_routine: { step: string; product_type: string; reason: string }[];
    weekly_treatments: { treatment: string; frequency: string; reason: string }[];
  };
}
```

Where `ReviewedDetection` extends the model Detection:
```typescript
interface ReviewedDetection {
  bbox: [number, number, number, number];
  classIndex: number;
  className: string;
  confidence: number;
  source: "model" | "ai";              // who detected it
  status: "confirmed" | "added" | "corrected" | "removed";
  original_class?: string;              // if corrected, what the model said
  ai_confidence?: "high" | "medium";    // Gemini's certainty
}
```

**Product catalog integration**: After Gemini returns recommendations with `product_keywords`, the Edge Function queries the existing product catalog to match specific products. These matched products are included in the response under a `matched_products` field.

**Gemini model**: `gemini-2.0-flash` — fast multimodal model with vision support, good balance of speed and quality for review tasks.

**Secrets required**: `GEMINI_API_KEY` (already in Supabase secrets)

#### 3. Database Schema

New migration: `supabase/migrations/004_scan_sessions.sql`

```sql
CREATE TABLE scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Images (Supabase Storage URLs)
  front_image_url TEXT NOT NULL,
  left_image_url TEXT NOT NULL,
  right_image_url TEXT NOT NULL,

  -- Model detections (raw YOLO output)
  model_detections JSONB NOT NULL,

  -- Gemini review results
  reviewed_detections JSONB,
  
  -- Summary
  severity severity_enum,
  severity_score INTEGER CHECK (severity_score BETWEEN 0 AND 100),
  total_spots INTEGER,
  confirmed_spots INTEGER,
  ai_added_spots INTEGER,
  primary_acne_type TEXT,
  description TEXT,

  -- Detailed results
  zone_breakdown JSONB,
  skin_insights JSONB,
  recommendations JSONB,
  skin_plan JSONB,
  matched_products JSONB,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed'))
);

-- RLS
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans"
  ON scan_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans"
  ON scan_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans"
  ON scan_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_scan_sessions_user_id ON scan_sessions(user_id);
CREATE INDEX idx_scan_sessions_created_at ON scan_sessions(created_at DESC);
```

Also update the `skin-photos` storage bucket policy to allow scan images.

#### 4. App Screens

**Modified: `app/(tabs)/scan.tsx`**

New multi-image capture flow:
1. Show camera with guide overlay (face outline)
2. Step indicator: "Front" → "Left Side" → "Right Side"
3. After each capture, show preview with retake option
4. After all 3, show "Analyze" button
5. On analyze: run YOLO on each image, then call edge function
6. Show processing screen with progress steps

**New: `app/scan-results.tsx`** (non-tab route, navigated to from scan screen)

Results display screen:
- Header with date and share button
- View toggle tabs: Front / Left / Right
- Image viewer with SVG bounding box overlays (color-coded by class)
- Legend showing model-detected vs AI-identified
- Severity summary card (score, description, severity bar)
- Confirmed/AI-flagged spot counts
- Zone breakdown cards (scrollable horizontal)
- Skin insights grid
- Recommendations list
- "Build My Skin Plan" CTA button

**Bounding box visualization**: SVG overlay positioned absolutely over the image. Each detection rendered as a colored rectangle with label. Colors per class:
- Papules: red (#F87171)
- Pustules: amber (#FCD34D)
- Blackheads: gray (#9CA3AF)
- Whiteheads: purple (#C4B5FD)
- Nodules: pink (#F472B6)
- Dark spots: brown (#D97706)

Model detections shown with solid borders, AI-added shown with dashed borders.

#### 5. JS Utilities

**`lib/scan-types.ts`**: All TypeScript interfaces for the pipeline (Detection, DetectionResult, ScanSession, GeminiResponse, etc.)

**`lib/yolo.ts`**: Thin wrapper around the native module that:
- Calls `YoloDetector.detect()` for each image
- Aggregates results
- Handles errors gracefully

**`lib/scan-api.ts`**: Functions to:
- Upload images to Supabase Storage
- Call the `gemini-review-scan` edge function
- Parse and validate the response
- Save results to database

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `modules/yolo-detector/expo-module.config.json` | Module config |
| `modules/yolo-detector/index.ts` | JS entry point |
| `modules/yolo-detector/src/YoloDetectorModule.ts` | TS definitions |
| `modules/yolo-detector/ios/YoloDetectorModule.swift` | CoreML inference |
| `modules/yolo-detector/ios/ImagePreprocessor.swift` | Image preprocessing |
| `modules/yolo-detector/android/YoloDetectorModule.kt` | TFLite inference |
| `modules/yolo-detector/android/ImagePreprocessor.kt` | Image preprocessing |
| `supabase/functions/gemini-review-scan/index.ts` | Edge function |
| `supabase/migrations/004_scan_sessions.sql` | DB migration |
| `app/scan-results.tsx` | Results screen |
| `lib/scan-types.ts` | Pipeline types |
| `lib/yolo.ts` | Native module wrapper |
| `lib/scan-api.ts` | API layer for scans |

### Modified Files
| File | Change |
|------|--------|
| `app/(tabs)/scan.tsx` | Multi-image capture flow |
| `lib/database.types.ts` | Add scan_sessions types |
| `app.json` | Native module plugin config |
| `supabase/config.toml` | Add gemini-review-scan function config |

## Secrets & Environment

| Secret | Location | Status |
|--------|----------|--------|
| `GEMINI_API_KEY` | Supabase Edge Function secrets | Already configured |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env.local` | Already configured |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Already configured |

## Model File Location

- Source: `Glow/yolo26m1280.pt` (PyTorch, not used at runtime)
- iOS build: `modules/yolo-detector/ios/models/yolo-acne.mlpackage`
- Android build: `modules/yolo-detector/android/src/main/assets/yolo-acne.tflite`

Conversion commands:
```bash
yolo export model=yolo26m1280.pt format=coreml imgsz=1280 nms
yolo export model=yolo26m1280.pt format=tflite imgsz=1280
```

## Testing

1. Convert model and place in module directories
2. Build dev client: `npx expo prebuild && npx expo run:ios` / `run:android`
3. Navigate to Scan tab, capture 3 photos
4. Verify YOLO detections appear in console logs
5. Verify Edge Function receives data and returns Gemini analysis
6. Verify results screen displays detections with overlays

## Open Items

- Model conversion quality should be validated — compare CoreML/TFLite output against PyTorch on the same test images to ensure no accuracy loss
- YOLO post-processing (NMS) parameters may need tuning after conversion
- App size increase from bundled models needs measurement
- Gemini token usage per scan should be monitored for cost
