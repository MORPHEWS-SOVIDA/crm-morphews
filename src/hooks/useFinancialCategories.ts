import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface FinancialCategory {
  id: string;
  organization_id: string;
  name: string;
  type: 'income' | 'expense';
  parent_id: string | null;
  dre_group: string | null;
  is_active: boolean;
  is_system: boolean;
  position: number;
  created_at: string;
}

export function useFinancialCategories(type?: 'income' | 'expense') {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['financial-categories', type],
    queryFn: async () => {
      let query = supabase
        .from('financial_categories')
        .select('*')
        .eq('is_active', true)
        .order('position')
        .order('name');

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialCategory[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateFinancialCategory() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<FinancialCategory>) => {
      const { data: result, error } = await supabase
        .from('financial_categories')
        .insert({
          organization_id: profile!.organization_id,
          name: data.name!,
          type: data.type!,
          parent_id: data.parent_id,
          dre_group: data.dre_group,
          position: data.position || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria criada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar: ' + error.message);
    },
  });
}

export function useUpdateFinancialCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<FinancialCategory> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('financial_categories')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria atualizada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useDeleteFinancialCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_categories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      toast.success('Categoria desativada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });
}

// Initialize default categories for an organization
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Fornecedores', dre_group: 'custo_mercadoria' },
  { name: 'Aluguel', dre_group: 'despesa_operacional' },
  { name: 'Energia/Água', dre_group: 'despesa_operacional' },
  { name: 'Internet/Telefone', dre_group: 'despesa_operacional' },
  { name: 'Salários', dre_group: 'despesa_pessoal' },
  { name: 'Impostos', dre_group: 'impostos' },
  { name: 'Marketing', dre_group: 'despesa_comercial' },
  { name: 'Frete', dre_group: 'custo_mercadoria' },
  { name: 'Material de Escritório', dre_group: 'despesa_operacional' },
  { name: 'Outros', dre_group: 'outras_despesas' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Vendas de Produtos', dre_group: 'receita_operacional' },
  { name: 'Vendas de Serviços', dre_group: 'receita_operacional' },
  { name: 'Recebimento de Clientes', dre_group: 'receita_operacional' },
  { name: 'Rendimentos Financeiros', dre_group: 'receita_financeira' },
  { name: 'Outras Receitas', dre_group: 'outras_receitas' },
];
