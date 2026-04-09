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
