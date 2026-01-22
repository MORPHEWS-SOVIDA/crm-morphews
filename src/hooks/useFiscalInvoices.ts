import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

// Note: Using 'any' type assertions until Supabase types are regenerated after migration

// =============================================================================
// TYPES
// =============================================================================

export type InvoiceType = 'nfe' | 'nfse' | 'nfce';
export type InvoiceStatus = 'pending' | 'processing' | 'authorized' | 'rejected' | 'cancelled';

export interface FiscalInvoice {
  id: string;
  organization_id: string;
  fiscal_company_id: string;
  sale_id: string | null;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  focus_nfe_ref: string;
  focus_nfe_id: string | null;
  invoice_number: string | null;
  invoice_series: string | null;
  access_key: string | null;
  verification_code: string | null;
  protocol_number: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  total_cents: number;
  error_message: string | null;
  focus_nfe_response: Record<string, unknown> | null;
  items: Record<string, unknown>[] | null;
  customer_data: Record<string, unknown> | null;
  created_at: string;
  authorized_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  // Draft-related fields
  is_draft?: boolean;
  emission_type?: string;
  nature_operation?: string;
  emission_date?: string;
  emission_time?: string;
  exit_date?: string;
  exit_time?: string;
  tax_regime?: string;
  purpose?: string;
  presence_indicator?: string;
  // Recipient data
  recipient_name?: string;
  recipient_type?: string;
  recipient_cpf_cnpj?: string;
  recipient_ie?: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_is_final_consumer?: boolean;
  recipient_cep?: string;
  recipient_state?: string;
  recipient_city?: string;
  recipient_city_code?: string;
  recipient_neighborhood?: string;
  recipient_street?: string;
  recipient_number?: string;
  recipient_complement?: string;
  // Transport data
  transport_type?: string;
  freight_responsibility?: string;
  carrier_name?: string;
  carrier_cpf_cnpj?: string;
  carrier_ie?: string;
  carrier_state?: string;
  carrier_city?: string;
  carrier_address?: string;
  vehicle_plate?: string;
  vehicle_state?: string;
  vehicle_rntc?: string;
  volume_quantity?: number;
  volume_gross_weight?: number;
  volume_net_weight?: number;
  volume_numbering?: string;
  volume_species?: string;
  volume_brand?: string;
  // Tax calculation
  products_total_cents?: number;
  freight_value_cents?: number;
  insurance_value_cents?: number;
  other_expenses_cents?: number;
  discount_cents?: number;
  // Additional info
  additional_info?: string;
  fisco_info?: string;
  seller_user_id?: string;
  // Joined data
  fiscal_company?: {
    company_name: string;
    cnpj: string;
  };
  sale?: {
    id: string;
    lead?: {
      name: string;
    };
  };
}

export interface FiscalInvoiceEvent {
  id: string;
  fiscal_invoice_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

export interface EmitInvoiceData {
  sale_id: string;
  invoice_type: InvoiceType;
  fiscal_company_id?: string; // Optional, uses primary if not specified
}

// =============================================================================
// HELPERS
// =============================================================================

export function getStatusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    pending: 'Pendente',
    processing: 'Processando',
    authorized: 'Autorizada',
    rejected: 'Rejeitada',
    cancelled: 'Cancelada',
  };
  return labels[status] || status;
}

export function getStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    authorized: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getInvoiceTypeLabel(type: InvoiceType): string {
  const labels: Record<InvoiceType, string> = {
    nfe: 'NF-e (Produtos)',
    nfse: 'NFS-e (Serviços)',
    nfce: 'NFC-e (Consumidor)',
  };
  return labels[type] || type;
}

// =============================================================================
// HOOKS
// =============================================================================

export function useFiscalInvoices(filters?: { status?: InvoiceStatus; sale_id?: string }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['fiscal-invoices', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = (supabase as any)
        .from('fiscal_invoices')
        .select(`
          *,
          fiscal_company:fiscal_companies(company_name, cnpj),
          sale:sales(id, lead:leads(name))
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.sale_id) {
        query = query.eq('sale_id', filters.sale_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as FiscalInvoice[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useFiscalInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['fiscal-invoice', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await (supabase as any)
        .from('fiscal_invoices')
        .select(`
          *,
          fiscal_company:fiscal_companies(company_name, cnpj),
          sale:sales(id, lead:leads(name))
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as FiscalInvoice;
    },
    enabled: !!id,
  });
}

export function useSaleInvoices(saleId: string | undefined) {
  return useQuery({
    queryKey: ['fiscal-invoices-sale', saleId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await (supabase as any)
        .from('fiscal_invoices')
        .select(`
          *,
          fiscal_company:fiscal_companies(company_name, cnpj)
        `)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as FiscalInvoice[];
    },
    enabled: !!saleId,
  });
}

export function useFiscalInvoiceEvents(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['fiscal-invoice-events', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];

      const { data, error } = await (supabase as any)
        .from('fiscal_invoice_events')
        .select('*')
        .eq('fiscal_invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FiscalInvoiceEvent[];
    },
    enabled: !!invoiceId,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

export function useEmitInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: EmitInvoiceData) => {
      const { data: result, error } = await supabase.functions.invoke('focus-nfe-emit', {
        body: data,
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (_, { sale_id }) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices-sale', sale_id] });
      toast({ title: 'Nota fiscal em processamento!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao emitir nota fiscal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: string; reason: string }) => {
      const { data: result, error } = await supabase.functions.invoke('focus-nfe-cancel', {
        body: { invoice_id: invoiceId, reason },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoice', invoiceId] });
      toast({ title: 'Solicitação de cancelamento enviada!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao cancelar nota fiscal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRefreshInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: result, error } = await supabase.functions.invoke('focus-nfe-status', {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoice', invoiceId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
