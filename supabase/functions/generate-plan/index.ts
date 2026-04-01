import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { skin_profile_id } = await req.json();
    if (!skin_profile_id) {
      return new Response(JSON.stringify({ error: 'Missing skin_profile_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: skin, error: skinError } = await supabaseClient
      .from('skin_profiles')
      .select('user_id, skin_type, acne_type, severity, analysis_notes')
      .eq('id', skin_profile_id)
      .single();

    if (skinError || !skin) {
      return new Response(JSON.stringify({ error: 'Skin profile not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ob } = await supabaseClient
      .from('onboarding_data')
      .select('age_range, acne_duration, tried_products, known_allergies, skin_concerns')
      .eq('user_id', skin.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const analysisContext = skin.analysis_notes ? `\nAI scan notes: ${skin.analysis_notes}` : '';

    const prompt = `You are a dermatologist creating a UNIQUE personalized plan. Do NOT give generic recommendations.

Patient profile:
- Skin: ${skin.skin_type} | Acne: ${skin.acne_type} | Severity: ${skin.severity}${analysisContext}
${ob ? `- Age: ${ob.age_range} | Duration: ${ob.acne_duration}\n- Tried: ${ob.tried_products?.join(', ') || 'nothing'}\n- Allergies: ${ob.known_allergies?.join(', ') || 'none'}\n- Concerns: ${ob.skin_concerns?.join(', ') || 'acne'}` : ''}

Generate 8 recommendations spread across ALL 4 pillars (at least 1 per pillar). Each must be SPECIFIC to this patient's exact profile. If they've tried products before, suggest DIFFERENT ones. Consider their allergies.

CRITICAL FORMAT — titles must be 1-3 words, rationale must be a short subtitle:

GOOD examples:
{"pillar":"product","title":"Salicylic acid","rationale":"Cleanser · twice daily","impact_rank":1}
{"pillar":"diet","title":"Cut dairy","rationale":"Swap cow's milk for oat milk","impact_rank":2}
{"pillar":"herbal","title":"Spearmint tea","rationale":"2 cups daily","impact_rank":3}
{"pillar":"lifestyle","title":"Clean pillowcase","rationale":"Change every 2 days","impact_rank":4}

BAD examples (TOO LONG — never do this):
{"title":"Use a salicylic acid cleanser (0.5-2%) twice daily"} ← WAY TOO LONG
{"rationale":"Beta hydroxy acid penetrates sebaceous follicles..."} ← WAY TOO LONG

Return ONLY a JSON array. No markdown. No explanation. No backticks.
[
  {"pillar":"product","title":"...","rationale":"...","impact_rank":1},
  ...8 items total
]

pillar: product | diet | herbal | lifestyle
Each pillar MUST have at least 1 item. Return exactly 8.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Claude API error', details: err }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claude = await res.json();
    const text = claude.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';

    let ranked_items;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      ranked_items = JSON.parse(cleaned);
      if (!Array.isArray(ranked_items)) throw new Error('Not an array');
    } catch (e) {
      console.error('Parse error:', e, text.substring(0, 300));
      return new Response(JSON.stringify({ error: 'Failed to parse response', raw: text.substring(0, 300) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deactivate old plans
    await supabaseClient
      .from('personalized_plans')
      .update({ is_active: false })
      .eq('user_id', skin.user_id);

    const empty = {};
    const { data: saved, error: saveErr } = await supabaseClient
      .from('personalized_plans')
      .insert({
        user_id: skin.user_id,
        skin_profile_id,
        products_pillar: empty,
        diet_pillar: empty,
        herbal_pillar: empty,
        lifestyle_pillar: empty,
        ranked_items,
        is_active: true,
      })
      .select()
      .single();

    if (saveErr) {
      console.error('Save error:', saveErr);
      return new Response(JSON.stringify({ error: 'Failed to save plan', details: saveErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(saved), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
