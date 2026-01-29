import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Default installment fees if not configured
const DEFAULT_INSTALLMENT_FEES: Record<string, number> = {
  "2": 3.49,
  "3": 4.29,
  "4": 4.99,
  "5": 5.49,
  "6": 5.99,
  "7": 6.49,
  "8": 6.99,
  "9": 7.49,
  "10": 7.99,
  "11": 8.49,
  "12": 8.99,
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
