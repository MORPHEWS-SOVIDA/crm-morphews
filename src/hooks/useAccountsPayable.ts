import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns';

export interface AccountPayable {
  id: string;
  organization_id: string;
  purchase_invoice_id: string | null;
  supplier_id: string | null;
  document_number: string | null;
  description: string;
  amount_cents: number;
  paid_amount_cents: number;
  discount_cents: number;
  interest_cents: number;
  fine_cents: number;
  issue_date: string;
  due_date: string;
  paid_at: string | null;
  installment_number: number;
  total_installments: number;
  payment_method: string | null;
  barcode: string | null;
  pix_code: string | null;
  category_id: string | null;
  cost_center_id: string | null;
  bank_account_id: string | null;
  status: string;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  notes: string | null;
  created_at: string;
  // Joins
  supplier?: {
    id: string;
    name: string;
    cnpj: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
  } | null;
  cost_center?: {
    id: string;
    name: string;
  } | null;
  bank_account?: {
    id: string;
    name: string;
  } | null;
}

export interface PayableFilters {
  status?: string;
  supplierId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PayableSummary {
  totalPending: number;
  totalApprovalPending: number;
  totalPaid: number;
  totalOverdue: number;
  countPending: number;
  countPaid: number;
  countOverdue: number;
  todayDue: number;
  weekDue: number;
  monthDue: number;
}

export function useAccountsPayable(filters: PayableFilters = {}) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['accounts-payable', filters],
    queryFn: async () => {
      let query = supabase
        .from('accounts_payable')
        .select(`
          *,
          supplier:suppliers(id, name, cnpj),
          category:financial_categories(id, name),
          cost_center:payment_cost_centers(id, name),
          bank_account:bank_accounts(id, name)
        `)
        .order('due_date', { ascending: true });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.supplierId) {
        query = query.eq('supplier_id', filters.supplierId);
      }

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.startDate) {
        query = query.gte('due_date', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('due_date', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply search filter client-side
      let result = data as AccountPayable[];
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(item =>
          item.description?.toLowerCase().includes(searchLower) ||
          item.document_number?.toLowerCase().includes(searchLower) ||
          item.supplier?.name?.toLowerCase().includes(searchLower)
        );
      }

      return result;
    },
    enabled: !!profile?.organization_id,
  });
}

export function usePayableSummary() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['payable-summary'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('accounts_payable')
        .select('status, amount_cents, paid_amount_cents, due_date, requires_approval');

      if (error) throw error;

      const summary: PayableSummary = {
        totalPending: 0,
        totalApprovalPending: 0,
        totalPaid: 0,
        totalOverdue: 0,
        countPending: 0,
        countPaid: 0,
        countOverdue: 0,
        todayDue: 0,
        weekDue: 0,
        monthDue: 0,
      };

      (data || []).forEach(item => {
        const amount = item.amount_cents || 0;

        if (item.status === 'paid') {
          summary.totalPaid += item.paid_amount_cents || amount;
          summary.countPaid++;
        } else if (item.status === 'overdue' || (item.status === 'pending' && item.due_date < today)) {
          summary.totalOverdue += amount;
          summary.countOverdue++;
        } else if (item.status === 'pending' || item.status === 'approved') {
          if (item.requires_approval && item.status === 'pending') {
            summary.totalApprovalPending += amount;
          }
          summary.totalPending += amount;
          summary.countPending++;

          // Due date analysis
          if (item.due_date === today) {
            summary.todayDue += amount;
          }
          if (item.due_date <= weekEnd) {
            summary.weekDue += amount;
          }
          if (item.due_date <= monthEnd) {
            summary.monthDue += amount;
          }
        }
      });

      return summary;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreatePayable() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<AccountPayable>) => {
      const { data: result, error } = await supabase
        .from('accounts_payable')
        .insert({
          organization_id: profile!.organization_id,
          description: data.description!,
          amount_cents: data.amount_cents!,
          issue_date: data.issue_date!,
          due_date: data.due_date!,
          supplier_id: data.supplier_id,
          category_id: data.category_id,
          cost_center_id: data.cost_center_id,
          bank_account_id: data.bank_account_id,
          payment_method: data.payment_method,
          barcode: data.barcode,
          pix_code: data.pix_code,
          document_number: data.document_number,
          installment_number: data.installment_number || 1,
          total_installments: data.total_installments || 1,
          notes: data.notes,
          is_recurring: data.is_recurring || false,
          recurrence_type: data.recurrence_type,
          created_by: profile?.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
      toast.success('Conta a pagar criada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar conta: ' + error.message);
    },
  });
}

export function useUpdatePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AccountPayable> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('accounts_payable')
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
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
      toast.success('Conta atualizada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      id, 
      paidAmount, 
      discount, 
      interest, 
      fine,
      bankAccountId 
    }: { 
      id: string; 
      paidAmount: number; 
      discount?: number; 
      interest?: number;
      fine?: number;
      bankAccountId?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('accounts_payable')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_amount_cents: paidAmount,
          discount_cents: discount || 0,
          interest_cents: interest || 0,
          fine_cents: fine || 0,
          bank_account_id: bankAccountId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
      toast.success('Pagamento confirmado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao confirmar: ' + error.message);
    },
  });
}

export function useApprovePayable() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error } = await supabase
        .from('accounts_payable')
        .update({
          status: 'approved',
          requires_approval: false,
          approved_by: profile?.user_id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
      toast.success('Pagamento aprovado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao aprovar: ' + error.message);
    },
  });
}

export function useDeletePayable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts_payable')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
      toast.success('Conta excluída');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });
}
