import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface PurchaseInvoice {
  id: string;
  organization_id: string;
  access_key: string | null;
  number: string;
  series: string | null;
  issue_date: string;
  entry_date: string | null;
  supplier_cnpj: string;
  supplier_name: string;
  supplier_ie: string | null;
  total_products_cents: number;
  total_freight_cents: number;
  total_discount_cents: number;
  total_taxes_cents: number;
  total_invoice_cents: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  processed_at: string | null;
  processed_by: string | null;
  xml_content: string | null;
  xml_storage_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  organization_id: string;
  invoice_id: string;
  item_number: number;
  supplier_product_code: string | null;
  supplier_product_name: string;
  ncm: string | null;
  cfop: string | null;
  unit: string | null;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  discount_cents: number;
  freight_cents: number;
  ean: string | null;
  icms_base_cents: number;
  icms_value_cents: number;
  icms_st_cents: number;
  ipi_cents: number;
  pis_cents: number;
  cofins_cents: number;
  product_id: string | null;
  linked_at: string | null;
  linked_by: string | null;
  link_status: 'pending' | 'linked' | 'created' | 'skipped';
  stock_location_id: string | null;
  stock_entered: boolean;
  stock_movement_id: string | null;
  created_at: string;
  // Joined
  product?: {
    id: string;
    name: string;
    barcode_ean: string | null;
  } | null;
}

export interface ParsedXmlInvoice {
  accessKey: string;
  number: string;
  series: string;
  issueDate: string;
  supplier: {
    cnpj: string;
    name: string;
    ie: string | null;
  };
  totals: {
    products: number;
    freight: number;
    discount: number;
    taxes: number;
    invoice: number;
  };
  items: ParsedXmlItem[];
  installments: ParsedXmlInstallment[];
}

export interface ParsedXmlInstallment {
  number: string;
  dueDate: string;
  amountCents: number;
}

export interface ParsedXmlItem {
  itemNumber: number;
  productCode: string;
  productName: string;
  ncm: string | null;
  cfop: string | null;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  discountCents: number;
  ean: string | null;
  taxes: {
    icmsBase: number;
    icmsValue: number;
    icmsSt: number;
    ipi: number;
    pis: number;
    cofins: number;
  };
}

export interface CreateInvoiceInput {
  access_key?: string;
  number: string;
  series?: string;
  issue_date: string;
  entry_date?: string;
  supplier_cnpj: string;
  supplier_name: string;
  supplier_ie?: string;
  total_products_cents: number;
  total_freight_cents?: number;
  total_discount_cents?: number;
  total_taxes_cents?: number;
  total_invoice_cents: number;
  xml_content?: string;
  notes?: string;
}

export interface CreateInvoiceItemInput {
  invoice_id: string;
  item_number: number;
  supplier_product_code?: string;
  supplier_product_name: string;
  ncm?: string;
  cfop?: string;
  unit?: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  discount_cents?: number;
  freight_cents?: number;
  ean?: string;
  icms_base_cents?: number;
  icms_value_cents?: number;
  icms_st_cents?: number;
  ipi_cents?: number;
  pis_cents?: number;
  cofins_cents?: number;
}

// ============================================================================
// HOOKS - INVOICES
// ============================================================================

export function usePurchaseInvoices() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['purchase-invoices', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PurchaseInvoice[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function usePurchaseInvoice(id: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['purchase-invoice', id],
    queryFn: async () => {
      if (!id || !profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('id', id)
        .eq('organization_id', profile.organization_id)
        .single();

      if (error) throw error;
      return data as PurchaseInvoice;
    },
    enabled: !!id && !!profile?.organization_id,
  });
}

export function usePurchaseInvoiceItems(invoiceId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['purchase-invoice-items', invoiceId],
    queryFn: async () => {
      if (!invoiceId || !profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .select(`
          *,
          product:product_id (
            id,
            name,
            barcode_ean
          )
        `)
        .eq('invoice_id', invoiceId)
        .eq('organization_id', profile.organization_id)
        .order('item_number');

      if (error) throw error;
      return data as PurchaseInvoiceItem[];
    },
    enabled: !!invoiceId && !!profile?.organization_id,
  });
}

export function useCreatePurchaseInvoice() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('purchase_invoices')
        .insert({
          organization_id: profile.organization_id,
          created_by: user?.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PurchaseInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      toast.success('Nota fiscal importada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao importar nota:', error);
      toast.error(error.message || 'Erro ao importar nota fiscal');
    },
  });
}

export function useCreatePurchaseInvoiceItems() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (items: CreateInvoiceItemInput[]) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      const itemsWithOrg = items.map(item => ({
        organization_id: profile.organization_id,
        ...item,
      }));

      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .insert(itemsWithOrg)
        .select();

      if (error) throw error;
      return data as PurchaseInvoiceItem[];
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['purchase-invoice-items', variables[0].invoice_id] });
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao salvar itens:', error);
      toast.error(error.message || 'Erro ao salvar itens da nota');
    },
  });
}

// ============================================================================
// HOOKS - LINKING PRODUCTS
// ============================================================================

export function useLinkInvoiceItemToProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      productId,
      saveMapping = true,
      supplierCnpj,
      supplierProductCode,
    }: { 
      itemId: string; 
      productId: string;
      saveMapping?: boolean;
      supplierCnpj?: string;
      supplierProductCode?: string;
    }) => {
      // Update the item
      const { data: item, error } = await supabase
        .from('purchase_invoice_items')
        .update({
          product_id: productId,
          linked_at: new Date().toISOString(),
          linked_by: user?.id,
          link_status: 'linked',
        })
        .eq('id', itemId)
        .select('*, invoice:invoice_id(organization_id, supplier_cnpj)')
        .single();

      if (error) throw error;

      // Save mapping for future imports
      if (saveMapping && supplierCnpj && supplierProductCode) {
        const invoiceData = item.invoice as { organization_id: string; supplier_cnpj: string } | null;
        if (invoiceData) {
          await supabase
            .from('supplier_product_mappings')
            .upsert({
              organization_id: invoiceData.organization_id,
              supplier_cnpj: supplierCnpj,
              supplier_product_code: supplierProductCode,
              product_id: productId,
              created_by: user?.id,
            }, {
              onConflict: 'organization_id,supplier_cnpj,supplier_product_code',
            });
        }
      }

      return item;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice-items', data.invoice_id] });
      toast.success('Produto vinculado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao vincular produto');
    },
  });
}

export function useSkipInvoiceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase
        .from('purchase_invoice_items')
        .update({ link_status: 'skipped' })
        .eq('id', itemId)
        .select('invoice_id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice-items', data.invoice_id] });
    },
  });
}

// ============================================================================
// HOOKS - PROCESS STOCK
// ============================================================================

export function useProcessInvoiceStock() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase
        .rpc('process_purchase_invoice_stock', {
          p_invoice_id: invoiceId,
          p_user_id: user?.id,
        });

      if (error) throw error;
      return data as { success: boolean; processed_count: number; errors: unknown[] };
    },
    onSuccess: (data, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice-items', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      
      if (data.processed_count > 0) {
        toast.success(`${data.processed_count} item(s) deram entrada no estoque!`);
      }
      if (data.errors && (data.errors as unknown[]).length > 0) {
        toast.warning(`${(data.errors as unknown[]).length} erro(s) durante processamento`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao processar estoque');
    },
  });
}

// ============================================================================
// HOOKS - GENERATE ACCOUNTS PAYABLE FROM INVOICE
// ============================================================================

export function useGeneratePayablesFromInvoice() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      invoiceId, 
      installments,
      supplierId,
      categoryId,
    }: { 
      invoiceId: string;
      installments: { number: string; dueDate: string; amountCents: number }[];
      supplierId?: string;
      categoryId?: string;
    }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Get invoice details
      const { data: invoice, error: invoiceError } = await supabase
        .from('purchase_invoices')
        .select('number, issue_date, supplier_name')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Create accounts payable for each installment
      const payables = installments.map((inst, index) => ({
        organization_id: profile.organization_id,
        purchase_invoice_id: invoiceId,
        supplier_id: supplierId || null,
        document_number: `NF ${invoice.number} - ${inst.number}`,
        description: `Duplicata ${inst.number}/${installments.length} - NF ${invoice.number} - ${invoice.supplier_name}`,
        amount_cents: inst.amountCents,
        issue_date: invoice.issue_date.split('T')[0],
        due_date: inst.dueDate,
        installment_number: index + 1,
        total_installments: installments.length,
        payment_method: 'boleto',
        category_id: categoryId || null,
        status: 'pending',
        created_by: user?.id,
      }));

      const { data, error } = await supabase
        .from('accounts_payable')
        .insert(payables)
        .select();

      if (error) throw error;

      // Mark invoice as having installments generated
      await supabase
        .from('purchase_invoices')
        .update({ installments_generated: true })
        .eq('id', invoiceId);

      return data;
    },
    onSuccess: (data, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
      toast.success(`${data.length} conta(s) a pagar gerada(s)!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao gerar contas a pagar');
    },
  });
}

// ============================================================================
// HOOKS - FIND PRODUCT MATCHES
// ============================================================================

export function useFindProductMatches() {
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (items: { ean?: string | null; supplierCode?: string; supplierCnpj?: string }[]) => {
      if (!profile?.organization_id) return [];

      const matches: { index: number; productId: string; matchType: 'ean' | 'mapping' }[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Try EAN match first
        if (item.ean) {
          const { data: eanMatch } = await supabase
            .from('lead_products')
            .select('id')
            .eq('organization_id', profile.organization_id)
            .or(`barcode_ean.eq.${item.ean},gtin_tax.eq.${item.ean}`)
            .limit(1)
            .single();

          if (eanMatch) {
            matches.push({ index: i, productId: eanMatch.id, matchType: 'ean' });
            continue;
          }
        }

        // Try mapping match
        if (item.supplierCode && item.supplierCnpj) {
          const { data: mappingMatch } = await supabase
            .from('supplier_product_mappings')
            .select('product_id')
            .eq('organization_id', profile.organization_id)
            .eq('supplier_cnpj', item.supplierCnpj)
            .eq('supplier_product_code', item.supplierCode)
            .limit(1)
            .single();

          if (mappingMatch) {
            matches.push({ index: i, productId: mappingMatch.product_id, matchType: 'mapping' });
          }
        }
      }

      return matches;
    },
  });
}

// ============================================================================
// XML PARSER (Client-side basic parsing)
// ============================================================================

export function parseNFeXml(xmlString: string): ParsedXmlInvoice {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  
  const getTextContent = (selector: string, parent: Element | Document = doc): string => {
    const el = parent.querySelector(selector);
    return el?.textContent?.trim() || '';
  };
  
  const getNumber = (selector: string, parent: Element | Document = doc): number => {
    const text = getTextContent(selector, parent);
    return parseFloat(text) || 0;
  };

  // Get NFe info
  const infNFe = doc.querySelector('infNFe');
  const ide = doc.querySelector('ide');
  const emit = doc.querySelector('emit');
  const total = doc.querySelector('total ICMSTot');

  // Parse items
  const detElements = doc.querySelectorAll('det');
  const items: ParsedXmlItem[] = [];
  
  detElements.forEach((det, index) => {
    const prod = det.querySelector('prod');
    const imposto = det.querySelector('imposto');
    
    if (!prod) return;

    const unitPrice = getNumber('vUnCom', prod);
    const quantity = getNumber('qCom', prod);
    
    items.push({
      itemNumber: parseInt(det.getAttribute('nItem') || String(index + 1)),
      productCode: getTextContent('cProd', prod),
      productName: getTextContent('xProd', prod),
      ncm: getTextContent('NCM', prod) || null,
      cfop: getTextContent('CFOP', prod) || null,
      unit: getTextContent('uCom', prod),
      quantity,
      unitPriceCents: Math.round(unitPrice * 100),
      totalPriceCents: Math.round(getNumber('vProd', prod) * 100),
      discountCents: Math.round(getNumber('vDesc', prod) * 100),
      ean: getTextContent('cEAN', prod) || getTextContent('cEANTrib', prod) || null,
      taxes: {
        icmsBase: Math.round(getNumber('vBC', imposto) * 100),
        icmsValue: Math.round(getNumber('vICMS', imposto) * 100),
        icmsSt: Math.round(getNumber('vICMSST', imposto) * 100),
        ipi: Math.round(getNumber('vIPI', imposto) * 100),
        pis: Math.round(getNumber('vPIS', imposto) * 100),
        cofins: Math.round(getNumber('vCOFINS', imposto) * 100),
      },
    });
  });

  // Parse installments (duplicatas)
  const dupElements = doc.querySelectorAll('dup');
  const installments: { number: string; dueDate: string; amountCents: number }[] = [];
  
  dupElements.forEach((dup) => {
    const nDup = getTextContent('nDup', dup);
    const dVenc = getTextContent('dVenc', dup);
    const vDup = getNumber('vDup', dup);
    
    if (dVenc && vDup > 0) {
      installments.push({
        number: nDup || String(installments.length + 1),
        dueDate: dVenc,
        amountCents: Math.round(vDup * 100),
      });
    }
  });

  // Get access key from chNFe or infNFe Id attribute
  let accessKey = getTextContent('chNFe');
  if (!accessKey && infNFe) {
    const idAttr = infNFe.getAttribute('Id');
    if (idAttr) {
      accessKey = idAttr.replace(/^NFe/, '');
    }
  }

  return {
    accessKey,
    number: getTextContent('nNF', ide),
    series: getTextContent('serie', ide),
    issueDate: getTextContent('dhEmi', ide) || getTextContent('dEmi', ide),
    supplier: {
      cnpj: getTextContent('CNPJ', emit),
      name: getTextContent('xNome', emit) || getTextContent('xFant', emit),
      ie: getTextContent('IE', emit) || null,
    },
    totals: {
      products: Math.round(getNumber('vProd', total) * 100),
      freight: Math.round(getNumber('vFrete', total) * 100),
      discount: Math.round(getNumber('vDesc', total) * 100),
      taxes: Math.round((getNumber('vICMS', total) + getNumber('vIPI', total) + getNumber('vPIS', total) + getNumber('vCOFINS', total)) * 100),
      invoice: Math.round(getNumber('vNF', total) * 100),
    },
    items,
    installments,
  };
}

// ============================================================================
// SUPPLIER MAPPINGS
// ============================================================================

export function useSupplierProductMappings(supplierCnpj?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['supplier-product-mappings', profile?.organization_id, supplierCnpj],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('supplier_product_mappings')
        .select(`
          *,
          product:product_id (
            id,
            name
          )
        `)
        .eq('organization_id', profile.organization_id);

      if (supplierCnpj) {
        query = query.eq('supplier_cnpj', supplierCnpj);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}
