import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface KitRejection {
  id: string;
  organization_id: string;
  lead_id: string;
  product_id: string;
  kit_id: string;
  rejected_by: string;
  rejection_reason: string;
  kit_quantity: number;
  kit_price_cents: number;
  created_at: string;
}

export interface CreateKitRejectionData {
  lead_id: string;
  product_id: string;
  kit_id: string;
  rejection_reason: string;
  kit_quantity: number;
  kit_price_cents: number;
}

// Fetch kit rejections for a specific lead and product
export function useKitRejections(leadId: string | undefined, productId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['kit-rejections', leadId, productId],
    queryFn: async () => {
      if (!leadId || !productId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_kit_rejections')
        .select('*')
        .eq('lead_id', leadId)
        .eq('product_id', productId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as KitRejection[];
    },
    enabled: !!leadId && !!productId && !!tenantId,
  });
}

// Create a kit rejection
export function useCreateKitRejection() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (data: CreateKitRejectionData) => {
      if (!tenantId) throw new Error('Organization not found');

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: rejection, error } = await supabase
        .from('lead_kit_rejections')
        .insert({
          organization_id: tenantId,
          lead_id: data.lead_id,
          product_id: data.product_id,
          kit_id: data.kit_id,
          rejected_by: user.user.id,
          rejection_reason: data.rejection_reason,
          kit_quantity: data.kit_quantity,
          kit_price_cents: data.kit_price_cents,
        })
        .select()
        .single();

      if (error) throw error;
      return rejection;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['kit-rejections', variables.lead_id, variables.product_id] 
      });
    },
  });
}

// Fetch all kit rejections for a lead (for timeline display)
export function useLeadKitRejections(leadId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-kit-rejections', leadId],
    queryFn: async () => {
      if (!leadId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_kit_rejections')
        .select(`
          *,
          product:lead_products(name),
          kit:product_price_kits(quantity)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!leadId && !!tenantId,
  });
}
