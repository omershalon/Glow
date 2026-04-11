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
      return new Response(JSON.stringify({ reply: 'The skin coach is temporarily unavailable. Please try again later.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ reply: 'Invalid request.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, message, history } = body;
    if (!user_id || !message) {
      return new Response(JSON.stringify({ reply: 'Please type a message to get started!' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user context — all optional, never fail
    let userContext = '';
    try {
      const [skinRes, planRes, onboardingRes] = await Promise.all([
        supabaseClient.from('skin_profiles').select('skin_type, acne_type, severity, analysis_notes').eq('user_id', user_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabaseClient.from('personalized_plans').select('ranked_items').eq('user_id', user_id).eq('is_active', true).maybeSingle(),
        supabaseClient.from('onboarding_data').select('age_range, acne_duration, tried_products, known_allergies, skin_concerns').eq('user_id', user_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const skin = skinRes.data;
      const plan = planRes.data;
      const onboarding = onboardingRes.data;

      if (skin) {
        userContext += `\nUser's skin profile: ${skin.skin_type} skin, ${skin.acne_type} acne, ${skin.severity} severity.`;
        if (skin.analysis_notes) userContext += ` AI scan notes: ${skin.analysis_notes}`;
      }
      if (plan?.ranked_items) {
        const items = (plan.ranked_items as any[]).map((i: any) => `${i.title} (${i.pillar})`).join(', ');
        userContext += `\nUser's current plan items: ${items}`;
      }
      if (onboarding) {
        if (onboarding.age_range) userContext += `\nAge range: ${onboarding.age_range}`;
        if (onboarding.acne_duration) userContext += `\nAcne duration: ${onboarding.acne_duration}`;
        if (onboarding.tried_products?.length) userContext += `\nProducts tried: ${onboarding.tried_products.join(', ')}`;
        if (onboarding.known_allergies?.length) userContext += `\nAllergies: ${onboarding.known_allergies.join(', ')}`;
        if (onboarding.skin_concerns?.length) userContext += `\nConcerns: ${onboarding.skin_concerns.join(', ')}`;
      }
    } catch (dbErr) {
      console.error('DB fetch error (non-fatal):', dbErr);
    }

    const systemPrompt = `You are SkinX's Skin Coach. You text like a knowledgeable friend — casual, short, easy to read.

STYLE:
- Reply in 2-3 SHORT sentences max. Like texting a friend who knows skin stuff.
- Use simple words. No medical jargon unless asked.
- One idea per message. Don't dump everything at once.
- No bullet points, no bold, no markdown, no numbered lists, no emojis.
- If they ask a big question, give the #1 most important thing first. They can ask follow-ups.

RULES:
- ONLY answer skin/skincare/acne questions. For anything else say "I can only help with skin stuff! What's going on with your skin?"
- Reference their actual skin data when relevant.
- Never diagnose. If it sounds serious, say "that's worth checking with a derm."

USER'S SKIN DATA:${userContext || '\nNo skin profile yet — tell them to take a skin scan first.'}`;

    const messages: { role: string; content: string }[] = [];
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: message });

    // Build Gemini conversation: system prompt + history + current message
    const geminiContents = [];

    // System instruction as first user message
    geminiContents.push({ role: 'user', parts: [{ text: systemPrompt + '\n\nRespond as the Skin Coach from now on.' }] });
    geminiContents.push({ role: 'model', parts: [{ text: 'Got it! I\'m your Skin Coach. What\'s going on with your skin?' }] });

    // Chat history
    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini API error:', res.status, err);
      return new Response(JSON.stringify({ reply: 'I had trouble thinking of a response. Please try again in a moment.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gemini = await res.json();
    const reply = gemini.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I had trouble responding. Please try again.';

    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('chat-skin-coach error:', err);
    return new Response(JSON.stringify({ reply: 'Something went wrong. Please try again.' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
