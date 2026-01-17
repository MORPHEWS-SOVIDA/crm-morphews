import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ConferenceRecord {
  id: string;
  sale_id: string;
  sale_item_id: string;
  organization_id: string;
  conferenced_by: string;
  conferenced_at: string;
  quantity_checked: number;
  stage: string;
  notes: string | null;
  created_at: string;
}

interface ConferenceWithUser extends ConferenceRecord {
  user_name?: string;
}

export function useProductConference(saleId: string, organizationId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch existing conference records for this sale
  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ['sale-item-conferences', saleId],
    queryFn: async () => {
      if (!saleId || !organizationId) return [];

      const { data, error } = await supabase
        .from('sale_item_conferences')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ConferenceRecord[];
    },
    enabled: !!saleId && !!organizationId,
  });

  // Fetch user names for conferences
  const { data: conferencesWithUsers = [] } = useQuery({
    queryKey: ['sale-item-conferences-with-users', saleId, conferences],
    queryFn: async () => {
      if (!conferences.length) return [];

      const userIds = [...new Set(conferences.map(c => c.conferenced_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const userMap = new Map(
        (profiles || []).map(p => [
          p.user_id,
          `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Usuário'
        ])
      );

      return conferences.map(c => ({
        ...c,
        user_name: userMap.get(c.conferenced_by) || 'Usuário',
      })) as ConferenceWithUser[];
    },
    enabled: conferences.length > 0,
  });

  // Add conference record
  const addConferenceMutation = useMutation({
    mutationFn: async ({
      saleItemId,
      stage = 'separation',
    }: {
      saleItemId: string;
      stage?: string;
    }) => {
      if (!user?.id || !organizationId) throw new Error('Missing user or org');

      const { data, error } = await supabase
        .from('sale_item_conferences')
        .insert({
          sale_id: saleId,
          sale_item_id: saleItemId,
          organization_id: organizationId,
          conferenced_by: user.id,
          stage,
          quantity_checked: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-item-conferences', saleId] });
    },
    onError: (error) => {
      console.error('Error adding conference:', error);
      toast.error('Erro ao registrar conferência');
    },
  });

  // Remove conference record (uncheck)
  const removeConferenceMutation = useMutation({
    mutationFn: async (conferenceId: string) => {
      const { error } = await supabase
        .from('sale_item_conferences')
        .delete()
        .eq('id', conferenceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-item-conferences', saleId] });
    },
    onError: (error) => {
      console.error('Error removing conference:', error);
      toast.error('Erro ao remover conferência');
    },
  });

  // Mark sale as fully conferenced
  const markSaleConferencedMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Missing user');

      const { error } = await supabase
        .from('sales')
        .update({
          conference_completed_at: new Date().toISOString(),
          conference_completed_by: user.id,
        })
        .eq('id', saleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      toast.success('Conferência completa registrada!');
    },
  });

  // Get count of conferences per item
  const getConferenceCountForItem = (saleItemId: string, stage?: string) => {
    return conferences.filter(
      c => c.sale_item_id === saleItemId && (!stage || c.stage === stage)
    ).length;
  };

  // Get all conferences for an item
  const getConferencesForItem = (saleItemId: string, stage?: string) => {
    return conferencesWithUsers.filter(
      c => c.sale_item_id === saleItemId && (!stage || c.stage === stage)
    );
  };

  // Check if all items are fully conferenced
  const isAllConferenced = (
    items: { id: string; quantity: number }[],
    stage?: string
  ) => {
    return items.every(item => {
      const count = getConferenceCountForItem(item.id, stage);
      return count >= item.quantity;
    });
  };

  return {
    conferences,
    conferencesWithUsers,
    isLoading,
    addConference: addConferenceMutation.mutate,
    removeConference: removeConferenceMutation.mutate,
    markSaleConferenced: markSaleConferencedMutation.mutate,
    getConferenceCountForItem,
    getConferencesForItem,
    isAllConferenced,
    isAdding: addConferenceMutation.isPending,
    isRemoving: removeConferenceMutation.isPending,
  };
}
