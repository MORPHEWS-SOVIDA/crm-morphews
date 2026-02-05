import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
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
  occurredAt?: string; // ISO date string for when the status change actually happened
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
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ saleId, status, notes, occurredAt }: UpdateTrackingData) => {
      // Get sale info
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('organization_id, lead_id, seller_user_id')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Use provided occurredAt date or default to now
      const trackingDate = occurredAt || new Date().toISOString();

      // Insert tracking history entry
      const { error: insertError } = await supabase
        .from('sale_carrier_tracking')
        .insert({
          sale_id: saleId,
          organization_id: sale.organization_id,
          status,
          changed_by: user?.id,
          notes,
          created_at: trackingDate, // Use custom date if provided
        });

      if (insertError) throw insertError;

      // Update current status on sales table
      const { error: updateError } = await supabase
        .from('sales')
        .update({ carrier_tracking_status: status })
        .eq('id', saleId);

      if (updateError) throw updateError;

      // Check if there's a message configured for this status
      if (tenantId && sale.lead_id) {
        const { data: statusConfig } = await supabase
          .from('carrier_tracking_statuses')
          .select('whatsapp_instance_id, message_template, media_type, media_url, media_filename')
          .eq('organization_id', tenantId)
          .eq('status_key', status)
          .single();

        if (statusConfig?.message_template && statusConfig?.whatsapp_instance_id) {
          // Get lead info
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: lead }: any = await (supabase as any)
            .from('leads')
            .select('name, lead_products(name)')
            .eq('id', sale.lead_id)
            .single();

          let sellerName = '';
          if (sale.seller_user_id) {
            const { data: seller } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', sale.seller_user_id)
              .single();
            if (seller) sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim();
          }

          let finalMessage = statusConfig.message_template;
          const leadName = lead?.name || '';
          const firstName = leadName.split(' ')[0] || '';
          const productName = (lead?.lead_products as any)?.name || '';

          finalMessage = finalMessage
            .replace(/\{\{nome\}\}/g, leadName)
            .replace(/\{\{primeiro_nome\}\}/g, firstName)
            .replace(/\{\{vendedor\}\}/g, sellerName)
            .replace(/\{\{produto\}\}/g, productName);

          await supabase
            .from('lead_scheduled_messages')
            .insert({
              lead_id: sale.lead_id,
              organization_id: sale.organization_id,
              created_by: user?.id || null,
              whatsapp_instance_id: statusConfig.whatsapp_instance_id,
              final_message: finalMessage,
              scheduled_at: new Date().toISOString(),
              status: 'pending' as const,
              media_type: statusConfig.media_type || null,
              media_url: statusConfig.media_url || null,
              media_filename: statusConfig.media_filename || null,
            } as any);
        }
      }

      return { saleId, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['carrier-tracking-history', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
    },
  });
}
