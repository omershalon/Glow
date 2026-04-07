import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function detectMediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  if (b64.startsWith('R0lGOD')) return 'image/gif';
  return 'image/jpeg';
}

serve(async (req) => {
  console.log('[analyze-skin] request received, method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Step 1: parse body
    let body: { image_base64?: string };
    try {
      body = await req.json();
    } catch (e) {
      console.error('[analyze-skin] failed to parse request body:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image_base64 } = body;
    console.log('[analyze-skin] image_base64 present:', !!image_base64, 'length:', image_base64?.length ?? 0);

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing image_base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: API key
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    console.log('[analyze-skin] ANTHROPIC_API_KEY present:', !!apiKey, 'starts with sk-ant:', apiKey?.startsWith('sk-ant') ?? false);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY secret not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mediaType = detectMediaType(image_base64);
    console.log('[analyze-skin] detected media type:', mediaType);

    // Step 4: call Anthropic
    console.log('[analyze-skin] calling Anthropic API...');
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: image_base64,
                },
              },
              {
                type: 'text',
                text: `You are an expert dermatologist AI. Carefully analyze this specific face photo. Look closely at the actual skin in the image — examine pore size, oiliness, dryness, redness, breakout locations, lesion types, and texture.

Based on what you ACTUALLY SEE in this specific photo, return your analysis.

IMPORTANT: Every face is different. Do NOT give a generic answer. Look at:
- WHERE are breakouts located? (jawline = hormonal, forehead = fungal/comedonal, cheeks = inflammatory)
- WHAT type of lesions? (deep painful bumps = cystic, blackheads/whiteheads = comedonal, red inflamed = inflammatory, uniform small bumps = fungal)
- HOW oily/dry does the skin appear? (shiny T-zone = combination/oily, flaky = dry, uniform = normal)
- HOW severe? (few spots = mild, noticeable coverage = moderate, widespread/painful = severe)
- severity_score: a number 0-100 representing overall skin severity. 0 = perfectly clear, 100 = most severe. Be precise — don't just pick 38/72/91. Use the full range based on what you see (e.g. 24, 57, 63, 81).

Also analyze each ZONE of the face separately. For each zone, describe what you see (clear, mild, moderate, severe) and any specific observations.

Return ONLY valid JSON, no markdown, no extra text:
{"skin_type":"oily","acne_type":"hormonal","severity":"moderate","severity_score":63,"analysis_notes":"2-3 sentences about this specific skin.","findings":[{"title":"Finding","description":"explanation"},{"title":"Finding","description":"explanation"},{"title":"Finding","description":"explanation"}],"zones":{"forehead":{"severity":"mild","note":"A few closed comedones"},"left_cheek":{"severity":"clear","note":"No active lesions"},"right_cheek":{"severity":"moderate","note":"3-4 inflamed papules"},"nose":{"severity":"mild","note":"Some blackheads on sides"},"chin":{"severity":"moderate","note":"Active breakout cluster"},"jawline":{"severity":"severe","note":"Deep cystic lesions"}},"confidence":0.85}

skin_type: oily | dry | combination | sensitive | normal
acne_type: hormonal | cystic | comedonal | fungal | inflammatory
severity: mild | moderate | severe
severity_score: integer 0-100
findings: 3 objects with title + description based on what you SEE
zones: object with keys forehead, left_cheek, right_cheek, nose, chin, jawline — each has severity (clear/mild/moderate/severe) and a short note about what you observe in that zone

Return ONLY the JSON object.`,
              },
            ],
          },
        ],
      }),
    });

    console.log('[analyze-skin] Anthropic response status:', anthropicRes.status);

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[analyze-skin] Anthropic API error:', anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'Anthropic API error', status: anthropicRes.status, details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await anthropicRes.json();
    console.log('[analyze-skin] Anthropic response received, content blocks:', claudeData.content?.length);

    const resultText = claudeData.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
    console.log('[analyze-skin] result text:', resultText.substring(0, 200));

    let analysisResult;
    try {
      const cleaned = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
      console.log('[analyze-skin] parsed result:', JSON.stringify(analysisResult));
    } catch (parseErr) {
      console.error('[analyze-skin] JSON parse failed:', parseErr, 'raw text:', resultText);
      // Try to extract JSON from within the text (Claude sometimes wraps in extra text)
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          analysisResult = JSON.parse(jsonMatch[0]);
          console.log('[analyze-skin] recovered JSON from text:', JSON.stringify(analysisResult));
        } catch {
          analysisResult = {
            skin_type: 'combination',
            acne_type: 'comedonal',
            severity: 'mild',
            analysis_notes: 'Could not parse analysis. Please try again with better lighting.',
            confidence: 0.5,
          };
        }
      } else {
        analysisResult = {
          skin_type: 'combination',
          acne_type: 'comedonal',
          severity: 'mild',
          analysis_notes: 'Could not parse analysis. Please try again with better lighting.',
          confidence: 0.5,
        };
      }
    }

    console.log('[analyze-skin] success, returning result');
    return new Response(
      JSON.stringify(analysisResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[analyze-skin] unhandled error:', error, error?.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
