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
  whatsapp_instance_id: string | null;
  message_template: string | null;
  media_type: 'image' | 'audio' | 'document' | null;
  media_url: string | null;
  media_filename: string | null;
  created_at: string;
  updated_at: string;
}

interface UpdateTrackingData {
  saleId: string;
  status: MotoboyTrackingStatus;
  notes?: string;
  assignedMotoboyId?: string | null;
  occurredAt?: string; // ISO date string for when the status change actually happened
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
      is_active,
      whatsapp_instance_id,
      message_template,
      media_type,
      media_url,
      media_filename,
    }: { 
      id: string; 
      label?: string; 
      webhook_url?: string | null;
      is_active?: boolean;
      whatsapp_instance_id?: string | null;
      message_template?: string | null;
      media_type?: 'image' | 'audio' | 'document' | null;
      media_url?: string | null;
      media_filename?: string | null;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (label !== undefined) updateData.label = label;
      if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (whatsapp_instance_id !== undefined) updateData.whatsapp_instance_id = whatsapp_instance_id;
      if (message_template !== undefined) updateData.message_template = message_template;
      if (media_type !== undefined) updateData.media_type = media_type;
      if (media_url !== undefined) updateData.media_url = media_url;
      if (media_filename !== undefined) updateData.media_filename = media_filename;
      
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
    mutationFn: async ({ saleId, status, notes, assignedMotoboyId, occurredAt }: UpdateTrackingData) => {
      // Get sale info including lead data for message variables
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select(`
          organization_id,
          lead_id,
          seller_user_id
        `)
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      // Get lead info separately
      let leadData: { name: string | null; whatsapp: string | null; product_name: string | null } = { 
        name: null, 
        whatsapp: null, 
        product_name: null 
      };
      if (sale.lead_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lead }: any = await (supabase as any)
          .from('leads')
          .select('name, whatsapp, lead_products(name)')
          .eq('id', sale.lead_id)
          .single();
        if (lead) {
          leadData = {
            name: lead.name,
            whatsapp: lead.whatsapp,
            product_name: (lead.lead_products as any)?.name || null,
          };
        }
      }

      // Get seller info
      let sellerName = '';
      if (sale.seller_user_id) {
        const { data: seller } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', sale.seller_user_id)
          .single();
        if (seller) {
          sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim();
        }
      }

      // Use provided occurredAt date or default to now
      const trackingDate = occurredAt || new Date().toISOString();

      // Insert tracking history entry
      const { error: insertError } = await supabase
        .from('sale_motoboy_tracking')
        .insert({
          sale_id: saleId,
          organization_id: sale.organization_id,
          status,
          changed_by: user?.id,
          notes,
          created_at: trackingDate, // Use custom date if provided
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

      // Check if there's a webhook or message configured for this status
      if (tenantId) {
        const { data: statusConfig } = await supabase
          .from('motoboy_tracking_statuses')
          .select('webhook_url, whatsapp_instance_id, message_template, media_type, media_url, media_filename')
          .eq('organization_id', tenantId)
          .eq('status_key', status)
          .single();

        // Send webhook in background (don't await)
        if (statusConfig?.webhook_url) {
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

        // Schedule automatic message if configured
        if (statusConfig?.message_template && statusConfig?.whatsapp_instance_id && sale.lead_id) {
          // Replace variables in message
          let finalMessage = statusConfig.message_template;
          const leadName = leadData.name || '';
          const firstName = leadName.split(' ')[0] || '';
          const productName = leadData.product_name || '';
          
          finalMessage = finalMessage
            .replace(/\{\{nome\}\}/g, leadName)
            .replace(/\{\{primeiro_nome\}\}/g, firstName)
            .replace(/\{\{vendedor\}\}/g, sellerName)
            .replace(/\{\{produto\}\}/g, productName);

          // Create scheduled message (immediate send)
          const { error: messageError } = await supabase
            .from('lead_scheduled_messages')
            .insert({
              lead_id: sale.lead_id!,
              organization_id: sale.organization_id,
              created_by: user?.id || null,
              whatsapp_instance_id: statusConfig.whatsapp_instance_id,
              final_message: finalMessage,
              scheduled_at: new Date().toISOString(),
              status: 'pending' as const,
              media_type: statusConfig.media_type || null,
              media_url: statusConfig.media_url || null,
              media_filename: statusConfig.media_filename || null,
            } as any);

          if (messageError) {
            console.error('Error scheduling tracking message:', messageError);
          }
        }
      }

      return { saleId, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['motoboy-tracking-history', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['sale', data.saleId] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
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
