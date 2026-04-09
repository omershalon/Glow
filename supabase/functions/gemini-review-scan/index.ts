import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // Authenticate the request
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { images, detections, image_dimensions } = body;
    const user_id = user.id; // Use authenticated user ID, not client-supplied

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

    // Validate required fields in the Gemini response
    const missing: string[] = [];
    if (!result.reviewed_detections || typeof result.reviewed_detections !== 'object') missing.push('reviewed_detections');
    if (!result.summary || typeof result.summary !== 'object') missing.push('summary');
    if (!result.zone_breakdown || !Array.isArray(result.zone_breakdown)) missing.push('zone_breakdown');
    if (!result.skin_insights || typeof result.skin_insights !== 'object') missing.push('skin_insights');
    if (!result.recommendations || !Array.isArray(result.recommendations)) missing.push('recommendations');
    if (!result.skin_plan || typeof result.skin_plan !== 'object') missing.push('skin_plan');

    if (missing.length > 0) {
      console.error('[gemini-review-scan] Gemini response missing fields:', missing);
      return new Response(
        JSON.stringify({ error: 'Gemini returned incomplete response', missing_fields: missing }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
