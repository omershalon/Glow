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
  const modelDetections = {
    front: detections.front.detections,
    left: detections.left.detections,
    right: detections.right.detections,
    image_dimensions: {
      front: { width: detections.front.imageWidth, height: detections.front.imageHeight },
      left: { width: detections.left.imageWidth, height: detections.left.imageHeight },
      right: { width: detections.right.imageWidth, height: detections.right.imageHeight },
    },
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
  return (data as any).id;
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
  const { error } = await (supabase
    .from('scan_sessions') as any)
    .update({
      reviewed_detections: response.reviewed_detections,
      severity: response.summary.severity,
      severity_score: response.summary.severity_score,
      total_spots: response.summary.total_spots,
      confirmed_spots: response.summary.confirmed_spots,
      ai_added_spots: response.summary.ai_added_spots,
      ai_corrected_spots: response.summary.ai_corrected_spots ?? 0,
      primary_acne_type: response.summary.primary_acne_type,
      description: response.summary.description,
      zone_breakdown: response.zone_breakdown,
      skin_insights: response.skin_insights,
      recommendations: response.recommendations,
      skin_plan: response.skin_plan,
      matched_products: response.matched_products ?? null,
      status: 'completed',
    })
    .eq('id', sessionId);

  if (error) throw new Error(`Update session failed: ${error.message}`);
}

/**
 * Mark a session as failed.
 */
export async function failScanSession(sessionId: string): Promise<void> {
  await (supabase
    .from('scan_sessions') as any)
    .update({ status: 'failed' })
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
