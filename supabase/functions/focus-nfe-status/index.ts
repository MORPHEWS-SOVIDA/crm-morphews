import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOCUS_NFE_GLOBAL_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
const FOCUS_NFE_BASE_URL = 'https://api.focusnfe.com.br/v2';

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

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get invoice with fiscal company
    const { data: invoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .select(`
        *,
        fiscal_company:fiscal_companies(
          id,
          cnpj,
          nfe_environment,
          nfse_environment,
          focus_nfe_token_homologacao,
          focus_nfe_token_producao
        )
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Nota fiscal não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fiscalCompany = invoice.fiscal_company;
    if (!fiscalCompany) {
      return new Response(JSON.stringify({ error: 'Empresa fiscal não encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine environment based on invoice type
    const environment = invoice.invoice_type === 'nfse' 
      ? fiscalCompany.nfse_environment 
      : fiscalCompany.nfe_environment;
    
    // Select token based on environment
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

    // Query Focus NFe for status
    const endpoint = invoice.invoice_type === 'nfe' ? '/nfe' : '/nfse';
    console.log(`Querying Focus NFe: ${FOCUS_NFE_BASE_URL}${endpoint}/${invoice.focus_nfe_ref}`);
    console.log(`Using token (first 6 chars): ${focusToken?.substring(0, 6)}...`);
    console.log(`Environment: ${environment}`);
    
    const focusResponse = await fetch(`${FOCUS_NFE_BASE_URL}${endpoint}/${invoice.focus_nfe_ref}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(focusToken + ':')}`,
      },
    });

    // Handle non-JSON responses (like 401 errors)
    const responseText = await focusResponse.text();
    console.log('Focus NFe raw response:', responseText);
    
    let focusResult: Record<string, unknown>;
    try {
      focusResult = JSON.parse(responseText);
    } catch {
      // If response is not JSON, it's likely an auth error
      if (focusResponse.status === 401 || responseText.includes('HTTP Basic')) {
        focusResult = {
          codigo: 'erro_autenticacao',
          mensagem: `Token Focus NFe inválido ou empresa não autorizada. Status HTTP: ${focusResponse.status}`,
        };
      } else {
        focusResult = {
          codigo: 'erro_desconhecido',
          mensagem: `Resposta inesperada do Focus NFe: ${responseText.substring(0, 100)}`,
        };
      }
    }
    
    console.log('Focus NFe parsed response:', focusResult);

    // Update invoice with current status
    const updateData: Record<string, unknown> = {
      focus_nfe_response: focusResult,
    };

    if (focusResult.status === 'autorizado') {
      updateData.status = 'authorized';
      updateData.invoice_number = focusResult.numero;
      updateData.invoice_series = focusResult.serie;
      updateData.access_key = focusResult.chave_nfe;
      updateData.verification_code = focusResult.codigo_verificacao;
      updateData.protocol_number = focusResult.protocolo;
      updateData.xml_url = focusResult.caminho_xml_nota_fiscal;
      updateData.pdf_url = focusResult.caminho_danfe;
      if (!invoice.authorized_at) {
        updateData.authorized_at = new Date().toISOString();
      }
    } else if (focusResult.status === 'cancelado') {
      updateData.status = 'cancelled';
      if (!invoice.cancelled_at) {
        updateData.cancelled_at = new Date().toISOString();
      }
    } else if (focusResult.status === 'erro_autorizacao' || focusResult.status === 'erro_validacao') {
      updateData.status = 'rejected';
      updateData.error_message = focusResult.mensagem || (focusResult.erros as string[])?.join(', ');
    } else if (focusResult.codigo === 'nao_encontrado') {
      updateData.status = 'rejected';
      updateData.error_message = 'Nota não encontrada no Focus NFe. Pode ter sido criada com token incorreto ou nunca enviada.';
    } else if (focusResult.codigo === 'permissao_negada') {
      updateData.status = 'rejected';
      updateData.error_message = `Permissão negada: ${focusResult.mensagem}. Verifique se a empresa está homologada no Focus NFe.`;
    } else if (focusResult.codigo === 'erro_autenticacao') {
      updateData.status = 'rejected';
      updateData.error_message = String(focusResult.mensagem);
    }

    await supabase
      .from('fiscal_invoices')
      .update(updateData)
      .eq('id', invoice_id);

    return new Response(JSON.stringify({
      success: true,
      status: updateData.status || invoice.status,
      focus_status: focusResult.status || focusResult.codigo,
      message: focusResult.mensagem,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-status:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
