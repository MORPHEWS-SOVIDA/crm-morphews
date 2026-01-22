import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import type { InvoiceType } from './useFiscalInvoices';

export interface CreateDraftFromSaleData {
  sale_id: string;
  invoice_type: InvoiceType;
  fiscal_company_id?: string;
}

/**
 * Hook to create a fiscal invoice draft from a sale
 * Pre-populates all fields from sale/lead/products data
 */
export function useCreateDraftFromSale() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: CreateDraftFromSaleData) => {
      if (!profile?.organization_id) throw new Error('Organization not found');

      // Fetch sale with lead and items
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(*),
          items:sale_items(*, product:lead_products(*))
        `)
        .eq('id', data.sale_id)
        .single();

      if (saleError) throw saleError;
      if (!sale) throw new Error('Sale not found');

      // Get fiscal company (primary or specified)
      let fiscalCompanyId = data.fiscal_company_id;
      if (!fiscalCompanyId) {
        const { data: primaryCompany } = await (supabase as any)
          .from('fiscal_companies')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('is_primary', true)
          .eq('is_active', true)
          .single();
        
        if (primaryCompany) {
          fiscalCompanyId = primaryCompany.id;
        }
      }

      if (!fiscalCompanyId) {
        throw new Error('Nenhuma empresa fiscal configurada');
      }

      // Get fiscal company details
      const { data: fiscalCompany } = await (supabase as any)
        .from('fiscal_companies')
        .select('*')
        .eq('id', fiscalCompanyId)
        .single();

      // Get lead address if available
      const { data: addresses } = await supabase
        .from('lead_addresses')
        .select('*')
        .eq('lead_id', sale.lead_id)
        .eq('is_primary', true)
        .limit(1);

      const primaryAddress = addresses?.[0];

      // Build items array with fiscal data
      const items = (sale.items || []).map((item: any) => ({
        product_id: item.product_id,
        name: item.product?.name || item.product_name,
        code: item.product?.sku || '',
        description: item.product?.description || '',
        unit: 'UN',
        quantity: item.quantity,
        unit_price_cents: item.price_cents,
        total_cents: item.total_cents,
        ncm: item.product?.fiscal_ncm || '',
        cfop: item.product?.fiscal_cfop || fiscalCompany?.default_cfop_internal || '',
        cst: item.product?.fiscal_cst || fiscalCompany?.default_cst || '',
        origin: item.product?.fiscal_origin || '0',
      }));

      // Calculate totals
      const productsTotalCents = items.reduce((sum: number, i: any) => sum + (i.total_cents || 0), 0);
      const discountCents = sale.discount_cents || 0;
      const freightCents = (sale as any).freight_cents || 0;
      const totalCents = productsTotalCents + freightCents - discountCents;

      // Create unique reference
      const ref = `${profile.organization_id.slice(0, 8)}-${data.sale_id.slice(0, 8)}-${Date.now()}`;

      // Get address from sale or lead_addresses
      const saleAny = sale as any;
      const recipientCep = primaryAddress?.cep || saleAny.delivery_cep || '';
      const recipientState = primaryAddress?.state || saleAny.delivery_state || '';
      const recipientCity = primaryAddress?.city || saleAny.delivery_city || '';
      const recipientNeighborhood = primaryAddress?.neighborhood || saleAny.delivery_neighborhood || '';
      const recipientStreet = primaryAddress?.street || saleAny.delivery_street || '';
      const recipientNumber = primaryAddress?.street_number || saleAny.delivery_number || '';
      const recipientComplement = primaryAddress?.complement || saleAny.delivery_complement || '';

      // Create draft invoice
      const { data: invoice, error: insertError } = await (supabase as any)
        .from('fiscal_invoices')
        .insert({
          organization_id: profile.organization_id,
          fiscal_company_id: fiscalCompanyId,
          sale_id: data.sale_id,
          invoice_type: data.invoice_type,
          status: 'pending',
          is_draft: true,
          focus_nfe_ref: ref,
          total_cents: totalCents,
          products_total_cents: productsTotalCents,
          discount_cents: discountCents,
          freight_value_cents: freightCents,
          // Pre-fill from company
          nature_operation: fiscalCompany?.default_nature_operation || 'Venda de mercadorias',
          tax_regime: fiscalCompany?.tax_regime || 'simples',
          presence_indicator: fiscalCompany?.presence_indicator || '9',
          // Pre-fill from lead
          recipient_name: sale.lead?.name || '',
          recipient_type: sale.lead?.cpf_cnpj?.length === 14 ? 'juridica' : 'fisica',
          recipient_cpf_cnpj: sale.lead?.cpf_cnpj || '',
          recipient_email: sale.lead?.email || '',
          recipient_phone: sale.lead?.whatsapp || '',
          recipient_is_final_consumer: true,
          // Pre-fill from address
          recipient_cep: recipientCep,
          recipient_state: recipientState,
          recipient_city: recipientCity,
          recipient_neighborhood: recipientNeighborhood,
          recipient_street: recipientStreet,
          recipient_number: recipientNumber,
          recipient_complement: recipientComplement,
          // Items
          items,
          customer_data: {
            lead_id: sale.lead_id,
            lead_name: sale.lead?.name,
            sale_id: sale.id,
          },
          seller_user_id: (sale as any).seller_id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices-sale'] });
      toast({ title: 'Rascunho criado! Redirecionando...' });
      // Navigate to fiscal invoices page with the draft open
      navigate(`/notas-fiscais?edit=${invoice.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar rascunho',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to save/update a fiscal invoice draft
 */
export function useSaveFiscalInvoiceDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, any> }) => {
      const { data: invoice, error } = await (supabase as any)
        .from('fiscal_invoices')
        .update(data.updates)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return invoice;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoice', invoice.id] });
      toast({ title: 'Rascunho salvo!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar rascunho',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to send a fiscal invoice (emit to Focus NFe)
 */
export function useSendFiscalInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Get the invoice
      const { data: invoice, error: fetchError } = await (supabase as any)
        .from('fiscal_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (!invoice) throw new Error('Invoice not found');

      // Call the emit function with the invoice data
      const { data: result, error } = await supabase.functions.invoke('focus-nfe-emit', {
        body: {
          invoice_id: invoiceId,
          sale_id: invoice.sale_id,
          invoice_type: invoice.invoice_type,
          fiscal_company_id: invoice.fiscal_company_id,
          // Pass all the draft data
          draft_data: invoice,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      toast({ title: 'Nota fiscal enviada para processamento!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao enviar nota fiscal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a draft invoice
 */
export function useDeleteFiscalInvoiceDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await (supabase as any)
        .from('fiscal_invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('is_draft', true); // Only allow deleting drafts

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal-invoices'] });
      toast({ title: 'Rascunho excluído!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir rascunho',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
