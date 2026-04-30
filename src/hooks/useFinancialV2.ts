import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Hooks do Razão Financeiro (módulo restrito ao Thiago / org SOVIDA → MORPHEWS).
 * Tudo passa pelo gate has_financial_access via RLS.
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
  legal_name: string | null;
  trade_name: string | null;
  responsible_name: string | null;
  phone: string | null;
  email: string | null;
  color: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | string;
  dre_group: string | null;
  code: string | null;
  parent_id: string | null;
  is_fixed: boolean | null;
  affects_dre: boolean | null;
  affects_cashflow: boolean | null;
  is_active: boolean;
  position: number | null;
  scope: string | null;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string | null;
  entity_id: string | null;
  responsible_user_id: string | null;
  is_active: boolean;
  position: number | null;
  scope: string | null;
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

export const ORG = '650b1667-e345-498e-9d41-b963faf824a7';

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

// ============================================================
// ENTIDADES FINANCEIRAS
// ============================================================
export interface EntityInput {
  name: string;
  entity_type: FinancialEntityType;
  document?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  responsible_name?: string | null;
  phone?: string | null;
  email?: string | null;
  color?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export function useFinancialEntities() {
  return useQuery({
    queryKey: ['financial-entities-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_entities')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as FinancialEntity[];
    },
  });
}

export function useCreateFinancialEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EntityInput) => {
      const { data, error } = await supabase
        .from('financial_entities')
        .insert({ organization_id: ORG, is_active: true, ...input } as any)
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

export function useUpdateFinancialEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<EntityInput>) => {
      const { data, error } = await supabase
        .from('financial_entities')
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-entities-v2'] });
      toast.success('Entidade atualizada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useToggleFinancialEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('financial_entities')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-entities-v2'] });
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ============================================================
// CATEGORIAS FINANCEIRAS
// ============================================================
export interface CategoryInput {
  name: string;
  type: string;
  dre_group?: string | null;
  code?: string | null;
  parent_id?: string | null;
  is_fixed?: boolean;
  affects_dre?: boolean;
  affects_cashflow?: boolean;
  position?: number;
  is_active?: boolean;
}

export function useFinancialCategoriesV2(activeOnly = false) {
  return useQuery({
    queryKey: ['financial-categories-v2', activeOnly],
    queryFn: async () => {
      let q = supabase
        .from('financial_categories')
        .select('id, name, type, dre_group, code, parent_id, is_fixed, affects_dre, affects_cashflow, is_active, position, scope')
        .order('position');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FinancialCategory[];
    },
  });
}

export function useCreateFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data, error } = await supabase
        .from('financial_categories')
        .insert({
          organization_id: ORG,
          is_active: true,
          scope: 'financial',
          is_financial_enabled: true,
          ...input,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-categories-v2'] });
      toast.success('Categoria criada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CategoryInput>) => {
      const { error } = await supabase
        .from('financial_categories')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-categories-v2'] });
      toast.success('Categoria atualizada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useToggleFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('financial_categories')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-categories-v2'] }),
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ============================================================
// CENTROS DE CUSTO
// ============================================================
export interface CostCenterInput {
  name: string;
  code?: string | null;
  description?: string | null;
  color?: string | null;
  entity_id?: string | null;
  responsible_user_id?: string | null;
  position?: number;
  is_active?: boolean;
}

export function useCostCentersV2(activeOnly = false) {
  return useQuery({
    queryKey: ['cost-centers-v2', activeOnly],
    queryFn: async () => {
      let q = supabase
        .from('cost_centers')
        .select('id, name, code, description, color, entity_id, responsible_user_id, is_active, position, scope')
        .order('position');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CostCenter[];
    },
  });
}

export function useCreateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CostCenterInput) => {
      const { data, error } = await supabase
        .from('cost_centers')
        .insert({
          organization_id: ORG,
          is_active: true,
          scope: 'financial',
          is_financial_enabled: true,
          ...input,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cost-centers-v2'] });
      toast.success('Centro de custo criado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CostCenterInput>) => {
      const { error } = await supabase
        .from('cost_centers')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cost-centers-v2'] });
      toast.success('Centro de custo atualizado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useToggleCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('cost_centers')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost-centers-v2'] }),
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ============================================================
// FORNECEDORES (escopo financial)
// ============================================================
export interface FinancialSupplier {
  id: string;
  name: string;
  trade_name: string | null;
  person_type: 'PF' | 'PJ' | null;
  cnpj: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: string | null;
  default_category_id: string | null;
  default_cost_center_id: string | null;
  entity_id: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface SupplierInput {
  name: string;
  trade_name?: string | null;
  person_type?: 'PF' | 'PJ' | null;
  cnpj?: string | null;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_type?: string | null;
  default_category_id?: string | null;
  default_cost_center_id?: string | null;
  entity_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export function useFinancialSuppliers(activeOnly = false) {
  return useQuery({
    queryKey: ['financial-suppliers-v2', activeOnly],
    queryFn: async () => {
      let q = supabase
        .from('suppliers')
        .select('id, name, trade_name, person_type, cnpj, cpf, email, phone, pix_key, pix_key_type, bank_name, bank_agency, bank_account, bank_account_type, default_category_id, default_cost_center_id, entity_id, notes, is_active')
        .eq('organization_id', ORG)
        .order('name');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FinancialSupplier[];
    },
  });
}

export function useCreateFinancialSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplierInput) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          organization_id: ORG,
          is_active: true,
          scope: 'financial',
          is_financial_enabled: true,
          ...input,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-suppliers-v2'] });
      toast.success('Fornecedor criado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateFinancialSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<SupplierInput>) => {
      const { error } = await supabase
        .from('suppliers')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-suppliers-v2'] });
      toast.success('Fornecedor atualizado');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useToggleFinancialSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-suppliers-v2'] }),
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ============================================================
// TRANSACTIONS (sem mudanças vs 1A.1)
// ============================================================
export interface TransactionFilters {
  status?: FinancialTxStatus[];
  entity_id?: string;
  direction?: FinancialDirection;
  from?: string;
  to?: string;
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
        } as any)
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

// ----------------- BANK ACCOUNTS (financial scope) -----------------
export interface FinancialBankAccount {
  id: string;
  organization_id: string;
  entity_id: string | null;
  name: string;
  bank_name: string | null;
  bank_code: string | null;
  agency: string | null;
  account_number: string | null;
  account_type: string;
  is_active: boolean;
  is_default: boolean;
  is_financial_enabled: boolean;
  scope: string;
  color: string | null;
  current_balance_cents: number | null;
  initial_balance_cents: number | null;
  balance_date: string | null;
  notes: string | null;
}

export interface BankAccountInput {
  name: string;
  entity_id?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  agency?: string | null;
  account_number?: string | null;
  account_type?: string;
  initial_balance_cents?: number;
  balance_date?: string | null;
  color?: string | null;
  notes?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

export function useFinancialBankAccounts(includeInactive = false) {
  return useQuery({
    queryKey: ['financial-bank-accounts-v2', includeInactive],
    queryFn: async () => {
      let q = supabase
        .from('bank_accounts')
        .select('*')
        .eq('organization_id', ORG)
        .eq('is_financial_enabled', true)
        .in('scope', ['financial', 'general']);
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as FinancialBankAccount[];
    },
  });
}

export function useCreateFinancialBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BankAccountInput) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          organization_id: ORG,
          name: input.name,
          entity_id: input.entity_id ?? null,
          bank_name: input.bank_name ?? null,
          bank_code: input.bank_code ?? null,
          agency: input.agency ?? null,
          account_number: input.account_number ?? null,
          account_type: input.account_type ?? 'corrente',
          initial_balance_cents: input.initial_balance_cents ?? 0,
          current_balance_cents: input.initial_balance_cents ?? 0,
          balance_date: input.balance_date ?? null,
          color: input.color ?? null,
          notes: input.notes ?? null,
          is_default: input.is_default ?? false,
          is_active: true,
          scope: 'financial',
          is_financial_enabled: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-bank-accounts-v2'] });
      toast.success('Conta bancária criada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateFinancialBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<BankAccountInput>) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-bank-accounts-v2'] });
      toast.success('Conta atualizada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useToggleFinancialBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial-bank-accounts-v2'] }),
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

export function useSetDefaultBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // unset all then set selected
      const { error: e1 } = await supabase
        .from('bank_accounts')
        .update({ is_default: false } as any)
        .eq('organization_id', ORG)
        .eq('is_default', true);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('bank_accounts')
        .update({ is_default: true } as any)
        .eq('id', id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-bank-accounts-v2'] });
      toast.success('Conta padrão atualizada');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });
}

// ----------------- ORG SETTINGS -----------------
export function useFinancialOrgSettings() {
  return useQuery({
    queryKey: ['financial-org-settings-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_organization_settings')
        .select('*')
        .eq('organization_id', ORG)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
