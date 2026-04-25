import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Default installment fees (Stone/Point CET D+15 + safety margin against antifraud/anticipation)
// Calibrated so R$ 1.000 in 12x = R$ 101,91 / parcel (22.29% total)
// 1x already includes acquirer MDR + safety margin (no "interest-free" at sight)
const DEFAULT_INSTALLMENT_FEES: Record<string, number> = {
  "1": 3.93,
  "2": 6.38,
  "3": 7.98,
  "4": 9.58,
  "5": 11.18,
  "6": 12.78,
  "7": 14.38,
  "8": 15.98,
  "9": 17.58,
  "10": 19.17,
  "11": 20.77,
  "12": 22.29,
};

export interface InstallmentInfo {
  installments: number;
  installmentValue: number; // cents
  totalWithInterest: number; // cents
  hasInterest: boolean;
  interestPercentage: number;
}

export function useTenantInstallmentFees(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['tenant-installment-fees', organizationId],
    enabled: !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payment_fees')
        .select('installment_fees, installment_fee_passed_to_buyer, max_installments')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching installment fees:', error);
        return {
          installment_fees: DEFAULT_INSTALLMENT_FEES,
          installment_fee_passed_to_buyer: true,
          max_installments: 12,
        };
      }

      return {
        installment_fees: (data?.installment_fees as Record<string, number>) || DEFAULT_INSTALLMENT_FEES,
        installment_fee_passed_to_buyer: data?.installment_fee_passed_to_buyer ?? true,
        max_installments: data?.max_installments || 12,
      };
    },
  });
}

/**
 * Calculate installment value with interest for a specific number of installments
 */
export function calculateInstallmentWithInterest(
  priceCents: number,
  installments: number,
  installmentFees: Record<string, number> = DEFAULT_INSTALLMENT_FEES,
  passFeeToCustomer: boolean = true
): InstallmentInfo {
  if (installments === 1) {
    return {
      installments: 1,
      installmentValue: priceCents,
      totalWithInterest: priceCents,
      hasInterest: false,
      interestPercentage: 0,
    };
  }

  const feePercentage = installmentFees[String(installments)] || 0;
  
  if (!passFeeToCustomer || feePercentage === 0) {
    return {
      installments,
      installmentValue: Math.ceil(priceCents / installments),
      totalWithInterest: priceCents,
      hasInterest: false,
      interestPercentage: 0,
    };
  }

  const totalWithInterest = Math.round(priceCents * (1 + feePercentage / 100));
  const installmentValue = Math.ceil(totalWithInterest / installments);

  return {
    installments,
    installmentValue,
    totalWithInterest,
    hasInterest: true,
    interestPercentage: feePercentage,
  };
}

/**
 * Get the default 12x installment info for display purposes
 */
export function getMaxInstallmentDisplay(
  priceCents: number,
  installmentFees: Record<string, number> = DEFAULT_INSTALLMENT_FEES,
  passFeeToCustomer: boolean = true,
  maxInstallments: number = 12
): InstallmentInfo {
  return calculateInstallmentWithInterest(
    priceCents,
    maxInstallments,
    installmentFees,
    passFeeToCustomer
  );
}
