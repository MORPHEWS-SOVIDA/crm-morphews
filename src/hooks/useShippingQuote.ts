import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface ShippingQuote {
  service_code: string;
  service_name: string;
  price_cents: number;
  delivery_days: number;
  delivery_date?: string;
  error?: string;
}

export interface ShippingQuoteRequest {
  destination_cep: string;
  weight_grams?: number;
  height_cm?: number;
  width_cm?: number;
  length_cm?: number;
  service_codes?: string[];
}

export interface EnabledService {
  id: string;
  organization_id: string;
  service_code: string;
  service_name: string;
  is_enabled: boolean;
  position: number;
  picking_cost_cents: number;
  extra_handling_days: number;
}

// All available Correios services
export const CORREIOS_SERVICES = [
  { code: '03220', name: 'SEDEX - Entrega expressa', description: 'Entrega rápida em 1-3 dias' },
  { code: '03298', name: 'PAC - Entrega econômica', description: 'Entrega econômica em 5-15 dias' },
  { code: '03140', name: 'SEDEX 12 - Entrega até 12h', description: 'Entrega até 12h do dia seguinte' },
  { code: '03158', name: 'SEDEX 10 - Entrega até 10h', description: 'Entrega até 10h do dia seguinte' },
  { code: '04227', name: 'Mini Envios - Objetos até 300g', description: 'Para objetos leves até 300g' },
];

export function useShippingQuote() {
  const { tenantId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);

  const getQuotes = async (request: ShippingQuoteRequest): Promise<ShippingQuote[]> => {
    if (!tenantId) {
      throw new Error('Organização não identificada');
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('correios-quote', {
        body: {
          organization_id: tenantId,
          ...request,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao consultar frete');
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha na consulta de frete');
      }

      return data.quotes || [];
    } finally {
      setIsLoading(false);
    }
  };

  return { getQuotes, isLoading };
}

export function useEnabledServices() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['correios-enabled-services', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('correios_enabled_services')
        .select('*')
        .eq('organization_id', tenantId)
        .order('position');

      if (error) throw error;
      return (data || []) as EnabledService[];
    },
    enabled: !!tenantId,
  });
}

export function useToggleService() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceCode, serviceName, isEnabled }: { serviceCode: string; serviceName: string; isEnabled: boolean }) => {
      if (!tenantId) throw new Error('Organização não identificada');

      // Upsert the service
      const { error } = await supabase
        .from('correios_enabled_services')
        .upsert({
          organization_id: tenantId,
          service_code: serviceCode,
          service_name: serviceName,
          is_enabled: isEnabled,
        }, {
          onConflict: 'organization_id,service_code',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correios-enabled-services'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar serviço: ${error.message}`);
    },
  });
}

export function useUpdateServiceConfig() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      serviceCode, 
      serviceName,
      pickingCostCents, 
      extraHandlingDays 
    }: { 
      serviceCode: string; 
      serviceName: string;
      pickingCostCents: number; 
      extraHandlingDays: number;
    }) => {
      if (!tenantId) throw new Error('Organização não identificada');

      const { error } = await supabase
        .from('correios_enabled_services')
        .upsert({
          organization_id: tenantId,
          service_code: serviceCode,
          service_name: serviceName,
          picking_cost_cents: pickingCostCents,
          extra_handling_days: extraHandlingDays,
        }, {
          onConflict: 'organization_id,service_code',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correios-enabled-services'] });
      toast.success('Configuração salva!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });
}

export function formatShippingPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
