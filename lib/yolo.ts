import { detect as nativeDetect, isAvailable } from '../modules/yolo-detector';
import type { Detection, DetectionResult, ViewAngle, CapturedImage } from './scan-types';

export { isAvailable as isYoloAvailable };

function emptyResult(image: CapturedImage): DetectionResult {
  return { detections: [], imageWidth: image.width, imageHeight: image.height, inferenceTimeMs: 0 };
}

export async function runDetection(image: CapturedImage): Promise<DetectionResult> {
  if (!isAvailable()) {
    console.warn('[YOLO] Native module not available — skipping on-device detection');
    return emptyResult(image);
  }
  try {
    return await nativeDetect(image.uri);
  } catch (error) {
    console.error('[YOLO] Detection failed:', error);
    return emptyResult(image);
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
