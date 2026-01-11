import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';

export interface LeadFollowup {
  id: string;
  organization_id: string;
  lead_id: string;
  user_id: string;
  scheduled_at: string;
  reason: string | null;
  source_type: string;
  source_id: string | null;
  completed_at: string | null;
  notes: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
}

export function useLeadFollowups(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-followups', leadId],
    queryFn: async () => {
      if (!leadId) {
        console.log('[useLeadFollowups] No leadId, returning empty');
        return [];
      }
      
      console.log('[useLeadFollowups] Fetching followups for lead:', leadId);
      
      const { data, error } = await supabase
        .from('lead_followups')
        .select(`
          *,
          profiles!lead_followups_user_id_fkey(first_name, last_name)
        `)
        .eq('lead_id', leadId)
        .order('scheduled_at', { ascending: false });

      if (error) {
        console.error('[useLeadFollowups] Error:', error);
        throw error;
      }
      
      console.log('[useLeadFollowups] Fetched:', data?.length, 'followups');
      
      return (data || []).map((item: any) => ({
        ...item,
        user_name: item.profiles 
          ? `${item.profiles.first_name} ${item.profiles.last_name}` 
          : 'Desconhecido',
      })) as LeadFollowup[];
    },
    enabled: !!leadId,
    staleTime: 0, // Always refetch
  });
}

export function useUpcomingFollowups() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['upcoming-followups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_followups')
        .select(`
          *,
          leads!lead_followups_lead_id_fkey(name, whatsapp)
        `)
        .eq('user_id', user!.id)
        .is('completed_at', null)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useCreateFollowup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      lead_id: string;
      scheduled_at: Date;
      reason?: string;
      source_type?: string;
      source_id?: string;
      notes?: string;
    }) => {
      if (!tenantId || !user) throw new Error('Usuário não autenticado');

      console.log('[useCreateFollowup] Creating followup:', { lead_id: data.lead_id, tenantId });

      const { data: followup, error } = await supabase
        .from('lead_followups')
        .insert({
          organization_id: tenantId,
          lead_id: data.lead_id,
          user_id: user.id,
          scheduled_at: data.scheduled_at.toISOString(),
          reason: data.reason || null,
          source_type: data.source_type || 'manual',
          source_id: data.source_id || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[useCreateFollowup] Error:', error);
        throw error;
      }
      
      console.log('[useCreateFollowup] Created:', followup);
      return { ...followup, lead_id: data.lead_id };
    },
    onSuccess: (data, variables) => {
      console.log('[useCreateFollowup] Invalidating queries for lead:', variables.lead_id);
      // Invalidate with exact match
      queryClient.invalidateQueries({ queryKey: ['lead-followups', variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-followups'] });
      // Also refetch immediately
      queryClient.refetchQueries({ queryKey: ['lead-followups', variables.lead_id] });
    },
    onError: (error: any) => {
      console.error('[useCreateFollowup] Mutation error:', error);
      toast({
        title: 'Erro ao criar follow-up',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCompleteFollowup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes, result }: { id: string; notes?: string; result?: string }) => {
      const { error } = await supabase
        .from('lead_followups')
        .update({
          completed_at: new Date().toISOString(),
          notes: notes || null,
          result: result || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-followups'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-followups'] });
    },
  });
}
