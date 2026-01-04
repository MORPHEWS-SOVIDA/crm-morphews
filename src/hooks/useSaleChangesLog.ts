import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';

export type ChangeType = 
  | 'item_added'
  | 'item_removed'
  | 'item_quantity_changed'
  | 'item_price_changed'
  | 'discount_changed'
  | 'delivery_changed'
  | 'payment_changed'
  | 'status_changed'
  | 'general_edit';

export interface SaleChangeLog {
  id: string;
  sale_id: string;
  organization_id: string;
  changed_by: string;
  changed_at: string;
  change_type: ChangeType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  item_id: string | null;
  product_name: string | null;
  notes: string | null;
  created_at: string;
  // Joined data
  changed_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreateChangeLogData {
  sale_id: string;
  change_type: ChangeType;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  item_id?: string;
  product_name?: string;
  notes?: string;
}

function useOrganizationId() {
  const { profile } = useAuth();
  const { data: tenantId } = useCurrentTenantId();
  return profile?.organization_id ?? tenantId ?? null;
}

export function useSaleChangesLog(saleId: string | undefined) {
  const organizationId = useOrganizationId();

  return useQuery({
    queryKey: ['sale-changes-log', saleId],
    queryFn: async () => {
      if (!saleId || !organizationId) return [];

      const { data, error } = await supabase
        .from('sale_changes_log')
        .select('*')
        .eq('sale_id', saleId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for changed_by users
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
      })) as SaleChangeLog[];
    },
    enabled: !!saleId && !!organizationId,
  });
}

export function useCreateSaleChangeLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async (data: CreateChangeLogData) => {
      if (!organizationId || !user?.id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: log, error } = await supabase
        .from('sale_changes_log')
        .insert({
          sale_id: data.sale_id,
          organization_id: organizationId,
          changed_by: user.id,
          change_type: data.change_type,
          field_name: data.field_name || null,
          old_value: data.old_value || null,
          new_value: data.new_value || null,
          item_id: data.item_id || null,
          product_name: data.product_name || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return log;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sale-changes-log', variables.sale_id] });
    },
  });
}

export function useCreateMultipleSaleChangeLogs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const organizationId = useOrganizationId();

  return useMutation({
    mutationFn: async (changes: CreateChangeLogData[]) => {
      if (!organizationId || !user?.id) {
        throw new Error('Usuário não autenticado');
      }

      if (changes.length === 0) return [];

      const logsToInsert = changes.map(data => ({
        sale_id: data.sale_id,
        organization_id: organizationId,
        changed_by: user.id,
        change_type: data.change_type,
        field_name: data.field_name || null,
        old_value: data.old_value || null,
        new_value: data.new_value || null,
        item_id: data.item_id || null,
        product_name: data.product_name || null,
        notes: data.notes || null,
      }));

      const { data: logs, error } = await supabase
        .from('sale_changes_log')
        .insert(logsToInsert)
        .select();

      if (error) throw error;
      return logs;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['sale-changes-log', variables[0].sale_id] });
      }
    },
  });
}

export function getChangeTypeLabel(type: ChangeType): string {
  const labels: Record<ChangeType, string> = {
    item_added: 'Item adicionado',
    item_removed: 'Item removido',
    item_quantity_changed: 'Quantidade alterada',
    item_price_changed: 'Preço alterado',
    discount_changed: 'Desconto alterado',
    delivery_changed: 'Entrega alterada',
    payment_changed: 'Pagamento alterado',
    status_changed: 'Status alterado',
    general_edit: 'Edição geral',
  };
  return labels[type] || type;
}
