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
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { fiscal_company_id, events } = await req.json();

    if (!fiscal_company_id) {
      return new Response(JSON.stringify({ error: 'fiscal_company_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the fiscal company to get the CNPJ
    const { data: company, error: companyError } = await supabase
      .from('fiscal_companies')
      .select('cnpj')
      .eq('id', fiscal_company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Fiscal company not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean CNPJ (remove formatting)
    const cnpj = company.cnpj.replace(/\D/g, '');

    // Webhook URL for this project
    const webhookUrl = `${supabaseUrl}/functions/v1/focus-nfe-webhook`;

    // Events to register (default to both nfe and nfse)
    const eventsToRegister = events || ['nfe', 'nfse'];
    
    const results = [];
    const focusApiUrl = 'https://api.focusnfe.com.br/v2/hooks';

    for (const event of eventsToRegister) {
      try {
        const response = await fetch(focusApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(focusToken + ':'),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cnpj,
            event,
            url: webhookUrl,
          }),
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        results.push({
          event,
          success: response.ok,
          status: response.status,
          data: responseData,
        });

        console.log(`Webhook registration for ${event}:`, response.status, responseData);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({
          event,
          success: false,
          error: message,
        });
      }
    }

    // Check if any succeeded
    const anySuccess = results.some(r => r.success);

    return new Response(JSON.stringify({ 
      success: anySuccess,
      webhook_url: webhookUrl,
      results 
    }), {
      status: anySuccess ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-register-hooks:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
