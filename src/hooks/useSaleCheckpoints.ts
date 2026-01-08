import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type CheckpointType = 'dispatched' | 'delivered' | 'payment_confirmed';

export interface SaleCheckpoint {
  id: string;
  sale_id: string;
  organization_id: string;
  checkpoint_type: CheckpointType;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_by_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

interface ToggleCheckpointData {
  saleId: string;
  checkpointType: CheckpointType;
  complete: boolean;
  notes?: string;
}

export const checkpointLabels: Record<CheckpointType, string> = {
  dispatched: 'Despachado',
  delivered: 'Entregue',
  payment_confirmed: 'Pagamento Confirmado',
};

export const checkpointOrder: CheckpointType[] = ['dispatched', 'delivered', 'payment_confirmed'];

export function useSaleCheckpoints(saleId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sale-checkpoints', saleId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await supabase
        .from('sale_checkpoints')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for completed_by users
      const userIds = [...new Set((data || []).map(c => c.completed_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
          return acc;
        }, {} as typeof profilesMap);
      }

      return (data || []).map(c => ({
        ...c,
        checkpoint_type: c.checkpoint_type as CheckpointType,
        completed_by_profile: c.completed_by ? profilesMap[c.completed_by] : undefined,
      })) as SaleCheckpoint[];
    },
    enabled: !!saleId && !!user,
  });
}

export function useToggleSaleCheckpoint() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ saleId, checkpointType, complete, notes }: ToggleCheckpointData) => {
      // Get organization_id from sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('organization_id')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Check if checkpoint exists
      const { data: existing } = await supabase
        .from('sale_checkpoints')
        .select('id')
        .eq('sale_id', saleId)
        .eq('checkpoint_type', checkpointType)
        .maybeSingle();

      if (complete) {
        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('sale_checkpoints')
            .update({
              completed_at: new Date().toISOString(),
              completed_by: user?.id,
              notes,
            })
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          // Create new
          const { error } = await supabase
            .from('sale_checkpoints')
            .insert({
              sale_id: saleId,
              organization_id: sale.organization_id,
              checkpoint_type: checkpointType,
              completed_at: new Date().toISOString(),
              completed_by: user?.id,
              notes,
            });

          if (error) throw error;
        }

        // Update legacy fields on sales table for compatibility AND update status
        if (checkpointType === 'dispatched') {
          await supabase.from('sales').update({ 
            dispatched_at: new Date().toISOString(),
            status: 'dispatched'
          }).eq('id', saleId);
        } else if (checkpointType === 'delivered') {
          await supabase.from('sales').update({ 
            delivered_at: new Date().toISOString(),
            status: 'delivered'
          }).eq('id', saleId);
        } else if (checkpointType === 'payment_confirmed') {
          await supabase.from('sales').update({ 
            payment_confirmed_at: new Date().toISOString(),
            payment_confirmed_by: user?.id,
            status: 'payment_confirmed'
          }).eq('id', saleId);
        }
      } else {
        // Uncheck - just clear the completed_at
        if (existing) {
          const { error } = await supabase
            .from('sale_checkpoints')
            .update({
              completed_at: null,
              completed_by: null,
              notes: null,
            })
            .eq('id', existing.id);

          if (error) throw error;
        }

        // Clear legacy fields too
        if (checkpointType === 'dispatched') {
          await supabase.from('sales').update({ dispatched_at: null }).eq('id', saleId);
        } else if (checkpointType === 'delivered') {
          await supabase.from('sales').update({ delivered_at: null }).eq('id', saleId);
        } else if (checkpointType === 'payment_confirmed') {
          await supabase.from('sales').update({ payment_confirmed_at: null }).eq('id', saleId);
        }
      }

      return { saleId, checkpointType, complete };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['post-sale-sales'] });
    },
  });
}

export function getCheckpointStatus(checkpoints: SaleCheckpoint[], type: CheckpointType) {
  const checkpoint = checkpoints.find(c => c.checkpoint_type === type);
  return {
    isCompleted: !!checkpoint?.completed_at,
    completedAt: checkpoint?.completed_at,
    completedBy: checkpoint?.completed_by_profile
      ? `${checkpoint.completed_by_profile.first_name || ''} ${checkpoint.completed_by_profile.last_name || ''}`.trim()
      : null,
    notes: checkpoint?.notes,
  };
}
