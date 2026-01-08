import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

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

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Query for existing lead with same WhatsApp in the organization
  let query = supabase
    .from('leads')
    .select(`
      id, 
      name, 
      whatsapp,
      lead_responsibles!inner(user_id)
    `)
    .eq('whatsapp', normalizedPhone)
    .limit(1);

  // Exclude current lead if editing
  if (excludeLeadId) {
    query = query.neq('id', excludeLeadId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error checking lead ownership:', error);
    return null;
  }

  if (!data) return null;

  // Check if any responsible is NOT the current user
  const responsibles = data.lead_responsibles as { user_id: string }[];
  const isCurrentUserResponsible = responsibles.some(r => r.user_id === user.id);
  
  if (isCurrentUserResponsible) {
    // Current user already has access, no need to transfer
    return null;
  }

  // Get the primary responsible user info
  const primaryResponsible = responsibles[0];
  if (!primaryResponsible) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('user_id', primaryResponsible.user_id)
    .single();

  return {
    id: data.id,
    name: data.name,
    whatsapp: data.whatsapp,
    owner_user_id: primaryResponsible.user_id,
    owner_name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Usuário desconhecido',
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
      if (!user || !tenantId) throw new Error('Não autenticado');

      // Add new user as responsible
      const { error: responsibleError } = await supabase
        .from('lead_responsibles')
        .upsert({
          lead_id: leadId,
          user_id: toUserId,
          organization_id: tenantId,
        }, {
          onConflict: 'lead_id,user_id',
        });

      if (responsibleError) throw responsibleError;

      // Record the transfer
      const { error: transferError } = await supabase
        .from('lead_ownership_transfers')
        .insert({
          organization_id: tenantId,
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
    onError: (error: Error) => {
      toast.error('Erro ao transferir lead', { description: error.message });
    },
  });
}
