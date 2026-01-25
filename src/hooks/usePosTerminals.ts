import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

// Types from database
export type PosGatewayType = Database['public']['Enums']['pos_gateway_type'];
export type PosMatchStatus = Database['public']['Enums']['pos_match_status'];

export interface PosTerminal {
  id: string;
  organization_id: string;
  gateway_type: PosGatewayType;
  terminal_id: string;
  serial_number: string | null;
  logical_number: string | null;
  name: string;
  payment_method_id: string | null;
  assignment_type: string | null;
  is_active: boolean;
  extra_config: Record<string, unknown> | null;
  webhook_secret: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  payment_method?: { id: string; name: string } | null;
  // Current assignment (from pos_terminal_assignments)
  current_assignment?: {
    user_id: string;
    profiles: { first_name: string; last_name: string } | null;
  } | null;
}

export interface PosTerminalAssignment {
  id: string;
  pos_terminal_id: string;
  user_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  assigned_by: string | null;
  notes: string | null;
  organization_id: string;
}

export interface PosTransaction {
  id: string;
  organization_id: string;
  pos_terminal_id: string | null;
  gateway_type: PosGatewayType;
  nsu: string | null;
  authorization_code: string | null;
  amount_cents: number;
  net_amount_cents: number | null;
  fee_cents: number | null;
  card_brand: string | null;
  card_last_digits: string | null;
  installments: number | null;
  transaction_type: string;
  gateway_transaction_id: string | null;
  gateway_timestamp: string | null;
  raw_payload: Record<string, unknown> | null;
  match_status: PosMatchStatus;
  sale_id: string | null;
  sale_installment_id: string | null;
  matched_user_id: string | null;
  matched_at: string | null;
  matched_by: string | null;
  created_at: string;
  updated_at: string;
}

// Gateway labels for UI
export const POS_GATEWAY_LABELS: Record<PosGatewayType, string> = {
  getnet: 'Getnet',
  pagarme: 'Pagar.me',
  banrisul: 'Banrisul',
  vero: 'Vero',
  banricompras: 'Banricompras',
  stone: 'Stone',
};

// Assignment type labels
export const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  user: 'Usuário/Motoboy',
  counter: 'Balcão/Caixa',
  pickup: 'Retirada',
};

// ==================== TERMINALS ====================

export function usePosTerminals() {
  return useQuery({
    queryKey: ['pos-terminals'],
    queryFn: async () => {
      // Fetch terminals
      const { data: terminals, error } = await supabase
        .from('pos_terminals')
        .select(`
          *,
          payment_method:payment_methods(id, name)
        `)
        .order('name');

      if (error) throw error;

      // Fetch current assignments (unassigned_at is null)
      const terminalIds = terminals?.map(t => t.id) || [];
      const { data: assignments } = await supabase
        .from('pos_terminal_assignments')
        .select(`
          pos_terminal_id,
          user_id,
          profiles:profiles!pos_terminal_assignments_user_id_fkey(first_name, last_name)
        `)
        .in('pos_terminal_id', terminalIds)
        .is('unassigned_at', null);

      // Map assignments to terminals
      const assignmentMap = new Map(
        (assignments || []).map(a => [a.pos_terminal_id, a])
      );

      return (terminals || []).map(t => ({
        ...t,
        current_assignment: assignmentMap.get(t.id) || null,
      })) as PosTerminal[];
    },
  });
}

export function useActivePosTerminals() {
  return useQuery({
    queryKey: ['pos-terminals', 'active'],
    queryFn: async () => {
      const { data: terminals, error } = await supabase
        .from('pos_terminals')
        .select(`
          *,
          payment_method:payment_methods(id, name)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const terminalIds = terminals?.map(t => t.id) || [];
      const { data: assignments } = await supabase
        .from('pos_terminal_assignments')
        .select(`
          pos_terminal_id,
          user_id,
          profiles:profiles!pos_terminal_assignments_user_id_fkey(first_name, last_name)
        `)
        .in('pos_terminal_id', terminalIds)
        .is('unassigned_at', null);

      const assignmentMap = new Map(
        (assignments || []).map(a => [a.pos_terminal_id, a])
      );

      return (terminals || []).map(t => ({
        ...t,
        current_assignment: assignmentMap.get(t.id) || null,
      })) as PosTerminal[];
    },
  });
}

export interface CreatePosTerminalInput {
  gateway_type: PosGatewayType;
  terminal_id: string;
  serial_number?: string;
  logical_number?: string;
  name: string;
  payment_method_id?: string;
  cost_center_id?: string;
  assignment_type: string;
  assigned_user_id?: string;
  is_active?: boolean;
}

export function useCreatePosTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePosTerminalInput) => {
      // Get org id from current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('pos_terminals')
        .insert({
          organization_id: profile.organization_id,
          gateway_type: input.gateway_type,
          terminal_id: input.terminal_id || '',
          serial_number: input.serial_number || null,
          logical_number: input.logical_number || null,
          name: input.name,
          payment_method_id: input.payment_method_id || null,
          cost_center_id: input.cost_center_id || null,
          assignment_type: input.assignment_type,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      // If assigned to user, create assignment record
      if (input.assignment_type === 'user' && input.assigned_user_id) {
        await supabase.from('pos_terminal_assignments').insert({
          pos_terminal_id: data.id,
          user_id: input.assigned_user_id,
          organization_id: profile.organization_id,
          assigned_by: user.id,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals'] });
      toast.success('Máquina POS cadastrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar máquina', { description: error.message });
    },
  });
}

export interface UpdatePosTerminalInput extends Partial<CreatePosTerminalInput> {
  id: string;
}

export function useUpdatePosTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePosTerminalInput) => {
      const { id, assigned_user_id, ...updateData } = input;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Get current assignment
      const { data: currentAssignment } = await supabase
        .from('pos_terminal_assignments')
        .select('id, user_id, organization_id')
        .eq('pos_terminal_id', id)
        .is('unassigned_at', null)
        .maybeSingle();

      // Prepare update payload
      const updatePayload: Record<string, unknown> = {
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('pos_terminals')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Handle assignment changes
      const oldUserId = currentAssignment?.user_id;
      const newUserId = updateData.assignment_type === 'user' ? assigned_user_id : null;

      if (oldUserId !== newUserId) {
        // Close old assignment if exists
        if (currentAssignment) {
          await supabase
            .from('pos_terminal_assignments')
            .update({ unassigned_at: new Date().toISOString() })
            .eq('id', currentAssignment.id);
        }

        // Create new assignment if user type
        if (newUserId && currentAssignment?.organization_id) {
          await supabase.from('pos_terminal_assignments').insert({
            pos_terminal_id: id,
            user_id: newUserId,
            organization_id: currentAssignment.organization_id,
            assigned_by: user.id,
          });
        } else if (newUserId) {
          // Get org from terminal if no previous assignment
          const { data: terminal } = await supabase
            .from('pos_terminals')
            .select('organization_id')
            .eq('id', id)
            .single();

          if (terminal) {
            await supabase.from('pos_terminal_assignments').insert({
              pos_terminal_id: id,
              user_id: newUserId,
              organization_id: terminal.organization_id,
              assigned_by: user.id,
            });
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals'] });
      toast.success('Máquina POS atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar máquina', { description: error.message });
    },
  });
}

export function useTogglePosTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('pos_terminals')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals'] });
      toast.success(is_active ? 'Máquina ativada!' : 'Máquina desativada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao alterar status', { description: error.message });
    },
  });
}

export function useDeletePosTerminal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pos_terminals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-terminals'] });
      toast.success('Máquina removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover máquina', { description: error.message });
    },
  });
}

// ==================== TRANSACTIONS ====================

export interface PosTransactionFilters {
  match_status?: PosMatchStatus;
  pos_terminal_id?: string;
  gateway_type?: PosGatewayType;
  from_date?: string;
  to_date?: string;
}

export function usePosTransactions(filters?: PosTransactionFilters) {
  return useQuery({
    queryKey: ['pos-transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('pos_transactions')
        .select(`
          *,
          terminal:pos_terminals(id, name, gateway_type),
          matched_sale:sales(id, lead_id, total_amount_cents)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.match_status) {
        query = query.eq('match_status', filters.match_status);
      }
      if (filters?.pos_terminal_id) {
        query = query.eq('pos_terminal_id', filters.pos_terminal_id);
      }
      if (filters?.gateway_type) {
        query = query.eq('gateway_type', filters.gateway_type);
      }
      if (filters?.from_date) {
        query = query.gte('created_at', filters.from_date);
      }
      if (filters?.to_date) {
        query = query.lte('created_at', filters.to_date);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useManualMatchTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      saleId,
      installmentId,
    }: {
      transactionId: string;
      saleId: string;
      installmentId?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error: txError } = await supabase
        .from('pos_transactions')
        .update({
          match_status: 'manual' as PosMatchStatus,
          sale_id: saleId,
          sale_installment_id: installmentId || null,
          matched_at: new Date().toISOString(),
          matched_by: user?.id || null,
        })
        .eq('id', transactionId);

      if (txError) throw txError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Transação vinculada manualmente!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao vincular transação', { description: error.message });
    },
  });
}
