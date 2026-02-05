/**
 * Correios Simple Quote - Cotação simplificada baseada em distância
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Regiões por faixa de CEP (primeiro dígito)
const CEP_REGIONS: Record<string, string> = {
  '0': 'SP', '1': 'SP',
  '2': 'RJ_ES',
  '3': 'MG',
  '4': 'BA_SE',
  '5': 'PE_AL_PB_RN',
  '6': 'CE_PI_MA_PA_AP_AM_RR_AC',
  '7': 'DF_GO_TO_MT_MS_RO',
  '8': 'PR_SC',
  '9': 'RS',
};

// Tabela de preços PAC aproximada (para pacote 500g, origem RS)
const PAC_PRICES_FROM_RS: Record<string, number> = {
  'RS': 2500,
  'PR_SC': 2800,
  'SP': 3200,
  'RJ_ES': 3500,
  'MG': 3500,
  'DF_GO_TO_MT_MS_RO': 4000,
  'BA_SE': 4200,
  'PE_AL_PB_RN': 4500,
  'CE_PI_MA_PA_AP_AM_RR_AC': 5500,
};

const SEDEX_MULTIPLIER = 1.8;

const PAC_DAYS_FROM_RS: Record<string, number> = {
  'RS': 3, 'PR_SC': 4, 'SP': 6, 'RJ_ES': 7, 'MG': 7,
  'DF_GO_TO_MT_MS_RO': 8, 'BA_SE': 9, 'PE_AL_PB_RN': 10,
  'CE_PI_MA_PA_AP_AM_RR_AC': 15,
};

const SEDEX_DAYS_FROM_RS: Record<string, number> = {
  'RS': 1, 'PR_SC': 2, 'SP': 3, 'RJ_ES': 4, 'MG': 4,
  'DF_GO_TO_MT_MS_RO': 5, 'BA_SE': 6, 'PE_AL_PB_RN': 7,
  'CE_PI_MA_PA_AP_AM_RR_AC': 10,
};

function getRegionFromCep(cep: string): string {
  const firstDigit = cep.charAt(0);
  return CEP_REGIONS[firstDigit] || 'CE_PI_MA_PA_AP_AM_RR_AC';
}

function calculateWeightMultiplier(weightGrams: number): number {
  if (weightGrams <= 500) return 1;
  if (weightGrams <= 1000) return 1.3;
  if (weightGrams <= 2000) return 1.6;
  if (weightGrams <= 5000) return 2.2;
  if (weightGrams <= 10000) return 3.0;
  return 4.0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { organization_id, destination_cep, weight_grams = 500 } = body;

    if (!organization_id || !destination_cep) {
      return new Response(
        JSON.stringify({ success: false, error: 'organization_id e destination_cep são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar config da organização
    const { data: config } = await supabase
      .from('correios_config')
      .select('sender_cep')
      .eq('organization_id', organization_id)
      .maybeSingle();

    const originCep = config?.sender_cep?.replace(/\D/g, '') || '90690310';
    const destCep = destination_cep.replace(/\D/g, '');

    // Buscar serviços habilitados
    const { data: enabledServices } = await supabase
      .from('correios_enabled_services')
      .select('service_code, service_name, is_enabled, picking_cost_cents, extra_handling_days')
      .eq('organization_id', organization_id)
      .eq('is_enabled', true)
      .order('position');

    const servicesToQuote = enabledServices && enabledServices.length > 0
      ? enabledServices
      : [
          { service_code: '03298', service_name: 'PAC', picking_cost_cents: 700, extra_handling_days: 2 },
          { service_code: '03220', service_name: 'SEDEX', picking_cost_cents: 700, extra_handling_days: 2 },
        ];

    const destRegion = getRegionFromCep(destCep);
    const weightMultiplier = calculateWeightMultiplier(weight_grams);

    console.log(`[Correios Simple Quote] Origin: ${originCep}, Dest: ${destCep}, Region: ${destRegion}`);

    const quotes = [];

    for (const service of servicesToQuote) {
      const isPac = service.service_code === '03298' || service.service_code === '04510';
      const isSedex = service.service_code === '03220' || service.service_code === '04014';

      if (!isPac && !isSedex) continue;

      const basePrice = PAC_PRICES_FROM_RS[destRegion] || 5000;
      const baseDays = isPac 
        ? (PAC_DAYS_FROM_RS[destRegion] || 12)
        : (SEDEX_DAYS_FROM_RS[destRegion] || 8);

      const priceWithWeight = Math.round(basePrice * weightMultiplier);
      const finalBasePrice = isPac ? priceWithWeight : Math.round(priceWithWeight * SEDEX_MULTIPLIER);

      const pickingCostCents = service.picking_cost_cents || 700;
      const extraDays = service.extra_handling_days || 2;

      quotes.push({
        service_code: service.service_code,
        service_name: service.service_name || (isPac ? 'PAC' : 'SEDEX'),
        price_cents: finalBasePrice + pickingCostCents,
        base_price_cents: finalBasePrice,
        picking_cost_cents: pickingCostCents,
        delivery_days: baseDays + extraDays,
        base_delivery_days: baseDays,
        extra_handling_days: extraDays,
      });
    }

    quotes.sort((a, b) => a.price_cents - b.price_cents);

    return new Response(
      JSON.stringify({ 
        success: true, 
        quotes,
        origin_cep: originCep,
        destination_cep: destCep,
        destination_region: destRegion,
        calculation_method: 'table_based',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Correios Simple Quote] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
