import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KNOWN_PRODUCTS: Record<string, { name: string; ingredients: string[] }> = {
  '796030114134': {
    name: 'CeraVe Moisturizing Cream',
    ingredients: ['Water', 'Glycerin', 'Cetearyl Alcohol', 'Caprylic/Capric Triglyceride', 'Ceramide NP', 'Ceramide AP', 'Ceramide EOP', 'Cholesterol', 'Sodium Hyaluronate', 'Dimethicone'],
  },
  '381370033244': {
    name: 'Neutrogena Oil-Free Acne Wash',
    ingredients: ['Water', 'Salicylic Acid 2%', 'Glycerin', 'Cocamidopropyl Betaine', 'Aloe Barbadensis Leaf Juice'],
  },
  '811701014161': {
    name: 'The Ordinary Niacinamide 10% + Zinc 1%',
    ingredients: ['Aqua', 'Niacinamide', 'Pentylene Glycol', 'Zinc PCA', 'Tamarindus Indica Seed Gum', 'Phenoxyethanol'],
  },
  '3337872413682': {
    name: 'La Roche-Posay Effaclar Duo',
    ingredients: ['Aqua', 'Benzoyl Peroxide 5.5%', 'Glycerin', 'Zinc PCA', 'Niacinamide', 'Lipo Hydroxy Acid'],
  },
};

function lookupProduct(barcode: string): { name: string; ingredients: string[] } {
  if (KNOWN_PRODUCTS[barcode]) return KNOWN_PRODUCTS[barcode];
  return {
    name: `Skincare Product #${barcode.slice(-6)}`,
    ingredients: [
      'Aqua (Water)', 'Glycerin', 'Niacinamide', 'Propylene Glycol',
      'Sodium Hyaluronate', 'Phenoxyethanol', 'Parfum/Fragrance',
      'Sodium Lauryl Sulfate', 'Methylparaben', 'Dimethicone',
    ],
  };
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

    const { barcode, user_id } = await req.json();
    if (!barcode || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing barcode or user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch skin profile and onboarding in parallel
    const [skinProfileRes, onboardingRes] = await Promise.all([
      supabaseClient
        .from('skin_profiles')
        .select('skin_type, acne_type, severity')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabaseClient
        .from('onboarding_data')
        .select('known_allergies')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const skinProfile = skinProfileRes.data;
    const onboarding = onboardingRes.data;
    const product = lookupProduct(barcode);

    const skinContext = skinProfile
      ? `User skin profile:
- Skin Type: ${skinProfile.skin_type}
- Acne Type: ${skinProfile.acne_type}
- Severity: ${skinProfile.severity}
${onboarding?.known_allergies?.length ? `- Known Allergies: ${onboarding.known_allergies.join(', ')}` : ''}`
      : 'No skin profile available — provide general analysis.';

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `You are a dermatologist AI analyzing a skincare product's compatibility with a specific user's skin.

${skinContext}

Product to analyze:
Name: ${product.name}
Ingredients: ${product.ingredients.join(', ')}

Return ONLY valid JSON, no markdown:
{
  "product_name": "${product.name}",
  "verdict": "suitable",
  "reason": "2-3 sentence explanation tailored to their skin profile.",
  "flagged_ingredients": [],
  "beneficial_ingredients": []
}

Verdict options:
- "suitable": ingredients are mostly beneficial or neutral for their skin type
- "caution": mixed — can use with monitoring
- "unsuitable": contains ingredients likely to worsen their specific condition

Return ONLY valid JSON, no markdown.`,
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

    let analysis: {
      product_name: string;
      verdict: 'suitable' | 'unsuitable' | 'caution';
      reason: string;
      flagged_ingredients: string[];
      beneficial_ingredients: string[];
    };

    try {
      const cleaned = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = {
        product_name: product.name,
        verdict: 'caution',
        reason: 'Unable to complete full analysis. Exercise caution and patch test before use.',
        flagged_ingredients: [],
        beneficial_ingredients: [],
      };
    }

    // Save scan to database
    const { data: savedScan, error: saveError } = await supabaseClient
      .from('product_scans')
      .insert({
        user_id,
        barcode,
        product_name: analysis.product_name,
        verdict: analysis.verdict,
        reason: analysis.reason,
        ingredients: analysis.verdict === 'suitable'
          ? analysis.beneficial_ingredients
          : analysis.flagged_ingredients,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save scan error:', saveError);
    }

    return new Response(
      JSON.stringify(savedScan ?? {
        user_id,
        barcode,
        product_name: analysis.product_name,
        verdict: analysis.verdict,
        reason: analysis.reason,
        ingredients: analysis.verdict === 'suitable'
          ? analysis.beneficial_ingredients
          : analysis.flagged_ingredients,
        created_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('scan-product error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
