import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FunnelStage } from '@/types/lead';

export interface LeadStageHistory {
  id: string;
  lead_id: string;
  organization_id: string;
  stage: FunnelStage;
  previous_stage: FunnelStage | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
  changed_by_profile?: {
    first_name: string;
    last_name: string;
  } | null;
}

export function useLeadStageHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-stage-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('lead_stage_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching lead stage history:', error);
        throw error;
      }

      // Fetch user profiles for changed_by
      const changedByIds = [...new Set((data || []).map(h => h.changed_by).filter(Boolean))] as string[];
      
      let profiles: Record<string, { first_name: string; last_name: string }> = {};
      
      if (changedByIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', changedByIds);
        
        if (profilesData) {
          profiles = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      // Merge profiles into history
      const historyWithProfiles = (data || []).map(entry => ({
        ...entry,
        changed_by_profile: entry.changed_by ? profiles[entry.changed_by] : null,
      }));

      return historyWithProfiles as LeadStageHistory[];
    },
    enabled: !!leadId,
  });
}

interface AddStageHistoryParams {
  lead_id: string;
  organization_id: string;
  stage: FunnelStage;
  previous_stage?: FunnelStage | null;
  reason?: string | null;
  changed_by?: string | null;
}

export function useAddStageHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddStageHistoryParams) => {
      const { data, error } = await supabase
        .from('lead_stage_history')
        .insert({
          lead_id: params.lead_id,
          organization_id: params.organization_id,
          stage: params.stage,
          previous_stage: params.previous_stage || null,
          reason: params.reason || null,
          changed_by: params.changed_by || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding stage history:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-stage-history', data.lead_id] });
    },
  });
}
