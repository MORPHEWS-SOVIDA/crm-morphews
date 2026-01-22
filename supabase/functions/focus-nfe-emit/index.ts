import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback global token (used if company doesn't have its own token)
const FOCUS_NFE_GLOBAL_TOKEN = Deno.env.get('FOCUS_NFE_TOKEN');
const FOCUS_NFE_PRODUCTION_URL = 'https://api.focusnfe.com.br/v2';
const FOCUS_NFE_HOMOLOGACAO_URL = 'https://homologacao.focusnfe.com.br/v2';

interface EmitRequest {
  invoice_id?: string; // Existing draft to update
  sale_id: string;
  invoice_type: 'nfe' | 'nfse';
  fiscal_company_id?: string;
  draft_data?: any; // Pre-populated draft data
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
    const { invoice_id, sale_id, invoice_type, fiscal_company_id, draft_data } = body;

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

    // Check if we're updating an existing invoice or creating new
    let invoice: any;
    let focusRef: string;

    if (invoice_id) {
      // Update existing draft invoice
      const { data: existingInvoice, error: fetchError } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('id', invoice_id)
        .single();

      if (fetchError || !existingInvoice) {
        return new Response(JSON.stringify({ error: 'Nota fiscal não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      focusRef = existingInvoice.focus_nfe_ref;
      
      // Update status to processing
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('fiscal_invoices')
        .update({ 
          status: 'processing',
          is_draft: false,
          error_message: null,
        })
        .eq('id', invoice_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating invoice:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar nota fiscal' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      invoice = updatedInvoice;
      
      // Create event
      await supabase.from('fiscal_invoice_events').insert({
        fiscal_invoice_id: invoice.id,
        event_type: 'sent_for_processing',
        event_data: { sale_id, invoice_type },
      });

    } else {
      // Create new invoice (legacy flow - should rarely be used now)
      focusRef = `${sale_id.substring(0, 8)}_${Date.now()}`;

      // Calculate total
      const totalCents = sale.items.reduce((sum: number, item: any) => {
        return sum + (item.quantity * item.unit_price_cents);
      }, 0);

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('fiscal_invoices')
        .insert({
          organization_id: sale.organization_id,
          fiscal_company_id: fiscalCompany.id,
          sale_id: sale_id,
          invoice_type,
          status: 'processing',
          is_draft: false,
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

      invoice = newInvoice;
      
      // Create event
      await supabase.from('fiscal_invoice_events').insert({
        fiscal_invoice_id: invoice.id,
        event_type: 'created',
        event_data: { sale_id, invoice_type },
      });
    }

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
    const focusUrl = `${focusBaseUrl}${endpoint}?ref=${focusRef}`;
    
    // Get token: prefer company-specific token, fallback to global
    const companyToken = environment === 'producao' 
      ? fiscalCompany.focus_nfe_token_producao 
      : fiscalCompany.focus_nfe_token_homologacao;
    const focusToken = companyToken || FOCUS_NFE_GLOBAL_TOKEN;
    
    if (!focusToken) {
      // Update invoice to rejected
      await supabase
        .from('fiscal_invoices')
        .update({ 
          status: 'rejected', 
          error_message: 'Token Focus NFe não configurado. Configure o token da empresa nas Configurações > Notas Fiscais.' 
        })
        .eq('id', invoice.id);
      
      throw new Error('Token Focus NFe não configurado para esta empresa');
    }

    // Debug: log token source
    console.log(`Focus NFe API call to: ${focusUrl}`);
    console.log(`Token source: ${companyToken ? 'Company-specific' : 'Global fallback'} (${focusToken.length} chars)`);
    
    const focusResponse = await fetch(focusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(focusToken + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(focusPayload),
    });

    // Handle non-JSON responses (error pages, etc)
    const responseText = await focusResponse.text();
    let focusResult: any;
    
    console.log(`Focus NFe response status: ${focusResponse.status} ${focusResponse.statusText}`);
    
    try {
      focusResult = JSON.parse(responseText);
    } catch {
      console.error('Focus NFe returned non-JSON response:', responseText.substring(0, 500));
      
      // Common error handling
      let errorMsg = `Erro na comunicação com Focus NFe: ${focusResponse.status} ${focusResponse.statusText}`;
      
      if (focusResponse.status === 401) {
        errorMsg = 'Token de API Focus NFe inválido ou expirado. Verifique o secret FOCUS_NFE_TOKEN.';
      } else if (focusResponse.status === 403) {
        errorMsg = 'Acesso negado à API Focus NFe. Verifique as permissões do token.';
      } else if (focusResponse.status === 404) {
        errorMsg = 'Endpoint não encontrado na API Focus NFe. Verifique a URL.';
      }
      
      focusResult = {
        status: 'erro_autorizacao',
        mensagem: errorMsg,
      };
    }
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
    const itemValue = (item.quantity * item.unit_price_cents) / 100;
    const unitValue = item.unit_price_cents / 100;
    
    // CST or CSOSN depending on tax regime
    const isSimples = company.tax_regime === 'simples_nacional';
    const cst = product.fiscal_cst || company.default_cst || (isSimples ? '102' : '00');
    
    // Build item with all fiscal fields
    const nfeItem: any = {
      numero_item: index + 1,
      codigo_produto: product.sku || product.id?.substring(0, 8) || String(index + 1),
      descricao: item.product_name || product.name || 'Produto',
      cfop: product.fiscal_cfop || cfop || '5102',
      ncm: (product.fiscal_ncm || '00000000').replace(/\D/g, ''),
      cest: product.fiscal_cest ? product.fiscal_cest.replace(/\D/g, '') : undefined,
      unidade_comercial: product.unit || 'UN',
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: unitValue.toFixed(2),
      valor_bruto: itemValue.toFixed(2),
      unidade_tributavel: product.unit || 'UN',
      quantidade_tributavel: item.quantity,
      valor_unitario_tributavel: unitValue.toFixed(2),
      
      // EAN / GTIN
      codigo_barras_comercial: product.barcode_ean || '',
      codigo_barras_tributavel: product.gtin_tax || product.barcode_ean || '',
      
      // ICMS fields
      icms_origem: product.fiscal_origin ?? 0,
      icms_situacao_tributaria: cst,
      icms_modalidade_base_calculo: 0, // 0 = Margem Valor Agregado
      icms_base_calculo: product.fiscal_icms_base ? parseFloat(product.fiscal_icms_base).toFixed(2) : '0.00',
      icms_valor: product.fiscal_icms_own_value ? parseFloat(product.fiscal_icms_own_value).toFixed(2) : '0.00',
      
      // ICMS ST (if applicable)
      ...(product.fiscal_icms_st_value && {
        icms_base_calculo_st: product.fiscal_icms_st_base ? parseFloat(product.fiscal_icms_st_base).toFixed(2) : '0.00',
        icms_valor_st: parseFloat(product.fiscal_icms_st_value).toFixed(2),
      }),
      
      // Benefício fiscal
      ...(product.fiscal_benefit_code && {
        icms_codigo_beneficio_fiscal: product.fiscal_benefit_code,
      }),
      
      // PIS fields - Simples Nacional uses CST 49 (Outras Operações de Saída)
      pis_situacao_tributaria: isSimples ? '49' : '01',
      pis_base_calculo: itemValue.toFixed(2),
      pis_aliquota: product.fiscal_pis_fixed ? '0' : (isSimples ? '0' : '1.65'),
      pis_valor: product.fiscal_pis_fixed 
        ? parseFloat(product.fiscal_pis_fixed).toFixed(2) 
        : (isSimples ? '0.00' : (itemValue * 0.0165).toFixed(2)),
      
      // COFINS fields
      cofins_situacao_tributaria: isSimples ? '49' : '01',
      cofins_base_calculo: itemValue.toFixed(2),
      cofins_aliquota: product.fiscal_cofins_fixed ? '0' : (isSimples ? '0' : '7.60'),
      cofins_valor: product.fiscal_cofins_fixed 
        ? parseFloat(product.fiscal_cofins_fixed).toFixed(2) 
        : (isSimples ? '0.00' : (itemValue * 0.076).toFixed(2)),
      
      // IPI fields (most products are exempt)
      ipi_situacao_tributaria: '53', // 53 = Saída não tributada
      ipi_codigo_enquadramento: product.fiscal_ipi_exception_code || '999',
      
      // Informações adicionais do item
      ...(product.fiscal_additional_info && {
        informacoes_adicionais_item: product.fiscal_additional_info,
      }),
    };
    
    // Add ICMS info fields if present
    if (product.fiscal_icms_info) {
      nfeItem.informacoes_adicionais_item = (nfeItem.informacoes_adicionais_item || '') + ' ' + product.fiscal_icms_info;
    }
    
    // Remove undefined values
    Object.keys(nfeItem).forEach(key => {
      if (nfeItem[key] === undefined || nfeItem[key] === '') {
        delete nfeItem[key];
      }
    });
    
    return nfeItem;
  });

  const totalValue = items.reduce((sum: number, item: any) => sum + parseFloat(item.valor_bruto), 0);
  const totalPis = items.reduce((sum: number, item: any) => sum + parseFloat(item.pis_valor || '0'), 0);
  const totalCofins = items.reduce((sum: number, item: any) => sum + parseFloat(item.cofins_valor || '0'), 0);

  // Build clean payload removing undefined/null values
  const payload: any = {
    numero: numero,
    serie: serie,
    natureza_operacao: company.default_nature_operation || 'Venda de mercadorias',
    forma_pagamento: '0', // à vista
    tipo_documento: '1', // saída
    finalidade_emissao: '1', // normal
    consumidor_final: '1',
    presenca_comprador: company.presence_indicator || '0',
    
    // Destinatário
    nome_destinatario: sale.lead?.name || 'Consumidor',
    cpf_destinatario: sale.lead?.cpf?.replace(/\D/g, ''),
    email_destinatario: sale.lead?.email || undefined,
    logradouro_destinatario: sale.delivery_street || sale.lead?.address_street,
    numero_destinatario: sale.delivery_number || sale.lead?.address_number || 'S/N',
    bairro_destinatario: sale.delivery_neighborhood || sale.lead?.address_neighborhood,
    municipio_destinatario: sale.delivery_city || sale.lead?.address_city,
    uf_destinatario: sale.delivery_state || sale.lead?.state,
    cep_destinatario: (sale.delivery_zip || sale.lead?.cep)?.replace(/\D/g, ''),
    telefone_destinatario: sale.lead?.phone?.replace(/\D/g, '') || undefined,
    indicador_inscricao_estadual_destinatario: '9', // 9 = não contribuinte
    
    // Itens
    items,
    
    // Totais ICMS
    icms_base_calculo: '0.00',
    icms_valor_total: '0.00',
    
    // Totais PIS/COFINS
    pis_base_calculo: totalValue.toFixed(2),
    pis_valor_total: totalPis.toFixed(2),
    cofins_base_calculo: totalValue.toFixed(2),
    cofins_valor_total: totalCofins.toFixed(2),
    
    // Totais gerais
    valor_produtos: totalValue.toFixed(2),
    valor_total: totalValue.toFixed(2),
    
    // Frete
    modalidade_frete: '9', // 9 = sem frete
  };
  
  // Remove undefined/null/empty values from payload
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      delete payload[key];
    }
  });
  
  return payload;
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
