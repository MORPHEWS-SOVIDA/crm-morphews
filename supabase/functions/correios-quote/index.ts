import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Correios API URLs
const CORREIOS_API_URLS = {
  HOMOLOGACAO: 'https://apihom.correios.com.br',
  PRODUCAO: 'https://api.correios.com.br',
};

// Simple encryption/decryption using base64 + XOR
function decrypt(encrypted: string): string {
  try {
    const key = Deno.env.get('CORREIOS_ENCRYPTION_KEY') || 'morphews-correios-2024';
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return encrypted;
  }
}

interface CorreiosConfig {
  id_correios: string;
  codigo_acesso_encrypted: string;
  contrato: string;
  cartao_postagem: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  sender_cep: string;
  default_weight_grams: number;
  default_height_cm: number;
  default_width_cm: number;
  default_length_cm: number;
}

interface QuoteRequest {
  organization_id: string;
  destination_cep: string;
  weight_grams?: number;
  height_cm?: number;
  width_cm?: number;
  length_cm?: number;
  service_codes?: string[];
}

interface QuoteResult {
  service_code: string;
  service_name: string;
  price_cents: number;
  delivery_days: number;
  delivery_date?: string;
  error?: string;
}

async function authenticateCorreios(config: CorreiosConfig, baseUrl: string): Promise<string> {
  const codigoAcesso = decrypt(config.codigo_acesso_encrypted);
  const credentials = btoa(`${config.id_correios}:${codigoAcesso}`);
  
  const response = await fetch(`${baseUrl}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ numero: config.cartao_postagem }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Correios auth error:', response.status, errorText);
    throw new Error(`Falha na autenticação Correios: ${response.status}`);
  }

  const data = await response.json();
  return data.token;
}

// Fetch delivery time separately from /prazo/v1/nacional
async function getDeliveryDays(
  token: string,
  baseUrl: string,
  cepOrigem: string,
  cepDestino: string,
  serviceCode: string
): Promise<number> {
  try {
    const response = await fetch(
      `${baseUrl}/prazo/v1/nacional/${serviceCode}?cepOrigem=${cepOrigem}&cepDestino=${cepDestino}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      // API returns prazoEntrega as integer
      return data.prazoEntrega || data.prazo || 0;
    }
  } catch (e) {
    console.error(`Error fetching delivery days for ${serviceCode}:`, e);
  }
  return 0;
}

async function getShippingQuotes(
  config: CorreiosConfig,
  token: string,
  baseUrl: string,
  request: QuoteRequest,
  serviceCodes: string[]
): Promise<QuoteResult[]> {
  const results: QuoteResult[] = [];
  
  const cepOrigem = config.sender_cep?.replace(/\D/g, '');
  const cepDestino = request.destination_cep?.replace(/\D/g, '');
  
  if (!cepOrigem || cepOrigem.length !== 8) {
    throw new Error('CEP de origem não configurado ou inválido');
  }
  if (!cepDestino || cepDestino.length !== 8) {
    throw new Error('CEP de destino inválido');
  }
  
  const weight = request.weight_grams || config.default_weight_grams || 500;
  const height = request.height_cm || config.default_height_cm || 10;
  const width = request.width_cm || config.default_width_cm || 15;
  const length = request.length_cm || config.default_length_cm || 20;
  
  // Service name mapping
  const serviceNames: Record<string, string> = {
    '03220': 'SEDEX',
    '03298': 'PAC',
    '03140': 'SEDEX 12',
    '03158': 'SEDEX 10',
    '04227': 'Mini Envios',
    '04510': 'PAC',
    '04014': 'SEDEX',
  };
  
  // Default delivery days by service type (fallback if API fails)
  const defaultDeliveryDays: Record<string, number> = {
    '03220': 3, // SEDEX
    '03298': 7, // PAC
    '03140': 2, // SEDEX 12
    '03158': 1, // SEDEX 10
    '04227': 10, // Mini Envios
    '04510': 7, // PAC
    '04014': 3, // SEDEX
  };
  
  // Batch request using POST /preco/v1/nacional
  const parametrosProduto = serviceCodes.map((code, idx) => ({
    coProduto: code,
    nuRequisicao: String(idx + 1),
    cepOrigem,
    cepDestino,
    psObjeto: weight,
    tpObjeto: 2, // 2 = Caixa/Pacote
    comprimento: length,
    largura: width,
    altura: height,
  }));
  
  console.log('Sending quote request:', JSON.stringify({ idLote: '1', parametrosProduto }, null, 2));
  
  try {
    const response = await fetch(`${baseUrl}/preco/v1/nacional`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idLote: '1',
        parametrosProduto,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Correios quote error:', response.status, errorText);
      
      // Try individual requests as fallback
      for (const code of serviceCodes) {
        try {
          const singleResponse = await fetch(
            `${baseUrl}/preco/v1/nacional/${code}?cepOrigem=${cepOrigem}&cepDestino=${cepDestino}&psObjeto=${weight}&tpObjeto=2&comprimento=${length}&largura=${width}&altura=${height}`,
            {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${token}` },
            }
          );
          
          if (singleResponse.ok) {
            const data = await singleResponse.json();
            
            // Parse price properly
            const priceString = String(data.pcFinal || data.pcBase || '0').replace(',', '.');
            const priceValue = parseFloat(priceString) || 0;
            
            // Try to get delivery days from prazo endpoint
            let deliveryDays = data.prazoEntrega || 0;
            if (deliveryDays === 0) {
              deliveryDays = await getDeliveryDays(token, baseUrl, cepOrigem, cepDestino, code);
              if (deliveryDays === 0) {
                deliveryDays = defaultDeliveryDays[code] || 5;
              }
            }
            
            results.push({
              service_code: code,
              service_name: serviceNames[code] || `Serviço ${code}`,
              price_cents: Math.round(priceValue * 100),
              delivery_days: deliveryDays,
              delivery_date: data.dataMaxima,
            });
          } else {
            const errData = await singleResponse.text();
            console.error(`Quote error for ${code}:`, errData);
            results.push({
              service_code: code,
              service_name: serviceNames[code] || `Serviço ${code}`,
              price_cents: 0,
              delivery_days: 0,
              error: 'Serviço indisponível para este destino',
            });
          }
        } catch (e) {
          console.error(`Quote exception for ${code}:`, e);
          results.push({
            service_code: code,
            service_name: serviceNames[code] || `Serviço ${code}`,
            price_cents: 0,
            delivery_days: 0,
            error: 'Erro ao consultar',
          });
        }
      }
      return results;
    }
    
    const data = await response.json();
    console.log('Quote response:', JSON.stringify(data, null, 2));
    
    // Parse batch response
    const items = data || [];
    
    // Collect successful price quotes first
    const priceResults: { code: string; priceValue: number; prazoFromApi: number | null }[] = [];
    
    for (const item of items) {
      const code = item.coProduto;
      if (item.txErro) {
        results.push({
          service_code: code,
          service_name: serviceNames[code] || `Serviço ${code}`,
          price_cents: 0,
          delivery_days: 0,
          error: item.txErro,
        });
      } else {
        // Parse price from Brazilian format (comma as decimal separator)
        const priceString = String(item.pcFinal || item.pcBase || '0').replace(',', '.');
        const priceValue = parseFloat(priceString) || 0;
        
        // prazoEntrega might be in the response, or not
        const prazoFromApi = item.prazoEntrega || null;
        
        priceResults.push({ code, priceValue, prazoFromApi });
      }
    }
    
    // Fetch delivery days for services that got a price but no prazo
    // Do this in parallel for efficiency
    const deliveryPromises = priceResults.map(async ({ code, priceValue, prazoFromApi }) => {
      let deliveryDays = prazoFromApi || 0;
      
      // If no prazo from price API, try to fetch from prazo endpoint
      if (!prazoFromApi || prazoFromApi === 0) {
        deliveryDays = await getDeliveryDays(token, baseUrl, cepOrigem, cepDestino, code);
        
        // If still no prazo, use default based on service type
        if (deliveryDays === 0) {
          deliveryDays = defaultDeliveryDays[code] || 5;
        }
      }
      
      return {
        service_code: code,
        service_name: serviceNames[code] || `Serviço ${code}`,
        price_cents: Math.round(priceValue * 100),
        delivery_days: deliveryDays,
      };
    });
    
    const finalResults = await Promise.all(deliveryPromises);
    results.push(...finalResults);
    
  } catch (e: unknown) {
    console.error('Quote fetch error:', e);
    const message = e instanceof Error ? e.message : 'Erro desconhecido';
    throw new Error(`Erro ao consultar preços: ${message}`);
  }
  
  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: QuoteRequest = await req.json();
    const { organization_id, destination_cep, weight_grams, height_cm, width_cm, length_cm, service_codes } = body;

    if (!organization_id) {
      throw new Error('organization_id é obrigatório');
    }
    if (!destination_cep) {
      throw new Error('destination_cep é obrigatório');
    }

    // Get correios config
    const { data: config, error: configError } = await supabase
      .from('correios_config')
      .select('*')
      .eq('organization_id', organization_id)
      .single();

    if (configError || !config) {
      throw new Error('Configuração de Correios não encontrada');
    }

    if (!config.is_active) {
      throw new Error('Integração com Correios está desativada');
    }

    // Get enabled services for this org with picking cost and extra days
    let servicesToQuote = service_codes || [];
    let serviceExtras: Record<string, { pickingCostCents: number; extraDays: number }> = {};
    
    const { data: enabledServices } = await supabase
      .from('correios_enabled_services')
      .select('service_code, is_enabled, picking_cost_cents, extra_handling_days')
      .eq('organization_id', organization_id)
      .order('position');
    
    // Build extras map for all configured services
    if (enabledServices && enabledServices.length > 0) {
      for (const s of enabledServices) {
        serviceExtras[s.service_code] = {
          pickingCostCents: s.picking_cost_cents || 0,
          extraDays: s.extra_handling_days || 0,
        };
      }
      
      if (servicesToQuote.length === 0) {
        servicesToQuote = enabledServices.filter(s => s.is_enabled).map(s => s.service_code);
      }
    }
    
    if (servicesToQuote.length === 0) {
      // Default to PAC and SEDEX
      servicesToQuote = ['03220', '03298'];
    }

    // Check cache first
    const cepNormalized = destination_cep.replace(/\D/g, '');
    const weightNorm = weight_grams || config.default_weight_grams || 500;
    
    const { data: cached } = await supabase
      .from('correios_quote_cache')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('origin_cep', config.sender_cep?.replace(/\D/g, '') || '')
      .eq('destination_cep', cepNormalized)
      .eq('weight_grams', weightNorm)
      .in('service_code', servicesToQuote)
      .gt('expires_at', new Date().toISOString());
    
    const cachedCodes = new Set((cached || []).map(c => c.service_code));
    const uncachedCodes = servicesToQuote.filter(c => !cachedCodes.has(c));
    
    let results: QuoteResult[] = [];
    
    // Add cached results
    for (const c of cached || []) {
      results.push({
        service_code: c.service_code,
        service_name: c.service_code === '03220' ? 'SEDEX' : c.service_code === '03298' ? 'PAC' : `Serviço ${c.service_code}`,
        price_cents: c.price_cents,
        delivery_days: c.delivery_days || 0,
      });
    }
    
    // Fetch uncached quotes
    if (uncachedCodes.length > 0) {
      const baseUrl = CORREIOS_API_URLS[config.ambiente as keyof typeof CORREIOS_API_URLS];
      const token = await authenticateCorreios(config, baseUrl);
      
      const freshQuotes = await getShippingQuotes(
        config,
        token,
        baseUrl,
        { ...body, organization_id },
        uncachedCodes
      );
      
      // Cache successful results
      const toCache = freshQuotes.filter(q => q.price_cents > 0 && !q.error);
      if (toCache.length > 0) {
        const cacheInserts = toCache.map(q => ({
          organization_id,
          origin_cep: config.sender_cep?.replace(/\D/g, '') || '',
          destination_cep: cepNormalized,
          weight_grams: weightNorm,
          service_code: q.service_code,
          price_cents: q.price_cents,
          delivery_days: q.delivery_days,
        }));
        
        await supabase
          .from('correios_quote_cache')
          .upsert(cacheInserts, { 
            onConflict: 'organization_id,origin_cep,destination_cep,weight_grams,service_code',
            ignoreDuplicates: false 
          });
      }
      
      results = results.concat(freshQuotes);
    }
    
    // Apply picking cost and extra handling days (internal only - not shown to end customers in quote)
    // This is used for internal calculations and reporting
    const resultsWithExtras = results.map(r => {
      const extras = serviceExtras[r.service_code];
      if (extras) {
        return {
          ...r,
          // Add picking cost to final price
          price_cents: r.price_cents + extras.pickingCostCents,
          // Add extra handling days to delivery estimate
          delivery_days: r.delivery_days + extras.extraDays,
          // Store original values for reference if needed
          _original_price_cents: r.price_cents,
          _original_delivery_days: r.delivery_days,
          _picking_cost_cents: extras.pickingCostCents,
          _extra_handling_days: extras.extraDays,
        };
      }
      return r;
    });
    
    // Sort by price
    resultsWithExtras.sort((a, b) => (a.price_cents || 999999) - (b.price_cents || 999999));

    return new Response(
      JSON.stringify({ success: true, quotes: resultsWithExtras }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Quote error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
