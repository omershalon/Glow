import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Create products table via RPC if it doesn't exist
  const { error: rpcErr } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS public.products (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        asin TEXT NOT NULL,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'cleanser',
        image_url TEXT DEFAULT '',
        price_cents INTEGER DEFAULT 0,
        description TEXT DEFAULT '',
        skin_types TEXT[] DEFAULT '{}',
        acne_types TEXT[] DEFAULT '{}',
        match_tags TEXT[] DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "Anyone can read products" ON public.products FOR SELECT USING (true);
      CREATE POLICY IF NOT EXISTS "Service role manages products" ON public.products FOR ALL USING (auth.role() = 'service_role');
    `
  });

  // If RPC doesn't exist, try direct insert to test
  if (rpcErr) {
    // Table might already exist, try inserting
    console.log('RPC not available, assuming table needs manual creation:', rpcErr.message);
  }

  return new Response(JSON.stringify({ status: 'done', rpcError: rpcErr?.message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
