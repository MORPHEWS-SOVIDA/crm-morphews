import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEcommerceOrganizationId } from './useEcommerceOrganizationId';

export interface AffiliateNetwork {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
  checkout_count?: number;
}

export interface NetworkMember {
  id: string;
  network_id: string;
  user_id: string;
  organization_id: string;
  affiliate_id: string | null;
  role: 'affiliate' | 'manager';
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  is_active: boolean;
  joined_at: string;
  invited_by: string | null;
  affiliate?: {
    id: string;
    name: string | null;
    email: string;
    affiliate_code: string | null;
  } | null;
  user?: {
    email: string;
  } | null;
}

export interface NetworkCheckout {
  id: string;
  network_id: string;
  checkout_id: string;
  organization_id: string;
  created_at: string;
  checkout?: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
  } | null;
}

export function useAffiliateNetworks() {
  const { data: organizationId, isLoading: isOrgLoading } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['affiliate-networks', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Fetch networks
      const { data: networks, error } = await supabase
        .from('affiliate_networks')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch member counts
      const { data: memberCounts } = await supabase
        .from('affiliate_network_members')
        .select('network_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Fetch checkout counts
      const { data: checkoutCounts } = await supabase
        .from('affiliate_network_checkouts')
        .select('network_id')
        .eq('organization_id', organizationId);

      // Calculate counts per network
      const memberCountMap = new Map<string, number>();
      const checkoutCountMap = new Map<string, number>();

      memberCounts?.forEach((m) => {
        memberCountMap.set(m.network_id, (memberCountMap.get(m.network_id) || 0) + 1);
      });

      checkoutCounts?.forEach((c) => {
        checkoutCountMap.set(c.network_id, (checkoutCountMap.get(c.network_id) || 0) + 1);
      });

      return networks.map((n) => ({
        ...n,
        member_count: memberCountMap.get(n.id) || 0,
        checkout_count: checkoutCountMap.get(n.id) || 0,
      })) as AffiliateNetwork[];
    },
    enabled: !!organizationId && !isOrgLoading,
  });
}

export function useNetworkMembers(networkId: string | null) {
  return useQuery({
    queryKey: ['network-members', networkId],
    queryFn: async () => {
      if (!networkId) return [];

      const { data, error } = await supabase
        .from('affiliate_network_members')
        .select(`
          *,
          affiliate:organization_affiliates(id, name, email, affiliate_code)
        `)
        .eq('network_id', networkId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      return data as unknown as NetworkMember[];
    },
    enabled: !!networkId,
  });
}

export function useNetworkCheckouts(networkId: string | null) {
  return useQuery({
    queryKey: ['network-checkouts', networkId],
    queryFn: async () => {
      if (!networkId) return [];

      const { data, error } = await supabase
        .from('affiliate_network_checkouts')
        .select(`
          *,
          checkout:standalone_checkouts(id, name, slug, is_active)
        `)
        .eq('network_id', networkId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as NetworkCheckout[];
    },
    enabled: !!networkId,
  });
}

export function useCreateNetwork() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; photo_url?: string }) => {
      if (!organizationId) throw new Error('Organization not found');

      const { data: network, error } = await supabase
        .from('affiliate_networks')
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description || null,
          photo_url: data.photo_url || null,
        })
        .select()
        .single();

      if (error) throw error;
      return network;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-networks'] });
    },
  });
}

export function useUpdateNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; name?: string; description?: string; photo_url?: string; is_active?: boolean }) => {
      const { id, ...updates } = data;
      const { data: network, error } = await supabase
        .from('affiliate_networks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return network;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-networks'] });
    },
  });
}

export function useDeleteNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (networkId: string) => {
      const { error } = await supabase
        .from('affiliate_networks')
        .delete()
        .eq('id', networkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-networks'] });
    },
  });
}

export function useAddCheckoutToNetwork() {
  const queryClient = useQueryClient();
  const { data: organizationId } = useEcommerceOrganizationId();

  return useMutation({
    mutationFn: async (data: { network_id: string; checkout_id: string }) => {
      if (!organizationId) throw new Error('Organization not found');

      const { error } = await supabase
        .from('affiliate_network_checkouts')
        .insert({
          network_id: data.network_id,
          checkout_id: data.checkout_id,
          organization_id: organizationId,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este checkout já está vinculado a esta rede');
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['network-checkouts', variables.network_id] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-networks'] });
    },
  });
}

export function useRemoveCheckoutFromNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { network_id: string; checkout_id: string }) => {
      const { error } = await supabase
        .from('affiliate_network_checkouts')
        .delete()
        .eq('network_id', data.network_id)
        .eq('checkout_id', data.checkout_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['network-checkouts', variables.network_id] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-networks'] });
    },
  });
}

export function useUpdateMemberCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { member_id: string; commission_type: 'percentage' | 'fixed'; commission_value: number }) => {
      const { error } = await supabase
        .from('affiliate_network_members')
        .update({
          commission_type: data.commission_type,
          commission_value: data.commission_value,
        })
        .eq('id', data.member_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-members'] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { member_id: string; role: 'affiliate' | 'manager' }) => {
      const { error } = await supabase
        .from('affiliate_network_members')
        .update({ role: data.role })
        .eq('id', data.member_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-members'] });
    },
  });
}

export function useRemoveMemberFromNetwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('affiliate_network_members')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-members'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-networks'] });
    },
  });
}

export function useAvailableCheckouts(networkId: string | null) {
  const { data: organizationId } = useEcommerceOrganizationId();

  return useQuery({
    queryKey: ['available-checkouts-for-network', networkId, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get all checkouts
      const { data: checkouts, error: checkoutsError } = await supabase
        .from('standalone_checkouts')
        .select('id, name, slug, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (checkoutsError) throw checkoutsError;

      if (!networkId) return checkouts || [];

      // Get checkouts already in this network
      const { data: linked, error: linkedError } = await supabase
        .from('affiliate_network_checkouts')
        .select('checkout_id')
        .eq('network_id', networkId);

      if (linkedError) throw linkedError;

      const linkedIds = new Set(linked?.map((l) => l.checkout_id) || []);
      return checkouts?.filter((c) => !linkedIds.has(c.id)) || [];
    },
    enabled: !!organizationId,
  });
}
