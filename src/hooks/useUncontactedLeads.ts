import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';
import type { FunnelStage } from '@/types/lead';

export interface UncontactedLead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  stage: string;
  stage_name: string;
  stage_color: string;
  created_at: string;
  lead_source: string | null;
  observations: string | null;
}

export function useUncontactedLeads() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['uncontacted-leads', tenantId],
    queryFn: async (): Promise<UncontactedLead[]> => {
      if (!tenantId) return [];

      // First, get funnel stages that require contact
      // @ts-ignore - requires_contact is a new column
      const { data: stages, error: stagesError } = await supabase
        .from('organization_funnel_stages')
        .select('id, name, color, enum_value')
        .eq('organization_id', tenantId)
        .eq('requires_contact' as any, true);

      if (stagesError) throw stagesError;
      if (!stages || stages.length === 0) return [];

      // Get the enum values for these stages
      const stageEnumValues: string[] = stages
        .map((s: any) => s.enum_value)
        .filter(Boolean);

      if (stageEnumValues.length === 0) return [];

      // Create a map for stage info lookup
      const stageMap = new Map<string, { name: string; color: string }>();
      stages.forEach((s: any) => {
        if (s.enum_value) {
          stageMap.set(s.enum_value, { name: s.name, color: s.color });
        }
      });

      // Get leads in these stages that have NO responsibles assigned
      // @ts-ignore - using dynamic stage values
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          whatsapp,
          email,
          stage,
          created_at,
          lead_source,
          observations,
          lead_responsibles!left(user_id)
        `)
        .eq('organization_id', tenantId)
        .in('stage', stageEnumValues as any)
        .order('created_at', { ascending: false })
        .limit(100);

      if (leadsError) throw leadsError;

      // Filter leads that have NO responsibles
      const uncontactedLeads = (leads || [])
        .filter((lead: any) => {
          const responsibles = lead.lead_responsibles || [];
          return responsibles.length === 0;
        })
        .map((lead: any) => {
          const stageInfo = stageMap.get(lead.stage) || { name: lead.stage, color: 'bg-gray-200' };
          return {
            id: lead.id,
            name: lead.name,
            whatsapp: lead.whatsapp,
            email: lead.email,
            stage: lead.stage,
            stage_name: stageInfo.name,
            stage_color: stageInfo.color,
            created_at: lead.created_at,
            lead_source: lead.lead_source,
            observations: lead.observations,
          };
        });

      return uncontactedLeads;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 30, // 30 seconds - refresh often for real-time claiming
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

export interface ClaimLeadResult {
  success: boolean;
  alreadyClaimed?: boolean;
  leadId?: string;
}

export function useClaimLead() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string): Promise<ClaimLeadResult> => {
      if (!tenantId || !user?.id) throw new Error('Missing tenant or user');

      // Use atomic claim function to prevent race conditions
      const { data, error } = await supabase.rpc('claim_lead', {
        p_lead_id: leadId,
        p_user_id: user.id,
        p_organization_id: tenantId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string; lead_id?: string };

      if (!result.success) {
        if (result.error === 'already_claimed') {
          return { success: false, alreadyClaimed: true };
        }
        throw new Error(result.message || 'Erro ao assumir lead');
      }

      return { success: true, leadId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['uncontacted-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (result.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead', result.leadId] });
      }
      // Toast is handled in the component for custom behavior
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao assumir lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
