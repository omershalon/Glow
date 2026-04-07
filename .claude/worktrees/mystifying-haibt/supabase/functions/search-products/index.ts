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
    const { query, user_id } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ products: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user skin profile for matching
    let skinContext = '';
    if (user_id) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data: skin } = await supabaseClient
        .from('skin_profiles')
        .select('skin_type, acne_type, severity')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (skin) {
        skinContext = `${skin.skin_type} skin, ${skin.acne_type} acne, ${skin.severity} severity`;
      }
    }

    // Search Open Beauty Facts
    const searchUrl = `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,image_url,ingredients_text,categories_tags`;
    const obfRes = await fetch(searchUrl);
    const obfData = await obfRes.json();

    const rawProducts = (obfData.products || [])
      .filter((p: any) => p.product_name && p.brands)
      .slice(0, 12);

    if (rawProducts.length === 0) {
      return new Response(JSON.stringify({ products: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we have skin context and AI key, score with AI
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    let scores: Record<number, number> = {};

    if (apiKey && skinContext && rawProducts.length > 0) {
      const productList = rawProducts.map((p: any, i: number) => {
        const ingredients = p.ingredients_text ? ` Ingredients: ${p.ingredients_text.substring(0, 150)}` : '';
        return `${i + 1}. "${p.product_name}" by ${p.brands}${ingredients}`;
      }).join('\n');

      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `Score each product 1-99 for a patient with ${skinContext}. Consider ingredient compatibility. Use full range (not all 90+). Return ONLY JSON like {"1":85,"2":42,...}\n\n${productList}`,
            }],
          }),
        });

        if (aiRes.ok) {
          const claude = await aiRes.json();
          const text = claude.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '{}';
          try {
            scores = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
          } catch {}
        }
      } catch (err) {
        console.error('AI scoring error:', err);
      }
    }

    // Format response
    const products = rawProducts.map((p: any, i: number) => ({
      id: `obf-${i}`,
      name: p.product_name,
      brand: p.brands?.split(',')[0]?.trim() || 'Unknown',
      image_url: p.image_url || '',
      ingredients: p.ingredients_text || '',
      match_score: scores[i + 1] || 50,
      source: 'openbeautyfacts',
    }));

    return new Response(JSON.stringify({ products }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('search-products error:', err);
    return new Response(JSON.stringify({ products: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
