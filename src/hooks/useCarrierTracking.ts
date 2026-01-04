import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

export type CarrierTrackingStatus = Database['public']['Enums']['carrier_tracking_status'];

export interface CarrierTrackingEntry {
  id: string;
  sale_id: string;
  organization_id: string;
  status: CarrierTrackingStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  changed_by_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface UpdateTrackingData {
  saleId: string;
  status: CarrierTrackingStatus;
  notes?: string;
}

export const carrierTrackingLabels: Record<CarrierTrackingStatus, string> = {
  waiting_post: 'Aguardando ser postado',
  posted: 'Postado corretamente',
  in_destination_city: 'Na cidade do cliente',
  attempt_1_failed: '1ª tentativa sem sucesso',
  attempt_2_failed: '2ª tentativa sem sucesso',
  attempt_3_failed: '3ª tentativa sem sucesso',
  waiting_pickup: 'Aguardando retirada no correio',
  returning_to_sender: 'Voltando para remetente',
  delivered: 'ENTREGUE',
};

export const carrierTrackingOrder: CarrierTrackingStatus[] = [
  'waiting_post',
  'posted',
  'in_destination_city',
  'attempt_1_failed',
  'attempt_2_failed',
  'attempt_3_failed',
  'waiting_pickup',
  'returning_to_sender',
  'delivered',
];

export function useCarrierTrackingHistory(saleId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['carrier-tracking-history', saleId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await supabase
        .from('sale_carrier_tracking')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for changed_by users
      const userIds = [...new Set((data || []).map(c => c.changed_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
          return acc;
        }, {} as typeof profilesMap);
      }

      return (data || []).map(c => ({
        ...c,
        changed_by_profile: c.changed_by ? profilesMap[c.changed_by] : undefined,
      })) as CarrierTrackingEntry[];
    },
    enabled: !!saleId && !!user,
  });
}

export function useUpdateCarrierTracking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ saleId, status, notes }: UpdateTrackingData) => {
      // Get organization_id from sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('organization_id')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Insert tracking history entry
      const { error: insertError } = await supabase
        .from('sale_carrier_tracking')
        .insert({
          sale_id: saleId,
          organization_id: sale.organization_id,
          status,
          changed_by: user?.id,
          notes,
        });

      if (insertError) throw insertError;

      // Update current status on sales table
      const { error: updateError } = await supabase
        .from('sales')
        .update({ carrier_tracking_status: status })
        .eq('id', saleId);

      if (updateError) throw updateError;

      return { saleId, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['carrier-tracking-history', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', data.saleId] });
    },
  });
}
