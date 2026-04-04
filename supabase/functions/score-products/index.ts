import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not set' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ scores: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user skin profile
    const { data: skin } = await supabaseClient
      .from('skin_profiles')
      .select('skin_type, acne_type, severity, analysis_notes')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!skin) {
      return new Response(JSON.stringify({ scores: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all active products
    const { data: products } = await supabaseClient
      .from('products')
      .select('id, name, brand, category, description, skin_types, acne_types')
      .eq('is_active', true);

    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ scores: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build product list for AI
    const productList = products.map((p, i) =>
      `${i + 1}. "${p.name}" by ${p.brand} (${p.category}) - ${p.description}`
    ).join('\n');

    const prompt = `You are a dermatologist scoring how well each product matches a specific patient.

PATIENT:
- Skin type: ${skin.skin_type}
- Acne type: ${skin.acne_type}
- Severity: ${skin.severity}
${skin.analysis_notes ? `- Notes: ${skin.analysis_notes}` : ''}

PRODUCTS:
${productList}

Score each product 1-99 based on how well it suits THIS specific patient. Consider:
- Is the product type appropriate for their skin type? (e.g. foaming cleanser bad for dry skin)
- Does it target their acne type? (e.g. salicylic acid great for comedonal, not needed for fungal)
- Could any typical ingredients irritate their skin?
- Is this product category relevant to their condition?

Be discriminating — NOT everything is a 90+. Use the full range:
- 85-99: Perfect match, directly addresses their needs
- 70-84: Good match, generally suitable
- 50-69: Okay, not ideal but not harmful
- 30-49: Poor match, not recommended for their profile
- 1-29: Bad match, could worsen their condition

Return ONLY a JSON object mapping product number to score, no markdown:
{"1":87,"2":45,"3":92,...}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error('Claude API error:', await res.text());
      return new Response(JSON.stringify({ scores: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claude = await res.json();
    const text = claude.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '{}';

    let numberScores: Record<string, number>;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      numberScores = JSON.parse(cleaned);
    } catch {
      console.error('Parse error:', text.substring(0, 200));
      return new Response(JSON.stringify({ scores: {} }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map number indices back to product IDs
    const scores: Record<string, number> = {};
    Object.entries(numberScores).forEach(([numStr, score]) => {
      const idx = parseInt(numStr) - 1;
      if (products[idx]) {
        scores[products[idx].id] = Math.min(99, Math.max(1, Math.round(score as number)));
      }
    });

    return new Response(JSON.stringify({ scores }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('score-products error:', err);
    return new Response(JSON.stringify({ scores: {} }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
