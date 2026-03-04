import { useState, useEffect, useCallback } from 'react';
import { Truck, Clock, Loader2, AlertCircle, Gift } from 'lucide-react';
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
  hasFreeShipping?: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// PAC service codes
const PAC_CODES = ['04510', '03298', 'PAC', '41106'];

function isPac(serviceCode: string): boolean {
  return PAC_CODES.some(code => serviceCode.toUpperCase().includes(code.toUpperCase()));
}

export function ShippingSelector({ cep, organizationId, onSelect, primaryColor, hasFreeShipping }: ShippingSelectorProps) {
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
      const { data, error: fnError } = await supabase.functions.invoke('correios-simple-quote', {
        body: {
          organization_id: organizationId,
          destination_cep: cep,
        },
      });

      if (fnError) throw fnError;

      const validOptions = (data?.quotes || [])
        .filter((q: ShippingOption) => q.price_cents > 0 && !q.error)
        .map((q: any) => ({
          ...q,
          service_name: `Correios ${q.service_name}`,
        }));

      setOptions(validOptions);

      // Auto-select: if free shipping, auto-select PAC; otherwise cheapest
      if (validOptions.length > 0) {
        let autoSelect: ShippingOption;
        if (hasFreeShipping) {
          autoSelect = validOptions.find((o: ShippingOption) => isPac(o.service_code)) || validOptions[0];
        } else {
          autoSelect = validOptions.reduce((min: ShippingOption, curr: ShippingOption) =>
            curr.price_cents < min.price_cents ? curr : min
          );
        }
        setSelectedCode(autoSelect.service_code);
        onSelect(autoSelect);
      } else if (data?.quotes?.length > 0 && data.quotes[0].error) {
        setError(data.quotes[0].error);
      }
    } catch (e) {
      console.error('Shipping fetch error:', e);
      setError('Erro ao calcular frete. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [cep, organizationId, onSelect, hasFreeShipping]);

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
    <div className="space-y-3">
      {/* Free shipping banner */}
      {hasFreeShipping && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: primaryColor || '#22c55e' }}
        >
          <Gift className="h-5 w-5 flex-shrink-0" />
          🎉 Parabéns! Você ganhou <strong>frete grátis</strong> no envio econômico!
        </div>
      )}

      <RadioGroup value={selectedCode || ''} onValueChange={handleSelect} className="space-y-3">
        {options.map((option) => {
          const isFreePac = hasFreeShipping && isPac(option.service_code);

          return (
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
                    <div className="font-medium flex items-center gap-2">
                      {option.service_name}
                      {isFreePac && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: primaryColor || '#22c55e' }}
                        >
                          GRÁTIS
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {option.delivery_days === 1
                        ? '1 dia útil'
                        : `${option.delivery_days} dias úteis`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {isFreePac ? (
                    <div className="flex flex-col items-end">
                      <span className="text-sm text-muted-foreground line-through">
                        {formatCurrency(option.price_cents)}
                      </span>
                      <span className="font-bold text-green-600">
                        Frete Grátis
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold" style={primaryColor ? { color: primaryColor } : undefined}>
                      {formatCurrency(option.price_cents)}
                    </span>
                  )}
                </div>
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
