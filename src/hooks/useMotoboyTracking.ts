import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import type { Database } from '@/integrations/supabase/types';

export type MotoboyTrackingStatus = Database['public']['Enums']['motoboy_tracking_status'];

export interface MotoboyTrackingEntry {
  id: string;
  sale_id: string;
  organization_id: string;
  status: MotoboyTrackingStatus;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
  changed_by_profile?: {
    first_name: string | null;
    last_name: string | null;
  };
}

export interface MotoboyTrackingStatusConfig {
  id: string;
  organization_id: string;
  status_key: string;
  label: string;
  webhook_url: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpdateTrackingData {
  saleId: string;
  status: MotoboyTrackingStatus;
  notes?: string;
  assignedMotoboyId?: string | null;
}

// Default labels for statuses
export const motoboyTrackingLabels: Record<MotoboyTrackingStatus, string> = {
  waiting_expedition: 'Aguardando expedição fechar pedido',
  expedition_ready: 'Expedição com pedido pronto',
  handed_to_motoboy: 'Pedido entregue ao motoboy',
  with_motoboy: 'Pedido já com motoboy',
  next_delivery: 'Próxima entrega',
  special_delay: 'Atraso por motivo especial do motoboy',
  call_motoboy: 'Ligar para motoboy',
  delivered: 'Entregue',
  returned: 'Voltou',
};

export const motoboyTrackingOrder: MotoboyTrackingStatus[] = [
  'waiting_expedition',
  'expedition_ready',
  'handed_to_motoboy',
  'with_motoboy',
  'next_delivery',
  'special_delay',
  'call_motoboy',
  'delivered',
  'returned',
];

// Hook to fetch motoboy tracking statuses configuration for current tenant
export function useMotoboyTrackingStatuses() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['motoboy-tracking-statuses', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('motoboy_tracking_statuses')
        .select('*')
        .eq('organization_id', tenantId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as MotoboyTrackingStatusConfig[];
    },
    enabled: !!tenantId,
  });
}

// Hook to update motoboy tracking status configuration
export function useUpdateMotoboyTrackingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      label, 
      webhook_url, 
      is_active 
    }: { 
      id: string; 
      label?: string; 
      webhook_url?: string | null;
      is_active?: boolean;
    }) => {
      const updateData: Partial<MotoboyTrackingStatusConfig> = {};
      if (label !== undefined) updateData.label = label;
      if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
      if (is_active !== undefined) updateData.is_active = is_active;
      
      const { error } = await supabase
        .from('motoboy_tracking_statuses')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motoboy-tracking-statuses'] });
    },
  });
}

// Hook to get tracking history for a sale
export function useMotoboyTrackingHistory(saleId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['motoboy-tracking-history', saleId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await supabase
        .from('sale_motoboy_tracking')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for changed_by users
      const userIds = [...new Set((data || []).map(c => c.changed_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
          return acc;
        }, {} as typeof profilesMap);
      }

      return (data || []).map(c => ({
        ...c,
        changed_by_profile: c.changed_by ? profilesMap[c.changed_by] : undefined,
      })) as MotoboyTrackingEntry[];
    },
    enabled: !!saleId && !!user,
  });
}

// Hook to update motoboy tracking for a sale
export function useUpdateMotoboyTracking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ saleId, status, notes, assignedMotoboyId }: UpdateTrackingData) => {
      // Get organization_id from sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('organization_id')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Insert tracking history entry
      const { error: insertError } = await supabase
        .from('sale_motoboy_tracking')
        .insert({
          sale_id: saleId,
          organization_id: sale.organization_id,
          status,
          changed_by: user?.id,
          notes,
        });

      if (insertError) throw insertError;

      // Update current status on sales table (and optionally assigned motoboy)
      const updateData: Record<string, unknown> = { motoboy_tracking_status: status };
      if (assignedMotoboyId !== undefined) {
        updateData.assigned_delivery_user_id = assignedMotoboyId;
      }
      
      const { error: updateError } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', saleId);

      if (updateError) throw updateError;

      // Check if there's a webhook configured for this status
      if (tenantId) {
        const { data: statusConfig } = await supabase
          .from('motoboy_tracking_statuses')
          .select('webhook_url')
          .eq('organization_id', tenantId)
          .eq('status_key', status)
          .single();

        if (statusConfig?.webhook_url) {
          // Send webhook in background (don't await)
          fetch(statusConfig.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sale_id: saleId,
              status,
              notes,
              changed_by: user?.id,
              timestamp: new Date().toISOString(),
            }),
          }).catch(console.error);
        }
      }

      return { saleId, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['motoboy-tracking-history', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    },
  });
}

// Helper to get label for a status, using tenant config if available
export function getMotoboyStatusLabel(
  status: MotoboyTrackingStatus, 
  statuses?: MotoboyTrackingStatusConfig[]
): string {
  if (statuses) {
    const config = statuses.find(s => s.status_key === status);
    if (config) return config.label;
  }
  return motoboyTrackingLabels[status] || status;
}
