// Proxy to download fiscal XML files (bypasses CORS from api.focusnfe.com.br)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let xmlUrl: string | null = null;
    if (req.method === 'GET') {
      const u = new URL(req.url);
      xmlUrl = u.searchParams.get('url');
    } else {
      const body = await req.json().catch(() => ({}));
      xmlUrl = body?.url ?? null;
    }

    if (!xmlUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate it points to Focus NFe / NFE storage to avoid open proxy abuse
    const allowedHosts = ['api.focusnfe.com.br', 'focusnfe.com.br', 'homologacao.focusnfe.com.br'];
    const target = new URL(xmlUrl);
    if (!allowedHosts.includes(target.hostname)) {
      return new Response(JSON.stringify({ error: 'Host not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const FOCUS_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
    const headers: Record<string, string> = {};
    if (FOCUS_TOKEN) {
      headers['Authorization'] = 'Basic ' + btoa(`${FOCUS_TOKEN}:`);
    }

    const upstream = await fetch(xmlUrl, { headers });
    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: 'Upstream error', status: upstream.status, body: text }), {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
