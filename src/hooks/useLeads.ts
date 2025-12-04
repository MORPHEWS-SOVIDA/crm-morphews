import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Lead = Tables<'leads'>;
export type LeadInsert = TablesInsert<'leads'>;
export type LeadUpdate = TablesUpdate<'leads'>;

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching leads:', error);
        throw error;
      }

      return data;
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching lead:', error);
        throw error;
      }

      return data;
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Omit<LeadInsert, 'organization_id' | 'created_by'>) => {
      // Get user's organization_id and user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: orgData, error: orgError } = await supabase
        .rpc('get_user_organization_id');
      
      if (orgError || !orgData) {
        console.error('Error getting organization:', orgError);
        throw new Error('Não foi possível identificar sua organização');
      }

      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...lead,
          organization_id: orgData,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating lead:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead criado com sucesso!',
        description: 'O lead foi adicionado ao seu CRM.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating lead:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', data.id] });
      toast({
        title: 'Lead atualizado!',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting lead:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead excluído',
        description: 'O lead foi removido do CRM.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao excluir lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
