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
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), {
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

    // ── Gather ALL available data about this user ──

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

    // Fetch everything in parallel
    const [obRes, scansRes, progressRes] = await Promise.all([
      // Onboarding data
      supabaseClient
        .from('onboarding_data')
        .select('age_range, acne_duration, tried_products, known_allergies, skin_concerns')
        .eq('user_id', skin.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Product scan history (what products they've checked)
      supabaseClient
        .from('product_scans')
        .select('product_name, verdict, ingredients')
        .eq('user_id', skin.user_id)
        .order('created_at', { ascending: false })
        .limit(20),

      // Progress photos (skin improvement tracking)
      supabaseClient
        .from('progress_photos')
        .select('severity_score, improvement_percentage, analysis_notes, annotations, created_at')
        .eq('user_id', skin.user_id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const ob = obRes.data;
    const scans = scansRes.data || [];
    const progress = progressRes.data || [];

    // ── Build rich context sections ──

    // Skin profile
    const skinContext = [
      `Skin type: ${skin.skin_type}`,
      `Acne type: ${skin.acne_type}`,
      `Severity: ${skin.severity}`,
      skin.analysis_notes ? `AI scan analysis: ${skin.analysis_notes}` : '',
    ].filter(Boolean).join('\n');

    // Onboarding context
    const onboardingContext = ob ? [
      `Age range: ${ob.age_range}`,
      `Acne duration: ${ob.acne_duration}`,
      ob.tried_products?.length ? `Products already tried: ${ob.tried_products.join(', ')}` : '',
      ob.known_allergies?.length ? `Known allergies: ${ob.known_allergies.join(', ')}` : '',
      ob.skin_concerns?.length ? `Primary concerns: ${ob.skin_concerns.join(', ')}` : '',
    ].filter(Boolean).join('\n') : '';

    // Product scan history — what they've scanned and results
    const scanContext = scans.length > 0
      ? `Products scanned recently:\n${scans.map(s =>
          `- ${s.product_name}: ${s.verdict}${s.ingredients?.length ? ` (contains: ${s.ingredients.slice(0, 5).join(', ')})` : ''}`
        ).join('\n')}`
      : '';

    // Progress tracking — how their skin has been changing
    const progressContext = progress.length > 0
      ? `Skin progress tracking (most recent first):\n${progress.map(p => {
          const date = new Date(p.created_at).toLocaleDateString();
          const improvement = p.improvement_percentage != null ? ` | ${p.improvement_percentage}% improvement` : '';
          const zones = p.annotations ? Object.entries(p.annotations as Record<string, string>)
            .filter(([_, v]) => v && v !== 'clear')
            .map(([zone, note]) => `${zone}: ${note}`)
            .join(', ') : '';
          return `- ${date}: severity ${p.severity_score}/10${improvement}${zones ? ` | Zones: ${zones}` : ''}${p.analysis_notes ? ` | Notes: ${p.analysis_notes.substring(0, 100)}` : ''}`;
        }).join('\n')}`
      : '';

    // Products they found suitable vs unsuitable
    const suitableProducts = scans.filter(s => s.verdict === 'suitable').map(s => s.product_name);
    const unsuitableProducts = scans.filter(s => s.verdict === 'unsuitable').map(s => s.product_name);
    const productInsight = [
      suitableProducts.length ? `Products that worked for them: ${suitableProducts.join(', ')}` : '',
      unsuitableProducts.length ? `Products that did NOT work: ${unsuitableProducts.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    // ── Assemble the full prompt ──

    const prompt = `You are a holistic skin health practitioner who combines ancestral wisdom with evidence-based dermatology. You take a root-cause, whole-body approach to skin health. Your philosophy:

- NATURAL FIRST: Prioritize plant-based, clean, and traditional remedies over synthetic/pharmaceutical products.
- CLEAN FORMULATIONS: When recommending actives (retinoids, BHA, niacinamide, zinc), suggest them in clean/natural forms — willow bark extract as natural BHA, bakuchiol or rosehip oil as retinol alternatives, food-based zinc. Never recommend CeraVe, Neutrogena, La Roche-Posay, or similar mainstream/corporate brands.
- ROOT CAUSE: Skin problems reflect internal imbalances — gut health, hormones, inflammation, nutrient deficiencies, toxin load, stress. Address the root cause.
- ANCESTRAL HEALTH: Draw from Ayurveda (neem, triphala, manjistha, ashwagandha), TCM (gua sha, herbal formulas), and ancestral nutrition (bone broth, fermented foods, wild-caught fish). Grounding, cold exposure, morning sunlight, filtered water.

═══ PATIENT PROFILE ═══
${skinContext}

${onboardingContext ? `═══ PATIENT HISTORY ═══\n${onboardingContext}\n` : ''}
${productInsight ? `═══ PRODUCT EXPERIENCE ═══\n${productInsight}\n` : ''}
${scanContext ? `═══ RECENT PRODUCT SCANS ═══\n${scanContext}\n` : ''}
${progressContext ? `═══ SKIN PROGRESS OVER TIME ═══\n${progressContext}\n` : ''}

═══ YOUR TASK ═══
Generate exactly 8 actionable recommendations across ALL 4 pillars (at least 1 per pillar):

PRODUCT picks: Clean/natural skincare only. Recommend specific natural ingredients — tallow balm, rosehip oil (natural vitamin A), willow bark (natural BHA), tea tree oil, bakuchiol, manuka honey, niacinamide in clean formulations, zinc oxide mineral SPF. Favor brands like Santa Cruz Paleo, Cocokind, Herbivore, OSEA, Pai, Badger, Weleda, True Botanicals.

DIET picks: Whole-food nutrition that's approachable but real. Be specific — "bone broth daily" not "eat healthy". Recommend: bone broth (collagen + gut healing), wild-caught salmon (omega-3), avocados, blueberries, fermented foods (kombucha, sauerkraut, kefir, kimchi for gut-skin axis), green tea, walnuts, sweet potatoes, raw manuka honey. Recommend eliminating: dairy, refined sugar, seed oils (canola, soybean, sunflower), processed foods, whey protein. No organ meats — keep it approachable.

HERBAL picks: Traditional herbs with real evidence + specific dosages. Spearmint tea (anti-androgen, 2 cups/day), ashwagandha (cortisol reduction), neem (Ayurvedic purification), triphala (digestive cleanse), manjistha (blood purifying), burdock root (liver + skin), holy basil/tulsi (adaptogen), turmeric + black pepper (anti-inflammatory), dandelion root (liver detox).

LIFESTYLE picks: Natural practices — morning sunlight 10-20 min (circadian reset + vitamin D), grounding/earthing barefoot on grass, cold showers or ice rolling (reduces inflammation), gua sha facial massage (lymphatic drainage), silk/satin pillowcase (less friction), breathwork or meditation (cortisol management), exercise (sweating = detox), clean water (filtered, no fluoride).

CRITICAL FORMAT — titles must be 1-3 words, rationale is a short actionable subtitle:
{"pillar":"product","title":"Rosehip oil","rationale":"Natural vitamin A alt · nightly","impact_rank":1}
{"pillar":"diet","title":"Bone broth","rationale":"1 cup daily · collagen + gut healing","impact_rank":2}
{"pillar":"herbal","title":"Spearmint tea","rationale":"2 cups daily · anti-androgen","impact_rank":3}
{"pillar":"lifestyle","title":"Morning sunlight","rationale":"15 min · circadian + vitamin D","impact_rank":4}

Return ONLY a JSON array. No markdown. No explanation. No backticks.
[{"pillar":"...","title":"...","rationale":"...","impact_rank":1}, ...8 items]

pillar values: product | diet | herbal | lifestyle
Exactly 8 items. At least 1 per pillar. impact_rank 1 = highest priority.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1500 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Gemini API error', details: err }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gemini = await res.json();
    const text = gemini.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

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
