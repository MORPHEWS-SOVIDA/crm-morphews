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
  // Melhor Envio specific
  service_id?: number;
  company_name?: string;
  company_picture?: string;
  delivery_range?: { min: number; max: number };
}

export interface ShippingQuoteRequest {
  destination_cep: string;
  weight_grams?: number;
  height_cm?: number;
  width_cm?: number;
  length_cm?: number;
  service_codes?: string[];
  declared_value_cents?: number;
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
  // Melhor Envio specific
  service_id?: number;
  company_name?: string;
}

// Melhor Envio services (most common services)
// IDs are based on Melhor Envio API service IDs
export const MELHOR_ENVIO_SERVICES = [
  { id: 1, name: 'PAC', company: 'Correios', description: 'Entrega econômica (5-10 dias)' },
  { id: 2, name: 'SEDEX', company: 'Correios', description: 'Entrega expressa (1-3 dias)' },
  { id: 3, name: '.Package', company: 'Jadlog', description: 'Entrega rápida rodoviária' },
  { id: 4, name: '.Com', company: 'Jadlog', description: 'Entrega econômica rodoviária' },
  { id: 12, name: 'Expresso', company: 'Loggi', description: 'Entrega expressa urbana' },
  { id: 17, name: 'MINI Envios', company: 'Correios', description: 'Para pacotes pequenos' },
  { id: 28, name: 'Rodoviário', company: 'Buslog', description: 'Entrega rodoviária' },
  { id: 31, name: 'Rodo', company: 'Latam Cargo', description: 'Entrega aérea/rodoviária' },
];

// Legacy export for backwards compatibility
export const CORREIOS_SERVICES = MELHOR_ENVIO_SERVICES.map(s => ({
  code: String(s.id),
  name: `${s.company} - ${s.name}`,
  description: s.description,
}));

export function useShippingQuote() {
  const { tenantId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);

  const getQuotes = async (request: ShippingQuoteRequest): Promise<ShippingQuote[]> => {
    if (!tenantId) {
      throw new Error('Organização não identificada');
    }

    setIsLoading(true);
    try {
      // Use Correios simple quote function (table-based, R$7 picking + 2 days)
      const { data, error } = await supabase.functions.invoke('correios-simple-quote', {
        body: {
          organization_id: tenantId,
          destination_cep: request.destination_cep,
          weight_grams: request.weight_grams,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao consultar frete');
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha na consulta de frete');
      }

      // Map Correios response to ShippingQuote format
      // Prepend "Correios" to service name for clarity
      return (data.quotes || []).map((q: any) => ({
        service_code: q.service_code,
        service_name: `Correios ${q.service_name}`,
        price_cents: q.price_cents,
        delivery_days: q.delivery_days,
        error: q.error,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return { getQuotes, isLoading };
}

export function useEnabledServices() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['melhor-envio-enabled-services', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('melhor_envio_enabled_services')
        .select('*')
        .eq('organization_id', tenantId)
        .order('position');

      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        service_code: String(s.service_id),
      })) as EnabledService[];
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

      const serviceId = parseInt(serviceCode);
      const { error } = await supabase
        .from('melhor_envio_enabled_services')
        .upsert({
          organization_id: tenantId,
          service_id: serviceId,
          service_name: serviceName,
          is_enabled: isEnabled,
        }, {
          onConflict: 'organization_id,service_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-enabled-services'] });
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

      const serviceId = parseInt(serviceCode);
      const { error } = await supabase
        .from('melhor_envio_enabled_services')
        .upsert({
          organization_id: tenantId,
          service_id: serviceId,
          service_name: serviceName,
          picking_cost_cents: pickingCostCents,
          extra_handling_days: extraHandlingDays,
        }, {
          onConflict: 'organization_id,service_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['melhor-envio-enabled-services'] });
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
