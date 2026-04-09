# Skin Scan Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an on-device YOLO + Gemini AI skin-scan pipeline that captures 3 facial photos, detects acne spots locally, sends results to Gemini for review/analysis, and displays comprehensive results.

**Architecture:** Expo native module wraps CoreML (iOS) and TFLite (Android) for on-device YOLO inference. A Supabase Edge Function calls Gemini to review detections, generate analysis, and recommend products. The scan screen captures 3 images (front/left/right), runs local detection, calls the edge function, and displays results on a dedicated screen.

**Tech Stack:** Expo (React Native), Expo Modules API (Swift/Kotlin), CoreML, TFLite, Supabase Edge Functions (Deno), Google Gemini API, react-native-svg

---

## File Structure

```
New files:
  modules/yolo-detector/
    expo-module.config.json          # Expo module registration
    index.ts                         # JS entry point
    src/YoloDetectorModule.ts        # TS type definitions for native module
    ios/YoloDetectorModule.swift     # CoreML inference + NMS
    ios/ExpoModuleConfig.swift       # Module registration (iOS)
    android/build.gradle             # TFLite dependency
    android/src/main/java/expo/modules/yolodetector/
      YoloDetectorModule.kt          # TFLite inference + NMS
  lib/scan-types.ts                  # All pipeline TS types
  lib/yolo.ts                        # JS wrapper around native module
  lib/scan-api.ts                    # Upload images, call edge function, save results
  supabase/functions/gemini-review-scan/index.ts   # Edge function
  supabase/migrations/004_scan_sessions.sql        # New table
  app/scan-results.tsx               # Results display screen

Modified files:
  app/(tabs)/scan.tsx                # Replace with 3-image capture flow
  lib/database.types.ts              # Add ScanSession types
  app.json                           # Add native module plugin
  supabase/config.toml               # Register new edge function
```

---

## Task 1: Pipeline Types

**Files:**
- Create: `lib/scan-types.ts`

- [ ] **Step 1: Create the types file**

Create `lib/scan-types.ts` with all pipeline types:

```typescript
// ── Detection classes ──

export const ACNE_CLASSES = [
  'blackheads',
  'dark spot',
  'nodules',
  'papules',
  'pustules',
  'whiteheads',
] as const;

export type AcneClass = (typeof ACNE_CLASSES)[number];

// ── YOLO detection output ──

export interface Detection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] in pixels
  classIndex: number;
  className: AcneClass;
  confidence: number;
}

export interface DetectionResult {
  detections: Detection[];
  imageWidth: number;
  imageHeight: number;
  inferenceTimeMs: number;
}

// ── Gemini-reviewed detection ──

export interface ReviewedDetection {
  bbox: [number, number, number, number];
  classIndex: number;
  className: string;
  confidence: number;
  source: 'model' | 'ai';
  status: 'confirmed' | 'added' | 'corrected' | 'removed';
  originalClass?: string;
  aiConfidence?: 'high' | 'medium';
}

// ── Image set ──

export type ViewAngle = 'front' | 'left' | 'right';

export interface CapturedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

export type ImageSet = Record<ViewAngle, CapturedImage>;

// ── Edge function request/response ──

export interface ScanRequest {
  user_id: string;
  images: Record<ViewAngle, string>; // base64
  detections: Record<ViewAngle, Detection[]>;
  image_dimensions: Record<ViewAngle, { width: number; height: number }>;
}

export interface ZoneBreakdown {
  zone: string;
  spot_count: number;
  primary_types: string[];
  severity: string;
  note: string;
}

export interface SkinInsights {
  skin_type: string;
  moisture: string;
  key_observations: string[];
}

export interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'product' | 'lifestyle' | 'professional';
  product_keywords?: string[];
}

export interface SkinPlanRoutineStep {
  step: string;
  product_type: string;
  reason: string;
}

export interface SkinPlanWeeklyTreatment {
  treatment: string;
  frequency: string;
  reason: string;
}

export interface SkinPlan {
  morning_routine: SkinPlanRoutineStep[];
  evening_routine: SkinPlanRoutineStep[];
  weekly_treatments: SkinPlanWeeklyTreatment[];
}

export interface ScanSummary {
  severity: 'mild' | 'moderate' | 'severe';
  severity_score: number;
  total_spots: number;
  confirmed_spots: number;
  ai_added_spots: number;
  ai_corrected_spots: number;
  primary_acne_type: string;
  description: string;
}

export interface GeminiResponse {
  reviewed_detections: Record<ViewAngle, ReviewedDetection[]>;
  summary: ScanSummary;
  zone_breakdown: ZoneBreakdown[];
  skin_insights: SkinInsights;
  recommendations: Recommendation[];
  skin_plan: SkinPlan;
}

export interface ScanResponse extends GeminiResponse {
  session_id: string;
  matched_products?: any[];
}

// ── Scan session (database row) ──

export interface ScanSession {
  id: string;
  user_id: string;
  created_at: string;
  front_image_url: string;
  left_image_url: string;
  right_image_url: string;
  model_detections: Record<ViewAngle, Detection[]>;
  reviewed_detections: Record<ViewAngle, ReviewedDetection[]> | null;
  severity: 'mild' | 'moderate' | 'severe' | null;
  severity_score: number | null;
  total_spots: number | null;
  confirmed_spots: number | null;
  ai_added_spots: number | null;
  primary_acne_type: string | null;
  description: string | null;
  zone_breakdown: ZoneBreakdown[] | null;
  skin_insights: SkinInsights | null;
  recommendations: Recommendation[] | null;
  skin_plan: SkinPlan | null;
  matched_products: any[] | null;
  status: 'processing' | 'completed' | 'failed';
}

// ── Bounding box colors ──

export const CLASS_COLORS: Record<string, string> = {
  papules: '#F87171',
  pustules: '#FCD34D',
  blackheads: '#9CA3AF',
  whiteheads: '#C4B5FD',
  nodules: '#F472B6',
  'dark spot': '#D97706',
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/scan-types.ts
git commit -m "feat(scan): add pipeline type definitions"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/004_scan_sessions.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/004_scan_sessions.sql`:

```sql
-- Scan sessions table for YOLO + Gemini pipeline
CREATE TABLE scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Images (Supabase Storage URLs)
  front_image_url TEXT NOT NULL,
  left_image_url TEXT NOT NULL,
  right_image_url TEXT NOT NULL,

  -- Model detections (raw YOLO output per view angle)
  model_detections JSONB NOT NULL DEFAULT '{}'::jsonb,

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

-- Indexes
CREATE INDEX idx_scan_sessions_user_id ON scan_sessions(user_id);
CREATE INDEX idx_scan_sessions_created_at ON scan_sessions(created_at DESC);
```

- [ ] **Step 2: Update database types**

Add the ScanSession table definition to `lib/database.types.ts`. Add this inside the `Tables` object after the `onboarding_data` block (before the closing `};` of Tables):

```typescript
      scan_sessions: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          front_image_url: string;
          left_image_url: string;
          right_image_url: string;
          model_detections: Record<string, any>;
          reviewed_detections: Record<string, any> | null;
          severity: import('./scan-types').ScanSummary['severity'] | null;
          severity_score: number | null;
          total_spots: number | null;
          confirmed_spots: number | null;
          ai_added_spots: number | null;
          primary_acne_type: string | null;
          description: string | null;
          zone_breakdown: any[] | null;
          skin_insights: Record<string, any> | null;
          recommendations: any[] | null;
          skin_plan: Record<string, any> | null;
          matched_products: any[] | null;
          status: 'processing' | 'completed' | 'failed';
        };
        Insert: {
          id?: string;
          user_id: string;
          front_image_url: string;
          left_image_url: string;
          right_image_url: string;
          model_detections: Record<string, any>;
          status?: 'processing' | 'completed' | 'failed';
        };
        Update: {
          reviewed_detections?: Record<string, any>;
          severity?: string;
          severity_score?: number;
          total_spots?: number;
          confirmed_spots?: number;
          ai_added_spots?: number;
          primary_acne_type?: string;
          description?: string;
          zone_breakdown?: any[];
          skin_insights?: Record<string, any>;
          recommendations?: any[];
          skin_plan?: Record<string, any>;
          matched_products?: any[];
          status?: 'processing' | 'completed' | 'failed';
        };
        Relationships: [];
      };
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_scan_sessions.sql lib/database.types.ts
git commit -m "feat(scan): add scan_sessions table and types"
```

---

## Task 3: Expo Native Module — Scaffolding + JS Interface

**Files:**
- Create: `modules/yolo-detector/expo-module.config.json`
- Create: `modules/yolo-detector/index.ts`
- Create: `modules/yolo-detector/src/YoloDetectorModule.ts`

- [ ] **Step 1: Create module config**

Create `modules/yolo-detector/expo-module.config.json`:

```json
{
  "platforms": ["ios", "android"],
  "ios": {
    "modules": ["YoloDetectorModule"]
  },
  "android": {
    "modules": ["expo.modules.yolodetector.YoloDetectorModule"]
  }
}
```

- [ ] **Step 2: Create TypeScript module definition**

Create `modules/yolo-detector/src/YoloDetectorModule.ts`:

```typescript
import { requireNativeModule } from 'expo-modules-core';

interface NativeDetection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  classIndex: number;
  className: string;
  confidence: number;
}

interface NativeDetectionResult {
  detections: NativeDetection[];
  imageWidth: number;
  imageHeight: number;
  inferenceTimeMs: number;
}

interface YoloDetectorModuleType {
  detect(imageUri: string, confidenceThreshold: number): Promise<NativeDetectionResult>;
}

export default requireNativeModule<YoloDetectorModuleType>('YoloDetector');
```

- [ ] **Step 3: Create JS entry point**

Create `modules/yolo-detector/index.ts`:

```typescript
import YoloDetectorModule from './src/YoloDetectorModule';
import type { Detection, DetectionResult } from '@/lib/scan-types';
import { ACNE_CLASSES } from '@/lib/scan-types';

const CONFIDENCE_THRESHOLD = 0.2;

export async function detect(imageUri: string): Promise<DetectionResult> {
  const result = await YoloDetectorModule.detect(imageUri, CONFIDENCE_THRESHOLD);

  const detections: Detection[] = result.detections.map((d) => ({
    bbox: [d.x1, d.y1, d.x2, d.y2] as [number, number, number, number],
    classIndex: d.classIndex,
    className: ACNE_CLASSES[d.classIndex] ?? 'unknown',
    confidence: d.confidence,
  }));

  return {
    detections,
    imageWidth: result.imageWidth,
    imageHeight: result.imageHeight,
    inferenceTimeMs: result.inferenceTimeMs,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add modules/yolo-detector/
git commit -m "feat(scan): scaffold yolo-detector Expo native module"
```

---

## Task 4: Expo Native Module — iOS (CoreML)

**Files:**
- Create: `modules/yolo-detector/ios/YoloDetectorModule.swift`

The model file `yolo-acne.mlpackage` must be placed in the iOS project resources after conversion. The Swift module loads it, preprocesses images to 1280x1280, runs inference, applies NMS (IoU 0.45), and returns detections.

- [ ] **Step 1: Create the Swift module**

Create `modules/yolo-detector/ios/YoloDetectorModule.swift`:

```swift
import ExpoModulesCore
import CoreML
import Vision
import UIKit
import Accelerate

public class YoloDetectorModule: Module {
  private var model: VNCoreMLModel?

  public func definition() -> ModuleDefinition {
    Name("YoloDetector")

    AsyncFunction("detect") { (imageUri: String, confidenceThreshold: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.runDetection(imageUri: imageUri, confidenceThreshold: Float(confidenceThreshold), promise: promise)
      }
    }
  }

  private func getModel() throws -> VNCoreMLModel {
    if let cached = model { return cached }

    guard let modelURL = Bundle.main.url(forResource: "yolo-acne", withExtension: "mlmodelc") else {
      // Try mlpackage
      guard let pkgURL = Bundle.main.url(forResource: "yolo-acne", withExtension: "mlpackage") else {
        throw NSError(domain: "YoloDetector", code: 1, userInfo: [NSLocalizedDescriptionKey: "Model file not found in bundle"])
      }
      let compiledURL = try MLModel.compileModel(at: pkgURL)
      let mlModel = try MLModel(contentsOf: compiledURL)
      let vnModel = try VNCoreMLModel(for: mlModel)
      self.model = vnModel
      return vnModel
    }

    let mlModel = try MLModel(contentsOf: modelURL)
    let vnModel = try VNCoreMLModel(for: mlModel)
    self.model = vnModel
    return vnModel
  }

  private func runDetection(imageUri: String, confidenceThreshold: Float, promise: Promise) {
    let startTime = CFAbsoluteTimeGetCurrent()

    // Load image
    guard let image = loadImage(from: imageUri) else {
      promise.reject("ERR_IMAGE", "Could not load image from URI: \(imageUri)")
      return
    }

    guard let cgImage = image.cgImage else {
      promise.reject("ERR_IMAGE", "Could not get CGImage")
      return
    }

    let imageWidth = cgImage.width
    let imageHeight = cgImage.height

    do {
      let vnModel = try getModel()

      let request = VNCoreMLRequest(model: vnModel) { request, error in
        if let error = error {
          promise.reject("ERR_INFERENCE", "Inference failed: \(error.localizedDescription)")
          return
        }

        let inferenceTime = (CFAbsoluteTimeGetCurrent() - startTime) * 1000

        guard let results = request.results as? [VNRecognizedObjectObservation] else {
          promise.resolve([
            "detections": [] as [[String: Any]],
            "imageWidth": imageWidth,
            "imageHeight": imageHeight,
            "inferenceTimeMs": inferenceTime
          ])
          return
        }

        let classNames = ["blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads"]
        var detections: [[String: Any]] = []

        for observation in results {
          guard let topLabel = observation.labels.first,
                observation.confidence >= confidenceThreshold else { continue }

          let classIndex = classNames.firstIndex(of: topLabel.identifier) ?? -1

          // VNRecognizedObjectObservation bbox is normalized with origin at bottom-left
          let box = observation.boundingBox
          let x1 = box.origin.x * CGFloat(imageWidth)
          let y1 = (1.0 - box.origin.y - box.height) * CGFloat(imageHeight)
          let x2 = (box.origin.x + box.width) * CGFloat(imageWidth)
          let y2 = (1.0 - box.origin.y) * CGFloat(imageHeight)

          detections.append([
            "x1": Double(x1),
            "y1": Double(y1),
            "x2": Double(x2),
            "y2": Double(y2),
            "classIndex": classIndex,
            "className": topLabel.identifier,
            "confidence": Double(observation.confidence)
          ])
        }

        promise.resolve([
          "detections": detections,
          "imageWidth": imageWidth,
          "imageHeight": imageHeight,
          "inferenceTimeMs": inferenceTime
        ])
      }

      request.imageCropAndScaleOption = .scaleFill

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])

    } catch {
      promise.reject("ERR_MODEL", "Model error: \(error.localizedDescription)")
    }
  }

  private func loadImage(from uri: String) -> UIImage? {
    if uri.hasPrefix("file://") || uri.hasPrefix("/") {
      let path = uri.hasPrefix("file://") ? String(uri.dropFirst(7)) : uri
      return UIImage(contentsOfFile: path)
    }
    guard let url = URL(string: uri), let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/yolo-detector/ios/
git commit -m "feat(scan): add iOS CoreML YOLO inference module"
```

---

## Task 5: Expo Native Module — Android (TFLite)

**Files:**
- Create: `modules/yolo-detector/android/build.gradle`
- Create: `modules/yolo-detector/android/src/main/java/expo/modules/yolodetector/YoloDetectorModule.kt`

- [ ] **Step 1: Create Android build.gradle**

Create `modules/yolo-detector/android/build.gradle`:

```gradle
apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'
apply plugin: 'maven-publish'

group = 'expo.modules.yolodetector'
version = '0.1.0'

android {
  namespace "expo.modules.yolodetector"
  compileSdkVersion safeExtGet("compileSdkVersion", 34)

  defaultConfig {
    minSdkVersion safeExtGet("minSdkVersion", 24)
    targetSdkVersion safeExtGet("targetSdkVersion", 34)
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  aaptOptions {
    noCompress "tflite"
  }
}

dependencies {
  implementation project(':expo-modules-core')
  implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:${safeExtGet('kotlinVersion', '1.9.24')}"
  implementation "org.tensorflow:tensorflow-lite:2.14.0"
  implementation "org.tensorflow:tensorflow-lite-gpu:2.14.0"
  implementation "org.tensorflow:tensorflow-lite-support:0.4.4"
}

def safeExtGet(prop, fallback) {
  rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}
```

- [ ] **Step 2: Create the Kotlin module**

Create directory structure first, then create `modules/yolo-detector/android/src/main/java/expo/modules/yolodetector/YoloDetectorModule.kt`:

```kotlin
package expo.modules.yolodetector

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.max
import kotlin.math.min

class YoloDetectorModule : Module() {
    private var interpreter: Interpreter? = null
    private val classNames = arrayOf("blackheads", "dark spot", "nodules", "papules", "pustules", "whiteheads")
    private val inputSize = 1280
    private val numClasses = 6
    private val iouThreshold = 0.45f

    override fun definition() = ModuleDefinition {
        Name("YoloDetector")

        AsyncFunction("detect") { imageUri: String, confidenceThreshold: Double, promise: Promise ->
            Thread {
                try {
                    runDetection(imageUri, confidenceThreshold.toFloat(), promise)
                } catch (e: Exception) {
                    promise.reject("ERR_DETECTION", e.message ?: "Detection failed", e)
                }
            }.start()
        }
    }

    private fun getInterpreter(): Interpreter {
        interpreter?.let { return it }

        val context = appContext.reactContext ?: throw Exception("React context not available")
        val modelBuffer = loadModelFile(context)

        val options = Interpreter.Options().apply {
            setNumThreads(4)
            try {
                addDelegate(GpuDelegate())
            } catch (e: Exception) {
                // GPU not available, fall back to CPU
            }
        }

        val interp = Interpreter(modelBuffer, options)
        interpreter = interp
        return interp
    }

    private fun loadModelFile(context: android.content.Context): MappedByteBuffer {
        val assetFd = context.assets.openFd("yolo-acne.tflite")
        val inputStream = FileInputStream(assetFd.fileDescriptor)
        val fileChannel = inputStream.channel
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, assetFd.startOffset, assetFd.declaredLength)
    }

    private fun runDetection(imageUri: String, confidenceThreshold: Float, promise: Promise) {
        val startTime = System.currentTimeMillis()

        // Load image
        val bitmap = loadBitmap(imageUri)
            ?: return promise.reject("ERR_IMAGE", "Could not load image from URI: $imageUri")

        val imageWidth = bitmap.width
        val imageHeight = bitmap.height

        // Resize to input size
        val resized = Bitmap.createScaledBitmap(bitmap, inputSize, inputSize, true)

        // Preprocess: convert to float32 RGB normalized [0, 1]
        val inputBuffer = ByteBuffer.allocateDirect(1 * 3 * inputSize * inputSize * 4).apply {
            order(ByteOrder.nativeOrder())
        }

        val pixels = IntArray(inputSize * inputSize)
        resized.getPixels(pixels, 0, inputSize, 0, 0, inputSize, inputSize)

        // YOLO expects CHW format: [1, 3, 1280, 1280]
        val rChannel = FloatArray(inputSize * inputSize)
        val gChannel = FloatArray(inputSize * inputSize)
        val bChannel = FloatArray(inputSize * inputSize)

        for (i in pixels.indices) {
            val pixel = pixels[i]
            rChannel[i] = ((pixel shr 16) and 0xFF) / 255.0f
            gChannel[i] = ((pixel shr 8) and 0xFF) / 255.0f
            bChannel[i] = (pixel and 0xFF) / 255.0f
        }

        for (v in rChannel) inputBuffer.putFloat(v)
        for (v in gChannel) inputBuffer.putFloat(v)
        for (v in bChannel) inputBuffer.putFloat(v)

        inputBuffer.rewind()

        // Run inference
        val interp = getInterpreter()

        // YOLO output shape: [1, numClasses + 4, numDetections]
        val outputShape = interp.getOutputTensor(0).shape()
        val numAttrs = outputShape[1]  // 4 + numClasses = 10
        val numDetections = outputShape[2]

        val outputBuffer = Array(1) { Array(numAttrs) { FloatArray(numDetections) } }
        interp.run(inputBuffer, outputBuffer)

        val inferenceTime = System.currentTimeMillis() - startTime

        // Post-process: decode detections
        val rawDetections = mutableListOf<FloatArray>() // [x1, y1, x2, y2, classIndex, confidence]
        val output = outputBuffer[0]

        for (i in 0 until numDetections) {
            val cx = output[0][i]
            val cy = output[1][i]
            val w = output[2][i]
            val h = output[3][i]

            // Find best class
            var maxScore = 0f
            var maxIdx = 0
            for (c in 0 until numClasses) {
                val score = output[4 + c][i]
                if (score > maxScore) {
                    maxScore = score
                    maxIdx = c
                }
            }

            if (maxScore < confidenceThreshold) continue

            // Convert from center format to corner format, scaled to original image
            val scaleX = imageWidth.toFloat() / inputSize
            val scaleY = imageHeight.toFloat() / inputSize
            val x1 = (cx - w / 2) * scaleX
            val y1 = (cy - h / 2) * scaleY
            val x2 = (cx + w / 2) * scaleX
            val y2 = (cy + h / 2) * scaleY

            rawDetections.add(floatArrayOf(x1, y1, x2, y2, maxIdx.toFloat(), maxScore))
        }

        // NMS
        val nmsResults = nms(rawDetections, iouThreshold)

        // Build output
        val detections = nmsResults.map { det ->
            val classIdx = det[4].toInt()
            mapOf(
                "x1" to det[0].toDouble(),
                "y1" to det[1].toDouble(),
                "x2" to det[2].toDouble(),
                "y2" to det[3].toDouble(),
                "classIndex" to classIdx,
                "className" to (classNames.getOrNull(classIdx) ?: "unknown"),
                "confidence" to det[5].toDouble()
            )
        }

        promise.resolve(mapOf(
            "detections" to detections,
            "imageWidth" to imageWidth,
            "imageHeight" to imageHeight,
            "inferenceTimeMs" to inferenceTime
        ))
    }

    private fun nms(detections: List<FloatArray>, iouThreshold: Float): List<FloatArray> {
        if (detections.isEmpty()) return emptyList()

        // Group by class
        val byClass = detections.groupBy { it[4].toInt() }
        val result = mutableListOf<FloatArray>()

        for ((_, dets) in byClass) {
            val sorted = dets.sortedByDescending { it[5] }.toMutableList()
            val keep = mutableListOf<FloatArray>()

            while (sorted.isNotEmpty()) {
                val best = sorted.removeAt(0)
                keep.add(best)
                sorted.removeAll { iou(best, it) > iouThreshold }
            }
            result.addAll(keep)
        }

        return result
    }

    private fun iou(a: FloatArray, b: FloatArray): Float {
        val x1 = max(a[0], b[0])
        val y1 = max(a[1], b[1])
        val x2 = min(a[2], b[2])
        val y2 = min(a[3], b[3])

        val intersection = max(0f, x2 - x1) * max(0f, y2 - y1)
        val areaA = (a[2] - a[0]) * (a[3] - a[1])
        val areaB = (b[2] - b[0]) * (b[3] - b[1])
        val union = areaA + areaB - intersection

        return if (union > 0) intersection / union else 0f
    }

    private fun loadBitmap(uri: String): Bitmap? {
        return try {
            val path = if (uri.startsWith("file://")) uri.substring(7) else uri
            val file = File(path)
            if (file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
            } else {
                val context = appContext.reactContext ?: return null
                val stream = context.contentResolver.openInputStream(Uri.parse(uri))
                BitmapFactory.decodeStream(stream)
            }
        } catch (e: Exception) {
            null
        }
    }
}
```

- [ ] **Step 3: Register module in app.json**

Add the native module to the `plugins` array in `app.json`. Add this entry after the existing plugins:

```json
"./modules/yolo-detector"
```

The full plugins array should become:
```json
"plugins": [
  "expo-router",
  ["expo-camera", { "cameraPermission": "Glow needs camera access to analyze your skin and scan products" }],
  ["expo-image-picker", { "photosPermission": "Allow Glow to analyze your skin photos" }],
  "expo-web-browser",
  ["expo-speech-recognition", {
    "microphonePermission": "Glow needs microphone access to talk to your Skin Coach",
    "speechRecognitionPermission": "Glow needs speech recognition to understand your voice"
  }],
  "expo-font",
  "./modules/yolo-detector"
]
```

- [ ] **Step 4: Commit**

```bash
git add modules/yolo-detector/android/ app.json
git commit -m "feat(scan): add Android TFLite YOLO module + register plugin"
```

---

## Task 6: YOLO Wrapper Utility

**Files:**
- Create: `lib/yolo.ts`

- [ ] **Step 1: Create the wrapper**

Create `lib/yolo.ts`:

```typescript
import { detect as nativeDetect } from '../modules/yolo-detector';
import type { Detection, DetectionResult, ViewAngle, CapturedImage } from './scan-types';

export async function runDetection(image: CapturedImage): Promise<DetectionResult> {
  try {
    return await nativeDetect(image.uri);
  } catch (error) {
    console.error('[YOLO] Detection failed:', error);
    // Return empty result on failure so the pipeline can continue with Gemini only
    return {
      detections: [],
      imageWidth: image.width,
      imageHeight: image.height,
      inferenceTimeMs: 0,
    };
  }
}

export async function runDetectionOnAll(
  images: Record<ViewAngle, CapturedImage>
): Promise<Record<ViewAngle, DetectionResult>> {
  const [front, left, right] = await Promise.all([
    runDetection(images.front),
    runDetection(images.left),
    runDetection(images.right),
  ]);

  return { front, left, right };
}

export function countDetections(results: Record<ViewAngle, DetectionResult>): number {
  return Object.values(results).reduce((sum, r) => sum + r.detections.length, 0);
}

export function groupByClass(detections: Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of detections) {
    counts[d.className] = (counts[d.className] ?? 0) + 1;
  }
  return counts;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/yolo.ts
git commit -m "feat(scan): add YOLO detection wrapper utility"
```

---

## Task 7: Scan API Layer

**Files:**
- Create: `lib/scan-api.ts`

- [ ] **Step 1: Create the API module**

Create `lib/scan-api.ts`:

```typescript
import { supabase } from './supabase';
import type {
  ViewAngle,
  CapturedImage,
  Detection,
  DetectionResult,
  ScanRequest,
  ScanResponse,
  ScanSession,
} from './scan-types';

/**
 * Upload a single scan image to Supabase Storage.
 * Returns the public URL.
 */
async function uploadImage(
  userId: string,
  angle: ViewAngle,
  image: CapturedImage
): Promise<string> {
  const fileName = `${userId}/scan-${angle}-${Date.now()}.jpg`;
  const binary = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));

  const { data, error } = await supabase.storage
    .from('skin-photos')
    .upload(fileName, binary, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Upload failed (${angle}): ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from('skin-photos').getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Upload all 3 images in parallel.
 */
export async function uploadAllImages(
  userId: string,
  images: Record<ViewAngle, CapturedImage>
): Promise<Record<ViewAngle, string>> {
  const [frontUrl, leftUrl, rightUrl] = await Promise.all([
    uploadImage(userId, 'front', images.front),
    uploadImage(userId, 'left', images.left),
    uploadImage(userId, 'right', images.right),
  ]);

  return { front: frontUrl, left: leftUrl, right: rightUrl };
}

/**
 * Create an initial scan session row (status = processing).
 */
export async function createScanSession(
  userId: string,
  imageUrls: Record<ViewAngle, string>,
  detections: Record<ViewAngle, DetectionResult>
): Promise<string> {
  const modelDetections: Record<ViewAngle, Detection[]> = {
    front: detections.front.detections,
    left: detections.left.detections,
    right: detections.right.detections,
  };

  const { data, error } = await supabase
    .from('scan_sessions')
    .insert({
      user_id: userId,
      front_image_url: imageUrls.front,
      left_image_url: imageUrls.left,
      right_image_url: imageUrls.right,
      model_detections: modelDetections,
      status: 'processing',
    } as any)
    .select('id')
    .single();

  if (error) throw new Error(`Create session failed: ${error.message}`);
  return data.id;
}

/**
 * Call the gemini-review-scan edge function.
 */
export async function callGeminiReview(
  userId: string,
  images: Record<ViewAngle, CapturedImage>,
  detections: Record<ViewAngle, DetectionResult>
): Promise<ScanResponse> {
  const payload: ScanRequest = {
    user_id: userId,
    images: {
      front: images.front.base64,
      left: images.left.base64,
      right: images.right.base64,
    },
    detections: {
      front: detections.front.detections,
      left: detections.left.detections,
      right: detections.right.detections,
    },
    image_dimensions: {
      front: { width: images.front.width, height: images.front.height },
      left: { width: images.left.width, height: images.left.height },
      right: { width: images.right.width, height: images.right.height },
    },
  };

  const { data, error } = await supabase.functions.invoke('gemini-review-scan', {
    body: payload,
  });

  if (error) throw new Error(`Gemini review failed: ${error.message}`);
  return data as ScanResponse;
}

/**
 * Update the scan session with Gemini results.
 */
export async function updateScanSession(
  sessionId: string,
  response: ScanResponse
): Promise<void> {
  const { error } = await supabase
    .from('scan_sessions')
    .update({
      reviewed_detections: response.reviewed_detections,
      severity: response.summary.severity,
      severity_score: response.summary.severity_score,
      total_spots: response.summary.total_spots,
      confirmed_spots: response.summary.confirmed_spots,
      ai_added_spots: response.summary.ai_added_spots,
      primary_acne_type: response.summary.primary_acne_type,
      description: response.summary.description,
      zone_breakdown: response.zone_breakdown,
      skin_insights: response.skin_insights,
      recommendations: response.recommendations,
      skin_plan: response.skin_plan,
      matched_products: response.matched_products ?? null,
      status: 'completed',
    } as any)
    .eq('id', sessionId);

  if (error) throw new Error(`Update session failed: ${error.message}`);
}

/**
 * Mark a session as failed.
 */
export async function failScanSession(sessionId: string): Promise<void> {
  await supabase
    .from('scan_sessions')
    .update({ status: 'failed' } as any)
    .eq('id', sessionId);
}

/**
 * Full pipeline: upload images → create session → call Gemini → update session.
 */
export async function runScanPipeline(
  userId: string,
  images: Record<ViewAngle, CapturedImage>,
  detections: Record<ViewAngle, DetectionResult>,
  onProgress?: (step: string) => void
): Promise<{ sessionId: string; response: ScanResponse }> {
  onProgress?.('Uploading images...');
  const imageUrls = await uploadAllImages(userId, images);

  onProgress?.('Saving scan data...');
  const sessionId = await createScanSession(userId, imageUrls, detections);

  try {
    onProgress?.('AI is reviewing your scan...');
    const response = await callGeminiReview(userId, images, detections);
    response.session_id = sessionId;

    onProgress?.('Saving results...');
    await updateScanSession(sessionId, response);

    return { sessionId, response };
  } catch (error) {
    await failScanSession(sessionId);
    throw error;
  }
}

/**
 * Load a completed scan session.
 */
export async function loadScanSession(sessionId: string): Promise<ScanSession | null> {
  const { data, error } = await supabase
    .from('scan_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) return null;
  return data as unknown as ScanSession;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scan-api.ts
git commit -m "feat(scan): add scan API layer (upload, create session, call Gemini)"
```

---

## Task 8: Supabase Edge Function — Gemini Review

**Files:**
- Create: `supabase/functions/gemini-review-scan/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/gemini-review-scan/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function detectMediaType(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

serve(async (req) => {
  console.log('[gemini-review-scan] request received');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { user_id, images, detections, image_dimensions } = body;

    if (!images?.front || !images?.left || !images?.right) {
      return new Response(
        JSON.stringify({ error: 'Missing images (front, left, right required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[gemini-review-scan] building Gemini request');

    // Build the Gemini multimodal request
    const imageParts = ['front', 'left', 'right'].flatMap((angle) => [
      {
        inlineData: {
          mimeType: detectMediaType(images[angle]),
          data: images[angle],
        },
      },
      {
        text: `[${angle.toUpperCase()} VIEW — ${image_dimensions?.[angle]?.width ?? 'unknown'}x${image_dimensions?.[angle]?.height ?? 'unknown'}px]\nModel detections for this view:\n${JSON.stringify(detections?.[angle] ?? [], null, 2)}`,
      },
    ]);

    const prompt = `You are an expert dermatologist AI reviewing skin scan results. You are given 3 facial photos (front, left side, right side) along with acne detection results from an Ultralytics YOLO object detection model.

## Your Tasks

1. **Review each detection** from the model. The model detects: blackheads, dark spots, nodules, papules, pustules, whiteheads.
   - Confirm detections that look correct
   - The model rarely has false positives but sometimes misses spots
   - Identify any acne spots or skin issues the model missed
   - Only correct a misclassified spot or remove a false positive if you are FULLY certain — otherwise keep the model's result unchanged

2. **Generate a comprehensive skin analysis** including:
   - Overall severity assessment
   - Zone-by-zone breakdown (forehead, chin, left_cheek, right_cheek, nose, jawline)
   - Skin type and moisture assessment
   - Key observations

3. **Create a skincare plan** with:
   - Morning and evening routines
   - Weekly treatments
   - Product recommendations with reasons

## Detection JSON Format

Each detection has: bbox [x1, y1, x2, y2] in pixels, classIndex (0-5), className, confidence (0-1).
Class mapping: 0=blackheads, 1=dark spot, 2=nodules, 3=papules, 4=pustules, 5=whiteheads.

## Required Output

Return ONLY valid JSON matching this exact structure:

{
  "reviewed_detections": {
    "front": [
      {
        "bbox": [x1, y1, x2, y2],
        "classIndex": 0,
        "className": "blackheads",
        "confidence": 0.95,
        "source": "model",
        "status": "confirmed"
      }
    ],
    "left": [...],
    "right": [...]
  },
  "summary": {
    "severity": "mild|moderate|severe",
    "severity_score": 0-100,
    "total_spots": number,
    "confirmed_spots": number,
    "ai_added_spots": number,
    "ai_corrected_spots": number,
    "primary_acne_type": "string",
    "description": "2-3 sentence overview"
  },
  "zone_breakdown": [
    {
      "zone": "chin",
      "spot_count": 7,
      "primary_types": ["papules", "pustules"],
      "severity": "moderate",
      "note": "Brief insight about this zone"
    }
  ],
  "skin_insights": {
    "skin_type": "combination",
    "moisture": "low-normal",
    "key_observations": ["observation 1", "observation 2"]
  },
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Why and how",
      "priority": "high|medium|low",
      "category": "product|lifestyle|professional",
      "product_keywords": ["niacinamide", "serum"]
    }
  ],
  "skin_plan": {
    "morning_routine": [
      {"step": "Gentle cleanser", "product_type": "cleanser", "reason": "why"}
    ],
    "evening_routine": [
      {"step": "Double cleanse", "product_type": "oil cleanser", "reason": "why"}
    ],
    "weekly_treatments": [
      {"treatment": "BHA exfoliant", "frequency": "2-3x per week", "reason": "why"}
    ]
  }
}

Rules for reviewed_detections:
- For model detections you confirm: set source="model", status="confirmed", keep original bbox/class/confidence
- For spots you ADD that the model missed: set source="ai", status="added", provide estimated bbox, className, confidence=1.0, aiConfidence="high" or "medium"
- For detections you CORRECT (only if fully certain): set source="model", status="corrected", include originalClass with the model's label
- For false positives you REMOVE (only if fully certain): set source="model", status="removed"

Return ONLY the JSON object. No markdown, no explanation.`;

    const geminiBody = {
      contents: [
        {
          parts: [
            ...imageParts,
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    };

    console.log('[gemini-review-scan] calling Gemini API...');
    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[gemini-review-scan] Gemini API error:', geminiRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'Gemini API error', status: geminiRes.status, details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log('[gemini-review-scan] Gemini response length:', resultText.length);

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Gemini response as JSON');
      }
    }

    console.log('[gemini-review-scan] success, total spots:', result.summary?.total_spots);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[gemini-review-scan] error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

- [ ] **Step 2: Register the function in supabase config**

Add to the end of `supabase/config.toml`:

```toml
[functions.gemini-review-scan]
verify_jwt = false
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/gemini-review-scan/ supabase/config.toml
git commit -m "feat(scan): add Gemini review edge function"
```

---

## Task 9: Scan Screen — Multi-Image Capture

**Files:**
- Modify: `app/(tabs)/scan.tsx`

This is a full rewrite of the scan screen. The new flow:
1. Camera view with step indicator (Front → Left → Right)
2. Face guide overlay with direction arrows
3. After each capture: preview with retake option
4. After all 3: "Analyze" button
5. Processing state: run YOLO → call edge function → navigate to results

- [ ] **Step 1: Rewrite scan.tsx**

Replace the entire contents of `app/(tabs)/scan.tsx` with the new multi-image capture flow. The file is large, so here is the complete implementation:

```typescript
import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Typography, BorderRadius, Spacing } from '@/lib/theme';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import type { ViewAngle, CapturedImage } from '@/lib/scan-types';
import { runDetectionOnAll, countDetections } from '@/lib/yolo';
import { runScanPipeline } from '@/lib/scan-api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS: { angle: ViewAngle; label: string; instruction: string }[] = [
  { angle: 'front', label: 'Front', instruction: 'Look straight at the camera' },
  { angle: 'left', label: 'Left Side', instruction: 'Turn your head to the right' },
  { angle: 'right', label: 'Right Side', instruction: 'Turn your head to the left' },
];

// ─── SVG Icons ───

function CameraIcon({ size = 48, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11z"
        stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function CheckIcon({ size = 20, color = '#34D399' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowIcon({ direction, size = 24, color = '#FFFFFF' }: { direction: 'left' | 'right'; size?: number; color?: string }) {
  const d = direction === 'left'
    ? 'M19 12H5M5 12l7-7M5 12l7 7'
    : 'M5 12h14M19 12l-7-7M19 12l-7 7';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // Capture state
  const [currentStep, setCurrentStep] = useState(0);
  const [captures, setCaptures] = useState<(CapturedImage | null)[]>([null, null, null]);
  const [previewing, setPreviewing] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  // Shutter animation
  const shutterScale = useRef(new Animated.Value(1)).current;
  const shutterFill = useRef(new Animated.Value(0)).current;

  const onShutterPressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(shutterScale, { toValue: 0.82, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.timing(shutterFill, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  }, []);

  const onShutterPressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(shutterScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }),
      Animated.timing(shutterFill, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, []);

  const shutterBg = shutterFill.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', '#7C5CFC'] });

  const capturePhoto = async () => {
    if (!cameraRef.current || processing) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (photo && photo.base64) {
        const captured: CapturedImage = {
          uri: photo.uri,
          base64: photo.base64,
          width: photo.width,
          height: photo.height,
        };

        const newCaptures = [...captures];
        newCaptures[currentStep] = captured;
        setCaptures(newCaptures);
        setPreviewing(true);
      }
    } catch (err) {
      console.error('Capture error:', err);
      Alert.alert('Capture failed', 'Could not take photo. Please try again.');
    }
  };

  const retakePhoto = () => {
    const newCaptures = [...captures];
    newCaptures[currentStep] = null;
    setCaptures(newCaptures);
    setPreviewing(false);
  };

  const confirmPhoto = () => {
    setPreviewing(false);
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const allCaptured = captures.every((c) => c !== null);

  const startAnalysis = async () => {
    if (!allCaptured || processing) return;

    setProcessing(true);
    setProcessingStep('Running skin detection...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const images = {
        front: captures[0]!,
        left: captures[1]!,
        right: captures[2]!,
      };

      // Step 1: Run YOLO on-device
      setProcessingStep('Detecting acne spots...');
      const detections = await runDetectionOnAll(images);
      const totalDetected = countDetections(detections);
      console.log(`[Scan] YOLO detected ${totalDetected} spots across 3 images`);

      // Step 2: Run full pipeline (upload + Gemini review)
      const { sessionId, response } = await runScanPipeline(
        user.id,
        images,
        detections,
        setProcessingStep
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to results
      router.push({
        pathname: '/scan-results',
        params: { sessionId },
      });
    } catch (err) {
      console.error('Analysis error:', err);
      Alert.alert(
        'Analysis failed',
        'Could not complete the skin analysis. Please try again.'
      );
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  const resetScan = () => {
    setCaptures([null, null, null]);
    setCurrentStep(0);
    setPreviewing(false);
    setProcessing(false);
  };

  // ─── Permission screens ───
  if (!permission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xxl }]}>
        <CameraIcon size={48} color={Colors.white} />
        <Text style={{ ...Typography.headlineMedium, color: Colors.white, textAlign: 'center' }}>
          Camera Access Needed
        </Text>
        <Text style={{ ...Typography.bodyMedium, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
          We need camera access to scan and analyze your skin
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.permissionButtonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Preview of captured photo ───
  if (previewing && captures[currentStep]) {
    return (
      <View style={[styles.container]}>
        <Image source={{ uri: captures[currentStep]!.uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={[styles.previewOverlay, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.previewLabel}>{STEPS[currentStep].label}</Text>

          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.previewBtn} onPress={retakePhoto} activeOpacity={0.8}>
              <Text style={styles.previewBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.previewBtn, styles.previewBtnPrimary]} onPress={confirmPhoto} activeOpacity={0.8}>
              <Text style={[styles.previewBtnText, { color: '#FFFFFF' }]}>
                {currentStep < 2 ? 'Next' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ─── All 3 captured — review & analyze ───
  if (allCaptured && !previewing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingOverlay
          visible={processing}
          title="Analyzing your skin..."
          subtitle={processingStep || 'This may take a moment'}
          steps={['Detecting acne spots', 'Uploading images', 'AI reviewing scan', 'Generating results']}
        />

        <Text style={styles.reviewTitle}>Review Your Photos</Text>
        <Text style={styles.reviewSubtitle}>Tap any photo to retake it</Text>

        <View style={styles.reviewGrid}>
          {STEPS.map((step, i) => (
            <TouchableOpacity
              key={step.angle}
              style={styles.reviewCard}
              onPress={() => {
                setCurrentStep(i);
                retakePhoto();
              }}
              activeOpacity={0.8}
            >
              <Image source={{ uri: captures[i]!.uri }} style={styles.reviewImage} resizeMode="cover" />
              <View style={styles.reviewCardLabel}>
                <CheckIcon size={16} />
                <Text style={styles.reviewCardText}>{step.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.analyzeButton, processing && { opacity: 0.6 }]}
          onPress={startAnalysis}
          disabled={processing}
          activeOpacity={0.85}
        >
          <Text style={styles.analyzeButtonText}>
            {processing ? 'Analyzing...' : 'Analyze My Skin'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={resetScan} disabled={processing}>
          <Text style={styles.resetButtonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Camera capture view ───
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="front" />

      {/* Step indicators */}
      <View style={[styles.stepBar, { top: insets.top + 10 }]}>
        {STEPS.map((step, i) => (
          <View key={step.angle} style={[styles.stepPill, i === currentStep && styles.stepPillActive, captures[i] && styles.stepPillDone]}>
            {captures[i] ? (
              <CheckIcon size={14} color="#FFFFFF" />
            ) : (
              <Text style={[styles.stepPillText, i === currentStep && styles.stepPillTextActive]}>{step.label}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Center instruction */}
      <View style={styles.instructionOverlay}>
        {currentStep === 1 && <ArrowIcon direction="left" size={40} color="rgba(255,255,255,0.5)" />}
        <View style={styles.instructionBadge}>
          <Text style={styles.instructionText}>{STEPS[currentStep].instruction}</Text>
        </View>
        {currentStep === 2 && <ArrowIcon direction="right" size={40} color="rgba(255,255,255,0.5)" />}
      </View>

      {/* Corner brackets */}
      <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.cornerBracket, styles.cTL]} />
        <View style={[styles.cornerBracket, styles.cTR]} />
        <View style={[styles.cornerBracket, styles.cBL]} />
        <View style={[styles.cornerBracket, styles.cBR]} />
      </View>

      {/* Shutter button */}
      <View style={[styles.shutterArea, { paddingBottom: insets.bottom + 30 }]}>
        {/* Thumbnail strip of captured photos */}
        <View style={styles.thumbnailStrip}>
          {STEPS.map((step, i) => (
            <View key={step.angle} style={[styles.thumbnail, i === currentStep && styles.thumbnailActive]}>
              {captures[i] ? (
                <Image source={{ uri: captures[i]!.uri }} style={styles.thumbnailImage} />
              ) : (
                <Text style={styles.thumbnailPlaceholder}>{i + 1}</Text>
              )}
            </View>
          ))}
        </View>

        <Pressable onPress={capturePhoto} onPressIn={onShutterPressIn} onPressOut={onShutterPressOut}>
          <Animated.View style={[styles.shutterOuter, { transform: [{ scale: shutterScale }] }]}>
            <Animated.View style={[styles.shutterInner, { backgroundColor: shutterBg }]} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
  },

  // Permission
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
  },
  permissionButtonText: {
    ...Typography.labelLarge,
    color: Colors.white,
  },

  // Step bar
  stepBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    zIndex: 10,
  },
  stepPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stepPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepPillDone: {
    backgroundColor: 'rgba(52,211,153,0.3)',
    borderColor: Colors.success,
  },
  stepPillText: {
    ...Typography.labelSmall,
    color: 'rgba(255,255,255,0.6)',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },

  // Instruction
  instructionOverlay: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    zIndex: 10,
  },
  instructionBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
  },
  instructionText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
  },

  // Corner brackets
  cornerBracket: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: Colors.white,
  },
  cTL: { top: 155, left: 55, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cTR: { top: 155, right: 55, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cBL: { bottom: 200, left: 55, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cBR: { bottom: 200, right: 55, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },

  // Shutter
  shutterArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.xl,
    zIndex: 10,
  },
  thumbnailStrip: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    ...Typography.labelSmall,
    color: 'rgba(255,255,255,0.4)',
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },

  // Preview
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  previewLabel: {
    ...Typography.headlineLarge,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  previewBtn: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  previewBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  previewBtnText: {
    ...Typography.labelLarge,
    color: '#FFFFFF',
  },

  // Review screen
  reviewTitle: {
    ...Typography.headlineLarge,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  reviewSubtitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  reviewGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  reviewCard: {
    flex: 1,
    aspectRatio: 0.75,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewCardLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reviewCardText: {
    ...Typography.labelSmall,
    color: '#FFFFFF',
  },

  // Analyze button
  analyzeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  analyzeButtonText: {
    ...Typography.headlineSmall,
    color: '#FFFFFF',
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  resetButtonText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/\(tabs\)/scan.tsx
git commit -m "feat(scan): rewrite scan screen with 3-image capture flow"
```

---

## Task 10: Scan Results Screen

**Files:**
- Create: `app/scan-results.tsx`

This screen displays the full results of a completed scan session: images with bounding box overlays, severity summary, zone breakdown, skin insights, recommendations, and a CTA to build a skin plan.

- [ ] **Step 1: Create the results screen**

Create `app/scan-results.tsx`:

```typescript
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect as SvgRect, Text as SvgText, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, BorderRadius, Spacing } from '@/lib/theme';
import ScreenBackground from '@/components/ScreenBackground';
import { loadScanSession } from '@/lib/scan-api';
import type {
  ScanSession,
  ViewAngle,
  ReviewedDetection,
  ZoneBreakdown,
  Recommendation,
  CLASS_COLORS,
} from '@/lib/scan-types';
import { CLASS_COLORS as COLORS } from '@/lib/scan-types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = SCREEN_WIDTH - 48;
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.33;

const VIEW_LABELS: Record<ViewAngle, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
};

const SEVERITY_BAR_COLORS: Record<string, string> = {
  mild: Colors.success,
  moderate: Colors.warning,
  severe: Colors.error,
};

export default function ScanResultsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<ScanSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewAngle>('front');

  useEffect(() => {
    if (sessionId) {
      loadScanSession(sessionId).then((data) => {
        setSession(data);
        setLoading(false);
      });
    }
  }, [sessionId]);

  if (loading || !session) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ScreenBackground preset="scan" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading results...</Text>
      </View>
    );
  }

  const imageUrl =
    activeView === 'front' ? session.front_image_url :
    activeView === 'left' ? session.left_image_url :
    session.right_image_url;

  const detections: ReviewedDetection[] =
    session.reviewed_detections?.[activeView] ?? [];

  const allDetections = Object.values(session.reviewed_detections ?? {}).flat() as ReviewedDetection[];
  const confirmedCount = allDetections.filter((d) => d.status === 'confirmed').length;
  const aiAddedCount = allDetections.filter((d) => d.status === 'added').length;

  // Group detections by class for the count list
  const classCounts: Record<string, { count: number; source: string }> = {};
  for (const d of allDetections) {
    if (d.status === 'removed') continue;
    const key = d.className;
    if (!classCounts[key]) classCounts[key] = { count: 0, source: d.source };
    classCounts[key].count++;
    if (d.source === 'ai' && classCounts[key].source === 'model') {
      classCounts[key].source = 'Model + AI';
    } else if (classCounts[key].source !== 'Model + AI') {
      classCounts[key].source = d.source === 'model' ? 'Model confirmed' : 'AI identified';
    }
  }

  const severity = session.severity ?? 'moderate';
  const severityScore = session.severity_score ?? 50;

  return (
    <View style={{ flex: 1 }}>
      <ScreenBackground preset="scan" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Line x1={19} y1={12} x2={5} y2={12} stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
              <Line x1={12} y1={5} x2={5} y2={12} stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
              <Line x1={12} y1={19} x2={5} y2={12} stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Scan Results</Text>
            <Text style={styles.headerDate}>
              {new Date(session.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* View angle tabs */}
        <View style={styles.viewTabs}>
          {(['front', 'left', 'right'] as ViewAngle[]).map((angle) => (
            <TouchableOpacity
              key={angle}
              style={[styles.viewTab, activeView === angle && styles.viewTabActive]}
              onPress={() => setActiveView(angle)}
            >
              <Text style={[styles.viewTabText, activeView === angle && styles.viewTabTextActive]}>
                {VIEW_LABELS[angle]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Image with bounding box overlay */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.scanImage} resizeMode="cover" />
          <Svg style={StyleSheet.absoluteFill} width={IMAGE_WIDTH} height={IMAGE_HEIGHT}>
            {detections.filter((d) => d.status !== 'removed').map((d, i) => {
              const color = COLORS[d.className] ?? '#FFFFFF';
              // Scale bbox from original image coords to display coords
              const dims = session.model_detections?.[activeView] ? {
                w: activeView === 'front' ? session.front_image_url : session.left_image_url,
                h: 0,
              } : { w: 1280, h: 1706 };
              // We use the image dimensions from reviewed detections — normalize bbox
              const imgW = (session as any).image_dimensions?.[activeView]?.width ?? 1280;
              const imgH = (session as any).image_dimensions?.[activeView]?.height ?? 1706;
              const scaleX = IMAGE_WIDTH / imgW;
              const scaleY = IMAGE_HEIGHT / imgH;
              const x = d.bbox[0] * scaleX;
              const y = d.bbox[1] * scaleY;
              const w = (d.bbox[2] - d.bbox[0]) * scaleX;
              const h = (d.bbox[3] - d.bbox[1]) * scaleY;

              return (
                <SvgRect
                  key={i}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={d.source === 'ai' ? '6,3' : undefined}
                  fill="transparent"
                  rx={4}
                />
              );
            })}
          </Svg>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Model detected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: Colors.primary, borderStyle: 'dashed' }]} />
              <Text style={styles.legendText}>AI identified</Text>
            </View>
          </View>
        </View>

        {/* Severity summary card */}
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['#2D1B69', '#1A0F3D']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)} Acne
              </Text>
              <Text style={styles.summarySpots}>
                {session.total_spots ?? 0} spots across 3 views
              </Text>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_BAR_COLORS[severity] + '30' }]}>
              <Text style={[styles.severityBadgeText, { color: SEVERITY_BAR_COLORS[severity] }]}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </Text>
            </View>
          </View>

          {/* Severity bar */}
          <View style={styles.severityBar}>
            <View style={[styles.severityFill, { width: `${severityScore}%`, backgroundColor: SEVERITY_BAR_COLORS[severity] }]} />
          </View>
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabel}>Clear</Text>
            <Text style={styles.severityLabel}>Mild</Text>
            <Text style={styles.severityLabel}>Moderate</Text>
            <Text style={styles.severityLabel}>Severe</Text>
          </View>

          {/* Description */}
          {session.description && (
            <Text style={styles.summaryDesc}>{session.description}</Text>
          )}

          {/* Stat chips */}
          <View style={styles.statChips}>
            <View style={styles.statChip}>
              <Text style={styles.statChipIcon}>✅</Text>
              <Text style={styles.statChipText}>{confirmedCount} confirmed</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipIcon}>🔍</Text>
              <Text style={styles.statChipText}>{aiAddedCount} possible</Text>
            </View>
            {session.primary_acne_type && (
              <View style={styles.statChip}>
                <Text style={styles.statChipIcon}>🎯</Text>
                <Text style={styles.statChipText}>
                  {session.primary_acne_type.charAt(0).toUpperCase() + session.primary_acne_type.slice(1)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Detection type breakdown */}
        <Text style={styles.sectionTitle}>ACNE MAP</Text>
        <View style={styles.typeList}>
          {Object.entries(classCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([className, { count, source }]) => (
              <View key={className} style={styles.typeRow}>
                <View style={[styles.typeDot, { backgroundColor: COLORS[className] ?? '#888' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeName}>
                    {className.charAt(0).toUpperCase() + className.slice(1)}
                  </Text>
                </View>
                <View style={styles.typeCountCol}>
                  <Text style={styles.typeCount}>{count}</Text>
                  <Text style={styles.typeSource}>{source}</Text>
                </View>
              </View>
            ))}
        </View>

        {/* Zone breakdown */}
        {session.zone_breakdown && session.zone_breakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ZONE BREAKDOWN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.zoneScroll}>
              {session.zone_breakdown.map((zone: ZoneBreakdown, i: number) => (
                <View key={i} style={styles.zoneCard}>
                  <Text style={styles.zoneCardTitle}>{zone.zone.replace(/_/g, ' ').toUpperCase()}</Text>
                  <Text style={styles.zoneCardCount}>{zone.spot_count}</Text>
                  <Text style={styles.zoneCardTypes}>{zone.primary_types.join(' · ')}</Text>
                  <View style={[styles.zoneBar, { backgroundColor: SEVERITY_BAR_COLORS[zone.severity] ?? Colors.textMuted }]} />
                  <Text style={styles.zoneCardNote}>{zone.note}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Skin insights */}
        {session.skin_insights && (
          <>
            <Text style={styles.sectionTitle}>SKIN INSIGHTS</Text>
            <View style={styles.insightsGrid}>
              <View style={styles.insightCard}>
                <Text style={styles.insightLabel}>SKIN TYPE</Text>
                <Text style={styles.insightValue}>{(session.skin_insights as any).skin_type}</Text>
              </View>
              <View style={styles.insightCard}>
                <Text style={styles.insightLabel}>MOISTURE</Text>
                <Text style={styles.insightValue}>{(session.skin_insights as any).moisture}</Text>
              </View>
            </View>
            {(session.skin_insights as any).key_observations?.map((obs: string, i: number) => (
              <Text key={i} style={styles.observationText}>• {obs}</Text>
            ))}
          </>
        )}

        {/* Recommendations */}
        {session.recommendations && (session.recommendations as Recommendation[]).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
            {(session.recommendations as Recommendation[]).map((rec, i) => (
              <View key={i} style={[styles.recCard, { borderLeftColor: rec.priority === 'high' ? Colors.error : rec.priority === 'medium' ? Colors.warning : Colors.success }]}>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            ))}
          </>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/plan')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>+ Build My Skin Plan</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.xxl },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...Typography.headlineLarge, color: Colors.text, textAlign: 'center' },
  headerDate: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  // View tabs
  viewTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  viewTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.cardGlass,
    alignItems: 'center',
  },
  viewTabActive: {
    backgroundColor: Colors.primary,
  },
  viewTabText: { ...Typography.labelMedium, color: Colors.textSecondary },
  viewTabTextActive: { color: '#FFFFFF' },

  // Image
  imageContainer: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scanImage: {
    width: '100%',
    height: '100%',
  },
  legend: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendLine: { width: 20, height: 2, borderRadius: 1 },
  legendText: { ...Typography.caption, color: 'rgba(255,255,255,0.8)' },

  // Summary card
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  summaryTitle: { ...Typography.displaySmall, color: Colors.text },
  summarySpots: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  severityBadge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill },
  severityBadgeText: { ...Typography.labelMedium },
  severityBar: { height: 6, backgroundColor: Colors.cardGlass, borderRadius: 3, marginBottom: Spacing.xs },
  severityFill: { height: 6, borderRadius: 3 },
  severityLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  severityLabel: { ...Typography.caption, color: Colors.textMuted },
  summaryDesc: { ...Typography.bodyMedium, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  statChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.cardGlass,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
  },
  statChipIcon: { fontSize: 14 },
  statChipText: { ...Typography.labelSmall, color: Colors.textSecondary },

  // Type list
  sectionTitle: { ...Typography.labelMedium, color: Colors.textMuted, letterSpacing: 2, marginBottom: Spacing.lg },
  typeList: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
  },
  typeDot: { width: 12, height: 12, borderRadius: 6 },
  typeName: { ...Typography.headlineSmall, color: Colors.text },
  typeCountCol: { alignItems: 'flex-end' },
  typeCount: { ...Typography.displaySmall, color: Colors.text },
  typeSource: { ...Typography.caption, color: Colors.textMuted },

  // Zone breakdown
  zoneScroll: { marginBottom: Spacing.xxl },
  zoneCard: {
    width: 180,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  zoneCardTitle: { ...Typography.labelSmall, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  zoneCardCount: { ...Typography.displayMedium, color: Colors.text },
  zoneCardTypes: { ...Typography.caption, color: Colors.primary, marginBottom: Spacing.sm },
  zoneBar: { height: 3, borderRadius: 2, marginBottom: Spacing.sm },
  zoneCardNote: { ...Typography.caption, color: Colors.textSecondary },

  // Insights
  insightsGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  insightCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightLabel: { ...Typography.labelSmall, color: Colors.textMuted, letterSpacing: 1, marginBottom: Spacing.sm },
  insightValue: { ...Typography.headlineSmall, color: Colors.primary },
  observationText: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.sm, marginLeft: Spacing.sm },

  // Recommendations
  recCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  recTitle: { ...Typography.headlineSmall, color: Colors.text, marginBottom: Spacing.xs },
  recDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  // CTA
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  ctaText: { ...Typography.headlineSmall, color: '#FFFFFF' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/scan-results.tsx
git commit -m "feat(scan): add scan results display screen"
```

---

## Task 11: Apply Database Migration

- [ ] **Step 1: Apply the migration to the remote database**

Run this via the Supabase MCP tool `apply_migration`:
- Migration name: `scan_sessions`
- SQL: the contents of `supabase/migrations/004_scan_sessions.sql`

Alternatively, run via Supabase dashboard SQL editor or CLI:
```bash
supabase db push
```

- [ ] **Step 2: Verify the table exists**

```bash
# Via Supabase MCP execute_sql or dashboard:
SELECT table_name FROM information_schema.tables WHERE table_name = 'scan_sessions';
```

Expected: one row with `scan_sessions`.

- [ ] **Step 3: Deploy the edge function**

```bash
supabase functions deploy gemini-review-scan
```

- [ ] **Step 4: Commit any config changes**

If any files changed during deployment, commit them.

---

## Task 12: Model Conversion

This is a manual step that requires a Python environment with `ultralytics` installed.

- [ ] **Step 1: Convert to CoreML (iOS)**

```bash
cd /Users/omer/Glow
pip install ultralytics  # if not already installed
yolo export model=yolo26m1280.pt format=coreml imgsz=1280 nms
```

This produces a `.mlpackage` file. Copy it:
```bash
mkdir -p modules/yolo-detector/ios/models
cp yolo26m1280.mlpackage modules/yolo-detector/ios/models/yolo-acne.mlpackage
```

- [ ] **Step 2: Convert to TFLite (Android)**

```bash
yolo export model=yolo26m1280.pt format=tflite imgsz=1280
```

This produces a `.tflite` file. Copy it:
```bash
mkdir -p modules/yolo-detector/android/src/main/assets
cp yolo26m1280.tflite modules/yolo-detector/android/src/main/assets/yolo-acne.tflite
```

- [ ] **Step 3: Add model files to .gitignore**

Add to `.gitignore`:
```
# YOLO model files (too large for git)
*.mlpackage
*.tflite
*.pt
*.onnx
```

- [ ] **Step 4: Commit gitignore**

```bash
git add .gitignore
git commit -m "chore: gitignore ML model files"
```

---

## Task 13: Build & Test

- [ ] **Step 1: Prebuild the project**

```bash
npx expo prebuild --clean
```

This generates the native iOS and Android projects with the yolo-detector module integrated.

- [ ] **Step 2: Build and run iOS**

```bash
npx expo run:ios
```

Verify:
- App launches
- Scan tab shows 3-step capture flow
- Camera works with step indicators (Front → Left → Right)

- [ ] **Step 3: Test the full flow**

1. Capture all 3 photos
2. Tap "Analyze My Skin"
3. Watch the loading overlay progress through steps
4. Verify you're navigated to the results screen
5. Check that bounding boxes appear on images
6. Check severity summary, zone breakdown, and recommendations display

- [ ] **Step 4: Test edge cases**

- Retake a photo mid-capture flow
- Start over after capturing all 3
- Test with poor lighting / non-face images (should still work, Gemini handles gracefully)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(scan): complete skin scan pipeline with YOLO + Gemini"
```
