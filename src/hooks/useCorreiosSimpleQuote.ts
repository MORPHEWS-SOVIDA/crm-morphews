import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface CorreiosQuote {
  service_code: string;
  service_name: string;
  price_cents: number;
  base_price_cents: number;
  picking_cost_cents: number;
  delivery_days: number;
  base_delivery_days: number;
  extra_handling_days: number;
  error?: string;
}

export function useCorreiosSimpleQuote() {
  const { tenantId } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<CorreiosQuote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getQuotes = async (params: {
    destination_cep: string;
    weight_grams?: number;
    height_cm?: number;
    width_cm?: number;
    length_cm?: number;
  }): Promise<CorreiosQuote[]> => {
    if (!tenantId) {
      toast.error('Organização não identificada');
      return [];
    }

    const cleanCep = params.destination_cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP inválido');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('correios-simple-quote', {
        body: {
          organization_id: tenantId,
          destination_cep: cleanCep,
          weight_grams: params.weight_grams || 500,
          height_cm: params.height_cm || 10,
          width_cm: params.width_cm || 15,
          length_cm: params.length_cm || 20,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao consultar Correios');
      }

      if (!data.success) {
        throw new Error(data.error || 'Falha na cotação');
      }

      setQuotes(data.quotes);
      return data.quotes;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(`Erro ao cotar frete: ${errorMessage}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    getQuotes,
    quotes,
    isLoading,
    error,
    clearQuotes: () => setQuotes([]),
  };
}
