import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { validateAuthCode } from '@/lib/auth-2fa';

export interface DiscountAuthorization {
  id: string;
  organization_id: string;
  sale_id: string | null;
  sale_item_id: string | null;
  product_id: string;
  seller_user_id: string;
  authorizer_user_id: string;
  minimum_price_cents: number;
  authorized_price_cents: number;
  discount_amount_cents: number;
  authorization_code: string;
  created_at: string;
}

export interface CreateAuthorizationData {
  product_id: string;
  authorizer_user_id: string;
  minimum_price_cents: number;
  authorized_price_cents: number;
  authorization_code: string;
  sale_id?: string;
  sale_item_id?: string;
}

export interface Manager {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

// Hook to get managers who can authorize discounts
export function useManagers() {
  return useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current user's organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      // Get managers (owner, admin, manager roles)
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', profile.organization_id)
        .in('role', ['owner', 'admin', 'manager']);

      if (membersError) throw membersError;

      if (!members || members.length === 0) return [];

      // Get profiles for these users
      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine data, excluding current user
      const managers: Manager[] = members
        .filter(m => m.user_id !== user.id)
        .map(m => {
          const p = profiles?.find(p => p.user_id === m.user_id);
          return {
            user_id: m.user_id,
            first_name: p?.first_name || 'Gerente',
            last_name: p?.last_name || '',
            role: m.role,
          };
        });

      return managers;
    },
  });
}

// Hook to validate and create authorization
export function useValidateAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      authorizerUserId,
      code,
      productId,
      minimumPriceCents,
      authorizedPriceCents,
    }: {
      authorizerUserId: string;
      code: string;
      productId: string;
      minimumPriceCents: number;
      authorizedPriceCents: number;
    }): Promise<{ success: boolean; authorizationId?: string; error?: string }> => {
      // Validate the code
      const isValid = validateAuthCode(authorizerUserId, code);
      if (!isValid) {
        return { success: false, error: 'Código inválido ou expirado' };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organization not found');

      const discountAmount = minimumPriceCents - authorizedPriceCents;

      // Create authorization record
      const { data, error } = await supabase
        .from('discount_authorizations')
        .insert({
          organization_id: profile.organization_id,
          product_id: productId,
          seller_user_id: user.id,
          authorizer_user_id: authorizerUserId,
          minimum_price_cents: minimumPriceCents,
          authorized_price_cents: authorizedPriceCents,
          discount_amount_cents: discountAmount,
          authorization_code: code.toUpperCase(),
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, authorizationId: data.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-authorizations'] });
    },
  });
}

// Hook to get authorizations (for reports/audit)
export function useDiscountAuthorizations() {
  return useQuery({
    queryKey: ['discount-authorizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_authorizations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as DiscountAuthorization[];
    },
  });
}

// Check if current user is a manager
export function useIsManager() {
  return useQuery({
    queryKey: ['is-manager'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) return false;

      const { data: member } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', profile.organization_id)
        .eq('user_id', user.id)
        .single();

      return member?.role && ['owner', 'admin', 'manager'].includes(member.role);
    },
  });
}
