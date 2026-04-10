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

serve(async (req) => {
  console.log('[gemini-review-scan] request received, method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Step 1: Authenticate ──
    console.log('[gemini-review-scan] step 1: auth');
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[gemini-review-scan] no authorization header');
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

    // ── Step 2: Check API key ──
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    console.log('[gemini-review-scan] step 2: ANTHROPIC_API_KEY present:', !!apiKey);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Supabase secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 3: Parse body ──
    console.log('[gemini-review-scan] step 3: parsing body');
    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('[gemini-review-scan] body parse error:', parseErr);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', details: String(parseErr) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { images, detections, image_dimensions } = body;

    console.log('[gemini-review-scan] images present:', {
      front: !!images?.front, frontLen: images?.front?.length ?? 0,
      left: !!images?.left, leftLen: images?.left?.length ?? 0,
      right: !!images?.right, rightLen: images?.right?.length ?? 0,
    });

    if (!images?.front || !images?.left || !images?.right) {
      return new Response(
        JSON.stringify({ error: 'Missing images (front, left, right required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 4: Build Claude request ──
    console.log('[gemini-review-scan] step 4: building Claude request');

    const imageContent = ['front', 'left', 'right'].flatMap((angle) => [
      {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: detectMediaType(images[angle]),
          data: images[angle],
        },
      },
      {
        type: 'text' as const,
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
- For model detections you confirm: set source="model", status="confirmed", keep original bbox/class/confidence
- For spots you ADD that the model missed: set source="ai", status="added", provide estimated bbox, className, confidence=1.0, aiConfidence="high" or "medium"
- For detections you CORRECT (only if fully certain): set source="model", status="corrected", include originalClass with the model's label
- For false positives you REMOVE (only if fully certain): set source="model", status="removed"
- If there are no detections for a view, return an empty array for that view

Return ONLY the JSON object. No markdown, no explanation.`;

    const claudeBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
    };

    const claudeBodyStr = JSON.stringify(claudeBody);
    console.log('[gemini-review-scan] step 5: calling Claude API, request size:', claudeBodyStr.length, 'bytes');

    // ── Step 5: Call Claude ──
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: claudeBodyStr,
    });

    console.log('[gemini-review-scan] Claude response status:', claudeRes.status);

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('[gemini-review-scan] Claude API error:', claudeRes.status, errText);
      return new Response(
        JSON.stringify({
          error: 'Claude API error',
          api_status: claudeRes.status,
          details: errText.substring(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 6: Parse Claude response ──
    console.log('[gemini-review-scan] step 6: parsing Claude response');
    const claudeData = await claudeRes.json();
    const resultText = claudeData.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';

    console.log('[gemini-review-scan] Claude response length:', resultText.length);

    if (!resultText) {
      const stopReason = claudeData.stop_reason;
      console.error('[gemini-review-scan] Empty Claude response, stop_reason:', stopReason);
      return new Response(
        JSON.stringify({
          error: 'Claude returned empty response',
          stop_reason: stopReason,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      // Claude sometimes wraps JSON in markdown code fences
      const cleaned = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        console.error('[gemini-review-scan] Could not parse response:', resultText.substring(0, 200));
        return new Response(
          JSON.stringify({ error: 'Could not parse Claude response as JSON', snippet: resultText.substring(0, 200) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Step 7: Validate ──
    const missing: string[] = [];
    if (!result.reviewed_detections || typeof result.reviewed_detections !== 'object') missing.push('reviewed_detections');
    if (!result.summary || typeof result.summary !== 'object') missing.push('summary');
    if (!result.zone_breakdown || !Array.isArray(result.zone_breakdown)) missing.push('zone_breakdown');
    if (!result.skin_insights || typeof result.skin_insights !== 'object') missing.push('skin_insights');
    if (!result.recommendations || !Array.isArray(result.recommendations)) missing.push('recommendations');
    if (!result.skin_plan || typeof result.skin_plan !== 'object') missing.push('skin_plan');

    if (missing.length > 0) {
      console.error('[gemini-review-scan] response missing fields:', missing, 'keys:', Object.keys(result));
      return new Response(
        JSON.stringify({ error: 'AI returned incomplete response', missing_fields: missing }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[gemini-review-scan] success! total_spots:', result.summary?.total_spots);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[gemini-review-scan] unhandled error:', error, error?.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
