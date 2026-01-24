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
            results.push({
              service_code: code,
              service_name: serviceNames[code] || `Serviço ${code}`,
              price_cents: Math.round((data.pcFinal || data.pcBase || 0) * 100),
              delivery_days: data.prazoEntrega || 0,
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
        
        results.push({
          service_code: code,
          service_name: serviceNames[code] || `Serviço ${code}`,
          price_cents: Math.round(priceValue * 100),
          delivery_days: item.prazoEntrega || 0,
          delivery_date: item.dataMaxima,
        });
      }
    }
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

    // Get enabled services for this org
    let servicesToQuote = service_codes || [];
    
    if (servicesToQuote.length === 0) {
      const { data: enabledServices } = await supabase
        .from('correios_enabled_services')
        .select('service_code')
        .eq('organization_id', organization_id)
        .eq('is_enabled', true)
        .order('position');
      
      if (enabledServices && enabledServices.length > 0) {
        servicesToQuote = enabledServices.map(s => s.service_code);
      } else {
        // Default to PAC and SEDEX
        servicesToQuote = ['03220', '03298'];
      }
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
    
    // Sort by price
    results.sort((a, b) => (a.price_cents || 999999) - (b.price_cents || 999999));

    return new Response(
      JSON.stringify({ success: true, quotes: results }),
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
