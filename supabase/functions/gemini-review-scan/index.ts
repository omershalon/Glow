import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG — tune these without touching pipeline logic
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  /** Only call Gemini on the first scan of the day; reuse cached response for later scans */
  enable_first_scan_only_gemini: true,

  /** Send only the front image to Gemini (left/right are excluded) */
  enable_gemini_front_only: true,

  /** If true, send only detection crops instead of the full front image (not yet implemented — placeholder) */
  enable_gemini_crop_only: false,

  /** Max dimension (px) the client should have resized the front image to before sending */
  image_resize_for_gemini: 800,

  /** Thresholds that determine whether a later-day scan is different enough to re-call Gemini */
  meaningful_change_threshold: {
    /** Fractional change in total spot count that triggers a re-run (0.30 = 30%) */
    count_change_pct: 0.30,
    /** Average Ultralytics confidence below this forces a re-run (model was uncertain) */
    min_avg_confidence: 0.30,
    /** A new acne class type appearing always triggers a re-run */
    new_type_triggers_rerun: true,
    /** A new facial zone becoming active always triggers a re-run */
    new_zone_triggers_rerun: true,
    /** Spot count must cross this absolute delta before the % check kicks in (avoids 0→1 = 100%) */
    min_absolute_delta: 3,
  },
};

// ═══════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function geminiUrl(model: string): string {
  return `${GEMINI_API_BASE}/${model}:generateContent`;
}

/** Maximum retries for transient 429 (rate-limit) errors — NOT for quota exhaustion */
const MAX_RETRIES = 2;
/** Base delay in ms for exponential backoff on retryable 429s */
const RETRY_BASE_DELAY_MS = 2000;

// ── Types ──

interface Detection {
  bbox: [number, number, number, number];
  classIndex: number;
  className: string;
  confidence: number;
}

interface AllDetections {
  front: Detection[];
  left: Detection[];
  right: Detection[];
}

interface PreviousSession {
  id: string;
  total_spots: number | null;
  model_detections: { front: Detection[]; left: Detection[]; right: Detection[] } | null;
  zone_breakdown: any[] | null;
  skin_insights: any | null;
  recommendations: any[] | null;
  skin_plan: any | null;
  reviewed_detections: { front: Detection[]; left: Detection[]; right: Detection[] } | null;
  severity: string | null;
  severity_score: number | null;
  primary_acne_type: string | null;
  description: string | null;
  matched_products: any[] | null;
}

// ── Helpers ──

function detectMediaType(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

/** Map a normalised y-coordinate (0..1) to a rough facial zone name */
function yToZone(normY: number): string {
  if (normY < 0.20) return 'forehead';
  if (normY < 0.45) return 'nose_eyes';
  if (normY < 0.70) return 'cheeks_nose';
  return 'chin_jawline';
}

/** Return the set of unique class names across all angles */
function uniqueClasses(det: AllDetections): Set<string> {
  const s = new Set<string>();
  [...det.front, ...det.left, ...det.right].forEach((d) => s.add(d.className));
  return s;
}

/** Estimate which zones are active based on bbox positions */
function activeZones(detections: Detection[], imgHeight: number): Set<string> {
  const zones = new Set<string>();
  detections.forEach((d) => {
    const midY = (d.bbox[1] + d.bbox[3]) / 2;
    zones.add(yToZone(midY / imgHeight));
  });
  return zones;
}

/** Average confidence across all detections */
function avgConfidence(det: AllDetections): number {
  const all = [...det.front, ...det.left, ...det.right];
  if (all.length === 0) return 1.0;
  return all.reduce((s, d) => s + d.confidence, 0) / all.length;
}

// ── Meaningful-change detector ──

interface ChangeResult {
  changed: boolean;
  reasons: string[];
}

function detectMeaningfulChange(
  current: AllDetections,
  prev: PreviousSession,
  imageDimensions: { front: { width: number; height: number } }
): ChangeResult {
  const reasons: string[] = [];
  const t = CONFIG.meaningful_change_threshold;

  // 1. Count change
  const currentTotal = current.front.length + current.left.length + current.right.length;
  const prevTotal = prev.total_spots ?? 0;
  const delta = Math.abs(currentTotal - prevTotal);
  if (
    delta >= t.min_absolute_delta &&
    prevTotal > 0 &&
    delta / prevTotal >= t.count_change_pct
  ) {
    reasons.push(`spot count changed ${prevTotal} → ${currentTotal} (${Math.round((delta / prevTotal) * 100)}%)`);
  }

  // 2. New acne type
  if (t.new_type_triggers_rerun) {
    const prevDet = prev.model_detections;
    if (prevDet) {
      const prevClasses = uniqueClasses(prevDet as AllDetections);
      const currentClasses = uniqueClasses(current);
      const newTypes: string[] = [];
      currentClasses.forEach((c) => { if (!prevClasses.has(c)) newTypes.push(c); });
      if (newTypes.length > 0) {
        reasons.push(`new acne type(s) detected: ${newTypes.join(', ')}`);
      }
    }
  }

  // 3. New zone
  if (t.new_zone_triggers_rerun) {
    const h = imageDimensions.front.height;
    const prevZones = prev.zone_breakdown?.map((z: any) => z.zone) ?? [];
    if (h > 0 && current.front.length > 0) {
      const currentFrontZones = activeZones(current.front, h);
      const newZones: string[] = [];
      currentFrontZones.forEach((z) => {
        if (!prevZones.some((pz: string) => pz.includes(z.split('_')[0]))) {
          newZones.push(z);
        }
      });
      if (newZones.length > 0) {
        reasons.push(`new zone(s) affected: ${newZones.join(', ')}`);
      }
    }
  }

  // 4. Low confidence
  const avg = avgConfidence(current);
  if (avg < t.min_avg_confidence) {
    reasons.push(`low avg model confidence ${avg.toFixed(2)} < ${t.min_avg_confidence}`);
  }

  return { changed: reasons.length > 0, reasons };
}

/** Build reviewed_detections for a cached response (all model detections confirmed) */
function buildCachedReviewedDetections(current: AllDetections) {
  function confirmAll(dets: Detection[]) {
    return dets.map((d) => ({
      bbox: d.bbox,
      classIndex: d.classIndex,
      className: d.className,
      confidence: d.confidence,
      source: 'model',
      status: 'confirmed',
    }));
  }
  return {
    front: confirmAll(current.front),
    left: confirmAll(current.left),
    right: confirmAll(current.right),
  };
}

/** Reconstruct a ScanResponse from a previous session + current detections */
function buildCachedResponse(prev: PreviousSession, current: AllDetections): object {
  const currentTotal = current.front.length + current.left.length + current.right.length;
  return {
    reviewed_detections: buildCachedReviewedDetections(current),
    summary: {
      severity: prev.severity ?? 'mild',
      severity_score: prev.severity_score ?? 0,
      total_spots: currentTotal,
      confirmed_spots: currentTotal,
      ai_added_spots: 0,
      ai_corrected_spots: 0,
      primary_acne_type: prev.primary_acne_type ?? 'unknown',
      description: prev.description ?? '',
    },
    zone_breakdown: prev.zone_breakdown ?? [],
    skin_insights: prev.skin_insights ?? {},
    recommendations: prev.recommendations ?? [],
    skin_plan: prev.skin_plan ?? { morning_routine: [], evening_routine: [], weekly_treatments: [] },
    matched_products: prev.matched_products ?? null,
    cached: true,
    gemini_called: false,
  };
}

// ── Retry helper ──

interface GeminiCallResult {
  ok: boolean;
  status: number;
  body: any;            // parsed JSON or raw text
  retryable: boolean;   // true if 429 is transient (RPM), false if quota exhausted
  retryAfterMs?: number;
  attempts: number;
  modelUsed: string;    // which model ultimately succeeded or last tried
}

/**
 * Call Gemini with smart retry for transient 429s.
 * If the primary model's quota is exhausted, automatically falls back to GEMINI_FALLBACK_MODEL.
 * Quota-exhaustion 429s skip retry (they won't clear up with a short wait).
 */
async function callGeminiWithRetry(
  apiKey: string,
  requestBody: object
): Promise<GeminiCallResult> {
  const modelsToTry = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];
  let lastResult: GeminiCallResult | null = null;

  for (const model of modelsToTry) {
    const url = `${geminiUrl(model)}?key=${apiKey}`;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      console.log(`[gemini-review-scan] Gemini API call — model: ${model}, attempt ${attempt}/${MAX_RETRIES + 1}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log(`[gemini-review-scan] Gemini response status: ${res.status} (model: ${model})`);

      if (res.ok) {
        const data = await res.json();
        return { ok: true, status: res.status, body: data, retryable: false, attempts: attempt, modelUsed: model };
      }

      // Non-429 errors — don't retry
      if (res.status !== 429) {
        const errText = await res.text();
        return { ok: false, status: res.status, body: errText, retryable: false, attempts: attempt, modelUsed: model };
      }

      // ── 429 handling ──
      const errText = await res.text();
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : undefined;

      console.log(`[gemini-review-scan] 429 received on attempt ${attempt} (model: ${model})`);
      console.log(`[gemini-review-scan]   Retry-After header: ${retryAfterHeader ?? 'not set'}`);
      console.log(`[gemini-review-scan]   error body (first 500 chars): ${errText.substring(0, 500)}`);

      // Check if this is a QUOTA exhaustion (not retryable) vs a transient rate limit
      const isQuotaExhausted =
        errText.includes('exceeded your current quota') ||
        errText.includes('billing') ||
        errText.includes('QUOTA_EXCEEDED') ||
        errText.includes('quota');

      lastResult = {
        ok: false,
        status: 429,
        body: errText,
        retryable: !isQuotaExhausted,
        retryAfterMs,
        attempts: attempt,
        modelUsed: model,
      };

      if (isQuotaExhausted) {
        console.log(`[gemini-review-scan] 429 is QUOTA EXHAUSTION for ${model} — trying fallback model if available`);
        break; // break inner retry loop → try next model
      }

      // Transient rate limit — wait and retry
      if (attempt <= MAX_RETRIES) {
        const delay = retryAfterMs ?? RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[gemini-review-scan] transient 429 — retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // If last result was OK (shouldn't reach here but safety check) or non-quota error, stop trying models
    if (lastResult && (lastResult.ok || (lastResult.status !== 429 || lastResult.retryable))) {
      break;
    }

    // If quota exhausted on primary, try fallback
    if (model === GEMINI_MODEL && lastResult && !lastResult.retryable) {
      console.log(`[gemini-review-scan] ═══ Falling back from ${GEMINI_MODEL} → ${GEMINI_FALLBACK_MODEL} ═══`);
    }
  }

  return lastResult!;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  console.log('[gemini-review-scan] ══════════ request received ══════════');
  console.log('[gemini-review-scan] method:', req.method);
  console.log('[gemini-review-scan] url:', req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── GET /test — lightweight Gemini health check (tests both primary + fallback) ──
  if (req.method === 'GET') {
    console.log('[gemini-review-scan] GET /test — running Gemini health check');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'GEMINI_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testBody = {
      contents: [{ parts: [{ text: 'Reply with exactly: {"status":"ok"}' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 32 },
    };

    const results: Record<string, any> = {};

    for (const model of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL]) {
      try {
        const testRes = await fetch(`${geminiUrl(model)}?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testBody),
        });
        const testStatus = testRes.status;
        const testText = await testRes.text();
        console.log(`[gemini-review-scan] test ${model}: status ${testStatus}`);
        console.log(`[gemini-review-scan] test ${model}: body ${testText.substring(0, 200)}`);

        results[model] = {
          status: testStatus,
          ok: testRes.ok,
          ...(testRes.ok
            ? { message: 'reachable and responding' }
            : { error: testText.substring(0, 300) }),
        };
      } catch (e) {
        results[model] = { status: 0, ok: false, error: String(e) };
      }
    }

    const anyOk = Object.values(results).some((r: any) => r.ok);

    return new Response(
      JSON.stringify({
        ok: anyOk,
        key_prefix: geminiKey.substring(0, 8) + '...',
        key_length: geminiKey.length,
        primary_model: GEMINI_MODEL,
        fallback_model: GEMINI_FALLBACK_MODEL,
        models: results,
        hint: anyOk
          ? 'At least one Gemini model is available. Scan should work.'
          : 'Both models returned errors. Your Gemini quota may be exhausted. Check https://ai.google.dev/gemini-api/docs/rate-limits',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ── POST — full scan review ──
  console.log('[gemini-review-scan] config:', JSON.stringify({
    enable_first_scan_only_gemini: CONFIG.enable_first_scan_only_gemini,
    enable_gemini_front_only: CONFIG.enable_gemini_front_only,
    image_resize_for_gemini: CONFIG.image_resize_for_gemini,
    meaningful_change_threshold: CONFIG.meaningful_change_threshold,
  }));

  try {
    // ── Step 1: Auth ──
    console.log('[gemini-review-scan] step 1: auth');
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[gemini-review-scan] auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[gemini-review-scan] authenticated user:', user.id);

    // ── Step 2: GEMINI_API_KEY ──
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    console.log('[gemini-review-scan] step 2: GEMINI_API_KEY present:', !!geminiKey, 'length:', geminiKey?.length ?? 0);
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set in Supabase secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 3: Parse body ──
    console.log('[gemini-review-scan] step 3: parsing request body');
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', details: String(e) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { front_image, detections, image_dimensions } = body;
    const current: AllDetections = {
      front: detections?.front ?? [],
      left: detections?.left ?? [],
      right: detections?.right ?? [],
    };
    const currentTotal = current.front.length + current.left.length + current.right.length;

    console.log('[gemini-review-scan] received front_image length:', front_image?.length ?? 0);
    console.log('[gemini-review-scan] Ultralytics detections:', {
      front: current.front.length,
      left: current.left.length,
      right: current.right.length,
      total: currentTotal,
    });

    if (!front_image) {
      return new Response(
        JSON.stringify({ error: 'Missing front_image in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: First-scan-of-day cache check ──
    if (CONFIG.enable_first_scan_only_gemini) {
      console.log('[gemini-review-scan] step 4: checking for first scan of day');

      // Query for today's earliest completed session for this user
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);

      const { data: prevSessions, error: queryError } = await supabase
        .from('scan_sessions')
        .select(`
          id, total_spots, model_detections, zone_breakdown,
          skin_insights, recommendations, skin_plan,
          reviewed_detections, severity, severity_score,
          primary_acne_type, description, matched_products, created_at
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', todayUTC.toISOString())
        .order('created_at', { ascending: true })
        .limit(1);

      if (queryError) {
        console.warn('[gemini-review-scan] DB query error (continuing with Gemini):', queryError.message);
      } else if (prevSessions && prevSessions.length > 0) {
        const prev = prevSessions[0] as PreviousSession;
        console.log('[gemini-review-scan] found earlier session today:', prev.id, '— running meaningful-change check');

        const { changed, reasons } = detectMeaningfulChange(current, prev, image_dimensions ?? { front: { width: 0, height: 0 } });

        if (!changed) {
          const skipReason = 'No meaningful change from first scan of day';
          console.log('[gemini-review-scan] ✓ GEMINI SKIPPED —', skipReason);
          console.log('[gemini-review-scan]   cached session:', prev.id);
          console.log('[gemini-review-scan]   prev total_spots:', prev.total_spots, '→ current:', currentTotal);

          const cached = buildCachedResponse(prev, current);
          return new Response(
            JSON.stringify({ ...cached, skip_reason: skipReason }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[gemini-review-scan] ✗ MEANINGFUL CHANGE — re-calling Gemini');
        console.log('[gemini-review-scan]   reasons:', reasons.join(' | '));
      } else {
        console.log('[gemini-review-scan] no completed sessions today — FIRST SCAN OF DAY → calling Gemini');
      }
    } else {
      console.log('[gemini-review-scan] step 4: first-scan-only disabled, always calling Gemini');
    }

    // ── Step 5: Build Gemini request ──
    console.log('[gemini-review-scan] step 5: building Gemini request');

    // Ultralytics summary as text context (all 3 angles)
    const ultralyticsContext = [
      `## Ultralytics YOLO Detections (all 3 angles)\n`,
      `Total spots found: ${currentTotal}`,
      `Average confidence: ${avgConfidence(current).toFixed(2)}`,
      ``,
      `### FRONT VIEW (${current.front.length} detections)`,
      ...current.front.map((d, i) =>
        `  [${i + 1}] ${d.className} (class ${d.classIndex}) — bbox [${d.bbox.map((v) => Math.round(v)).join(', ')}] — conf ${d.confidence.toFixed(3)}`
      ),
      ``,
      `### LEFT SIDE (${current.left.length} detections)`,
      ...current.left.map((d, i) =>
        `  [${i + 1}] ${d.className} (class ${d.classIndex}) — bbox [${d.bbox.map((v) => Math.round(v)).join(', ')}] — conf ${d.confidence.toFixed(3)}`
      ),
      ``,
      `### RIGHT SIDE (${current.right.length} detections)`,
      ...current.right.map((d, i) =>
        `  [${i + 1}] ${d.className} (class ${d.classIndex}) — bbox [${d.bbox.map((v) => Math.round(v)).join(', ')}] — conf ${d.confidence.toFixed(3)}`
      ),
    ].join('\n');

    const frontDim = image_dimensions?.front;
    const frontLabel = frontDim
      ? `FRONT VIEW (${frontDim.width}x${frontDim.height}px original, sent resized to ≤${CONFIG.image_resize_for_gemini}px)`
      : 'FRONT VIEW';

    // Build Gemini parts — front image only
    const parts: any[] = [
      {
        inlineData: {
          mimeType: detectMediaType(front_image),
          data: front_image,
        },
      },
      { text: `[${frontLabel}]` },
      { text: ultralyticsContext },
    ];

    const geminiPayloadSizeKB = Math.round(
      JSON.stringify(parts).length / 1024
    );

    console.log('[gemini-review-scan] Gemini payload info:');
    console.log('  model:', GEMINI_MODEL);
    console.log('  images sent:', 1, '(front only)');
    console.log('  front_image base64 length:', front_image.length);
    console.log('  detections in context — front:', current.front.length, 'left:', current.left.length, 'right:', current.right.length);
    console.log('  total payload size:', geminiPayloadSizeKB, 'KB');

    const prompt = `You are an expert dermatologist AI working alongside an Ultralytics YOLO acne detection model.

Your role is strictly complementary to the YOLO model:
- YOLO is the PRIMARY detector. Its results are the ground truth unless you are FULLY certain of an error.
- You must use the YOLO detections above as structured context for your analysis.
- You may suggest possible spots the model missed (mark as source="ai", status="added").
- You may only override a YOLO result (correct or remove) when you are 100% certain — otherwise keep it as-is.

## Class mapping (YOLO model)
0 = blackheads | 1 = dark spot | 2 = nodules | 3 = papules | 4 = pustules | 5 = whiteheads

## Your two tasks

### Task 1 — Review YOLO detections (front image only shown)
Using the front image and the YOLO detection list for all 3 angles:
- Confirm front-image detections you can visually verify
- Note any possible missed spots on the front image
- For left/right angles, rely on the YOLO detection list (no images provided) — preserve those results unchanged unless confidence is very low

### Task 2 — Skin analysis + plan
Generate a comprehensive dermatologist-level analysis based on the YOLO results AND your visual assessment of the front image:
- Overall severity and zone breakdown
- Skin type and moisture
- Personalised skincare routine (morning/evening)
- Weekly treatment recommendations
- Product category recommendations (no brand names)

## Required JSON output

Return ONLY valid JSON with exactly this structure:

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
    "left": [],
    "right": []
  },
  "summary": {
    "severity": "mild",
    "severity_score": 35,
    "total_spots": 12,
    "confirmed_spots": 10,
    "ai_added_spots": 2,
    "ai_corrected_spots": 0,
    "primary_acne_type": "comedonal",
    "description": "2-3 sentence personalised overview"
  },
  "zone_breakdown": [
    {
      "zone": "chin",
      "spot_count": 7,
      "primary_types": ["papules", "pustules"],
      "severity": "moderate",
      "note": "insight specific to this zone"
    }
  ],
  "skin_insights": {
    "skin_type": "combination",
    "moisture": "low-normal",
    "key_observations": ["observation 1", "observation 2"]
  },
  "recommendations": [
    {
      "title": "title",
      "description": "why and how",
      "priority": "high",
      "category": "product",
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
- YOLO front detections you can visually confirm: source="model", status="confirmed"
- Spots you ADD (model missed): source="ai", status="added", aiConfidence="high"|"medium"
- YOLO result you CORRECT (only if 100% certain): source="model", status="corrected", include originalClass
- YOLO false positive (only if 100% certain): source="model", status="removed"
- Left/right detections: copy YOLO result as-is with source="model", status="confirmed" (no image to review)
- Empty arrays are valid if no detections

Return ONLY the JSON. No markdown. No explanation.`;

    const geminiBody = {
      contents: [{ parts: [...parts, { text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    };

    // ── Step 6: Call Gemini (with retry for transient 429s + model fallback) ──
    console.log('[gemini-review-scan] step 6: calling Gemini API (with retry + fallback support)');
    console.log(`[gemini-review-scan]   primary model: ${GEMINI_MODEL}, fallback: ${GEMINI_FALLBACK_MODEL}`);
    const geminiResult = await callGeminiWithRetry(geminiKey, geminiBody);

    console.log(`[gemini-review-scan] Gemini call completed — status: ${geminiResult.status}, model: ${geminiResult.modelUsed}, attempts: ${geminiResult.attempts}`);

    if (!geminiResult.ok) {
      const errBody = typeof geminiResult.body === 'string' ? geminiResult.body : JSON.stringify(geminiResult.body);
      console.error('[gemini-review-scan] Gemini API error status:', geminiResult.status);
      console.error('[gemini-review-scan] Gemini API error body:', errBody.substring(0, 1000));

      // Build a user-friendly error message for 429s
      let userHint = '';
      if (geminiResult.status === 429) {
        if (!geminiResult.retryable) {
          userHint = 'Your Gemini API quota is exhausted for the current billing period. '
            + 'Please check your plan at https://ai.google.dev/gemini-api/docs/rate-limits '
            + 'or wait for the quota to reset (usually daily). '
            + 'You can also upgrade to a paid tier in Google AI Studio.';
        } else {
          userHint = `Gemini rate limit hit after ${geminiResult.attempts} attempts. Try again in a minute.`;
        }
      }

      return new Response(
        JSON.stringify({
          error: `Gemini API returned ${geminiResult.status}`,
          gemini_status: geminiResult.status,
          details: errBody.substring(0, 500),
          attempts: geminiResult.attempts,
          retryable: geminiResult.retryable,
          hint: userHint || undefined,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 7: Parse Gemini response ──
    console.log('[gemini-review-scan] step 7: parsing Gemini response');
    const geminiData = geminiResult.body;
    const candidate = geminiData.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const resultText = candidate?.content?.parts?.[0]?.text ?? '';

    console.log('[gemini-review-scan] finishReason:', finishReason);
    console.log('[gemini-review-scan] response text length:', resultText.length);

    if (!resultText) {
      console.error('[gemini-review-scan] Empty Gemini response');
      console.error('[gemini-review-scan] promptFeedback:', JSON.stringify(geminiData.promptFeedback));
      return new Response(
        JSON.stringify({ error: 'Gemini returned empty response', finishReason, promptFeedback: geminiData.promptFeedback }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any;
    try {
      result = JSON.parse(resultText);
    } catch {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error('[gemini-review-scan] Could not parse Gemini response as JSON:', resultText.substring(0, 300));
        return new Response(
          JSON.stringify({ error: 'Could not parse Gemini response as JSON', snippet: resultText.substring(0, 200) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Step 8: Validate required fields ──
    const missing: string[] = [];
    if (!result.reviewed_detections) missing.push('reviewed_detections');
    if (!result.summary) missing.push('summary');
    if (!Array.isArray(result.zone_breakdown)) missing.push('zone_breakdown');
    if (!result.skin_insights) missing.push('skin_insights');
    if (!Array.isArray(result.recommendations)) missing.push('recommendations');
    if (!result.skin_plan) missing.push('skin_plan');

    if (missing.length > 0) {
      console.error('[gemini-review-scan] response missing fields:', missing);
      return new Response(
        JSON.stringify({ error: 'Gemini returned incomplete response', missing_fields: missing }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    result.gemini_called = true;
    result.cached = false;

    console.log('[gemini-review-scan] ✓ SUCCESS');
    console.log('  total_spots:', result.summary?.total_spots);
    console.log('  severity:', result.summary?.severity, '(score:', result.summary?.severity_score + ')');
    console.log('  ai_added_spots:', result.summary?.ai_added_spots);
    console.log('  zones:', result.zone_breakdown?.map((z: any) => z.zone).join(', '));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[gemini-review-scan] unhandled error:', err, (err as any)?.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
