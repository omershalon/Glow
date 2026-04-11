import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'Missing image_base64' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `You are an expert dermatologist AI. Carefully analyze this face photo. Look at pore size, oiliness, dryness, redness, breakout locations, lesion types, and texture.

Based on what you ACTUALLY SEE in this specific photo, return your analysis.

Look at:
- WHERE are breakouts? (jawline = hormonal, forehead = fungal/comedonal, cheeks = inflammatory)
- WHAT type of lesions? (deep bumps = cystic, blackheads = comedonal, red inflamed = inflammatory, uniform small bumps = fungal)
- HOW oily/dry? (shiny T-zone = oily, flaky = dry, uniform = normal)
- HOW severe? (few spots = mild, noticeable = moderate, widespread = severe)
- severity_score: 0-100 (0 = clear, 100 = most severe)

Analyze each ZONE of the face separately.

Return ONLY valid JSON, no markdown:
{"skin_type":"oily","acne_type":"hormonal","severity":"moderate","severity_score":63,"analysis_notes":"2-3 sentences about this specific skin.","findings":[{"title":"Finding","description":"explanation"},{"title":"Finding","description":"explanation"},{"title":"Finding","description":"explanation"}],"zones":{"forehead":{"severity":"mild","note":"description"},"left_cheek":{"severity":"clear","note":"description"},"right_cheek":{"severity":"moderate","note":"description"},"nose":{"severity":"mild","note":"description"},"chin":{"severity":"moderate","note":"description"},"jawline":{"severity":"severe","note":"description"}},"confidence":0.85}

skin_type: oily | dry | combination | sensitive | normal
acne_type: hormonal | cystic | comedonal | fungal | inflammatory
severity: mild | moderate | severe
Return ONLY the JSON object.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: image_base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Gemini API error', details: err }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let result;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {
          result = { skin_type: 'combination', acne_type: 'comedonal', severity: 'mild', analysis_notes: 'Could not parse. Try again with better lighting.', confidence: 0.5 };
        }
      } else {
        result = { skin_type: 'combination', acne_type: 'comedonal', severity: 'mild', analysis_notes: 'Could not parse. Try again with better lighting.', confidence: 0.5 };
      }
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal error', details: String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
