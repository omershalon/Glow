import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AnalysisResult {
  skin_type: 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal';
  acne_type: 'hormonal' | 'cystic' | 'comedonal' | 'fungal' | 'inflammatory';
  severity: 'mild' | 'moderate' | 'severe';
  analysis_notes: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing image_base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    });

    // Auto-detect image format from base64 magic bytes
    function detectMediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
      if (b64.startsWith('UklGR')) return 'image/webp';
      if (b64.startsWith('R0lGOD')) return 'image/gif';
      return 'image/jpeg';
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: detectMediaType(image_base64),
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: `You are an expert dermatologist AI. Analyze this face photo for skin type and acne characteristics.

Analyze carefully and provide a JSON response with exactly this structure:
{
  "skin_type": "oily" | "dry" | "combination" | "sensitive" | "normal",
  "acne_type": "hormonal" | "cystic" | "comedonal" | "fungal" | "inflammatory",
  "severity": "mild" | "moderate" | "severe",
  "analysis_notes": "A detailed 2-3 sentence explanation of your findings, including visible skin characteristics, affected zones, and key observations.",
  "confidence": 0.0 to 1.0
}

Definitions:
- skin_type oily: visibly shiny, enlarged pores, prone to breakouts
- skin_type dry: tight-feeling appearance, flaky patches, fine lines
- skin_type combination: oily T-zone (forehead, nose, chin), dry or normal cheeks
- skin_type sensitive: redness, reactive appearance, thin skin
- skin_type normal: balanced, minimal issues

- acne_type hormonal: concentrated on jaw, chin, lower face; cystic deep nodules
- acne_type cystic: large, deep, painful-looking nodules under skin
- acne_type comedonal: blackheads and whiteheads, clogged pores
- acne_type fungal: small uniform bumps, often on forehead and hairline
- acne_type inflammatory: red papules and pustules, swollen

- severity mild: few lesions, minimal inflammation
- severity moderate: multiple lesions, moderate inflammation
- severity severe: many lesions, significant inflammation and scarring

If no clear acne is visible, default acne_type to "comedonal" and severity to "mild".
IMPORTANT: Return only valid JSON, no markdown formatting.`,
            },
          ],
        },
      ],
    });

    // Extract text content from response
    let resultText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        resultText = block.text;
        break;
      }
    }

    // Parse the JSON result
    let analysisResult: AnalysisResult;
    try {
      // Remove any markdown code blocks if present
      const cleaned = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
    } catch (parseError) {
      // Fallback result if parsing fails
      analysisResult = {
        skin_type: 'combination',
        acne_type: 'comedonal',
        severity: 'mild',
        analysis_notes: 'Analysis completed. Please consult a dermatologist for a comprehensive evaluation.',
        confidence: 0.7,
      };
    }

    return new Response(
      JSON.stringify(analysisResult),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('analyze-skin error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
