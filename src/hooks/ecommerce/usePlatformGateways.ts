import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type GatewayType = 'pagarme' | 'appmax' | 'stripe' | 'asaas';
export type PaymentMethodType = 'pix' | 'credit_card' | 'boleto';

export interface PlatformGatewayConfig {
  id: string;
  gateway_type: GatewayType;
  display_name: string;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  webhook_secret_encrypted: string | null;
  is_primary: boolean;
  priority: number;
  is_active: boolean;
  is_sandbox: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GatewayFallbackConfig {
  id: string;
  payment_method: PaymentMethodType;
  primary_gateway: string;
  fallback_gateways: string[];
  fallback_enabled: boolean;
  max_fallback_attempts: number;
  fallback_on_error_codes: string[];
  no_fallback_error_codes: string[];
  created_at: string;
  updated_at: string;
}

export interface TenantPaymentFees {
  id: string;
  organization_id: string;
  pix_fee_percentage: number;
  pix_fee_fixed_cents: number;
  pix_release_days: number;
  pix_enabled: boolean;
  card_fee_percentage: number;
  card_fee_fixed_cents: number;
  card_release_days: number;
  card_enabled: boolean;
  max_installments: number;
  installment_fees: Record<string, number>;
  installment_fee_passed_to_buyer: boolean;
  boleto_fee_percentage: number;
  boleto_fee_fixed_cents: number;
  boleto_release_days: number;
  boleto_enabled: boolean;
  boleto_expiration_days: number;
  allow_save_card: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAttempt {
  id: string;
  organization_id: string;
  sale_id: string | null;
  cart_id: string | null;
  gateway: string;
  payment_method: PaymentMethodType;
  amount_cents: number;
  installments: number;
  status: 'pending' | 'processing' | 'approved' | 'refused' | 'error' | 'cancelled';
  gateway_transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  is_fallback: boolean;
  fallback_from_gateway: string | null;
  attempt_number: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SavedPaymentMethod {
  id: string;
  organization_id: string;
  lead_id: string;
  gateway: string;
  gateway_customer_id: string | null;
  gateway_card_id: string | null;
  payment_type: 'credit_card' | 'debit_card';
  card_brand: string | null;
  card_last4: string | null;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
  card_holder_name: string | null;
  card_first6: string | null;
  is_default: boolean;
  fingerprint_hash: string | null;
  created_at: string;
  last_used_at: string | null;
  times_used: number;
  is_active: boolean;
}

// Fetch active platform gateways
export function useActivePlatformGateways() {
  return useQuery({
    queryKey: ['platform-gateways', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_gateway_config')
        .select('*')
        .eq('is_active', true)
        .order('priority');
      
      if (error) throw error;
      return data as PlatformGatewayConfig[];
    },
  });
}

// Fetch fallback config for a payment method
export function useGatewayFallbackConfig(paymentMethod?: PaymentMethodType) {
  return useQuery({
    queryKey: ['gateway-fallback-config', paymentMethod],
    queryFn: async () => {
      let query = supabase.from('gateway_fallback_config').select('*');
      
      if (paymentMethod) {
        query = query.eq('payment_method', paymentMethod);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as GatewayFallbackConfig[];
    },
  });
}

// Fetch tenant payment fees
export function useTenantPaymentFees(organizationId?: string) {
  return useQuery({
    queryKey: ['tenant-payment-fees', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      
      const { data, error } = await supabase
        .from('tenant_payment_fees')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (error) throw error;
      return data as TenantPaymentFees | null;
    },
    enabled: !!organizationId,
  });
}

// Fetch payment attempts for a sale
export function usePaymentAttempts(saleId?: string) {
  return useQuery({
    queryKey: ['payment-attempts', saleId],
    queryFn: async () => {
      if (!saleId) return [];
      
      const { data, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PaymentAttempt[];
    },
    enabled: !!saleId,
  });
}

// Fetch saved payment methods for a lead
export function useSavedPaymentMethods(leadId?: string) {
  return useQuery({
    queryKey: ['saved-payment-methods', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('saved_payment_methods')
        .select('*')
        .eq('lead_id', leadId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('last_used_at', { ascending: false });
      
      if (error) throw error;
      return data as SavedPaymentMethod[];
    },
    enabled: !!leadId,
  });
}

// Calculate fees for a transaction
export function calculateTransactionFees(
  fees: TenantPaymentFees | null,
  paymentMethod: PaymentMethodType,
  amountCents: number,
  installments: number = 1
): {
  grossAmount: number;
  feePercentage: number;
  feeFixed: number;
  installmentFee: number;
  totalFee: number;
  netAmount: number;
  releaseDays: number;
} {
  // Default fees if not configured
  const defaultFees = {
    pix: { percentage: 1.5, fixed: 0, release: 2 },
    credit_card: { percentage: 4.99, fixed: 0, release: 14 },
    boleto: { percentage: 0, fixed: 350, release: 2 },
  };

  let feePercentage = 0;
  let feeFixed = 0;
  let releaseDays = 14;
  let installmentFee = 0;

  if (fees) {
    switch (paymentMethod) {
      case 'pix':
        feePercentage = Number(fees.pix_fee_percentage);
        feeFixed = fees.pix_fee_fixed_cents;
        releaseDays = fees.pix_release_days;
        break;
      case 'credit_card':
        feePercentage = Number(fees.card_fee_percentage);
        feeFixed = fees.card_fee_fixed_cents;
        releaseDays = fees.card_release_days;
        if (installments > 1 && fees.installment_fees) {
          installmentFee = fees.installment_fees[String(installments)] || 0;
        }
        break;
      case 'boleto':
        feePercentage = Number(fees.boleto_fee_percentage);
        feeFixed = fees.boleto_fee_fixed_cents;
        releaseDays = fees.boleto_release_days;
        break;
    }
  } else {
    const defaults = defaultFees[paymentMethod];
    feePercentage = defaults.percentage;
    feeFixed = defaults.fixed;
    releaseDays = defaults.release;
  }

  const percentageFeeAmount = Math.round(amountCents * ((feePercentage + installmentFee) / 100));
  const totalFee = percentageFeeAmount + feeFixed;
  const netAmount = amountCents - totalFee;

  return {
    grossAmount: amountCents,
    feePercentage,
    feeFixed,
    installmentFee,
    totalFee,
    netAmount,
    releaseDays,
  };
}

// Gateway display info
export const GATEWAY_INFO: Record<GatewayType, { label: string; color: string; icon: string }> = {
  pagarme: { label: 'Pagar.me', color: 'bg-green-500', icon: '💳' },
  appmax: { label: 'Appmax', color: 'bg-blue-500', icon: '🛒' },
  stripe: { label: 'Stripe', color: 'bg-purple-500', icon: '⚡' },
  asaas: { label: 'Asaas', color: 'bg-orange-500', icon: '🏦' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  boleto: 'Boleto',
};
