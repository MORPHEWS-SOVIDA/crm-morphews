import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface BankAccount {
  id: string;
  organization_id: string;
  name: string;
  bank_code: string | null;
  bank_name: string | null;
  agency: string | null;
  agency_digit: string | null;
  account_number: string | null;
  account_digit: string | null;
  account_type: string;
  initial_balance_cents: number;
  current_balance_cents: number;
  is_active: boolean;
  is_default: boolean;
  color: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  organization_id: string;
  bank_account_id: string;
  fitid: string | null;
  transaction_date: string;
  amount_cents: number;
  description: string | null;
  memo: string | null;
  transaction_type: string | null;
  is_reconciled: boolean;
  reconciled_at: string | null;
  account_payable_id: string | null;
  sale_installment_id: string | null;
  created_at: string;
}

export function useBankAccounts(activeOnly: boolean = true) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['bank-accounts', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('bank_accounts')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<BankAccount>) => {
      const { data: result, error } = await supabase
        .from('bank_accounts')
        .insert({
          organization_id: profile!.organization_id,
          name: data.name!,
          bank_code: data.bank_code,
          bank_name: data.bank_name,
          agency: data.agency,
          agency_digit: data.agency_digit,
          account_number: data.account_number,
          account_digit: data.account_digit,
          account_type: data.account_type || 'corrente',
          initial_balance_cents: data.initial_balance_cents || 0,
          current_balance_cents: data.initial_balance_cents || 0,
          is_default: data.is_default || false,
          color: data.color,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Conta bancária criada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar: ' + error.message);
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BankAccount> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('bank_accounts')
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
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Conta atualizada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Conta desativada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });
}

export function useBankTransactions(bankAccountId: string | null, filters?: { startDate?: string; endDate?: string }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['bank-transactions', bankAccountId, filters],
    queryFn: async () => {
      if (!bankAccountId) return [];

      let query = supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .order('transaction_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('transaction_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('transaction_date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BankTransaction[];
    },
    enabled: !!profile?.organization_id && !!bankAccountId,
  });
}

// OFX Parser utility
export interface OFXTransaction {
  fitid: string;
  date: string;
  amount: number;
  description: string;
  memo?: string;
  type: 'credit' | 'debit';
}

export function parseOFX(content: string): { transactions: OFXTransaction[]; startDate?: string; endDate?: string } {
  const transactions: OFXTransaction[] = [];
  
  // Extract transactions
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    
    const fitid = extractTag(block, 'FITID');
    const dtPosted = extractTag(block, 'DTPOSTED');
    const trnAmt = extractTag(block, 'TRNAMT');
    const memo = extractTag(block, 'MEMO') || extractTag(block, 'NAME');
    
    if (fitid && dtPosted && trnAmt) {
      const amount = parseFloat(trnAmt);
      const date = parseOFXDate(dtPosted);
      
      transactions.push({
        fitid,
        date,
        amount: Math.round(amount * 100), // Convert to cents
        description: memo || '',
        type: amount >= 0 ? 'credit' : 'debit',
      });
    }
  }
  
  // Extract date range
  const dtStart = extractTag(content, 'DTSTART');
  const dtEnd = extractTag(content, 'DTEND');
  
  return {
    transactions,
    startDate: dtStart ? parseOFXDate(dtStart) : undefined,
    endDate: dtEnd ? parseOFXDate(dtEnd) : undefined,
  };
}

function extractTag(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\n]+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function parseOFXDate(dateStr: string): string {
  // OFX dates are in format YYYYMMDDHHMMSS or YYYYMMDD
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

export function useImportOFX() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      bankAccountId, 
      transactions, 
      fileName,
      startDate,
      endDate 
    }: { 
      bankAccountId: string; 
      transactions: OFXTransaction[];
      fileName: string;
      startDate?: string;
      endDate?: string;
    }) => {
      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('ofx_imports')
        .insert({
          organization_id: profile!.organization_id,
          bank_account_id: bankAccountId,
          file_name: fileName,
          start_date: startDate,
          end_date: endDate,
          total_transactions: transactions.length,
          imported_by: profile?.user_id,
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert transactions (skip duplicates)
      let newCount = 0;
      let dupCount = 0;

      for (const trx of transactions) {
        const { error } = await supabase
          .from('bank_transactions')
          .insert({
            organization_id: profile!.organization_id,
            bank_account_id: bankAccountId,
            fitid: trx.fitid,
            transaction_date: trx.date,
            amount_cents: trx.amount,
            description: trx.description,
            transaction_type: trx.type,
            import_batch_id: importRecord.id,
          });

        if (error) {
          if (error.code === '23505') { // Unique violation
            dupCount++;
          } else {
            console.error('Error inserting transaction:', error);
          }
        } else {
          newCount++;
        }
      }

      // Update import record with counts
      await supabase
        .from('ofx_imports')
        .update({
          new_transactions: newCount,
          duplicate_transactions: dupCount,
        })
        .eq('id', importRecord.id);

      return { importRecord, newCount, dupCount };
    },
    onSuccess: ({ newCount, dupCount }) => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success(`Importação concluída: ${newCount} novas, ${dupCount} duplicadas`);
    },
    onError: (error: Error) => {
      toast.error('Erro na importação: ' + error.message);
    },
  });
}

export function useReconcileTransaction() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      transactionId, 
      payableId,
      installmentId 
    }: { 
      transactionId: string; 
      payableId?: string;
      installmentId?: string;
    }) => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: profile?.user_id,
          account_payable_id: payableId,
          sale_installment_id: installmentId,
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Transação conciliada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao conciliar: ' + error.message);
    },
  });
}
