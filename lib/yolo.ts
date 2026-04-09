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
