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

    // Preserve any suffix after /webhook-proxy (e.g. /test)
    const path = url.pathname;
    const suffix = path.includes('/webhook-proxy')
      ? (path.split('/webhook-proxy')[1] || '')
      : '';

    // Forward to the integration-webhook function
    const backendUrl = Deno.env.get('SUPABASE_URL')!;

    const forwardParams = new URLSearchParams(url.searchParams);
    forwardParams.set('token', token);

    const targetUrl = `${backendUrl}/functions/v1/integration-webhook${suffix}?${forwardParams.toString()}`;

    console.log(`Proxying request to: ${targetUrl}`);

    // Forward headers (preserve original Content-Type)
    const headers = new Headers(req.headers);
    headers.delete('host');
    headers.delete('content-length');

    // Forward body (raw) to support JSON/urlencoded payloads
    let body: ArrayBuffer | undefined = undefined;
    if (!['GET', 'HEAD'].includes(req.method)) {
      try {
        body = await req.arrayBuffer();
      } catch {
        body = undefined;
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseData = await response.text();
    const responseContentType = response.headers.get('content-type') || 'application/json';

    return new Response(responseData, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': responseContentType },
    });
  } catch (error) {
    console.error('Proxy error:', error);

    return new Response(
      JSON.stringify({ error: 'Erro no proxy', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
