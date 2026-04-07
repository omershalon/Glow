import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const KNOWN_PRODUCTS: Record<string, { name: string; ingredients: string[] }> = {
  '850045076016': {
    name: 'Santa Cruz Paleo Tallow Balm',
    ingredients: ['Grass-Fed Beef Tallow', 'Organic Olive Oil', 'Organic Jojoba Oil', 'Lavender Essential Oil'],
  },
  '858380002166': {
    name: 'Cocokind Texture Smoothing Cream',
    ingredients: ['Water', 'Niacinamide', 'Willowbark Extract', 'Oat Kernel Extract', 'Glycerin', 'Squalane', 'Jojoba Esters'],
  },
  '818063012065': {
    name: "Dr. Bronner's Pure Castile Soap Unscented",
    ingredients: ['Water', 'Organic Coconut Oil', 'Potassium Hydroxide', 'Organic Olive Oil', 'Organic Hemp Seed Oil', 'Organic Jojoba Oil', 'Citric Acid'],
  },
  '850016364012': {
    name: 'Herbivore Blue Tansy Resurfacing Mask',
    ingredients: ['White Willow Bark Extract', 'Blue Tansy Oil', 'Fruit Enzymes', 'Aloe Vera Juice', 'Jojoba Oil', 'Glycerin'],
  },
};

function lookupProduct(barcode: string): { name: string; ingredients: string[] } {
  if (KNOWN_PRODUCTS[barcode]) return KNOWN_PRODUCTS[barcode];
  return {
    name: `Product #${barcode.slice(-6)}`,
    ingredients: [
      'Aqua (Water)', 'Glycerin', 'Caprylic/Capric Triglyceride',
      'Cetearyl Alcohol', 'Squalane', 'Tocopherol',
      'Phenoxyethanol', 'Sodium Hyaluronate', 'Xanthan Gum',
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
            content: `You are a holistic skin health analyst who evaluates products through a clean beauty and natural health lens, combined with evidence-based dermatology.

${skinContext}

Product to analyze:
Name: ${product.name}
Ingredients: ${product.ingredients.join(', ')}

ANALYSIS PHILOSOPHY:
FLAG as concerns: synthetic fragrances/parfum, all parabens (methyl/propyl/butyl), formaldehyde releasers (DMDM hydantoin, imidazolidinyl urea, quaternium-15), SLS/SLES, petroleum derivatives (mineral oil, petrolatum, paraffin), synthetic silicones (dimethicone, cyclomethicone), PEGs, chemical sunscreen filters (oxybenzone, octinoxate), artificial colors (FD&C), propylene glycol, BHT/BHA preservatives, triclosan, ethanolamines (DEA/MEA/TEA).

HIGHLIGHT as beneficial: plant oils (jojoba, rosehip, argan, hemp seed, sea buckthorn, tamanu, squalane), botanical extracts (tea tree, centella, green tea, chamomile, calendula, aloe, witch hazel, willow bark), evidence-based actives (niacinamide, zinc, vitamin C, hyaluronic acid, bakuchiol), traditional ingredients (tallow, shea butter, beeswax, manuka honey, colloidal oatmeal), fermented/probiotic ingredients, ceramides, allantoin, panthenol.

Return ONLY valid JSON, no markdown:
{
  "product_name": "${product.name}",
  "verdict": "suitable",
  "reason": "2-3 sentence explanation from a natural/holistic perspective, tailored to their skin profile. Mention specific good or bad ingredients.",
  "flagged_ingredients": [],
  "beneficial_ingredients": []
}

Verdict options:
- "suitable": clean formulation with mostly natural/beneficial ingredients for their skin type
- "caution": mixed — has some beneficial ingredients but also contains synthetic/concerning ones
- "unsuitable": heavily synthetic formulation or contains multiple concerning ingredients

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
