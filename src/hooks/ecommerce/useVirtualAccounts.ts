import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export type AccountType = 'tenant' | 'affiliate' | 'coproducer';
export type TransactionType = 'credit' | 'debit' | 'fee' | 'withdrawal' | 'refund' | 'chargeback';
export type TransactionStatus = 'pending' | 'released' | 'completed' | 'cancelled';
export type WithdrawalStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';

export interface VirtualAccount {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  account_type: AccountType;
  holder_name: string;
  holder_email: string;
  holder_document: string | null;
  balance_cents: number;
  pending_balance_cents: number;
  total_received_cents: number;
  total_withdrawn_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  bank_data?: BankData[];
}

export interface BankData {
  id: string;
  virtual_account_id: string;
  bank_code: string;
  bank_name: string;
  agency: string;
  account_number: string;
  account_type: 'checking' | 'savings';
  holder_name: string;
  holder_document: string;
  pix_key: string | null;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | null;
  is_primary: boolean;
  created_at: string;
}

export interface VirtualTransaction {
  id: string;
  virtual_account_id: string;
  sale_id: string | null;
  transaction_type: TransactionType;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  description: string | null;
  reference_id: string | null;
  status: TransactionStatus;
  release_at: string | null;
  released_at: string | null;
  created_at: string;
  virtual_account?: VirtualAccount;
}

export interface WithdrawalRequest {
  id: string;
  virtual_account_id: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  bank_data: unknown;
  status: WithdrawalStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  transfer_proof_url: string | null;
  completed_at: string | null;
  created_at: string;
  virtual_account?: VirtualAccount;
}

// Fetch my virtual account
export function useMyVirtualAccount() {
  return useQuery({
    queryKey: ['my-virtual-account'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*, bank_data:virtual_account_bank_data(*)')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as VirtualAccount | null;
    },
  });
}

// Fetch tenant's virtual account
export function useTenantVirtualAccount() {
  return useQuery({
    queryKey: ['tenant-virtual-account'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*, bank_data:virtual_account_bank_data(*)')
        .eq('organization_id', profile.organization_id)
        .eq('account_type', 'tenant')
        .maybeSingle();
      
      if (error) throw error;
      return data as VirtualAccount | null;
    },
  });
}

// Fetch transactions for an account
export function useVirtualTransactions(accountId: string | undefined) {
  return useQuery({
    queryKey: ['virtual-transactions', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_transactions')
        .select('*')
        .eq('virtual_account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as VirtualTransaction[];
    },
  });
}

// Fetch my withdrawal requests
export function useMyWithdrawals() {
  return useQuery({
    queryKey: ['my-withdrawals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          virtual_account:virtual_accounts(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as WithdrawalRequest[];
    },
  });
}

// Create/update bank data
export function useUpdateBankData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      virtualAccountId, 
      ...bankData 
    }: Omit<BankData, 'id' | 'created_at' | 'virtual_account_id'> & { virtualAccountId: string }) => {
      // Check if already exists
      const { data: existing } = await supabase
        .from('virtual_account_bank_data')
        .select('id')
        .eq('virtual_account_id', virtualAccountId)
        .eq('is_primary', true)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('virtual_account_bank_data')
          .update(bankData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('virtual_account_bank_data')
          .insert({
            virtual_account_id: virtualAccountId,
            ...bankData,
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-virtual-account'] });
      toast.success('Dados bancários atualizados!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Request withdrawal
export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      virtualAccountId, 
      amountCents 
    }: { 
      virtualAccountId: string; 
      amountCents: number;
    }) => {
      // Fetch account to validate balance
      const { data: account, error: accError } = await supabase
        .from('virtual_accounts')
        .select('balance_cents, bank_data:virtual_account_bank_data(*)')
        .eq('id', virtualAccountId)
        .single();
      
      if (accError) throw accError;
      if (account.balance_cents < amountCents) {
        throw new Error('Saldo insuficiente');
      }
      
      const bankData = account.bank_data?.find((b: BankData) => b.is_primary);
      if (!bankData) {
        throw new Error('Cadastre seus dados bancários primeiro');
      }
      
      // Fetch platform settings for fees
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'withdrawal_rules')
        .single();
      
      const rules = (settings?.setting_value || { fee_percentage: 2.5, fee_fixed_cents: 0 }) as { fee_percentage: number; fee_fixed_cents: number };
      const feePercentage = Number(rules.fee_percentage) || 2.5;
      const feeFixed = Number(rules.fee_fixed_cents) || 0;
      
      const feeCents = Math.round(amountCents * (feePercentage / 100)) + feeFixed;
      const netAmount = amountCents - feeCents;
      
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
          virtual_account_id: virtualAccountId,
          amount_cents: amountCents,
          fee_cents: feeCents,
          net_amount_cents: netAmount,
          bank_data: bankData,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Debit from balance
      await supabase
        .from('virtual_accounts')
        .update({
          balance_cents: account.balance_cents - amountCents,
        })
        .eq('id', virtualAccountId);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-virtual-account'] });
      queryClient.invalidateQueries({ queryKey: ['my-withdrawals'] });
      toast.success('Saque solicitado! Aguarde aprovação.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// =====================================================
// SUPER ADMIN HOOKS
// =====================================================

// Fetch all virtual accounts (super admin)
export function useAllVirtualAccounts() {
  return useQuery({
    queryKey: ['all-virtual-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*, bank_data:virtual_account_bank_data(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as VirtualAccount[];
    },
  });
}

// Fetch all pending withdrawals (super admin)
export function usePendingWithdrawals() {
  return useQuery({
    queryKey: ['pending-withdrawals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          virtual_account:virtual_accounts(*)
        `)
        .in('status', ['pending', 'approved', 'processing'])
        .order('requested_at', { ascending: true });
      
      if (error) throw error;
      return data as unknown as WithdrawalRequest[];
    },
  });
}

// Approve/reject withdrawal (super admin)
export function useReviewWithdrawal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejectionReason,
      transferProofUrl,
    }: { 
      id: string; 
      status: 'approved' | 'rejected' | 'processing' | 'completed';
      rejectionReason?: string;
      transferProofUrl?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: Record<string, any> = {
        status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      };
      
      if (status === 'rejected' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
        
        // Refund balance
        const { data: withdrawal } = await supabase
          .from('withdrawal_requests')
          .select('virtual_account_id, amount_cents')
          .eq('id', id)
          .single();
        
        if (withdrawal) {
          const { data: account } = await supabase
            .from('virtual_accounts')
            .select('balance_cents')
            .eq('id', withdrawal.virtual_account_id)
            .single();
          
          if (account) {
            await supabase
              .from('virtual_accounts')
              .update({ balance_cents: account.balance_cents + withdrawal.amount_cents })
              .eq('id', withdrawal.virtual_account_id);
          }
        }
      }
      
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        if (transferProofUrl) {
          updateData.transfer_proof_url = transferProofUrl;
        }
      }
      
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['all-virtual-accounts'] });
      toast.success('Saque atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Fetch platform settings
export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');
      
      if (error) throw error;
      
      return data.reduce((acc, s) => {
        acc[s.setting_key] = s.setting_value;
        return acc;
      }, {} as Record<string, any>);
    },
  });
}

// Update platform settings
export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('platform_settings')
        .update({
          setting_value: value,
          updated_by: user?.id,
        })
        .eq('setting_key', key)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success('Configuração atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
