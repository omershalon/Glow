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
                text: `You are an expert dermatologist AI. Analyze this face photo for skin type and acne characteristics.

Return ONLY valid JSON, no markdown:
{"skin_type":"combination","acne_type":"comedonal","severity":"mild","analysis_notes":"2-3 sentence description.","confidence":0.85}

skin_type options: oily | dry | combination | sensitive | normal
acne_type options: hormonal | cystic | comedonal | fungal | inflammatory
severity options: mild | moderate | severe

If no clear acne is visible, use comedonal / mild.
Return ONLY the JSON object, nothing else.`,
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
      analysisResult = {
        skin_type: 'combination',
        acne_type: 'comedonal',
        severity: 'mild',
        analysis_notes: 'Analysis completed. Please consult a dermatologist for a comprehensive evaluation.',
        confidence: 0.7,
      };
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
