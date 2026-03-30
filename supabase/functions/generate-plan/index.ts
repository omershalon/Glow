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

    const prompt = `You are a dermatologist. Generate 15 ranked skincare recommendations for:
Skin: ${skin.skin_type} | Acne: ${skin.acne_type} | Severity: ${skin.severity}
${ob ? `Age: ${ob.age_range} | Duration: ${ob.acne_duration} | Tried: ${ob.tried_products?.join(', ') || 'nothing'} | Allergies: ${ob.known_allergies?.join(', ') || 'none'} | Concerns: ${ob.skin_concerns?.join(', ') || 'acne'}` : ''}

Return ONLY this JSON array, no markdown, no explanation:
[
  {"pillar":"product","title":"Use a salicylic acid cleanser twice daily","rationale":"Unclogs pores and reduces excess oil linked to comedonal acne","impact_rank":1},
  {"pillar":"diet","title":"...","rationale":"...","impact_rank":2}
]

pillar must be one of: product, diet, herbal, lifestyle
Rank 1 = highest clinical impact. Be specific and actionable. Return exactly 8 items.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
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
