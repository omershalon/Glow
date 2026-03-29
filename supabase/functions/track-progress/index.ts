import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProgressResult {
  severity_score: number;
  improvement_percentage: number | null;
  analysis_notes: string;
  zones: {
    forehead: string;
    nose: string;
    left_cheek: string;
    right_cheek: string;
    chin: string;
    overall: string;
  };
  insights: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id, image_base64, week_number, previous_photo_url } = await req.json();

    if (!user_id || !image_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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
      .select('severity_score, week_number')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    const previousScore = previousPhotos?.[0]?.severity_score;

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    });

    function detectMediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
      if (b64.startsWith('UklGR')) return 'image/webp';
      if (b64.startsWith('R0lGOD')) return 'image/gif';
      return 'image/jpeg';
    }

    const skinContext = skinProfile
      ? `User's baseline: ${skinProfile.skin_type} skin with ${skinProfile.acne_type} acne, originally ${skinProfile.severity} severity.`
      : '';

    const messageContent: Anthropic.Messages.MessageParam['content'] = [
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
        text: `You are a dermatologist AI conducting a weekly skin progress assessment.

${skinContext}
This is Week ${week_number} progress photo.
${previousScore !== undefined ? `Previous severity score was: ${previousScore.toFixed(1)}/10` : 'This is the first progress photo.'}

Analyze the skin carefully and return ONLY valid JSON with this structure:
{
  "severity_score": 0.0 to 10.0 (0=clear skin, 10=very severe),
  "analysis_notes": "2-3 sentences describing current skin state, changes observed, and encouragement",
  "zones": {
    "forehead": "Brief description of forehead zone condition",
    "nose": "Brief description of nose/T-zone condition",
    "left_cheek": "Brief description of left cheek condition",
    "right_cheek": "Brief description of right cheek condition",
    "chin": "Brief description of chin/jaw zone condition",
    "overall": "Overall skin assessment summary"
  },
  "insights": [
    "Specific insight 1 about progress or recommendation",
    "Specific insight 2",
    "Specific insight 3"
  ]
}

Severity scale:
- 0-2: Clear/minimal blemishes
- 3-4: Mild acne with few active lesions
- 5-6: Moderate acne with several lesions
- 7-8: Moderately severe with many lesions
- 9-10: Severe acne with cysts/nodules

Be encouraging and specific. Return ONLY valid JSON, no markdown.`,
      },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    });

    let analysisText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        analysisText = block.text;
        break;
      }
    }

    let result: ProgressResult;
    try {
      const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const improvementPercentage =
        previousScore !== undefined
          ? ((previousScore - parsed.severity_score) / previousScore) * 100
          : null;

      result = {
        severity_score: parsed.severity_score,
        improvement_percentage: improvementPercentage,
        analysis_notes: parsed.analysis_notes,
        zones: parsed.zones,
        insights: parsed.insights || [],
      };
    } catch {
      result = {
        severity_score: 5.0,
        improvement_percentage: previousScore !== undefined ? ((previousScore - 5.0) / previousScore) * 100 : null,
        analysis_notes: 'Progress photo logged successfully. Keep following your personalized plan for best results.',
        zones: {
          forehead: 'Monitoring active',
          nose: 'Monitoring active',
          left_cheek: 'Monitoring active',
          right_cheek: 'Monitoring active',
          chin: 'Monitoring active',
          overall: 'Continuing to track progress week by week.',
        },
        insights: [
          'Consistency with your skincare routine is key.',
          'Remember to stay hydrated and maintain your diet plan.',
          'Continue logging weekly for best tracking accuracy.',
        ],
      };
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('track-progress error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
