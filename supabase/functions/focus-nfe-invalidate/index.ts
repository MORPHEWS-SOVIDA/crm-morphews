import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOCUS_NFE_GLOBAL_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
const FOCUS_NFE_PRODUCTION_URL = 'https://api.focusnfe.com.br/v2';
const FOCUS_NFE_HOMOLOGACAO_URL = 'https://homologacao.focusnfe.com.br/v2';

interface InvalidateRequest {
  fiscal_company_id: string;
  serie: number;
  start_number: number;
  end_number: number;
  justification: string;
}

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

    const body: InvalidateRequest = await req.json();
    const { fiscal_company_id, serie, start_number, end_number, justification } = body;

    // Validate inputs
    if (!fiscal_company_id || !serie || !start_number || !end_number || !justification) {
      return new Response(JSON.stringify({ error: 'Todos os campos são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (justification.length < 15) {
      return new Response(JSON.stringify({ error: 'Justificativa deve ter pelo menos 15 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (start_number > end_number) {
      return new Response(JSON.stringify({ error: 'Número inicial deve ser menor ou igual ao final' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get fiscal company
    const { data: fiscalCompany, error: companyError } = await supabase
      .from('fiscal_companies')
      .select('*')
      .eq('id', fiscal_company_id)
      .single();

    if (companyError || !fiscalCompany) {
      return new Response(JSON.stringify({ error: 'Empresa fiscal não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine environment
    const environment = fiscalCompany.nfe_environment || 'homologacao';
    
    // Get token
    const companyToken = environment === 'producao' 
      ? fiscalCompany.focus_nfe_token_producao 
      : fiscalCompany.focus_nfe_token_homologacao;
    const focusToken = companyToken || FOCUS_NFE_GLOBAL_TOKEN;
    
    if (!focusToken) {
      return new Response(JSON.stringify({ 
        error: `Token Focus NFe não configurado para ambiente de ${environment === 'producao' ? 'produção' : 'homologação'}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const focusBaseUrl = environment === 'producao' 
      ? FOCUS_NFE_PRODUCTION_URL 
      : FOCUS_NFE_HOMOLOGACAO_URL;

    // Build payload for Focus NFe Inutilização API
    const cnpj = String(fiscalCompany.cnpj).replace(/\D/g, '');
    
    const focusPayload = {
      cnpj: cnpj,
      serie: serie,
      numero_inicial: start_number,
      numero_final: end_number,
      justificativa: justification,
    };

    console.log('Focus NFe Invalidate payload:', focusPayload);

    // Call Focus NFe API for inutilização
    const focusUrl = `${focusBaseUrl}/nfe/inutilizacao`;
    
    const focusResponse = await fetch(focusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(focusToken + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(focusPayload),
    });

    const responseText = await focusResponse.text();
    console.log('Focus NFe Invalidate response:', responseText);
    
    let focusResult: Record<string, unknown>;
    try {
      focusResult = JSON.parse(responseText);
    } catch {
      focusResult = {
        codigo: 'erro_desconhecido',
        mensagem: `Resposta inesperada: ${responseText.substring(0, 200)}`,
      };
    }

    // Check for success
    const status = String(focusResult.status || '').toLowerCase();
    const codigo = String(focusResult.codigo || '').toLowerCase();

    if (status === 'autorizado' || status === 'inutilizado') {
      // Success - update fiscal company's last number if needed
      const currentLastNumber = fiscalCompany.nfe_last_number || 0;
      if (end_number > currentLastNumber) {
        await supabase
          .from('fiscal_companies')
          .update({ nfe_last_number: end_number })
          .eq('id', fiscal_company_id);
      }

      return new Response(JSON.stringify({
        success: true,
        status: focusResult.status,
        protocolo: focusResult.protocolo,
        message: focusResult.mensagem || 'Inutilização realizada com sucesso',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Error response
    const errorMessage = focusResult.mensagem || focusResult.mensagem_sefaz || 'Erro na inutilização';
    return new Response(JSON.stringify({
      error: errorMessage,
      focus_response: focusResult,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-invalidate:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
