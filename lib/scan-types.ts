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
