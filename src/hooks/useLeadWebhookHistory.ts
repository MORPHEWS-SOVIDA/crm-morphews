import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookHistoryEntry {
  id: string;
  lead_id: string;
  organization_id: string;
  integration_id: string | null;
  integration_name: string | null;
  payload: Record<string, any>;
  received_at: string;
  processed_successfully: boolean;
  error_message: string | null;
}

// Hook para buscar histórico de webhooks de um lead
export function useLeadWebhookHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-webhook-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('lead_webhook_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('received_at', { ascending: false });
      
      if (error) throw error;
      return data as WebhookHistoryEntry[];
    },
    enabled: !!leadId,
  });
}
