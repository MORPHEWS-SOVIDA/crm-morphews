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
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Auth error:', authError);
        throw new Error('Você precisa estar logado. Faça logout e login novamente.');
      }

      console.log('=== DEBUG LEAD CREATION ===');
      console.log('User ID:', user.id);
      console.log('User Email:', user.email);

      // Get organization_id directly from organization_members table
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      console.log('Member query result:', memberData);
      console.log('Member query error:', memberError);

      if (memberError) {
        console.error('Member query error:', memberError);
        throw new Error('Erro ao buscar sua organização: ' + memberError.message);
      }

      if (!memberData?.organization_id) {
        console.error('No organization found for user:', user.id);
        throw new Error('Você não está vinculado a nenhuma organização. Contate o administrador.');
      }

      const organizationId = memberData.organization_id;
      console.log('Organization ID found:', organizationId);

      // Check subscription lead limit
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select(`*, plan:subscription_plans(*)`)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (subscription?.plan?.max_leads !== null && subscription?.plan?.max_leads !== undefined) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', startOfMonth.toISOString());

        if (count !== null && count >= subscription.plan.max_leads) {
          throw new Error(`Limite de ${subscription.plan.max_leads} leads/mês atingido. Faça upgrade do plano.`);
        }
      }

      // Prepare lead data
      const leadData = {
        ...lead,
        organization_id: organizationId,
        created_by: user.id,
      };
      
      console.log('Lead data to insert:', JSON.stringify(leadData, null, 2));

      // Insert the lead
      const { data, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        console.error('Insert error code:', error.code);
        console.error('Insert error details:', error.details);
        console.error('Insert error hint:', error.hint);
        throw new Error('Erro ao criar lead: ' + error.message);
      }

      console.log('Lead created successfully:', data.id);

      // Add creator as responsible
      await supabase
        .from('lead_responsibles')
        .insert({
          lead_id: data.id,
          user_id: user.id,
          organization_id: organizationId,
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead criado com sucesso!',
        description: 'O lead foi adicionado ao seu CRM.',
      });
    },
    onError: (error: Error) => {
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
