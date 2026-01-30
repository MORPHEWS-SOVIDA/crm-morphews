import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type CheckpointType = 'printed' | 'pending_expedition' | 'dispatched' | 'delivered' | 'payment_confirmed';

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
  printed: 'Impresso',
  pending_expedition: 'Pedido Separado',
  dispatched: 'Despachado',
  delivered: 'Entregue',
  payment_confirmed: 'Pagamento Confirmado',
};

export const checkpointEmojis: Record<CheckpointType | 'draft' | 'returned' | 'cancelled' | 'closed' | 'finalized', string> = {
  draft: '👀',
  printed: '🖨️',
  pending_expedition: '📦',
  dispatched: '🚚',
  returned: '⚠️',
  delivered: '✅',
  payment_confirmed: '💰',
  cancelled: '😭💔',
  closed: '📋',
  finalized: '🏆',
};

export const checkpointOrder: CheckpointType[] = ['printed', 'pending_expedition', 'dispatched', 'delivered', 'payment_confirmed'];

// Labels for closing status steps (not part of checkpoints, come from sales table)
export const closingStepLabels = {
  closed: 'Baixado (Financeiro)',
  finalized: 'Finalizado (Thiago)',
};

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
        .select('organization_id, status, expedition_validated_at, dispatched_at, delivered_at')
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

      let checkpointId = existing?.id;

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
          const { data: newCheckpoint, error } = await supabase
            .from('sale_checkpoints')
            .insert({
              sale_id: saleId,
              organization_id: sale.organization_id,
              checkpoint_type: checkpointType,
              completed_at: new Date().toISOString(),
              completed_by: user?.id,
              notes,
            })
            .select('id')
            .single();

          if (error) throw error;
          checkpointId = newCheckpoint.id;
        }

        // Insert history record
        await supabase.from('sale_checkpoint_history').insert({
          checkpoint_id: checkpointId,
          sale_id: saleId,
          organization_id: sale.organization_id,
          checkpoint_type: checkpointType,
          action: 'completed',
          changed_by: user?.id,
          notes,
        });

        // Update legacy fields on sales table for compatibility AND update status
        if (checkpointType === 'printed') {
          const { error } = await supabase.from('sales').update({ 
            printed_at: new Date().toISOString(),
            printed_by: user?.id,
          }).eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'pending_expedition') {
          const { error } = await supabase.from('sales').update({ 
            expedition_validated_at: new Date().toISOString(),
            expedition_validated_by: user?.id,
            status: 'pending_expedition'
          }).eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'dispatched') {
          const { error } = await supabase.from('sales').update({ 
            dispatched_at: new Date().toISOString(),
            status: 'dispatched'
          }).eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'delivered') {
          const { error } = await supabase.from('sales').update({ 
            delivered_at: new Date().toISOString(),
            status: 'delivered'
          }).eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'payment_confirmed') {
          const { error } = await supabase.from('sales').update({ 
            payment_confirmed_at: new Date().toISOString(),
            payment_confirmed_by: user?.id,
            status: 'payment_confirmed'
          }).eq('id', saleId);
          if (error) throw error;
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

          // Insert history record for uncomplete
          await supabase.from('sale_checkpoint_history').insert({
            checkpoint_id: existing.id,
            sale_id: saleId,
            organization_id: sale.organization_id,
            checkpoint_type: checkpointType,
            action: 'uncompleted',
            changed_by: user?.id,
            notes,
          });
        }

        // Clear legacy fields too
        if (checkpointType === 'printed') {
          const { error } = await supabase
            .from('sales')
            .update({ printed_at: null, printed_by: null })
            .eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'pending_expedition') {
          // IMPORTANT: ao desmarcar a validação de expedição, a venda precisa voltar a ser editável
          // (caso contrário o status fica preso em pending_expedition e bloqueia edição).
          const { error } = await supabase
            .from('sales')
            .update({
              expedition_validated_at: null,
              expedition_validated_by: null,
              status: 'draft',
            })
            .eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'dispatched') {
          const nextStatus = sale.expedition_validated_at ? 'pending_expedition' : 'draft';
          const { error } = await supabase
            .from('sales')
            .update({ dispatched_at: null, status: nextStatus })
            .eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'delivered') {
          const nextStatus = sale.dispatched_at
            ? 'dispatched'
            : sale.expedition_validated_at
              ? 'pending_expedition'
              : 'draft';
          const { error } = await supabase
            .from('sales')
            .update({ delivered_at: null, status: nextStatus })
            .eq('id', saleId);
          if (error) throw error;
        } else if (checkpointType === 'payment_confirmed') {
          const nextStatus = sale.delivered_at
            ? 'delivered'
            : sale.dispatched_at
              ? 'dispatched'
              : sale.expedition_validated_at
                ? 'pending_expedition'
                : 'draft';

          const { error } = await supabase
            .from('sales')
            .update({ payment_confirmed_at: null, payment_confirmed_by: null, status: nextStatus })
            .eq('id', saleId);
          if (error) throw error;
        }
      }

      return { saleId, checkpointType, complete };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale-checkpoint-history', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['post-sale-sales'] });
    },
  });
}

function deriveStatusFromCompletedCheckpoints(completed: Set<CheckpointType>, currentStatus?: string | null) {
  if (currentStatus === 'cancelled' || currentStatus === 'returned') return currentStatus;
  if (completed.has('delivered')) return 'delivered';
  if (completed.has('dispatched')) return 'dispatched';
  if (completed.has('pending_expedition')) return 'pending_expedition';
  // printed alone doesn't define a special status
  return 'draft';
}

/**
 * Reconcile legacy columns in `sales` (status + timestamps) based on `sale_checkpoints`.
 * This fixes old/inconsistent sales where the UI shows checkpoints unchecked but `sales.status`
 * is still stuck (e.g. delivered).
 */
export function useSyncSaleLegacyFromCheckpoints() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (saleId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('id, status')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      const { data: checkpoints, error: checkpointsError } = await supabase
        .from('sale_checkpoints')
        .select('checkpoint_type, completed_at, completed_by')
        .eq('sale_id', saleId);

      if (checkpointsError) throw checkpointsError;

      const completedSet = new Set<CheckpointType>();
      const map = new Map<CheckpointType, { completed_at: string | null; completed_by: string | null }>();

      (checkpoints || []).forEach((c: any) => {
        const type = c.checkpoint_type as CheckpointType;
        map.set(type, { completed_at: c.completed_at, completed_by: c.completed_by });
        if (c.completed_at) completedSet.add(type);
      });

      const completedAt = (type: CheckpointType) => map.get(type)?.completed_at ?? null;
      const completedBy = (type: CheckpointType) => (map.get(type)?.completed_at ? (map.get(type)?.completed_by ?? null) : null);

      const nextStatus = deriveStatusFromCompletedCheckpoints(completedSet, sale.status);

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          // Legacy compatibility fields
          printed_at: completedAt('printed'),
          printed_by: completedBy('printed'),
          expedition_validated_at: completedAt('pending_expedition'),
          expedition_validated_by: completedBy('pending_expedition'),
          dispatched_at: completedAt('dispatched'),
          delivered_at: completedAt('delivered'),
          payment_confirmed_at: completedAt('payment_confirmed'),
          payment_confirmed_by: completedBy('payment_confirmed'),

          // Status derived from checkpoints
          status: nextStatus,
        })
        .eq('id', saleId);

      if (updateError) throw updateError;

      return saleId;
    },
    onSuccess: (saleId) => {
      queryClient.invalidateQueries({ queryKey: ['sale-checkpoints', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale-checkpoint-history', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['post-sale-sales'] });
    },
  });
}

// New hook to fetch checkpoint history
export interface CheckpointHistoryEntry {
  id: string;
  checkpoint_id: string | null;
  sale_id: string;
  organization_id: string;
  checkpoint_type: CheckpointType;
  action: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  changed_by_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

export function useSaleCheckpointHistory(saleId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sale-checkpoint-history', saleId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await supabase
        .from('sale_checkpoint_history')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for changed_by users
      const userIds = [...new Set((data || []).map(c => c.changed_by).filter(Boolean))] as string[];
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
        changed_by_profile: c.changed_by ? profilesMap[c.changed_by] : undefined,
      })) as CheckpointHistoryEntry[];
    },
    enabled: !!saleId && !!user,
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
