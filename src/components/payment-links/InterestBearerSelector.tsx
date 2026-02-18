import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface InterestBearerSelectorProps {
  /** Who pays: 'customer' | 'seller' */
  bearer: 'customer' | 'seller';
  onBearerChange: (bearer: 'customer' | 'seller') => void;
  /** Max interest-free installments when seller absorbs */
  maxFreeInstallments: number;
  onMaxFreeInstallmentsChange: (value: number) => void;
  /** Base amount in cents (required for cost preview) */
  amountCents?: number;
  /** Only show when card is enabled */
  cardEnabled?: boolean;
}

const DEFAULT_FEES: Record<string, number> = {
  "2": 3.49, "3": 4.29, "4": 4.99, "5": 5.49, "6": 5.99,
  "7": 6.49, "8": 6.99, "9": 7.49, "10": 7.99, "11": 8.49, "12": 8.99
};

export function InterestBearerSelector({
  bearer,
  onBearerChange,
  maxFreeInstallments,
  onMaxFreeInstallmentsChange,
  amountCents,
  cardEnabled = true,
}: InterestBearerSelectorProps) {
  const { profile } = useAuth();

  const { data: tenantFees } = useQuery({
    queryKey: ['tenant-fees-interest-selector', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from('tenant_payment_fees')
        .select('max_installments, installment_fees')
        .eq('organization_id', profile.organization_id)
        .single();
      return data;
    },
    enabled: !!profile?.organization_id,
  });

  const maxInstallments = tenantFees?.max_installments || 12;
  const fees = (tenantFees?.installment_fees as Record<string, number>) || DEFAULT_FEES;

  // Calculate the cost when seller absorbs interest
  const costPreview = useMemo(() => {
    if (!amountCents || bearer !== 'seller') return null;

    // The max interest cost is at the highest installment the seller allows interest-free
    const feePercent = fees[maxFreeInstallments.toString()] || DEFAULT_FEES[maxFreeInstallments.toString()] || 2.69;
    const totalWithInterest = Math.round(amountCents * (1 + feePercent / 100));
    const interestCost = totalWithInterest - amountCents;
    const netReceived = amountCents - interestCost;

    return {
      interestCost,
      netReceived,
      feePercent,
    };
  }, [amountCents, bearer, maxFreeInstallments, fees]);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (!cardEnabled) return null;

  return (
    <div className="space-y-3">
      <div>
        <Label>Juros do Parcelamento</Label>
        <Select value={bearer} onValueChange={(v) => onBearerChange(v as 'customer' | 'seller')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Juros por conta do CLIENTE</SelectItem>
            <SelectItem value="seller">Juros por conta da EMPRESA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {bearer === 'seller' && (
        <>
          <div>
            <Label>Em até quantas vezes sem juros o cliente vai poder pagar?</Label>
            <Select 
              value={maxFreeInstallments.toString()} 
              onValueChange={(v) => onMaxFreeInstallmentsChange(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.min(maxInstallments, 12) - 1 }, (_, i) => i + 2).map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    Até {n}x sem juros
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {amountCents && costPreview && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm space-y-2">
              <div className="flex items-start gap-2 font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>LEMBRE-SE: essa opção vai custar para a empresa</span>
              </div>
              <div className="ml-6 space-y-1 text-amber-700 dark:text-amber-300">
                <p>
                  Se o cliente parcelar em <strong>{maxFreeInstallments}x</strong> ({costPreview.feePercent}% de juros):
                </p>
                <p>
                  💰 Custo dos juros: <strong className="text-red-600 dark:text-red-400">{formatCurrency(costPreview.interestCost)}</strong>
                </p>
                <p>
                  ✅ Só iremos receber: <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(costPreview.netReceived)}</strong>
                </p>
                <p className="text-xs mt-2 pt-2 border-t border-amber-300 dark:border-amber-700">
                  O restante é custo de juros que a empresa está assumindo. Para cálculo de <strong>comissão e metas</strong>, esse será o valor considerado para você.
                </p>
              </div>
            </div>
          )}

          {!amountCents && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Informe um valor acima para visualizar o custo dos juros que a empresa vai absorver.
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
