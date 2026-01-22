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

    const { fiscal_company_id, environment = 'homologacao' } = await req.json();

    if (!fiscal_company_id) {
      return new Response(JSON.stringify({ error: 'fiscal_company_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the fiscal company with all details
    const { data: company, error: companyError } = await supabase
      .from('fiscal_companies')
      .select('*')
      .eq('id', fiscal_company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Empresa fiscal não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean CNPJ (remove formatting)
    const cnpj = company.cnpj.replace(/\D/g, '');

    // Map tax regime to Focus NFe format
    const regimeTributarioMap: Record<string, number> = {
      'simples_nacional': 1,
      'simples_nacional_excesso': 2,
      'lucro_presumido': 3,
      'lucro_real': 3,
    };

    // Build the company payload for Focus NFe API
    const focusCompanyData: Record<string, unknown> = {
      nome: company.company_name,
      nome_fantasia: company.trade_name || company.company_name,
      cnpj,
      inscricao_estadual: company.state_registration || '',
      inscricao_municipal: company.municipal_registration || '',
      regime_tributario: regimeTributarioMap[company.tax_regime] || 1,
      
      // Address
      logradouro: company.address_street || '',
      numero: company.address_number || 'S/N',
      complemento: company.address_complement || '',
      bairro: company.address_neighborhood || '',
      municipio: company.address_city || '',
      uf: company.address_state || '',
      cep: company.address_zip?.replace(/\D/g, '') || '',
      codigo_municipio: company.address_city_code || '',
      
      // Contact
      email: company.email || '',
      telefone: company.phone?.replace(/\D/g, '') || '',
      
      // Fiscal settings
      habilita_nfe: true,
      habilita_nfse: true,
      enviar_email_destinatario: false, // Can be configured later
    };

    // IMPORTANT (Focus NFe): the *company management* endpoints (/v2/empresas and /v2/hooks)
    // live on the production API domain, even when the company will be used for homologação.
    // Using homologacao.focusnfe.com.br for /v2/empresas returns 404.
    const baseUrl = 'https://api.focusnfe.com.br';
    const apiUrl = `${baseUrl}/v2/empresas`;

    console.log('Creating company in Focus NFe:', { cnpj, environment, apiUrl, payload: focusCompanyData });

    // Create the company in Focus NFe
    // Try with token query parameter as an alternative auth method
    const response = await fetch(`${apiUrl}?token=${focusToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(focusCompanyData),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('Focus NFe response:', response.status, responseData);

    if (!response.ok) {
      // Check for specific errors
      const errorMsg = responseData?.mensagem || responseData?.erros?.[0]?.mensagem || 'Erro ao criar empresa no Focus NFe';
      
      // If company already exists, try to get its ID
      if (response.status === 422 && errorMsg.includes('já existe')) {
        // Try to get the existing company
        const getResponse = await fetch(`${apiUrl}/${cnpj}?token=${focusToken}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (getResponse.ok) {
          const existingCompany = await getResponse.json();
          
          // Update our record with the Focus NFe ID
          await supabase
            .from('fiscal_companies')
            .update({ 
              focus_nfe_company_id: existingCompany.id || cnpj,
              nfe_environment: environment,
            })
            .eq('id', fiscal_company_id);
          
          return new Response(JSON.stringify({ 
            success: true,
            message: 'Empresa já estava cadastrada no Focus NFe',
            focus_company_id: existingCompany.id || cnpj,
            company: existingCompany,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      return new Response(JSON.stringify({ 
        success: false,
        error: errorMsg,
        details: responseData,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Success - update our record with the Focus NFe ID
    const focusCompanyId = responseData.id || cnpj;
    
    await supabase
      .from('fiscal_companies')
      .update({ 
        focus_nfe_company_id: focusCompanyId,
        nfe_environment: environment,
      })
      .eq('id', fiscal_company_id);

    // Now try to register webhooks for this company
    const webhookUrl = `${supabaseUrl}/functions/v1/focus-nfe-webhook`;
    const webhookSecret = Deno.env.get('FOCUS_WEBHOOK_SECRET') || 'morphews_focus_webhook_2024';
    
    const webhookResults = [];
    for (const event of ['nfe', 'nfse']) {
      try {
        const webhookResponse = await fetch(`${baseUrl}/v2/hooks?token=${focusToken}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cnpj,
            event,
            url: webhookUrl,
            authorization_key: webhookSecret,
            authorization_header: 'X-Webhook-Secret',
          }),
        });
        
        webhookResults.push({
          event,
          success: webhookResponse.ok,
          status: webhookResponse.status,
        });
      } catch (err) {
        console.error(`Webhook registration error for ${event}:`, err);
        webhookResults.push({ event, success: false, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Empresa cadastrada com sucesso no Focus NFe!',
      focus_company_id: focusCompanyId,
      company: responseData,
      webhooks: webhookResults,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-create-company:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
