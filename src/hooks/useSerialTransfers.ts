import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface SerialLabelTransfer {
  id: string;
  organization_id: string;
  from_location_id: string | null;
  to_location_id: string;
  serial_codes: string[];
  serial_count: number;
  notes: string | null;
  transferred_by: string | null;
  created_at: string;
  from_location?: { name: string; code: string | null } | null;
  to_location?: { name: string; code: string | null } | null;
}

export function useSerialTransfers() {
  const { data: orgId } = useCurrentTenantId();
  return useQuery({
    queryKey: ['serial-transfers', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('serial_label_transfers')
        .select('*, from_location:from_location_id(name, code), to_location:to_location_id(name, code)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any as SerialLabelTransfer[];
    },
    enabled: !!orgId,
  });
}

export function useTransferSerials() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orgId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      toLocationId,
      serialCodes,
      notes,
    }: {
      toLocationId: string;
      serialCodes: string[];
      notes?: string;
    }) => {
      if (!orgId) throw new Error('Organização não encontrada');
      if (!toLocationId) throw new Error('Selecione o local de destino');
      if (!serialCodes.length) throw new Error('Informe pelo menos uma etiqueta');

      const codes = Array.from(new Set(serialCodes.map(c => c.trim().toUpperCase()).filter(Boolean)));

      // Validate all exist + capture current location
      const { data: existing, error: lookErr } = await supabase
        .from('product_serial_labels')
        .select('id, serial_code, stock_location_id, status')
        .eq('organization_id', orgId)
        .in('serial_code', codes);
      if (lookErr) throw lookErr;

      const found = new Set((existing || []).map(r => r.serial_code));
      const missing = codes.filter(c => !found.has(c));
      if (missing.length) throw new Error(`Etiquetas não encontradas: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);

      const blocked = (existing || []).filter(r => r.status === 'shipped' || r.status === 'delivered');
      if (blocked.length) throw new Error(`Etiquetas já enviadas/entregues não podem ser transferidas: ${blocked.slice(0, 5).map(b => b.serial_code).join(', ')}`);

      // Group by current location to log "from"
      const fromLocations = Array.from(new Set((existing || []).map(r => r.stock_location_id).filter(Boolean))) as string[];
      const fromLocationId = fromLocations.length === 1 ? fromLocations[0] : null;

      // Update in batches
      const BATCH = 200;
      let updated = 0;
      for (let i = 0; i < codes.length; i += BATCH) {
        const slice = codes.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from('product_serial_labels')
          .update({ stock_location_id: toLocationId })
          .eq('organization_id', orgId)
          .in('serial_code', slice)
          .select('id');
        if (error) throw error;
        updated += data?.length || 0;
      }

      const { error: logErr } = await supabase
        .from('serial_label_transfers')
        .insert({
          organization_id: orgId,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          serial_codes: codes,
          serial_count: codes.length,
          notes: notes || null,
          transferred_by: user?.id || null,
        });
      if (logErr) throw logErr;

      return { updated, count: codes.length };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['serial-labels'] });
      queryClient.invalidateQueries({ queryKey: ['serial-transfers'] });
      toast.success(`${r.updated} etiqueta(s) transferida(s) com sucesso!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
