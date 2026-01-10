import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-message';

export interface LeadOwnershipTransfer {
  id: string;
  organization_id: string;
  lead_id: string;
  from_user_id: string | null;
  to_user_id: string;
  transferred_by: string;
  transfer_reason: string;
  notes: string | null;
  created_at: string;
  // Joined fields
  from_user?: { first_name: string; last_name: string } | null;
  to_user?: { first_name: string; last_name: string };
  transferred_by_user?: { first_name: string; last_name: string };
}

export interface ExistingLeadWithOwner {
  id: string;
  name: string;
  whatsapp: string;
  owner_user_id: string;
  owner_name: string;
}

/**
 * Check if a WhatsApp number already exists for another user's lead
 * Returns the lead info with current owner if found
 * Uses SECURITY DEFINER function to bypass RLS for cross-permission searches
 */
export async function checkLeadExistsForOtherUser(
  whatsapp: string,
  excludeLeadId?: string
): Promise<ExistingLeadWithOwner | null> {
  if (!whatsapp || whatsapp.trim() === '') {
    return null;
  }

  // Normalize the phone number (remove non-digits)
  const normalizedPhone = whatsapp.replace(/\D/g, '');

  if (normalizedPhone.length < 8) {
    return null;
  }

  // Use SECURITY DEFINER function to check across all leads in the org
  const { data, error } = await supabase.rpc('find_lead_by_whatsapp', {
    p_whatsapp: normalizedPhone,
  });

  if (error) {
    console.error('Error checking lead ownership via RPC:', error);
    return null;
  }

  // RPC returns array, check first result
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || !result.lead_id) {
    return null;
  }

  // If current user is already responsible, no need to transfer
  if (result.is_current_user_responsible) {
    return null;
  }

  // If we're editing an existing lead, exclude it from the check
  if (excludeLeadId && result.lead_id === excludeLeadId) {
    return null;
  }

  return {
    id: result.lead_id,
    name: result.lead_name || 'Lead sem nome',
    whatsapp: result.lead_whatsapp,
    owner_user_id: result.owner_user_id,
    owner_name: result.owner_name || 'Usuário desconhecido',
  };
}

/**
 * Hook to get ownership transfer history for a lead
 */
export function useLeadOwnershipHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-ownership-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];

      const { data, error } = await supabase
        .from('lead_ownership_transfers')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ownership history:', error);
        throw error;
      }

      // Fetch user profiles for the transfers
      const userIds = new Set<string>();
      data.forEach(t => {
        if (t.from_user_id) userIds.add(t.from_user_id);
        userIds.add(t.to_user_id);
        userIds.add(t.transferred_by);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data.map(t => ({
        ...t,
        from_user: t.from_user_id ? profileMap.get(t.from_user_id) : null,
        to_user: profileMap.get(t.to_user_id),
        transferred_by_user: profileMap.get(t.transferred_by),
      })) as LeadOwnershipTransfer[];
    },
    enabled: !!leadId,
  });
}

/**
 * Hook to transfer/assume lead ownership
 */
export function useTransferLeadOwnership() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({
      leadId,
      toUserId,
      fromUserId,
      reason,
      notes,
    }: {
      leadId: string;
      toUserId: string;
      fromUserId?: string | null;
      reason: 'cadastro' | 'atendimento_whatsapp' | 'manual' | 'receptivo';
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Tenant can be briefly unavailable right after login; fall back to backend function.
      let orgId = tenantId;
      if (!orgId) {
        const { data: orgFromRpc, error: orgError } = await supabase.rpc('get_user_organization_id');
        if (orgError) throw orgError;
        orgId = orgFromRpc as unknown as string | null;
      }

      if (!orgId) throw new Error('Organização não encontrada');

      // 1. Add new user as responsible (upsert to avoid duplicates)
      const { error: responsibleError } = await supabase
        .from('lead_responsibles')
        .upsert(
          {
            lead_id: leadId,
            user_id: toUserId,
            organization_id: orgId,
          },
          {
            onConflict: 'lead_id,user_id',
          },
        );

      if (responsibleError) throw responsibleError;

      // 2. Update lead's primary assigned_to field so UI reflects the change
      const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({ assigned_to: toUserId })
        .eq('id', leadId);

      if (leadUpdateError) throw leadUpdateError;

      // 3. Record the transfer in history
      const { error: transferError } = await supabase
        .from('lead_ownership_transfers')
        .insert({
          organization_id: orgId,
          lead_id: leadId,
          from_user_id: fromUserId || null,
          to_user_id: toUserId,
          transferred_by: user.id,
          transfer_reason: reason,
          notes: notes || null,
        });

      if (transferError) throw transferError;

      return { leadId, toUserId };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-responsibles', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-ownership-history', leadId] });
      toast.success('Lead transferido com sucesso!');
    },
    onError: (error: unknown) => {
      toast.error('Erro ao transferir lead', { description: getErrorMessage(error) });
    },
  });
}

