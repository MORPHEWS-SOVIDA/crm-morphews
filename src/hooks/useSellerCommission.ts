import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SellerCommission {
  userId: string;
  commissionPercentage: number;
}

export function useSellerCommission(userId?: string | null) {
  const { user, profile } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['seller-commission', targetUserId, profile?.organization_id],
    queryFn: async (): Promise<SellerCommission | null> => {
      if (!targetUserId || !profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, commission_percentage')
        .eq('user_id', targetUserId)
        .eq('organization_id', profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        userId: data.user_id,
        commissionPercentage: data.commission_percentage || 0,
      };
    },
    enabled: !!targetUserId && !!profile?.organization_id,
  });
}

export function useMyCommission() {
  const { user } = useAuth();
  return useSellerCommission(user?.id);
}

// Helper para calcular valor da comissão
export function calculateCommissionValue(
  saleValueCents: number,
  commissionPercentage: number
): number {
  return Math.round(saleValueCents * (commissionPercentage / 100));
}

// Helper para comparar comissão do kit com a padrão do vendedor
export type CommissionComparison = 'higher' | 'lower' | 'equal';

export function compareCommission(
  kitCommission: number | null,
  defaultCommission: number | null,
  useDefault: boolean
): CommissionComparison {
  if (useDefault || kitCommission === null) return 'equal';
  
  const defaultValue = defaultCommission || 0;
  
  if (kitCommission > defaultValue) return 'higher';
  if (kitCommission < defaultValue) return 'lower';
  return 'equal';
}
