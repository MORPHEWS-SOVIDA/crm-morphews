import { useState, useEffect, useCallback } from 'react';
import { Truck, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface ShippingOption {
  service_code: string;
  service_name: string;
  price_cents: number;
  delivery_days: number;
  error?: string;
}

interface ShippingSelectorProps {
  cep: string;
  organizationId: string;
  onSelect: (option: ShippingOption | null) => void;
  primaryColor?: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ShippingSelector({ cep, organizationId, onSelect, primaryColor }: ShippingSelectorProps) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShippingOptions = useCallback(async () => {
    if (!cep || cep.length !== 8 || !organizationId) {
      setOptions([]);
      setSelectedCode(null);
      onSelect(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use Melhor Envio quote function
      const { data, error: fnError } = await supabase.functions.invoke('melhor-envio-quote', {
        body: {
          organization_id: organizationId,
          destination_cep: cep,
        },
      });

      if (fnError) throw fnError;

      const validOptions = (data?.quotes || []).filter(
        (q: ShippingOption) => q.price_cents > 0 && !q.error
      );

      setOptions(validOptions);

      // Auto-select cheapest option
      if (validOptions.length > 0) {
        const cheapest = validOptions.reduce((min: ShippingOption, curr: ShippingOption) =>
          curr.price_cents < min.price_cents ? curr : min
        );
        setSelectedCode(cheapest.service_code);
        onSelect(cheapest);
      } else if (data?.quotes?.length > 0 && data.quotes[0].error) {
        setError(data.quotes[0].error);
      }
    } catch (e) {
      console.error('Shipping fetch error:', e);
      setError('Erro ao calcular frete. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [cep, organizationId, onSelect]);

  useEffect(() => {
    const timer = setTimeout(fetchShippingOptions, 500);
    return () => clearTimeout(timer);
  }, [fetchShippingOptions]);

  const handleSelect = (code: string) => {
    setSelectedCode(code);
    const selected = options.find(o => o.service_code === code);
    onSelect(selected || null);
  };

  if (!cep || cep.length < 8) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
        <Truck className="h-4 w-4" />
        Preencha o CEP para calcular o frete
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculando frete...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-destructive text-sm">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Nenhuma opção de frete disponível para este CEP.
      </div>
    );
  }

  return (
    <RadioGroup value={selectedCode || ''} onValueChange={handleSelect} className="space-y-3">
      {options.map((option) => (
        <div key={option.service_code}>
          <Label
            htmlFor={option.service_code}
            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${
              selectedCode === option.service_code
                ? 'border-2 bg-primary/5'
                : 'border-muted hover:border-primary/30'
            }`}
            style={
              selectedCode === option.service_code && primaryColor
                ? { borderColor: primaryColor }
                : undefined
            }
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value={option.service_code} id={option.service_code} />
              <div>
                <div className="font-medium">{option.service_name}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {option.delivery_days === 1
                    ? '1 dia útil'
                    : `${option.delivery_days} dias úteis`}
                </div>
              </div>
            </div>
            <div className="font-bold" style={primaryColor ? { color: primaryColor } : undefined}>
              {formatCurrency(option.price_cents)}
            </div>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
