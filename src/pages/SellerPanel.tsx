import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SellerDashboard } from '@/components/dashboard/SellerDashboard';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Eye, X } from 'lucide-react';

/**
 * Hook to get active sellers/members for the "view as" selector.
 * - Sales managers: see their associated team members
 * - Admins/owners: see ALL active members
 */
function useViewableMembers(isAdminOrOwner: boolean) {
  const { user } = useAuth();
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['viewable-members', tenantId, user?.id, isAdminOrOwner],
    queryFn: async () => {
      if (!tenantId || !user?.id) return [];

      let memberUserIds: string[] = [];

      if (isAdminOrOwner) {
        // Admins/owners can see all active members
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', tenantId)
          .eq('is_active', true);

        memberUserIds = (members || []).map(m => m.user_id).filter(id => id !== user.id);
      } else {
        // Sales managers see their associated team members
        const { data: associations } = await supabase
          .from('sales_manager_team_members')
          .select('team_member_user_id')
          .eq('organization_id', tenantId)
          .eq('manager_user_id', user.id);

        if (!associations?.length) return [];
        memberUserIds = associations.map(a => a.team_member_user_id);
      }

      if (memberUserIds.length === 0) return [];

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', memberUserIds);

      return (profiles || [])
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
  const { isAdmin } = useAuth();
  const { role } = useTenant();
  
  const isOwnerOrAdmin = isAdmin || role === 'owner' || role === 'admin';
  const isSalesManager = currentMember?.is_sales_manager === true;
  const canViewAs = isOwnerOrAdmin || isSalesManager;
  
  const { data: viewableMembers = [] } = useViewableMembers(isOwnerOrAdmin);
  
  const [viewAsUserId, setViewAsUserId] = useState<string | undefined>(undefined);
  
  const viewingSellerName = viewAsUserId 
    ? viewableMembers.find(s => s.user_id === viewAsUserId)?.name 
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
        {/* View-as banner - prominent bar at the top */}
        {canViewAs && viewableMembers.length > 0 && (
          <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border ${
            viewAsUserId 
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700' 
              : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span>Ver como:</span>
            </div>
            <Select 
              value={viewAsUserId || 'me'} 
              onValueChange={(val) => setViewAsUserId(val === 'me' ? undefined : val)}
            >
              <SelectTrigger className="w-full sm:w-[250px] bg-background">
                <SelectValue placeholder="Selecione um membro..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Meu Painel</SelectItem>
                {viewableMembers.map(member => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {viewAsUserId && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setViewAsUserId(undefined)}
                className="text-amber-700 dark:text-amber-300 hover:text-amber-900"
              >
                <X className="w-4 h-4 mr-1" />
                Voltar ao meu painel
              </Button>
            )}
          </div>
        )}

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

        <SellerDashboard viewAsUserId={viewAsUserId} />
      </div>
    </Layout>
  );
}
