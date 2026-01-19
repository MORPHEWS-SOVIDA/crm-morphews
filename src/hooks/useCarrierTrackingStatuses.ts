import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface CarrierTrackingStatusConfig {
  id: string;
  organization_id: string;
  status_key: string;
  label: string;
  webhook_url: string | null;
  position: number;
  is_active: boolean;
  whatsapp_instance_id: string | null;
  message_template: string | null;
  media_type: 'image' | 'audio' | 'document' | null;
  media_url: string | null;
  media_filename: string | null;
  created_at: string;
  updated_at: string;
}

export function useCarrierTrackingStatuses() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['carrier-tracking-statuses', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('carrier_tracking_statuses')
        .select('*')
        .eq('organization_id', tenantId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as CarrierTrackingStatusConfig[];
    },
    enabled: !!tenantId,
  });
}

export function useUpdateCarrierTrackingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      label, 
      webhook_url, 
      is_active,
      whatsapp_instance_id,
      message_template,
      media_type,
      media_url,
      media_filename,
    }: { 
      id: string; 
      label?: string; 
      webhook_url?: string | null;
      is_active?: boolean;
      whatsapp_instance_id?: string | null;
      message_template?: string | null;
      media_type?: 'image' | 'audio' | 'document' | null;
      media_url?: string | null;
      media_filename?: string | null;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (label !== undefined) updateData.label = label;
      if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (whatsapp_instance_id !== undefined) updateData.whatsapp_instance_id = whatsapp_instance_id;
      if (message_template !== undefined) updateData.message_template = message_template;
      if (media_type !== undefined) updateData.media_type = media_type;
      if (media_url !== undefined) updateData.media_url = media_url;
      if (media_filename !== undefined) updateData.media_filename = media_filename;
      
      const { error } = await supabase
        .from('carrier_tracking_statuses')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrier-tracking-statuses'] });
    },
  });
}
