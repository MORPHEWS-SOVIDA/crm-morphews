import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SellerDashboard } from '@/components/dashboard/SellerDashboard';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

/**
 * Hook to get team members associated to the current manager
 * Returns list of sellers this manager can "view as"
 */
function useManagerTeamSellers() {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['manager-team-sellers', tenantId, user?.id],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];

      // Get team member user IDs from sales_manager_team_members
      const { data: associations, error: assocError } = await supabase
        .from('sales_manager_team_members')
        .select('team_member_user_id')
        .eq('organization_id', tenantId)
        .eq('manager_user_id', user.id);

      if (assocError || !associations?.length) return [];

      const memberUserIds = associations.map(a => a.team_member_user_id);

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', memberUserIds);

      // Get active org members
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, is_active')
        .eq('organization_id', tenantId)
        .in('user_id', memberUserIds)
        .eq('is_active', true);

      const activeUserIds = new Set(members?.map(m => m.user_id) || []);

      return (profiles || [])
        .filter(p => activeUserIds.has(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Sem nome',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 60_000,
  });
}

export default function SellerPanel() {
  const { data: currentMember, isLoading } = useCurrentMember();
  const { user } = useAuth();
  const isSalesManager = currentMember?.is_sales_manager === true;
  
  const { data: teamSellers = [], isLoading: loadingSellers } = useManagerTeamSellers();
  
  // "me" = viewing own panel, otherwise the selected seller's user_id
  const [viewAsUserId, setViewAsUserId] = useState<string | undefined>(undefined);
  
  // The name to display when viewing as another seller
  const viewingSellerName = viewAsUserId 
    ? teamSellers.find(s => s.user_id === viewAsUserId)?.name 
    : null;

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              {viewingSellerName ? `Painel de ${viewingSellerName}` : 'Meu Painel'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              {viewingSellerName 
                ? 'Visualizando o painel como este vendedor' 
                : 'Acompanhe suas vendas, comissões e atividades'}
            </p>
          </div>
          
          {/* Seller selector for managers */}
          {isSalesManager && teamSellers.length > 0 && (
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <Select 
                value={viewAsUserId || 'me'} 
                onValueChange={(val) => setViewAsUserId(val === 'me' ? undefined : val)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Ver como..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">
                    Meu Painel
                  </SelectItem>
                  {teamSellers.map(seller => (
                    <SelectItem key={seller.user_id} value={seller.user_id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {viewAsUserId && (
                <Badge variant="secondary" className="whitespace-nowrap">
                  <Eye className="w-3 h-3 mr-1" />
                  Visualizando
                </Badge>
              )}
            </div>
          )}
        </div>

        <SellerDashboard viewAsUserId={viewAsUserId} />
      </div>
    </Layout>
  );
}
