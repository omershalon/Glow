import { getModule, isAvailable } from './src/YoloDetectorModule';
import type { Detection, DetectionResult } from '@/lib/scan-types';
import { ACNE_CLASSES } from '@/lib/scan-types';

const CONFIDENCE_THRESHOLD = 0.2;

export { isAvailable };

export async function detect(imageUri: string): Promise<DetectionResult> {
  const mod = getModule();
  const result = await mod.detect(imageUri, CONFIDENCE_THRESHOLD);

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
