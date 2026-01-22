import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: 'Organização não encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { api_key, key_type } = body;

    if (!api_key || !key_type) {
      return new Response(JSON.stringify({ error: 'api_key e key_type são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Encrypt the API key using pgcrypto
    const encryptionKey = Deno.env.get('ENCRYPTION_SECRET') || 'morphews-fiscal-key-2024';
    
    // Use pgcrypto to encrypt
    const { data: encryptedResult, error: encryptError } = await supabase.rpc(
      'encrypt_value',
      { 
        plain_text: api_key,
        encryption_key: encryptionKey,
      }
    );

    // If encrypt_value function doesn't exist, store with simple obfuscation
    let encryptedKey = api_key;
    if (!encryptError && encryptedResult) {
      encryptedKey = encryptedResult;
    } else {
      // Simple base64 obfuscation as fallback
      encryptedKey = btoa(api_key);
    }

    // Upsert config
    const { data: existing } = await supabase
      .from('fiscal_auto_send_config')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('fiscal_auto_send_config')
        .update({ resend_api_key_encrypted: encryptedKey })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('fiscal_auto_send_config')
        .insert({
          organization_id: profile.organization_id,
          resend_api_key_encrypted: encryptedKey,
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in fiscal-save-api-key:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
