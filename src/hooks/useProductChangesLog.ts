import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ProductChangeType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'cloned'
  | 'price_changed'
  | 'commission_changed'
  | 'stock_changed'
  | 'kit_changed'
  | 'general_edit';

export interface ProductChangeLog {
  id: string;
  product_id: string;
  organization_id: string;
  changed_by: string;
  changed_at: string;
  change_type: ProductChangeType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
  changed_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreateProductChangeLogData {
  product_id: string;
  change_type: ProductChangeType;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
}

export function useProductChangesLog(productId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['product-changes-log', productId],
    queryFn: async () => {
      if (!productId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('product_changes_log')
        .select('*')
        .eq('product_id', productId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set((data || []).map(log => log.changed_by))];
      let profiles: Record<string, { first_name: string; last_name: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        if (profilesData) {
          profiles = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      return (data || []).map(log => ({
        ...log,
        changed_by_profile: profiles[log.changed_by],
      })) as ProductChangeLog[];
    },
    enabled: !!productId && !!profile?.organization_id,
  });
}

export function useCreateProductChangeLog() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateProductChangeLogData) => {
      if (!profile?.organization_id || !user?.id) return null;

      const { data: log, error } = await supabase
        .from('product_changes_log')
        .insert({
          product_id: data.product_id,
          organization_id: profile.organization_id,
          changed_by: user.id,
          change_type: data.change_type,
          field_name: data.field_name || null,
          old_value: data.old_value || null,
          new_value: data.new_value || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return log;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-changes-log', variables.product_id] });
    },
  });
}

export function useCreateMultipleProductChangeLogs() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async (changes: CreateProductChangeLogData[]) => {
      if (!profile?.organization_id || !user?.id || changes.length === 0) return [];

      const logsToInsert = changes.map(data => ({
        product_id: data.product_id,
        organization_id: profile.organization_id!,
        changed_by: user.id,
        change_type: data.change_type,
        field_name: data.field_name || null,
        old_value: data.old_value || null,
        new_value: data.new_value || null,
        notes: data.notes || null,
      }));

      const { data: logs, error } = await supabase
        .from('product_changes_log')
        .insert(logsToInsert)
        .select();

      if (error) throw error;
      return logs;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['product-changes-log', variables[0].product_id] });
      }
    },
  });
}

export function getProductChangeTypeLabel(type: ProductChangeType): string {
  const labels: Record<ProductChangeType, string> = {
    created: 'Produto criado',
    updated: 'Produto atualizado',
    deleted: 'Produto excluído',
    cloned: 'Produto clonado',
    price_changed: 'Preço alterado',
    commission_changed: 'Comissão alterada',
    stock_changed: 'Estoque alterado',
    kit_changed: 'Kit alterado',
    general_edit: 'Edição geral',
  };
  return labels[type] || type;
}
