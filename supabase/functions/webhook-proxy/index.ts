/**
 * Webhook Proxy - Redireciona requisições para a edge function de integração
 * Permite usar URL customizada: https://crm.morphews.com/functions/v1/webhook-proxy?token=...
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the request body
    let body = null;
    if (req.method !== 'GET') {
      try {
        body = await req.text();
      } catch (e) {
        // No body
      }
    }

    // Forward to the integration-webhook function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const targetUrl = `${supabaseUrl}/functions/v1/integration-webhook?token=${token}`;

    console.log(`Proxying request to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });

    const responseData = await response.text();
    
    return new Response(responseData, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Erro no proxy', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
