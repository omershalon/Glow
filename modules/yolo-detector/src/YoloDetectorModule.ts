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
