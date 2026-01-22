import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOCUS_NFE_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
const FOCUS_NFE_PRODUCTION_URL = 'https://api.focusnfe.com.br/v2';
const FOCUS_NFE_HOMOLOGACAO_URL = 'https://homologacao.focusnfe.com.br/v2';

interface EmitRequest {
  sale_id: string;
  invoice_type: 'nfe' | 'nfse';
  fiscal_company_id?: string;
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

    const body: EmitRequest = await req.json();
    const { sale_id, invoice_type, fiscal_company_id } = body;

    if (!sale_id || !invoice_type) {
      return new Response(JSON.stringify({ error: 'sale_id e invoice_type são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get sale with items and lead
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        lead:leads(*),
        items:sale_items(*, product:lead_products(*))
      `)
      .eq('id', sale_id)
      .single();

    if (saleError || !sale) {
      return new Response(JSON.stringify({ error: 'Venda não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get fiscal company
    let fiscalCompanyQuery = supabase
      .from('fiscal_companies')
      .select('*')
      .eq('organization_id', sale.organization_id)
      .eq('is_active', true);

    if (fiscal_company_id) {
      fiscalCompanyQuery = fiscalCompanyQuery.eq('id', fiscal_company_id);
    } else {
      fiscalCompanyQuery = fiscalCompanyQuery.eq('is_primary', true);
    }

    const { data: fiscalCompany, error: companyError } = await fiscalCompanyQuery.single();

    if (companyError || !fiscalCompany) {
      return new Response(JSON.stringify({ error: 'Empresa fiscal não encontrada. Configure uma empresa nas configurações.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fiscalCompany.certificate_file_path) {
      return new Response(JSON.stringify({ error: 'Certificado A1 não configurado para esta empresa.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique reference
    const focusRef = `${sale_id.substring(0, 8)}_${Date.now()}`;

    // Calculate total
    const totalCents = sale.items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unit_price_cents);
    }, 0);

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .insert({
        organization_id: sale.organization_id,
        fiscal_company_id: fiscalCompany.id,
        sale_id: sale_id,
        invoice_type,
        status: 'processing',
        focus_nfe_ref: focusRef,
        total_cents: totalCents,
        items: sale.items,
        customer_data: {
          name: sale.lead?.name,
          cpf_cnpj: sale.lead?.cpf,
          email: sale.lead?.email,
          phone: sale.lead?.phone,
        },
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice record:', invoiceError);
      return new Response(JSON.stringify({ error: 'Erro ao criar registro da nota' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create event
    await supabase.from('fiscal_invoice_events').insert({
      fiscal_invoice_id: invoice.id,
      event_type: 'created',
      event_data: { sale_id, invoice_type },
    });

    // Determine if internal or interstate sale
    const customerState = sale.delivery_state || sale.lead?.state;
    const isInterstate = customerState && customerState !== fiscalCompany.address_state;
    const cfop = isInterstate ? fiscalCompany.default_cfop_interstate : fiscalCompany.default_cfop_internal;

    // Get environment and next invoice number
    const environment = invoice_type === 'nfe' 
      ? (fiscalCompany.nfe_environment || 'homologacao')
      : (fiscalCompany.nfse_environment || 'homologacao');
    
    const serie = invoice_type === 'nfe'
      ? (fiscalCompany.nfe_serie || 1)
      : (fiscalCompany.nfse_serie || 1);

    const lastNumber = invoice_type === 'nfe'
      ? (fiscalCompany.nfe_last_number || 0)
      : (fiscalCompany.nfse_last_number || 0);
    
    const nextNumber = lastNumber + 1;

    // Select base URL based on environment
    const focusBaseUrl = environment === 'producao' 
      ? FOCUS_NFE_PRODUCTION_URL 
      : FOCUS_NFE_HOMOLOGACAO_URL;

    // Build Focus NFe payload
    let focusPayload: any;

    if (invoice_type === 'nfe') {
      focusPayload = buildNFePayload(sale, fiscalCompany, cfop, focusRef, serie, nextNumber);
    } else {
      focusPayload = buildNFSePayload(sale, fiscalCompany, focusRef, serie, nextNumber);
    }

    console.log(`Sending to Focus NFe (${environment}):`, JSON.stringify(focusPayload, null, 2));

    // Send to Focus NFe API
    const endpoint = invoice_type === 'nfe' ? '/nfe' : '/nfse';
    const focusResponse = await fetch(`${focusBaseUrl}${endpoint}?ref=${focusRef}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(FOCUS_NFE_TOKEN + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(focusPayload),
    });

    const focusResult = await focusResponse.json();
    console.log('Focus NFe response:', focusResult);

    // Update invoice with response
    const updateData: any = {
      focus_nfe_response: focusResult,
    };

    if (focusResult.status === 'erro_autorizacao' || focusResult.status === 'erro_validacao') {
      updateData.status = 'rejected';
      updateData.error_message = focusResult.mensagem || focusResult.erros?.join(', ') || 'Erro na validação';
    } else if (focusResult.status === 'autorizado') {
      updateData.status = 'authorized';
      updateData.invoice_number = focusResult.numero;
      updateData.invoice_series = focusResult.serie;
      updateData.access_key = focusResult.chave_nfe;
      updateData.protocol_number = focusResult.protocolo;
      updateData.xml_url = focusResult.caminho_xml_nota_fiscal;
      updateData.pdf_url = focusResult.caminho_danfe;
      updateData.authorized_at = new Date().toISOString();

      // Update last invoice number on fiscal company
      const updateField = invoice_type === 'nfe' ? 'nfe_last_number' : 'nfse_last_number';
      await supabase
        .from('fiscal_companies')
        .update({ [updateField]: parseInt(focusResult.numero) || nextNumber })
        .eq('id', fiscalCompany.id);
    }
    // Otherwise keep as 'processing' - webhook will update

    await supabase
      .from('fiscal_invoices')
      .update(updateData)
      .eq('id', invoice.id);

    // Create event
    await supabase.from('fiscal_invoice_events').insert({
      fiscal_invoice_id: invoice.id,
      event_type: updateData.status || 'processing',
      event_data: focusResult,
    });

    return new Response(JSON.stringify({
      success: true,
      invoice_id: invoice.id,
      status: updateData.status || 'processing',
      focus_ref: focusRef,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-emit:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildNFePayload(sale: any, company: any, cfop: string, ref: string, serie: number, numero: number) {
  const items = sale.items.map((item: any, index: number) => {
    const product = item.product || {};
    return {
      numero_item: index + 1,
      codigo_produto: product.sku || product.id?.substring(0, 8) || String(index + 1),
      descricao: item.product_name || product.name || 'Produto',
      cfop: product.fiscal_cfop || cfop,
      ncm: product.fiscal_ncm || '00000000',
      unidade_comercial: product.unit || 'UN',
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: (item.unit_price_cents / 100).toFixed(2),
      valor_bruto: ((item.quantity * item.unit_price_cents) / 100).toFixed(2),
      unidade_tributavel: product.unit || 'UN',
      quantidade_tributavel: item.quantity,
      valor_unitario_tributavel: (item.unit_price_cents / 100).toFixed(2),
      origem: product.fiscal_origin ?? 0,
      icms_situacao_tributaria: product.fiscal_cst || company.default_cst || '102',
    };
  });

  const totalValue = items.reduce((sum: number, item: any) => sum + parseFloat(item.valor_bruto), 0);

  return {
    numero: numero,
    serie: serie,
    natureza_operacao: company.default_nature_operation || 'Venda de mercadorias',
    forma_pagamento: '0', // à vista
    tipo_documento: '1', // saída
    finalidade_emissao: '1', // normal
    consumidor_final: '1',
    presenca_comprador: company.presence_indicator || '9', // indicador de presença
    nome_destinatario: sale.lead?.name || 'Consumidor',
    cpf_destinatario: sale.lead?.cpf?.replace(/\D/g, ''),
    email_destinatario: sale.lead?.email,
    logradouro_destinatario: sale.delivery_street || sale.lead?.address_street,
    numero_destinatario: sale.delivery_number || sale.lead?.address_number || 'S/N',
    bairro_destinatario: sale.delivery_neighborhood || sale.lead?.address_neighborhood,
    municipio_destinatario: sale.delivery_city || sale.lead?.address_city,
    uf_destinatario: sale.delivery_state || sale.lead?.state,
    cep_destinatario: (sale.delivery_zip || sale.lead?.cep)?.replace(/\D/g, ''),
    telefone_destinatario: sale.lead?.phone?.replace(/\D/g, ''),
    indicador_inscricao_estadual_destinatario: '9',
    items,
    icms_base_calculo: '0.00',
    icms_valor_total: '0.00',
    valor_produtos: totalValue.toFixed(2),
    valor_total: totalValue.toFixed(2),
    modalidade_frete: '9', // sem frete
  };
}

function buildNFSePayload(sale: any, company: any, ref: string, serie: number, numero: number) {
  const totalValue = sale.items.reduce((sum: number, item: any) => {
    return sum + (item.quantity * item.unit_price_cents) / 100;
  }, 0);

  const servicesDescription = sale.items
    .map((item: any) => `${item.quantity}x ${item.product_name || item.product?.name || 'Serviço'}`)
    .join('; ');

  return {
    numero: numero,
    serie: serie,
    razao_social_prestador: company.company_name,
    cnpj_prestador: company.cnpj,
    inscricao_municipal_prestador: company.municipal_registration,
    codigo_municipio_prestador: company.address_city_code,
    razao_social_tomador: sale.lead?.name || 'Consumidor',
    cpf_tomador: sale.lead?.cpf?.replace(/\D/g, ''),
    email_tomador: sale.lead?.email,
    logradouro_tomador: sale.lead?.address_street,
    numero_tomador: sale.lead?.address_number || 'S/N',
    bairro_tomador: sale.lead?.address_neighborhood,
    codigo_municipio_tomador: sale.lead?.city_code || company.address_city_code,
    uf_tomador: sale.lead?.state,
    cep_tomador: sale.lead?.cep?.replace(/\D/g, ''),
    telefone_tomador: sale.lead?.phone?.replace(/\D/g, ''),
    discriminacao: servicesDescription,
    valor_servicos: totalValue.toFixed(2),
    base_calculo: totalValue.toFixed(2),
    aliquota: '5.00', // Default ISS rate
    valor_iss: (totalValue * 0.05).toFixed(2),
    iss_retido: false,
    codigo_servico: company.nfse_municipal_code || '1701',
  };
}
