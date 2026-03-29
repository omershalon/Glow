import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

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

    const { skin_profile_id } = await req.json();
    if (!skin_profile_id) {
      return new Response(
        JSON.stringify({ error: 'Missing skin_profile_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch skin profile
    const { data: skinProfile, error: skinError } = await supabaseClient
      .from('skin_profiles')
      .select('*')
      .eq('id', skin_profile_id)
      .single();

    if (skinError || !skinProfile) {
      return new Response(
        JSON.stringify({ error: 'Skin profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch onboarding data
    const { data: onboarding } = await supabaseClient
      .from('onboarding_data')
      .select('*')
      .eq('user_id', skinProfile.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
    });

    const contextInfo = `
Skin Profile:
- Skin Type: ${skinProfile.skin_type}
- Acne Type: ${skinProfile.acne_type}
- Severity: ${skinProfile.severity}
- Analysis Notes: ${skinProfile.analysis_notes}

${onboarding ? `User Background:
- Age Range: ${onboarding.age_range}
- Acne Duration: ${onboarding.acne_duration}
- Previously tried: ${onboarding.tried_products?.join(', ') || 'None specified'}
- Known Allergies: ${onboarding.known_allergies?.join(', ') || 'None'}
- Main Concerns: ${onboarding.skin_concerns?.join(', ') || 'Not specified'}` : ''}`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `You are an expert dermatologist and nutritionist creating a comprehensive, personalized skincare plan.

${contextInfo}

Create a complete 4-pillar skincare plan as a JSON object with this EXACT structure:

{
  "products_pillar": {
    "morning_routine": [
      {
        "step": 1,
        "name": "Step Name",
        "product_type": "e.g. Gentle Cleanser",
        "key_ingredients": ["ingredient1", "ingredient2"],
        "instructions": "Specific usage instructions"
      }
    ],
    "evening_routine": [same structure, 4-6 steps],
    "ingredients_to_use": ["ingredient1", "ingredient2", ...at least 8],
    "ingredients_to_avoid": ["ingredient1", "ingredient2", ...at least 8],
    "top_product_recommendations": ["Product type 1", "Product type 2", ...5 items]
  },
  "diet_pillar": {
    "foods_to_eat": [
      {
        "food": "Food name",
        "reason": "Why it helps for their specific skin type/acne",
        "frequency": "Daily/3x week/etc"
      }
    ],
    "foods_to_reduce": [same structure, at least 6],
    "meal_swaps": [
      {
        "instead_of": "Problematic food",
        "try": "Better alternative",
        "why": "Specific reason"
      }
    ],
    "supplements": [
      {
        "name": "Supplement",
        "dose": "Dosage",
        "benefit": "Specific benefit for their skin"
      }
    ],
    "hydration_tips": ["tip1", "tip2", ...]
  },
  "herbal_pillar": {
    "remedies": [
      {
        "name": "Herb/remedy name",
        "form": "Topical/Internal/Both",
        "dosage": "Specific dosage or application amount",
        "application": "How to use",
        "evidence": "Brief evidence summary",
        "caution": "Any cautions or null"
      }
    ],
    "diy_masks": [
      {
        "name": "Mask name",
        "ingredients": ["ingredient1", "ingredient2"],
        "instructions": "Step by step",
        "frequency": "How often"
      }
    ],
    "teas": [
      {
        "name": "Tea name",
        "benefit": "Specific skin benefit",
        "preparation": "How to prepare"
      }
    ]
  },
  "lifestyle_pillar": {
    "daily_habits": [
      {
        "habit": "Habit description",
        "frequency": "Daily/Weekly/etc",
        "why": "Why it helps their specific skin condition",
        "how_to_start": "Actionable first step"
      }
    ],
    "sleep_tips": ["tip1", "tip2", ...at least 4],
    "stress_management": ["technique1", "technique2", ...at least 4],
    "exercise_guidance": "Detailed exercise recommendation paragraph",
    "things_to_avoid": ["thing1", "thing2", ...at least 5]
  }
}

Make ALL recommendations SPECIFIC to their skin type (${skinProfile.skin_type}), acne type (${skinProfile.acne_type}), and severity (${skinProfile.severity}).
${onboarding?.known_allergies?.length ? `IMPORTANT: Avoid products/ingredients they are allergic to: ${onboarding.known_allergies.join(', ')}` : ''}
${onboarding?.tried_products?.length ? `Note they have already tried: ${onboarding.tried_products.join(', ')} - suggest alternatives or complementary approaches.` : ''}

Return ONLY valid JSON, no markdown formatting, no explanation text.`,
        },
      ],
    });

    // Extract text content
    let planText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        planText = block.text;
        break;
      }
    }

    // Parse the plan
    let plan;
    try {
      const cleaned = planText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      plan = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, planText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deactivate existing plans
    await supabaseClient
      .from('personalized_plans')
      .update({ is_active: false })
      .eq('user_id', skinProfile.user_id);

    // Save the new plan
    const { data: savedPlan, error: saveError } = await supabaseClient
      .from('personalized_plans')
      .insert({
        user_id: skinProfile.user_id,
        skin_profile_id: skin_profile_id,
        products_pillar: plan.products_pillar,
        diet_pillar: plan.diet_pillar,
        herbal_pillar: plan.herbal_pillar,
        lifestyle_pillar: plan.lifestyle_pillar,
        is_active: true,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save error:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save plan', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(savedPlan),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('generate-plan error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
