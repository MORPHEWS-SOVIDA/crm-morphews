import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PaymentLink {
  id: string;
  organization_id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  slug: string;
  amount_cents: number | null;
  allow_custom_amount: boolean;
  min_amount_cents: number;
  max_amount_cents: number | null;
  pix_enabled: boolean;
  boleto_enabled: boolean;
  card_enabled: boolean;
  max_installments: number | null;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  lead_id: string | null;
  external_reference: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentLinkTransaction {
  id: string;
  organization_id: string;
  payment_link_id: string | null;
  origin_type: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  payment_method: string;
  gateway_type: string;
  gateway_order_id: string | null;
  installments: number;
  status: string;
  paid_at: string | null;
  release_date: string | null;
  released_at: string | null;
  created_at: string;
  created_by: string | null;
  card_brand: string | null;
  card_last_digits: string | null;
}

// Fetch payment links
export function usePaymentLinks() {
  return useQuery({
    queryKey: ['payment-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PaymentLink[];
    },
  });
}

// Fetch single payment link by slug (public)
export function usePaymentLinkBySlug(slug: string) {
  return useQuery({
    queryKey: ['payment-link', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      return data as PaymentLink;
    },
    enabled: !!slug,
  });
}

// Fetch payment link transactions
export function usePaymentLinkTransactions(filters?: {
  status?: string;
  payment_method?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['payment-link-transactions', filters],
    queryFn: async () => {
      let query = supabase
        .from('payment_link_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data, error } = await query.limit(500);
      
      if (error) throw error;
      return data as PaymentLinkTransaction[];
    },
  });
}

// Create payment link
export interface CreatePaymentLinkInput {
  title: string;
  description?: string;
  amount_cents?: number;
  allow_custom_amount?: boolean;
  min_amount_cents?: number;
  max_amount_cents?: number;
  pix_enabled?: boolean;
  boleto_enabled?: boolean;
  card_enabled?: boolean;
  max_installments?: number;
  expires_at?: string;
  max_uses?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_document?: string;
  lead_id?: string;
  external_reference?: string;
  notes?: string;
}

export function useCreatePaymentLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreatePaymentLinkInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Generate unique slug
      const { data: slugData } = await supabase.rpc('generate_payment_link_slug');
      const slug = slugData || Math.random().toString(36).substring(2, 10);
      
      const { data, error } = await supabase
        .from('payment_links')
        .insert({
          organization_id: profile.organization_id,
          created_by: user.id,
          slug,
          title: input.title,
          description: input.description,
          amount_cents: input.amount_cents,
          allow_custom_amount: input.allow_custom_amount ?? !input.amount_cents,
          min_amount_cents: input.min_amount_cents ?? 100,
          max_amount_cents: input.max_amount_cents,
          pix_enabled: input.pix_enabled ?? true,
          boleto_enabled: input.boleto_enabled ?? true,
          card_enabled: input.card_enabled ?? true,
          max_installments: input.max_installments ?? 12,
          expires_at: input.expires_at,
          max_uses: input.max_uses,
          customer_name: input.customer_name,
          customer_email: input.customer_email,
          customer_phone: input.customer_phone,
          customer_document: input.customer_document,
          lead_id: input.lead_id,
          external_reference: input.external_reference,
          notes: input.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      toast.success('Link de pagamento criado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update payment link
export function useUpdatePaymentLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreatePaymentLinkInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('payment_links')
        .update({
          title: input.title,
          description: input.description,
          amount_cents: input.amount_cents,
          allow_custom_amount: input.allow_custom_amount,
          min_amount_cents: input.min_amount_cents,
          max_amount_cents: input.max_amount_cents,
          pix_enabled: input.pix_enabled,
          boleto_enabled: input.boleto_enabled,
          card_enabled: input.card_enabled,
          max_installments: input.max_installments,
          expires_at: input.expires_at,
          max_uses: input.max_uses,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      toast.success('Link atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Toggle payment link active status
export function useTogglePaymentLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('payment_links')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      toast.success(variables.is_active ? 'Link ativado!' : 'Link desativado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete payment link
export function useDeletePaymentLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_links')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      toast.success('Link removido!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Process payment (call edge function)
export function useProcessPayment() {
  return useMutation({
    mutationFn: async (payload: {
      paymentLinkId?: string;
      organizationId?: string;
      amount_cents: number;
      payment_method: 'pix' | 'boleto' | 'credit_card';
      installments?: number;
      customer: {
        name: string;
        email: string;
        phone: string;
        document: string;
      };
      card_data?: {
        number: string;
        holder_name: string;
        expiration_date: string;
        cvv: string;
      };
      origin_type?: 'payment_link' | 'telesales' | 'receptive';
      sale_id?: string;
      lead_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('process-payment-link', {
        body: payload,
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Get transaction stats for dashboard
export function usePaymentLinkStats() {
  return useQuery({
    queryKey: ['payment-link-stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data: transactions } = await supabase
        .from('payment_link_transactions')
        .select('amount_cents, fee_cents, status, payment_method, release_date, created_at')
        .gte('created_at', startOfMonth.toISOString());
      
      if (!transactions) return null;

      const paidTransactions = transactions.filter(t => t.status === 'paid');
      const pendingTransactions = transactions.filter(t => t.status === 'pending');
      
      const totalReceived = paidTransactions.reduce((sum, t) => sum + t.amount_cents, 0);
      const totalFees = paidTransactions.reduce((sum, t) => sum + t.fee_cents, 0);
      const totalNet = totalReceived - totalFees;
      const totalPending = pendingTransactions.reduce((sum, t) => sum + t.amount_cents, 0);
      
      // Calculate pending release
      const today = new Date().toISOString().split('T')[0];
      const pendingRelease = paidTransactions
        .filter(t => t.release_date && t.release_date > today)
        .reduce((sum, t) => sum + (t.amount_cents - t.fee_cents), 0);
      
      const availableBalance = totalNet - pendingRelease;

      return {
        totalReceived,
        totalFees,
        totalNet,
        totalPending,
        pendingRelease,
        availableBalance,
        transactionCount: paidTransactions.length,
        pendingCount: pendingTransactions.length,
        byMethod: {
          pix: paidTransactions.filter(t => t.payment_method === 'pix').reduce((sum, t) => sum + t.amount_cents, 0),
          boleto: paidTransactions.filter(t => t.payment_method === 'boleto').reduce((sum, t) => sum + t.amount_cents, 0),
          credit_card: paidTransactions.filter(t => t.payment_method === 'credit_card').reduce((sum, t) => sum + t.amount_cents, 0),
        },
      };
    },
  });
}
