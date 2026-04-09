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

export interface YoloDetectorModuleType {
  detect(imageUri: string, confidenceThreshold: number): Promise<NativeDetectionResult>;
}

// Lazy-load the native module so the app doesn't crash on startup
// if the module isn't available (e.g. in Expo Go or dev builds without native rebuild)
let _module: YoloDetectorModuleType | null = null;

export function getModule(): YoloDetectorModuleType {
  if (!_module) {
    _module = requireNativeModule<YoloDetectorModuleType>('YoloDetector');
  }
  return _module;
}

export function isAvailable(): boolean {
  try {
    getModule();
    return true;
  } catch {
    return false;
  }
}
