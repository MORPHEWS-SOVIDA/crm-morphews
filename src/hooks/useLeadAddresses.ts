import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadAddress {
  id: string;
  lead_id: string;
  organization_id: string;
  label: string;
  is_primary: boolean;
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  google_maps_link: string | null;
  delivery_notes: string | null;
  delivery_region_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressData {
  lead_id: string;
  label: string;
  is_primary?: boolean;
  cep?: string;
  street?: string;
  street_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  google_maps_link?: string;
  delivery_notes?: string;
  delivery_region_id?: string;
}

export interface UpdateAddressData extends Partial<Omit<CreateAddressData, 'lead_id'>> {
  id: string;
}

export function useLeadAddresses(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-addresses', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('lead_addresses')
        .select('*')
        .eq('lead_id', leadId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as LeadAddress[];
    },
    enabled: !!leadId,
  });
}

export function useCreateLeadAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAddressData) => {
      // Get organization_id
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!membership) throw new Error('No organization found');

      // If this is marked as primary, unset other primary addresses
      if (data.is_primary) {
        await supabase
          .from('lead_addresses')
          .update({ is_primary: false })
          .eq('lead_id', data.lead_id);
      }

      const { data: address, error } = await supabase
        .from('lead_addresses')
        .insert({
          ...data,
          organization_id: membership.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return address;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', variables.lead_id] });
      toast.success('Endereço adicionado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating address:', error);
      toast.error('Erro ao adicionar endereço');
    },
  });
}

export function useUpdateLeadAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateAddressData) => {
      // If setting as primary, first get the lead_id
      if (data.is_primary) {
        const { data: currentAddress } = await supabase
          .from('lead_addresses')
          .select('lead_id')
          .eq('id', id)
          .single();

        if (currentAddress) {
          await supabase
            .from('lead_addresses')
            .update({ is_primary: false })
            .eq('lead_id', currentAddress.lead_id);
        }
      }

      const { data: address, error } = await supabase
        .from('lead_addresses')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return address;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', data.lead_id] });
      toast.success('Endereço atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Error updating address:', error);
      toast.error('Erro ao atualizar endereço');
    },
  });
}

export function useDeleteLeadAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('lead_addresses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', data.leadId] });
      toast.success('Endereço removido com sucesso');
    },
    onError: (error) => {
      console.error('Error deleting address:', error);
      toast.error('Erro ao remover endereço');
    },
  });
}

export function useSetPrimaryAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      // Unset all primary first
      await supabase
        .from('lead_addresses')
        .update({ is_primary: false })
        .eq('lead_id', leadId);

      // Set this one as primary
      const { error } = await supabase
        .from('lead_addresses')
        .update({ is_primary: true })
        .eq('id', id);

      if (error) throw error;
      return { leadId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', data.leadId] });
      toast.success('Endereço principal atualizado');
    },
    onError: (error) => {
      console.error('Error setting primary address:', error);
      toast.error('Erro ao definir endereço principal');
    },
  });
}
