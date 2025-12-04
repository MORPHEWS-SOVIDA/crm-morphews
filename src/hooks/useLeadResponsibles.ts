import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface LeadResponsible {
  id: string;
  lead_id: string;
  user_id: string;
  organization_id: string;
  created_at: string;
}

export interface LeadResponsibleWithProfile extends LeadResponsible {
  profile?: {
    first_name: string;
    last_name: string;
    user_id: string;
  };
}

export function useLeadResponsibles(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-responsibles', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('lead_responsibles')
        .select('*')
        .eq('lead_id', leadId);

      if (error) {
        console.error('Error fetching lead responsibles:', error);
        throw error;
      }

      // Get profiles for each responsible
      if (data && data.length > 0) {
        const userIds = data.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('first_name, last_name, user_id')
          .in('user_id', userIds);

        return data.map(r => ({
          ...r,
          profile: profiles?.find(p => p.user_id === r.user_id)
        })) as LeadResponsibleWithProfile[];
      }

      return data as LeadResponsibleWithProfile[];
    },
    enabled: !!leadId,
  });
}

export function useAddLeadResponsible() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, userId, organizationId }: { leadId: string; userId: string; organizationId: string }) => {
      const { data, error } = await supabase
        .from('lead_responsibles')
        .insert({
          lead_id: leadId,
          user_id: userId,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) {
        // Ignore unique constraint violations (already responsible)
        if (error.code === '23505') {
          return null;
        }
        console.error('Error adding lead responsible:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-responsibles', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar responsável',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveLeadResponsible() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string; userId: string }) => {
      const { error } = await supabase
        .from('lead_responsibles')
        .delete()
        .eq('lead_id', leadId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing lead responsible:', error);
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-responsibles', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover responsável',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSetLeadResponsibles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, userIds, organizationId }: { leadId: string; userIds: string[]; organizationId: string }) => {
      // First, delete all existing responsibles for this lead
      const { error: deleteError } = await supabase
        .from('lead_responsibles')
        .delete()
        .eq('lead_id', leadId);

      if (deleteError) {
        console.error('Error clearing lead responsibles:', deleteError);
        throw deleteError;
      }

      // Then, insert new ones
      if (userIds.length > 0) {
        const { error: insertError } = await supabase
          .from('lead_responsibles')
          .insert(
            userIds.map(userId => ({
              lead_id: leadId,
              user_id: userId,
              organization_id: organizationId,
            }))
          );

        if (insertError) {
          console.error('Error setting lead responsibles:', insertError);
          throw insertError;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-responsibles', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Responsáveis atualizados!',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar responsáveis',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
