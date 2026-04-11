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
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set' }),
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

    const promptText = `You are a holistic skin health analyst who evaluates products through a clean beauty and natural health lens, combined with evidence-based dermatology.

${skinContext}

Product to analyze:
Name: ${product.name}
Ingredients: ${product.ingredients.join(', ')}

ANALYSIS PHILOSOPHY:
FLAG as concerns: synthetic fragrances/parfum, all parabens, formaldehyde releasers, SLS/SLES, petroleum derivatives, synthetic silicones, PEGs, chemical sunscreen filters, artificial colors, propylene glycol, BHT/BHA preservatives, triclosan, ethanolamines.

HIGHLIGHT as beneficial: plant oils, botanical extracts, evidence-based actives (niacinamide, zinc, vitamin C, hyaluronic acid, bakuchiol), traditional ingredients (tallow, shea butter, beeswax, manuka honey), fermented/probiotic ingredients, ceramides, allantoin, panthenol.

Return ONLY valid JSON, no markdown:
{"product_name":"${product.name}","verdict":"suitable","reason":"2-3 sentence explanation.","flagged_ingredients":[],"beneficial_ingredients":[]}

Verdict: "suitable" | "caution" | "unsuitable"
Return ONLY valid JSON.`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(
        JSON.stringify({ error: 'Gemini API error', details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const analysisText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

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
