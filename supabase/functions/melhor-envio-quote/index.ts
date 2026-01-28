import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Melhor Envio API URLs
const MELHOR_ENVIO_API = {
  SANDBOX: 'https://sandbox.melhorenvio.com.br/api/v2',
  PRODUCTION: 'https://api.melhorenvio.com.br/api/v2',
};

interface QuoteRequest {
  organization_id: string;
  destination_cep: string;
  weight_grams?: number;
  height_cm?: number;
  width_cm?: number;
  length_cm?: number;
  declared_value_cents?: number;
  service_ids?: number[];
}

interface QuoteResult {
  service_id: number;
  service_code: string;
  service_name: string;
  company_name: string;
  company_picture: string;
  price_cents: number;
  delivery_days: number;
  delivery_range: { min: number; max: number };
  error?: string;
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
    const { organization_id, destination_cep, weight_grams, height_cm, width_cm, length_cm, declared_value_cents, service_ids } = body;

    if (!organization_id) {
      throw new Error('organization_id é obrigatório');
    }
    if (!destination_cep) {
      throw new Error('destination_cep é obrigatório');
    }

    // Get Melhor Envio config for this org
    const { data: config, error: configError } = await supabase
      .from('melhor_envio_config')
      .select('*')
      .eq('organization_id', organization_id)
      .single();

    if (configError || !config) {
      throw new Error('Configuração do Melhor Envio não encontrada');
    }

    if (!config.is_active) {
      throw new Error('Integração com Melhor Envio está desativada');
    }

    // Get token based on environment - try environment-specific first, then generic, then db
    let token: string | undefined;
    if (config.ambiente === 'production') {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN_PRODUCTION') || Deno.env.get('MELHOR_ENVIO_TOKEN') || config.token_encrypted;
    } else {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN_SANDBOX') || Deno.env.get('MELHOR_ENVIO_TOKEN') || config.token_encrypted;
    }
    
    if (!token) {
      throw new Error('Token do Melhor Envio não configurado');
    }

    const baseUrl = config.ambiente === 'sandbox' ? MELHOR_ENVIO_API.SANDBOX : MELHOR_ENVIO_API.PRODUCTION;
    
    // Normalize CEPs
    const originCep = config.sender_cep?.replace(/\D/g, '');
    const destCep = destination_cep.replace(/\D/g, '');
    
    if (!originCep || originCep.length !== 8) {
      throw new Error('CEP de origem não configurado ou inválido');
    }
    if (!destCep || destCep.length !== 8) {
      throw new Error('CEP de destino inválido');
    }

    // Prepare quote request
    const quotePayload = {
      from: { postal_code: originCep },
      to: { postal_code: destCep },
      package: {
        weight: (weight_grams || config.default_weight_grams || 500) / 1000, // Convert to kg
        height: height_cm || config.default_height_cm || 10,
        width: width_cm || config.default_width_cm || 15,
        length: length_cm || config.default_length_cm || 20,
      },
      options: {
        insurance_value: declared_value_cents ? declared_value_cents / 100 : 0,
        receipt: false,
        own_hand: false,
      },
      services: service_ids?.join(',') || undefined,
    };

    console.log('[Melhor Envio] Quote request:', JSON.stringify(quotePayload, null, 2));
    console.log('[Melhor Envio] Using ambiente:', config.ambiente, 'baseUrl:', baseUrl);

    // Fetch with retry for DNS issues
    const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fetch(url, options);
        } catch (error) {
          console.log(`[Melhor Envio] Attempt ${i + 1} failed:`, error);
          if (i === retries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
      throw new Error('Falha ao conectar à API do Melhor Envio');
    };

    const response = await fetchWithRetry(`${baseUrl}/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
      },
      body: JSON.stringify(quotePayload),
    });

    const responseText = await response.text();
    console.log('[Melhor Envio] Response status:', response.status);
    console.log('[Melhor Envio] Response:', responseText.substring(0, 1000));

    if (!response.ok) {
      let errorMessage = 'Erro ao consultar frete';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = responseText.substring(0, 200);
      }
      throw new Error(errorMessage);
    }

    const data = JSON.parse(responseText);
    
    // Parse Melhor Envio response
    const results: QuoteResult[] = [];
    
    for (const service of data) {
      if (service.error) {
        results.push({
          service_id: service.id,
          service_code: String(service.id),
          service_name: service.name,
          company_name: service.company?.name || '',
          company_picture: service.company?.picture || '',
          price_cents: 0,
          delivery_days: 0,
          delivery_range: { min: 0, max: 0 },
          error: service.error,
        });
      } else {
        const priceCents = Math.round(parseFloat(service.custom_price || service.price || 0) * 100);
        
        results.push({
          service_id: service.id,
          service_code: String(service.id),
          service_name: service.name,
          company_name: service.company?.name || '',
          company_picture: service.company?.picture || '',
          price_cents: priceCents,
          delivery_days: service.delivery_time || service.delivery_range?.max || 0,
          delivery_range: {
            min: service.delivery_range?.min || 0,
            max: service.delivery_range?.max || 0,
          },
        });
      }
    }

    // Get enabled services and apply picking cost/extra days
    const { data: enabledServices } = await supabase
      .from('melhor_envio_enabled_services')
      .select('service_id, is_enabled, picking_cost_cents, extra_handling_days')
      .eq('organization_id', organization_id);

    const serviceExtras: Record<number, { pickingCostCents: number; extraDays: number; isEnabled: boolean }> = {};
    for (const s of enabledServices || []) {
      serviceExtras[s.service_id] = {
        pickingCostCents: s.picking_cost_cents || 0,
        extraDays: s.extra_handling_days || 0,
        isEnabled: s.is_enabled,
      };
    }

    // Filter and apply extras
    const resultsWithExtras = results
      .filter(r => {
        const extras = serviceExtras[r.service_id];
        // If no config for this service, include it by default
        // If configured, respect is_enabled
        return !extras || extras.isEnabled;
      })
      .map(r => {
        const extras = serviceExtras[r.service_id];
        if (extras && r.price_cents > 0) {
          return {
            ...r,
            price_cents: r.price_cents + extras.pickingCostCents,
            delivery_days: r.delivery_days + extras.extraDays,
            _original_price_cents: r.price_cents,
            _original_delivery_days: r.delivery_days,
            _picking_cost_cents: extras.pickingCostCents,
            _extra_handling_days: extras.extraDays,
          };
        }
        return r;
      });

    // Sort by price
    resultsWithExtras.sort((a, b) => {
      if (a.error && !b.error) return 1;
      if (!a.error && b.error) return -1;
      return (a.price_cents || 999999) - (b.price_cents || 999999);
    });

    return new Response(
      JSON.stringify({ success: true, quotes: resultsWithExtras }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Melhor Envio] Quote error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
