import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FunnelStage } from '@/types/lead';

export interface LeadStageHistory {
  id: string;
  lead_id: string;
  organization_id: string;
  stage: FunnelStage;
  previous_stage: FunnelStage | null;
  funnel_stage_id: string | null;
  reason: string | null;
  changed_by: string | null;
  source: string | null;
  created_at: string;
  changed_by_profile?: {
    first_name: string;
    last_name: string;
  } | null;
  funnel_stage_name?: string | null;
  funnel_stage_color?: string | null;
  funnel_stage_text_color?: string | null;
  previous_funnel_stage_name?: string | null;
  previous_funnel_stage_color?: string | null;
  previous_funnel_stage_text_color?: string | null;
}

export function useLeadStageHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-stage-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await (supabase as any)
        .from('lead_stage_history')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching lead stage history:', error);
        throw error;
      }

      const entries = (data || []) as any[];

      // Collect all funnel_stage_ids to resolve names
      const stageIds = new Set<string>();
      for (const entry of entries) {
        if (entry.funnel_stage_id) stageIds.add(entry.funnel_stage_id);
      }

      // Also get org_id to fetch all stages for enum fallback
      const orgId = entries[0]?.organization_id;
      let stagesMap: Record<string, { name: string; color: string; text_color: string; enum_value: string | null }> = {};

      if (orgId) {
        const { data: stages } = await (supabase as any)
          .from('organization_funnel_stages')
          .select('id, name, color, text_color, enum_value')
          .eq('organization_id', orgId);

        if (stages) {
          for (const s of stages) {
            stagesMap[s.id] = { name: s.name, color: s.color, text_color: s.text_color, enum_value: s.enum_value };
          }
        }
      }

      // Build enum-to-stage lookup for previous_stage resolution
      const enumToStage: Record<string, { name: string; color: string; text_color: string }> = {};
      for (const s of Object.values(stagesMap)) {
        if (s.enum_value) {
          enumToStage[s.enum_value] = { name: s.name, color: s.color, text_color: s.text_color };
        }
      }

      // Fetch user profiles for changed_by
      const changedByIds = [...new Set(entries.map((h: any) => h.changed_by).filter(Boolean))] as string[];
      
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

      // Merge everything
      const historyWithProfiles = entries.map((entry: any) => {
        const stageInfo = entry.funnel_stage_id ? stagesMap[entry.funnel_stage_id] : null;
        const prevInfo = entry.previous_stage ? enumToStage[entry.previous_stage] : null;

        return {
          ...entry,
          changed_by_profile: entry.changed_by ? profiles[entry.changed_by] : null,
          funnel_stage_name: stageInfo?.name || null,
          funnel_stage_color: stageInfo?.color || null,
          funnel_stage_text_color: stageInfo?.text_color || null,
          previous_funnel_stage_name: prevInfo?.name || null,
          previous_funnel_stage_color: prevInfo?.color || null,
          previous_funnel_stage_text_color: prevInfo?.text_color || null,
        };
      });

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
  to_stage_id?: string;
  source?: 'manual' | 'whatsapp' | 'automation' | 'webhook' | 'ecommerce';
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
          source: params.source || 'manual',
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding stage history:', error);
        throw error;
      }

      if (params.to_stage_id) {
        try {
          supabase.functions.invoke('traczap-stage-event', {
            body: {
              lead_id: params.lead_id,
              organization_id: params.organization_id,
              to_stage_id: params.to_stage_id,
              history_id: data.id,
            },
          }).then(result => {
            if (result.error) {
              console.warn('[TracZAP] Event dispatch failed:', result.error);
            } else {
              console.log('[TracZAP] Event dispatched:', result.data);
            }
          }).catch(err => {
            console.warn('[TracZAP] Event dispatch error:', err);
          });
        } catch (e) {
          console.warn('[TracZAP] Error invoking function:', e);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-stage-history', data.lead_id] });
    },
  });
}
