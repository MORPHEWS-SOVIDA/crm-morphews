import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface DiscountCoupon {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value_cents: number; // For percentage: 10 = 10%, for fixed: value in cents
  applies_to: 'all' | 'specific_products' | 'specific_combos' | 'specific_items';
  product_ids: string[];
  combo_ids: string[];
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_customer: number | null;
  min_order_cents: number | null;
  allow_with_affiliate: boolean;
  affiliate_only: boolean;
  auto_attribute_affiliate_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  auto_attribute_affiliate?: {
    id: string;
    user_id: string;
    display_name: string | null;
  } | null;
}

export interface CouponUsage {
  id: string;
  organization_id: string;
  coupon_id: string;
  sale_id: string | null;
  cart_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  discount_cents: number;
  attributed_affiliate_id: string | null;
  created_at: string;
}

export interface CreateCouponInput {
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value_cents: number;
  applies_to: 'all' | 'specific_products' | 'specific_combos' | 'specific_items';
  product_ids?: string[];
  combo_ids?: string[];
  valid_from?: string;
  valid_until?: string;
  max_uses?: number;
  max_uses_per_customer?: number;
  min_order_cents?: number;
  allow_with_affiliate?: boolean;
  affiliate_only?: boolean;
  auto_attribute_affiliate_id?: string;
  is_active?: boolean;
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {
  id: string;
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

export function useDiscountCoupons() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['discount-coupons', profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_coupons')
        .select(`
          *,
          auto_attribute_affiliate:organization_affiliates(id, user_id, display_name)
        `)
        .eq('organization_id', profile!.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as DiscountCoupon[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useDiscountCoupon(couponId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['discount-coupon', couponId],
    queryFn: async () => {
      if (!couponId) return null;

      const { data, error } = await supabase
        .from('discount_coupons')
        .select(`
          *,
          auto_attribute_affiliate:organization_affiliates(id, user_id, display_name)
        `)
        .eq('id', couponId)
        .single();

      if (error) throw error;
      return data as unknown as DiscountCoupon;
    },
    enabled: !!couponId && !!profile?.organization_id,
  });
}

export function useCouponUsages(couponId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['coupon-usages', couponId],
    queryFn: async () => {
      if (!couponId) return [];

      const { data, error } = await supabase
        .from('coupon_usages')
        .select('*')
        .eq('coupon_id', couponId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CouponUsage[];
    },
    enabled: !!couponId && !!profile?.organization_id,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

export function useCreateDiscountCoupon() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCouponInput) => {
      const { data, error } = await supabase
        .from('discount_coupons')
        .insert({
          organization_id: profile!.organization_id,
          code: input.code.toUpperCase().trim(),
          name: input.name,
          description: input.description,
          discount_type: input.discount_type,
          discount_value_cents: input.discount_value_cents,
          applies_to: input.applies_to,
          product_ids: input.product_ids || [],
          combo_ids: input.combo_ids || [],
          valid_from: input.valid_from,
          valid_until: input.valid_until,
          max_uses: input.max_uses,
          max_uses_per_customer: input.max_uses_per_customer,
          min_order_cents: input.min_order_cents,
          allow_with_affiliate: input.allow_with_affiliate ?? true,
          affiliate_only: input.affiliate_only ?? false,
          auto_attribute_affiliate_id: input.auto_attribute_affiliate_id,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um cupom com este código');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-coupons'] });
      toast.success('Cupom criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateDiscountCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCouponInput) => {
      const updateData: any = { ...input };
      if (input.code) {
        updateData.code = input.code.toUpperCase().trim();
      }

      const { data, error } = await supabase
        .from('discount_coupons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um cupom com este código');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['discount-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['discount-coupon', variables.id] });
      toast.success('Cupom atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteDiscountCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('discount_coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-coupons'] });
      toast.success('Cupom removido');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useToggleCouponStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('discount_coupons')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-coupons'] });
      toast.success('Status atualizado');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =============================================================================
// VALIDATION HOOK (for checkout)
// =============================================================================

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({
      code,
      organizationId,
      orderTotal,
      hasAffiliateRef,
      customerEmail,
      customerPhone,
      productIds,
      comboIds,
    }: {
      code: string;
      organizationId: string;
      orderTotal: number;
      hasAffiliateRef: boolean;
      customerEmail?: string;
      customerPhone?: string;
      productIds?: string[];
      comboIds?: string[];
    }) => {
      // Fetch the coupon
      const { data: coupon, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('code', code.toUpperCase().trim())
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        throw new Error('Cupom inválido ou expirado');
      }

      const now = new Date();

      // Check validity period
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        throw new Error('Este cupom ainda não está ativo');
      }
      if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        throw new Error('Este cupom expirou');
      }

      // Check max uses
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        throw new Error('Este cupom atingiu o limite de usos');
      }

      // Check min order value
      if (coupon.min_order_cents && orderTotal < coupon.min_order_cents) {
        const minValue = (coupon.min_order_cents / 100).toFixed(2);
        throw new Error(`Pedido mínimo de R$ ${minValue} para usar este cupom`);
      }

      // Check affiliate rules
      if (coupon.affiliate_only && !hasAffiliateRef) {
        throw new Error('Este cupom só pode ser usado com link de afiliado');
      }
      if (!coupon.allow_with_affiliate && hasAffiliateRef) {
        throw new Error('Este cupom não pode ser usado com link de afiliado');
      }

      // Check per-customer limit
      if (coupon.max_uses_per_customer && (customerEmail || customerPhone)) {
        const { count } = await supabase
          .from('coupon_usages')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', coupon.id)
          .or(`customer_email.eq.${customerEmail},customer_phone.eq.${customerPhone}`);

        if (count && count >= coupon.max_uses_per_customer) {
          throw new Error('Você já utilizou este cupom o número máximo de vezes');
        }
      }

      // Check product/combo scope
      if (coupon.applies_to === 'specific_products' && productIds) {
        const hasValidProduct = productIds.some(id => coupon.product_ids?.includes(id));
        if (!hasValidProduct) {
          throw new Error('Este cupom não é válido para os produtos selecionados');
        }
      }
      if (coupon.applies_to === 'specific_combos' && comboIds) {
        const hasValidCombo = comboIds.some(id => coupon.combo_ids?.includes(id));
        if (!hasValidCombo) {
          throw new Error('Este cupom não é válido para os combos selecionados');
        }
      }

      // Calculate discount
      let discountCents = 0;
      if (coupon.discount_type === 'percentage') {
        discountCents = Math.round(orderTotal * (coupon.discount_value_cents / 100));
      } else {
        discountCents = coupon.discount_value_cents;
      }

      // Don't let discount exceed order total
      discountCents = Math.min(discountCents, orderTotal);

      return {
        coupon: coupon as DiscountCoupon,
        discountCents,
        autoAttributeAffiliateId: coupon.auto_attribute_affiliate_id,
      };
    },
  });
}
