import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { DemandBoard, DemandColumn } from '@/types/demand';

// ============================================================================
// BOARDS
// ============================================================================

export function useDemandBoards() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand-boards', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('demand_boards')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as DemandBoard[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useDemandBoard(boardId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand-board', boardId],
    queryFn: async () => {
      if (!boardId || !profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('demand_boards')
        .select('*')
        .eq('id', boardId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (error) throw error;
      return data as DemandBoard;
    },
    enabled: !!boardId && !!profile?.organization_id,
  });
}

export function useCreateDemandBoard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string }) => {
      if (!profile?.organization_id || !profile?.user_id) {
        throw new Error('Usuário não autenticado');
      }

      // Get max position
      const { data: existing } = await supabase
        .from('demand_boards')
        .select('position')
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: false })
        .limit(1);

      const position = existing?.[0]?.position ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('demand_boards')
        .insert({
          organization_id: profile.organization_id,
          created_by: profile.user_id,
          name: input.name,
          description: input.description || null,
          color: input.color || null,
          position,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create default columns for the new board
      const defaultColumns = [
        { name: 'A Fazer', color: '#6b7280', is_final: false, position: 0 },
        { name: 'Em Andamento', color: '#f59e0b', is_final: false, position: 1 },
        { name: 'Em Revisão', color: '#8b5cf6', is_final: false, position: 2 },
        { name: 'Concluído', color: '#22c55e', is_final: true, position: 3 },
      ];

      await supabase.from('demand_columns').insert(
        defaultColumns.map(col => ({
          organization_id: profile.organization_id,
          board_id: data.id,
          ...col,
        }))
      );

      return data as DemandBoard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand-boards'] });
      toast({ title: 'Quadro criado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar quadro', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateDemandBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; description?: string | null; color?: string | null; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('demand_boards')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DemandBoard;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demand-boards'] });
      queryClient.invalidateQueries({ queryKey: ['demand-board', data.id] });
      toast({ title: 'Quadro atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar quadro', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDemandBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('demand_boards')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demand-boards'] });
      toast({ title: 'Quadro excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir quadro', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================================
// COLUMNS
// ============================================================================

export function useDemandColumns(boardId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['demand-columns', boardId],
    queryFn: async () => {
      if (!boardId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('demand_columns')
        .select('*')
        .eq('board_id', boardId)
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as DemandColumn[];
    },
    enabled: !!boardId && !!profile?.organization_id,
  });
}

export function useCreateDemandColumn() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { board_id: string; name: string; color?: string; is_final?: boolean }) => {
      if (!profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      // Get max position
      const { data: existing } = await supabase
        .from('demand_columns')
        .select('position')
        .eq('board_id', input.board_id)
        .order('position', { ascending: false })
        .limit(1);

      const position = existing?.[0]?.position ? existing[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('demand_columns')
        .insert({
          organization_id: profile.organization_id,
          board_id: input.board_id,
          name: input.name,
          color: input.color || null,
          is_final: input.is_final || false,
          position,
        })
        .select()
        .single();

      if (error) throw error;
      return data as DemandColumn;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demand-columns', data.board_id] });
      toast({ title: 'Coluna criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar coluna', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateDemandColumn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; color?: string | null; is_final?: boolean; position?: number }) => {
      const { data, error } = await supabase
        .from('demand_columns')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DemandColumn;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['demand-columns', data.board_id] });
      toast({ title: 'Coluna atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar coluna', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDemandColumn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, boardId }: { id: string; boardId: string }) => {
      const { error } = await supabase
        .from('demand_columns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return boardId;
    },
    onSuccess: (boardId) => {
      queryClient.invalidateQueries({ queryKey: ['demand-columns', boardId] });
      toast({ title: 'Coluna excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir coluna', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReorderDemandColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boardId, columns }: { boardId: string; columns: { id: string; position: number }[] }) => {
      const updates = columns.map(col =>
        supabase
          .from('demand_columns')
          .update({ position: col.position })
          .eq('id', col.id)
      );

      await Promise.all(updates);
      return boardId;
    },
    onSuccess: (boardId) => {
      queryClient.invalidateQueries({ queryKey: ['demand-columns', boardId] });
    },
  });
}
