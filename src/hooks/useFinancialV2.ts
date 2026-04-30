import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Hooks da Mini-Fase 1B do Razão Financeiro (módulo restrito ao Thiago).
 * Tudo passa pelo gate has_financial_access via RLS — não precisamos
 * filtrar manualmente: o banco devolve só o que for permitido.
 */

export type FinancialEntityType =
  | 'cnpj' | 'cpf' | 'projeto' | 'imovel' | 'familia'
  | 'carteira' | 'centro_operacional' | 'outro';

export type FinancialTxStatus =
  | 'previsto' | 'pendente_aprovacao' | 'aprovado' | 'realizado'
  | 'conciliado' | 'cancelado' | 'estornado' | 'vencido' | 'pago_parcial';

export type FinancialTxType =
  | 'receita' | 'despesa' | 'transferencia_entrada' | 'transferencia_saida'
  | 'taxa' | 'imposto' | 'estorno' | 'ajuste';

export type FinancialDirection = 'inflow' | 'outflow';

export interface FinancialEntity {
  id: string;
  organization_id: string;
  name: string;
  entity_type: FinancialEntityType;
  document: string | null;
  color: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  dre_group: string | null;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string | null;
}

export interface FinancialTransaction {
  id: string;
  organization_id: string;
  entity_id: string | null;
  category_id: string | null;
  cost_center_id: string | null;
  description: string | null;
  type: FinancialTxType;
  direction: FinancialDirection;
  status: FinancialTxStatus;
  expected_amount_cents: number | null;
  actual_amount_cents: number | null;
  difference_amount_cents: number | null;
  competence_date: string | null;
  due_date: string | null;
  expected_payment_date: string | null;
  paid_at: string | null;
  canceled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const ORG = '650b1667-e345-498e-9d41-b963faf824a7';

// ----------------- ACCESS GATE -----------------
export function useFinancialAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['financial-access', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc('has_financial_access', {
        _user_id: user.id, _org_id: ORG,
      });
      if (error) return false;
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// ----------------- ENTITIES -----------------
export function useFinancialEntities() {
  return useQuery({
    queryKey: ['financial-entities-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_entities')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as FinancialEntity[];
    },
  });
}

export function useCreateFinancialEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; entity_type: FinancialEntityType; document?: string; color?: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('financial_entities')
        .insert({ organization_id: ORG, is_active: true, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-entities-v2'] });
      toast.success('Entidade criada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ----------------- CATEGORIES & COST CENTERS -----------------
export function useFinancialCategoriesV2() {
  return useQuery({
    queryKey: ['financial-categories-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_categories')
        .select('id, name, type, dre_group')
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return (data ?? []) as FinancialCategory[];
    },
  });
}

export function useCostCentersV2() {
  return useQuery({
    queryKey: ['cost-centers-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_centers')
        .select('id, name, code')
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      return (data ?? []) as CostCenter[];
    },
  });
}

// ----------------- TRANSACTIONS -----------------
export interface TransactionFilters {
  status?: FinancialTxStatus[];
  entity_id?: string;
  direction?: FinancialDirection;
  from?: string; // due_date >=
  to?: string;   // due_date <=
}

export function useFinancialTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['financial-transactions-v2', filters],
    queryFn: async () => {
      let q = supabase.from('financial_transactions').select('*').order('due_date', { ascending: false, nullsFirst: false });
      if (filters.status?.length) q = q.in('status', filters.status);
      if (filters.entity_id) q = q.eq('entity_id', filters.entity_id);
      if (filters.direction) q = q.eq('direction', filters.direction);
      if (filters.from) q = q.gte('due_date', filters.from);
      if (filters.to) q = q.lte('due_date', filters.to);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data ?? []) as FinancialTransaction[];
    },
  });
}

export interface CreateTxInput {
  entity_id: string;
  category_id?: string | null;
  cost_center_id?: string | null;
  description: string;
  type: FinancialTxType;
  direction: FinancialDirection;
  expected_amount_cents: number;
  competence_date?: string;
  due_date?: string;
  expected_payment_date?: string;
  notes?: string;
}

export function useCreateFinancialTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTxInput) => {
      const { data, error } = await supabase
        .from('financial_transactions')
        .insert({
          organization_id: ORG,
          status: 'previsto',
          source: 'manual',
          ...input,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-transactions-v2'] });
      toast.success('Lançamento criado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      transaction_id: string;
      bank_account_id: string;
      actual_amount_cents: number;
      paid_at?: string;
      difference_reason?: string;
      difference_notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('fn_register_payment', {
        _transaction_id: input.transaction_id,
        _bank_account_id: input.bank_account_id,
        _actual_amount_cents: input.actual_amount_cents,
        _paid_at: input.paid_at ?? new Date().toISOString(),
        _difference_reason: input.difference_reason ?? null,
        _difference_notes: input.difference_notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-transactions-v2'] });
      qc.invalidateQueries({ queryKey: ['financial-audit-v2'] });
      toast.success('Pagamento registrado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useCancelTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { transaction_id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('fn_cancel_transaction', {
        _transaction_id: input.transaction_id,
        _reason: input.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-transactions-v2'] });
      qc.invalidateQueries({ queryKey: ['financial-audit-v2'] });
      toast.success('Lançamento cancelado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ----------------- AUDIT -----------------
export function useFinancialAuditLogs(limit = 100) {
  return useQuery({
    queryKey: ['financial-audit-v2', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}
