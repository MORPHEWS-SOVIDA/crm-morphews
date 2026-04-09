import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';

export type SerialLabelStatus = 'available' | 'in_stock' | 'assigned' | 'shipped' | 'delivered' | 'returned';

export interface SerialLabel {
  id: string;
  serial_code: string;
  status: SerialLabelStatus;
  organization_id: string;
  product_id: string | null;
  product_name: string | null;
  sale_id: string | null;
  sale_item_id: string | null;
  stock_movement_id: string | null;
  batch_label: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  stocked_at: string | null;
  stocked_by: string | null;
  shipped_at: string | null;
  shipped_by: string | null;
  returned_at: string | null;
  returned_by: string | null;
  return_reason: string | null;
  created_at: string;
  updated_at: string;
  lead_products?: { name: string } | null;
}

// Assign serial labels range to a product (stock entry)
export function useAssignSerialsToProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ 
      productId, 
      productName, 
      serialStart, 
      serialEnd, 
      prefix 
    }: { 
      productId: string; 
      productName: string; 
      serialStart: number; 
      serialEnd: number; 
      prefix: string;
    }) => {
      if (!orgId) throw new Error('Organização não encontrada');
      
      const now = new Date().toISOString();
      const records: any[] = [];
      
      for (let i = serialStart; i <= serialEnd; i++) {
        records.push({
          organization_id: orgId,
          serial_code: `${prefix}${String(i).padStart(5, '0')}`,
          product_id: productId,
          product_name: productName,
          status: 'in_stock',
          stocked_at: now,
          stocked_by: user?.id,
        });
      }

      // Upsert in batches — creates if not exists, updates if exists
      const BATCH_SIZE = 200;
      let total = 0;

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('product_serial_labels')
          .upsert(batch, { 
            onConflict: 'organization_id,serial_code',
            ignoreDuplicates: false 
          });

        if (error) throw error;
        total += batch.length;
      }

      return { updated: total, codes: records.map(r => r.serial_code) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['serial-labels'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`${result.updated} etiquetas associadas ao produto!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao associar etiquetas');
    },
  });
}

// Assign serial labels to a sale (expedition)
export function useAssignSerialsToSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      serialCode,
      saleId,
      saleItemId,
    }: {
      serialCode: string;
      saleId: string;
      saleItemId?: string;
    }) => {
      if (!orgId) throw new Error('Organização não encontrada');

      // Lookup the label
      const { data: label, error: lookupErr } = await supabase
        .from('product_serial_labels')
        .select('*')
        .eq('organization_id', orgId)
        .eq('serial_code', serialCode.toUpperCase())
        .maybeSingle();

      if (lookupErr) throw lookupErr;
      if (!label) throw new Error(`Etiqueta ${serialCode} não encontrada`);
      if (label.status !== 'in_stock') throw new Error(`Etiqueta ${serialCode} não está em estoque (status: ${label.status})`);

      const { data, error } = await supabase
        .from('product_serial_labels')
        .update({
          sale_id: saleId,
          sale_item_id: saleItemId || null,
          status: 'assigned' as any,
          assigned_at: new Date().toISOString(),
          assigned_by: user?.id,
        })
        .eq('id', label.id)
        .select('*, lead_products:product_id(name)')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-labels'] });
      queryClient.invalidateQueries({ queryKey: ['sale-serials'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Ship serial labels (mark as shipped)
export function useShipSerials() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ serialCodes }: { serialCodes: string[] }) => {
      if (!orgId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('product_serial_labels')
        .update({
          status: 'shipped' as any,
          shipped_at: new Date().toISOString(),
          shipped_by: user?.id,
        })
        .eq('organization_id', orgId)
        .in('serial_code', serialCodes)
        .eq('status', 'assigned' as any)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['serial-labels'] });
      queryClient.invalidateQueries({ queryKey: ['sale-serials'] });
      toast.success(`${data.length} etiquetas marcadas como enviadas`);
    },
  });
}

// Return serial label to stock
export function useReturnSerial() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ serialCode, reason }: { serialCode: string; reason?: string }) => {
      if (!orgId) throw new Error('Organização não encontrada');

      const { data: label, error: lookupErr } = await supabase
        .from('product_serial_labels')
        .select('*')
        .eq('organization_id', orgId)
        .eq('serial_code', serialCode.toUpperCase())
        .maybeSingle();

      if (lookupErr) throw lookupErr;
      if (!label) throw new Error(`Etiqueta ${serialCode} não encontrada`);
      if (!['assigned', 'shipped'].includes(label.status as string)) {
        throw new Error(`Etiqueta ${serialCode} não pode ser devolvida (status: ${label.status})`);
      }

      const { data, error } = await supabase
        .from('product_serial_labels')
        .update({
          status: 'in_stock' as any,
          returned_at: new Date().toISOString(),
          returned_by: user?.id,
          return_reason: reason || null,
          sale_id: null,
          sale_item_id: null,
          assigned_at: null,
          assigned_by: null,
          shipped_at: null,
          shipped_by: null,
        })
        .eq('id', label.id)
        .select('*, lead_products:product_id(name)')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-labels'] });
      queryClient.invalidateQueries({ queryKey: ['sale-serials'] });
      toast.success('Etiqueta devolvida ao estoque');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Get serial labels assigned to a sale
export function useSaleSerials(saleId: string | undefined) {
  const { data: orgId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['sale-serials', saleId],
    queryFn: async () => {
      if (!saleId || !orgId) return [];

      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', orgId)
        .eq('sale_id', saleId)
        .order('serial_code');

      if (error) throw error;
      return data as SerialLabel[];
    },
    enabled: !!saleId && !!orgId,
  });
}

// Get available serial count per product
export function useProductSerialCount(productId: string | undefined) {
  const { data: orgId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['serial-count', productId],
    queryFn: async () => {
      if (!productId || !orgId) return { in_stock: 0, assigned: 0, shipped: 0 };

      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('status')
        .eq('organization_id', orgId)
        .eq('product_id', productId);

      if (error) throw error;

      const counts = { in_stock: 0, assigned: 0, shipped: 0 };
      data?.forEach(row => {
        if (row.status in counts) counts[row.status as keyof typeof counts]++;
      });
      return counts;
    },
    enabled: !!productId && !!orgId,
  });
}
