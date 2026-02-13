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
        // Try primary first
        const { data: primaryCompany } = await (supabase as any)
          .from('fiscal_companies')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('is_primary', true)
          .eq('is_active', true)
          .single();
        
        if (primaryCompany) {
          fiscalCompanyId = primaryCompany.id;
        } else {
          // Fallback to any active company
          const { data: anyCompany } = await (supabase as any)
            .from('fiscal_companies')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .eq('is_active', true)
            .limit(1)
            .single();
          
          if (anyCompany) {
            fiscalCompanyId = anyCompany.id;
          }
        }
      }

      if (!fiscalCompanyId) {
        throw new Error('Nenhuma empresa fiscal cadastrada. Acesse Configurações > Notas Fiscais.');
      }

      // Get fiscal company details
      const { data: fiscalCompany } = await (supabase as any)
        .from('fiscal_companies')
        .select('*')
        .eq('id', fiscalCompanyId)
        .single();

      // Get lead address - try primary first, fallback to any address
      const { data: primaryAddresses } = await supabase
        .from('lead_addresses')
        .select('*')
        .eq('lead_id', sale.lead_id)
        .eq('is_primary', true)
        .limit(1);

      let primaryAddress = primaryAddresses?.[0];
      
      // Fallback: if no primary address, use the first available address
      if (!primaryAddress) {
        const { data: anyAddresses } = await supabase
          .from('lead_addresses')
          .select('*')
          .eq('lead_id', sale.lead_id)
          .order('created_at', { ascending: false })
          .limit(1);
        primaryAddress = anyAddresses?.[0];
      }
      
      const primaryAddressAny = primaryAddress as any;

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
      const leadAny = sale.lead as any;
      const recipientCityCode = primaryAddressAny?.city_code || saleAny.delivery_city_code || leadAny?.city_code || '';
      const recipientNeighborhood = primaryAddress?.neighborhood || saleAny.delivery_neighborhood || '';
      const recipientStreet = primaryAddress?.street || saleAny.delivery_street || '';
      const recipientNumber = primaryAddress?.street_number || saleAny.delivery_number || '';
      const recipientComplement = primaryAddress?.complement || saleAny.delivery_complement || '';

      // Lead fiscal registrations (optional overrides)
      const recipientIE = leadAny?.inscricao_estadual ? String(leadAny.inscricao_estadual).replace(/\D/g, '') : null;
      const recipientIEIsento = !!leadAny?.inscricao_estadual_isento;
      const recipientIM = leadAny?.inscricao_municipal ? String(leadAny.inscricao_municipal).replace(/\D/g, '') : null;
      const recipientIMIsento = !!leadAny?.inscricao_municipal_isento;

      // IMPORTANT: Get the REAL max invoice number from the database to avoid duplicates
      const serie = data.invoice_type === 'nfe' 
        ? (fiscalCompany?.nfe_serie || 1) 
        : (fiscalCompany?.nfse_serie || 1);
      
      const { data: maxInvoiceRow } = await (supabase as any)
        .from('fiscal_invoices')
        .select('invoice_number')
        .eq('fiscal_company_id', fiscalCompanyId)
        .eq('invoice_type', data.invoice_type)
        .not('status', 'eq', 'cancelled')
        .order('invoice_number', { ascending: false })
        .limit(50);
      
      // Find the actual max number (parse as integers since stored as strings)
      const maxFromInvoices = (maxInvoiceRow || []).reduce((max: number, row: any) => {
        const num = parseInt(String(row.invoice_number), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      
      const currentLastNumber = data.invoice_type === 'nfe' 
        ? (fiscalCompany?.nfe_last_number || 0) 
        : (fiscalCompany?.nfse_last_number || 0);
      
      // Use the HIGHER of the two sources to guarantee no duplicates
      const effectiveLastNumber = Math.max(maxFromInvoices, currentLastNumber);
      const nextNumber = effectiveLastNumber + 1;

      // Update the company's last number to reserve it
      const updateField = data.invoice_type === 'nfe' ? 'nfe_last_number' : 'nfse_last_number';
      await (supabase as any)
        .from('fiscal_companies')
        .update({ [updateField]: nextNumber })
        .eq('id', fiscalCompanyId);

      // Clean CPF/CNPJ - remove all non-digits
      const rawCpfCnpj = sale.lead?.cpf_cnpj || '';
      const cleanCpfCnpj = String(rawCpfCnpj).replace(/\D/g, '').trim();
      const recipientType = cleanCpfCnpj.length === 14 ? 'juridica' : 'fisica';

      // Create draft invoice with reserved number
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
          // RESERVED invoice number and series
          invoice_number: String(nextNumber),
          invoice_series: String(serie),
          // Pre-fill from company
          nature_operation: fiscalCompany?.default_nature_operation || 'Venda de mercadorias',
          tax_regime: fiscalCompany?.tax_regime || 'simples',
          presence_indicator: fiscalCompany?.presence_indicator || '9',
          // Pre-fill from lead - CLEANED CPF/CNPJ
          recipient_name: sale.lead?.name || '',
          recipient_type: recipientType,
          recipient_cpf_cnpj: cleanCpfCnpj,
          recipient_email: sale.lead?.email || '',
          recipient_phone: String(sale.lead?.whatsapp || '').replace(/\D/g, ''),
          recipient_is_final_consumer: true,
          // Pre-fill from address
          recipient_cep: String(recipientCep).replace(/\D/g, ''),
          recipient_state: recipientState,
          recipient_city: recipientCity,
          recipient_city_code: recipientCityCode || null,
          recipient_neighborhood: recipientNeighborhood,
          recipient_street: recipientStreet,
          recipient_number: recipientNumber || 'S/N',
          recipient_complement: recipientComplement,
          recipient_inscricao_estadual: recipientIE,
          recipient_inscricao_estadual_isento: recipientIEIsento,
          recipient_inscricao_municipal: recipientIM,
          recipient_inscricao_municipal_isento: recipientIMIsento,
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
