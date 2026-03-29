import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mock product database - in production this would call Open Food Facts, EWG, etc.
const MOCK_PRODUCTS: Record<string, { name: string; ingredients: string[] }> = {
  '796030114134': {
    name: 'CeraVe Moisturizing Cream',
    ingredients: ['Water', 'Glycerin', 'Cetearyl Alcohol', 'Caprylic/Capric Triglyceride', 'Behentrimonium Methosulfate', 'Ceramide NP', 'Ceramide AP', 'Ceramide EOP', 'Cholesterol', 'Phytosphingosine', 'Sodium Lauroyl Lactylate', 'Sodium Hyaluronate', 'Carbomer', 'Dimethicone'],
  },
  '381370033244': {
    name: 'Neutrogena Oil-Free Acne Wash',
    ingredients: ['Water', 'Salicylic Acid 2%', 'Glycerin', 'Cocamidopropyl Betaine', 'Sodium Methyl Cocoyl Taurate', 'Sodium Lauroyl Sarcosinate', 'Sodium Chloride', 'Aloe Barbadensis Leaf Juice', 'Glycol Distearate'],
  },
  '811701014161': {
    name: 'The Ordinary Niacinamide 10% + Zinc 1%',
    ingredients: ['Aqua (Water)', 'Niacinamide', 'Pentylene Glycol', 'Zinc PCA', 'Dimethyl Isosorbide', 'Tamarindus Indica Seed Gum', 'Xanthan Gum', 'Isoceteth-20', 'Ethoxydiglycol', 'Phenoxyethanol', 'Chlorphenesin'],
  },
  '3337872413682': {
    name: 'La Roche-Posay Effaclar Duo',
    ingredients: ['Aqua/Water', 'Benzoyl Peroxide 5.5%', 'PPG-15 Stearyl Ether', 'Glycerin', 'Propylene Glycol', 'Zinc PCA', 'Niacinamide', 'Lipo Hydroxy Acid', 'Piroctone Olamine', 'Silica', 'Dimethicone'],
  },
};

function lookupProduct(barcode: string): { name: string; ingredients: string[] } {
  // Check mock database
  if (MOCK_PRODUCTS[barcode]) {
    return MOCK_PRODUCTS[barcode];
  }

  // Generate a plausible product for any other barcode
  return {
    name: `Skincare Product #${barcode.slice(-6)}`,
    ingredients: [
      'Aqua (Water)',
      'Glycerin',
      'Niacinamide',
      'Propylene Glycol',
      'Sodium Hyaluronate',
      'Phenoxyethanol',
      'Parfum/Fragrance',
      'Sodium Lauryl Sulfate',
      'Methylparaben',
      'Dimethicone',
      'Cetearyl Alcohol',
      'Butylene Glycol',
    ],
  };
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

    const { barcode, user_id } = await req.json();
    if (!barcode || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing barcode or user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's skin profile and onboarding
    const [skinProfileRes, onboardingRes] = await Promise.all([
      supabaseClient
        .from('skin_profiles')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabaseClient
        .from('onboarding_data')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const skinProfile = skinProfileRes.data;
    const onboarding = onboardingRes.data;

    // Look up product
    const product = lookupProduct(barcode);

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    });

    const skinContext = skinProfile
      ? `User skin profile:
- Skin Type: ${skinProfile.skin_type}
- Acne Type: ${skinProfile.acne_type}
- Severity: ${skinProfile.severity}
${onboarding?.known_allergies?.length ? `- Known Allergies: ${onboarding.known_allergies.join(', ')}` : ''}`
      : 'No skin profile available - provide general analysis.';

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are a dermatologist AI analyzing a skincare product's compatibility with a specific user's skin.

${skinContext}

Product to analyze:
Name: ${product.name}
Ingredients: ${product.ingredients.join(', ')}

Analyze the ingredients and determine if this product is suitable for this user's specific skin type and acne condition.

Return ONLY valid JSON with this structure:
{
  "product_name": "${product.name}",
  "verdict": "suitable" | "unsuitable" | "caution",
  "reason": "2-3 sentence explanation tailored to their specific skin profile",
  "flagged_ingredients": ["ingredient1", "ingredient2"],
  "beneficial_ingredients": ["ingredient1", "ingredient2"]
}

Verdict definitions:
- suitable: Most ingredients are beneficial or neutral for their skin type; minimal concerning ingredients
- caution: Mix of beneficial and problematic ingredients; can use with monitoring
- unsuitable: Contains ingredients likely to worsen their specific acne type or skin concerns

Return ONLY valid JSON, no markdown.`,
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
      JSON.stringify(savedScan || {
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
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('scan-product error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
