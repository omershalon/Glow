import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY secret not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id, image_base64, week_number } = await req.json();

    if (!user_id || !image_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id and image_base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's skin profile for context
    const { data: skinProfile } = await supabaseClient
      .from('skin_profiles')
      .select('skin_type, acne_type, severity')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get previous severity score for comparison
    const { data: previousPhotos } = await supabaseClient
      .from('progress_photos')
      .select('severity_score')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const previousScore: number | undefined = previousPhotos?.[0]?.severity_score;

    const skinContext = skinProfile
      ? `User baseline: ${skinProfile.skin_type} skin with ${skinProfile.acne_type} acne, originally ${skinProfile.severity} severity.`
      : '';

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
                  media_type: detectMediaType(image_base64),
                  data: image_base64,
                },
              },
              {
                type: 'text',
                text: `You are a dermatologist AI conducting a weekly skin progress check-in.

${skinContext}
Week ${week_number ?? 1} progress photo.
${previousScore !== undefined ? `Previous severity score: ${previousScore.toFixed(1)}/10` : 'This is the first progress photo.'}

Return ONLY valid JSON, no markdown:
{
  "severity_score": 5.0,
  "analysis_notes": "2-3 encouraging sentences about current skin state and progress.",
  "zones": {
    "forehead": "Brief condition description",
    "nose": "Brief condition description",
    "left_cheek": "Brief condition description",
    "right_cheek": "Brief condition description",
    "chin": "Brief condition description",
    "overall": "Overall summary"
  }
}

Severity scale: 0=clear, 2=minimal, 4=mild, 6=moderate, 8=severe, 10=very severe.
Be encouraging and specific. Return ONLY valid JSON, no markdown.`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', errText);
      return new Response(
        JSON.stringify({ error: 'Anthropic API error', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await anthropicRes.json();
    const analysisText = claudeData.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';

    let parsed;
    try {
      const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        severity_score: 5.0,
        analysis_notes: 'Progress photo logged successfully. Keep following your personalized plan.',
        zones: {
          forehead: 'Monitoring active',
          nose: 'Monitoring active',
          left_cheek: 'Monitoring active',
          right_cheek: 'Monitoring active',
          chin: 'Monitoring active',
          overall: 'Continuing to track progress week by week.',
        },
      };
    }

    const improvementPercentage =
      previousScore !== undefined && previousScore > 0
        ? ((previousScore - parsed.severity_score) / previousScore) * 100
        : null;

    return new Response(
      JSON.stringify({
        severity_score: parsed.severity_score,
        improvement_percentage: improvementPercentage,
        analysis_notes: parsed.analysis_notes,
        zones: parsed.zones,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('track-progress error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
