import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Enums
export type PaymentCategory = 
  | 'cash'
  | 'pix'
  | 'card_machine'
  | 'payment_link'
  | 'ecommerce'
  | 'boleto_prepaid'
  | 'boleto_postpaid'
  | 'boleto_installment'
  | 'gift';

export type PaymentTiming = 'cash' | 'term' | 'installments';

export type InstallmentFlow = 'anticipation' | 'receive_per_installment';

export type CardTransactionType = 'debit' | 'credit_cash' | 'credit_installment' | 'credit_predate' | 'pix';

export type CardBrand = 'visa' | 'master' | 'elo' | 'amex' | 'banricompras';

// Labels
export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  cash: 'Dinheiro',
  pix: 'Chave Pix',
  card_machine: 'Maquina de Cartão / TEF',
  payment_link: 'Link de Pagamento',
  ecommerce: 'Ecommerce/Site',
  boleto_prepaid: 'Boleto à vista pré-pago',
  boleto_postpaid: 'Boleto pós-pago',
  boleto_installment: 'Boleto parcelado',
  gift: 'Presente/Grátis',
};

export const PAYMENT_TIMING_LABELS: Record<PaymentTiming, string> = {
  cash: 'À Vista',
  term: 'A Prazo',
  installments: 'Parcelado',
};

export const INSTALLMENT_FLOW_LABELS: Record<InstallmentFlow, string> = {
  anticipation: 'Antecipação em 1x',
  receive_per_installment: 'Receber no fluxo de parcelas',
};

export const TRANSACTION_TYPE_LABELS: Record<CardTransactionType, string> = {
  debit: 'Débito',
  credit_cash: 'Crédito à vista',
  credit_installment: 'Crédito parcelado',
  credit_predate: 'Crédito pré-datado',
  pix: 'Pix',
};

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'VISA',
  master: 'MASTER',
  elo: 'ELO',
  amex: 'AMEX',
  banricompras: 'BANRICOMPRAS',
};

// Categories that require transaction data (NSU, bandeira, etc)
export const CATEGORIES_REQUIRING_TRANSACTION_DATA: PaymentCategory[] = [
  'card_machine',
  'payment_link',
  'ecommerce',
];

// Categories that can have boleto fees
export const BOLETO_CATEGORIES: PaymentCategory[] = [
  'boleto_prepaid',
  'boleto_postpaid',
  'boleto_installment',
];

// Interfaces
export interface BankDestination {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
}

export interface CnpjDestination {
  id: string;
  organization_id: string;
  cnpj: string;
  normalized_cnpj: string;
  created_at: string;
}

export interface CostCenter {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Acquirer {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TransactionFee {
  id: string;
  organization_id: string;
  payment_method_id: string;
  transaction_type: CardTransactionType;
  fee_percentage: number;
  fee_fixed_cents: number;
  settlement_days: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodEnhanced {
  id: string;
  organization_id: string;
  name: string;
  category: PaymentCategory | null;
  payment_timing: PaymentTiming;
  installment_flow: InstallmentFlow | null;
  max_installments: number;
  min_installment_value_cents: number;
  bank_destination_id: string | null;
  cnpj_destination_id: string | null;
  cost_center_id: string | null;
  acquirer_id: string | null;
  destination_bank: string | null;
  destination_cnpj: string | null;
  fee_percentage: number;
  fee_fixed_cents: number;
  settlement_days: number;
  anticipation_fee_percentage: number;
  requires_proof: boolean;
  requires_transaction_data: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  bank_destination?: BankDestination;
  cnpj_destination?: CnpjDestination;
  cost_center?: CostCenter;
  acquirer?: Acquirer;
  transaction_fees?: TransactionFee[];
}

// Hooks for dropdown data
export function useBankDestinations() {
  return useQuery({
    queryKey: ['payment-bank-destinations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_bank_destinations')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as BankDestination[];
    },
  });
}

export function useCnpjDestinations() {
  return useQuery({
    queryKey: ['payment-cnpj-destinations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_cnpj_destinations')
        .select('*')
        .order('cnpj');
      if (error) throw error;
      return data as CnpjDestination[];
    },
  });
}

export function useCostCenters() {
  return useQuery({
    queryKey: ['payment-cost-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_cost_centers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as CostCenter[];
    },
  });
}

export function useAcquirers() {
  return useQuery({
    queryKey: ['payment-acquirers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_acquirers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Acquirer[];
    },
  });
}

// Create new bank destination
export function useCreateBankDestination() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      // Normalize the name
      const normalizedName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      const { data, error } = await supabase
        .from('payment_bank_destinations')
        .insert({ 
          organization_id: profile.organization_id, 
          name, 
          normalized_name: normalizedName 
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Este banco já está cadastrado');
        }
        throw error;
      }
      return data as BankDestination;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-bank-destinations'] });
    },
  });
}

// Create new CNPJ destination
export function useCreateCnpjDestination() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (cnpj: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      // Normalize: only digits
      const normalizedCnpj = cnpj.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from('payment_cnpj_destinations')
        .insert({ 
          organization_id: profile.organization_id, 
          cnpj, 
          normalized_cnpj: normalizedCnpj 
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Este CNPJ já está cadastrado');
        }
        throw error;
      }
      return data as CnpjDestination;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-cnpj-destinations'] });
    },
  });
}

// Create new cost center
export function useCreateCostCenter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const normalizedName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      const { data, error } = await supabase
        .from('payment_cost_centers')
        .insert({ 
          organization_id: profile.organization_id, 
          name, 
          normalized_name: normalizedName 
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Este centro de custo já existe');
        }
        throw error;
      }
      return data as CostCenter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-cost-centers'] });
    },
  });
}

// Create new acquirer
export function useCreateAcquirer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const normalizedName = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      const { data, error } = await supabase
        .from('payment_acquirers')
        .insert({ 
          organization_id: profile.organization_id, 
          name, 
          normalized_name: normalizedName 
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Esta adquirente já existe');
        }
        throw error;
      }
      return data as Acquirer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-acquirers'] });
    },
  });
}

// Enhanced payment methods hook
export function usePaymentMethodsEnhanced() {
  return useQuery({
    queryKey: ['payment-methods-enhanced'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select(`
          *,
          bank_destination:payment_bank_destinations(*),
          cnpj_destination:payment_cnpj_destinations(*),
          cost_center:payment_cost_centers(*),
          acquirer:payment_acquirers(*)
        `)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Fetch transaction fees for each payment method
      const methodIds = (data || []).map(m => m.id);
      
      let transactionFees: TransactionFee[] = [];
      if (methodIds.length > 0) {
        const { data: feesData, error: feesError } = await supabase
          .from('payment_method_transaction_fees')
          .select('*')
          .in('payment_method_id', methodIds);
        
        if (!feesError && feesData) {
          transactionFees = feesData as TransactionFee[];
        }
      }
      
      // Map fees to methods
      const methodsWithFees = (data || []).map(method => ({
        ...method,
        transaction_fees: transactionFees.filter(f => f.payment_method_id === method.id),
      }));
      
      return methodsWithFees as PaymentMethodEnhanced[];
    },
  });
}

export function useActivePaymentMethodsEnhanced() {
  return useQuery({
    queryKey: ['payment-methods-enhanced', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select(`
          *,
          bank_destination:payment_bank_destinations(*),
          cnpj_destination:payment_cnpj_destinations(*),
          cost_center:payment_cost_centers(*),
          acquirer:payment_acquirers(*)
        `)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Fetch transaction fees
      const methodIds = (data || []).map(m => m.id);
      
      let transactionFees: TransactionFee[] = [];
      if (methodIds.length > 0) {
        const { data: feesData } = await supabase
          .from('payment_method_transaction_fees')
          .select('*')
          .in('payment_method_id', methodIds)
          .eq('is_enabled', true);
        
        if (feesData) {
          transactionFees = feesData as TransactionFee[];
        }
      }
      
      const methodsWithFees = (data || []).map(method => ({
        ...method,
        transaction_fees: transactionFees.filter(f => f.payment_method_id === method.id),
      }));
      
      return methodsWithFees as PaymentMethodEnhanced[];
    },
  });
}

export interface CreatePaymentMethodInput {
  name: string;
  category: PaymentCategory;
  payment_timing: PaymentTiming;
  installment_flow?: InstallmentFlow | null;
  max_installments?: number;
  min_installment_value_cents?: number;
  bank_destination_id?: string | null;
  cnpj_destination_id?: string | null;
  cost_center_id?: string | null;
  acquirer_id?: string | null;
  fee_percentage?: number;
  fee_fixed_cents?: number;
  settlement_days?: number;
  anticipation_fee_percentage?: number;
  requires_proof?: boolean;
  // Transaction fees for card-based methods
  transaction_fees?: {
    transaction_type: CardTransactionType;
    fee_percentage: number;
    fee_fixed_cents: number;
    settlement_days: number;
    is_enabled: boolean;
  }[];
}

export function useCreatePaymentMethodEnhanced() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentMethodInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const requiresTransactionData = CATEGORIES_REQUIRING_TRANSACTION_DATA.includes(input.category);

      const { transaction_fees, ...methodData } = input;
      
      const { data, error } = await supabase
        .from('payment_methods')
        .insert({
          ...methodData,
          organization_id: profile.organization_id,
          requires_transaction_data: requiresTransactionData,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert transaction fees if provided
      if (transaction_fees && transaction_fees.length > 0 && requiresTransactionData) {
        const feesToInsert = transaction_fees.map(fee => ({
          organization_id: profile.organization_id,
          payment_method_id: data.id,
          ...fee,
        }));

        const { error: feesError } = await supabase
          .from('payment_method_transaction_fees')
          .insert(feesToInsert);

        if (feesError) {
          console.error('Erro ao inserir taxas:', feesError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods-enhanced'] });
      toast.success('Forma de pagamento criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar forma de pagamento: ${error.message}`);
    },
  });
}

export interface UpdatePaymentMethodInput extends Partial<CreatePaymentMethodInput> {
  is_active?: boolean;
  display_order?: number;
}

export function useUpdatePaymentMethodEnhanced() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePaymentMethodInput & { id: string }) => {
      const { transaction_fees, ...rawMethodData } = input;
      
      // Clean up empty strings that should be null (for UUID fields)
      const methodData: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawMethodData)) {
        // Convert empty strings to null for UUID reference fields
        if (value === '' && ['bank_destination_id', 'cnpj_destination_id', 'cost_center_id', 'acquirer_id'].includes(key)) {
          methodData[key] = null;
        } else if (value !== undefined) {
          methodData[key] = value;
        }
      }
      
      // Update requires_transaction_data based on category if category is being updated
      if (methodData.category) {
        methodData.requires_transaction_data = CATEGORIES_REQUIRING_TRANSACTION_DATA.includes(methodData.category);
      }
      
      const { data, error } = await supabase
        .from('payment_methods')
        .update(methodData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update transaction fees if provided
      if (transaction_fees !== undefined) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.organization_id) throw new Error('Organização não encontrada');

        // Delete existing fees
        await supabase
          .from('payment_method_transaction_fees')
          .delete()
          .eq('payment_method_id', id);

        // Insert new fees
        if (transaction_fees.length > 0) {
          const feesToInsert = transaction_fees.map(fee => ({
            organization_id: profile.organization_id,
            payment_method_id: id,
            ...fee,
          }));

          await supabase
            .from('payment_method_transaction_fees')
            .insert(feesToInsert);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods-enhanced'] });
      toast.success('Forma de pagamento atualizada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useDeletePaymentMethodEnhanced() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Transaction fees will be deleted automatically due to CASCADE
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      queryClient.invalidateQueries({ queryKey: ['payment-methods-enhanced'] });
      toast.success('Forma de pagamento removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}
