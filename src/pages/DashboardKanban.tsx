import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StarsFilter } from '@/components/dashboard/StarsFilter';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { MobileFilters } from '@/components/dashboard/MobileFilters';
import { ResponsavelFilter } from '@/components/dashboard/ResponsavelFilter';
import { SellerMultiSelect } from '@/components/dashboard/SellerMultiSelect';
import { ManagerFilter } from '@/components/dashboard/ManagerFilter';
import { InactivityFilter } from '@/components/dashboard/InactivityFilter';
import { useLeads } from '@/hooks/useLeads';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { FunnelStage, Lead } from '@/types/lead';
import { Loader2, Columns3, Truck, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { normalizeText } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function DashboardKanban() {
  const { isAdmin, profile } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: stages = [], isLoading: loadingStages } = useFunnelStages();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: currentMember } = useCurrentMember();
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [selectedInactivityDays, setSelectedInactivityDays] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasAutoSelectedSellers, setHasAutoSelectedSellers] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Auto-select team members for sales managers when they access the page
  useEffect(() => {
    if (currentMember && teamMembers.length > 0 && !hasAutoSelectedSellers) {
      // If user is a sales manager and has a team, pre-select their team members
      if (currentMember.is_sales_manager && currentMember.team_id) {
        const teamMemberIds = teamMembers
          .filter(m => m.team_id === currentMember.team_id)
          .map(m => m.user_id);
        setSelectedSellers(teamMemberIds);
      }
      // Even if not a manager, if user has a team, pre-select team members (optional behavior)
      else if (currentMember.team_id && !isAdmin) {
        const teamMemberIds = teamMembers
          .filter(m => m.team_id === currentMember.team_id)
          .map(m => m.user_id);
        setSelectedSellers(teamMemberIds);
      }
      setHasAutoSelectedSellers(true);
    }
  }, [currentMember, teamMembers, hasAutoSelectedSellers, isAdmin]);

  const canSeeLeads = isAdmin || permissions?.leads_view;
  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;
  
  // Check if user can see all leads (not restricted to only own)
  const canSeeAllLeads = permissions?.leads_view && !permissions?.leads_view_only_own;
  const showAdvancedFilters = isAdmin || canSeeAllLeads;

  const responsaveis = useMemo(() => {
    const uniqueResponsaveis = [...new Set(leads.map(lead => lead.assigned_to))];
    return uniqueResponsaveis.filter(Boolean);
  }, [leads]);

  const normalizeAssignee = (value: string) => {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Filter leads by selected sellers
  const filteredLeads = useMemo(() => {
    let result = [...leads];
    
    console.log('[DashboardKanban] Filtering - selectedSellers:', selectedSellers, 'totalLeads:', leads.length, 'selectedManager:', selectedManager);
    
    // Se um gerente está selecionado e ele não tem vendedores associados,
    // o resultado deve ser vazio (senão o filtro parece "não funcionar").
    if (selectedManager && selectedSellers.length === 0) {
      console.log('[DashboardKanban] Manager selected but no sellers - returning empty');
      return [];
    }

    // Filter by selected sellers (supports both user_id and full_name in assigned_to)
    if (selectedSellers.length > 0) {
      const selectedSellerIds = new Set(selectedSellers);

      // Get full names for selected user IDs to support legacy data
      // Usar full_name_normalized para comparação caso exista
      const selectedSellerNamesMap = new Map<string, string>();
      teamMembers.forEach(m => {
        if (selectedSellerIds.has(m.user_id)) {
          const normalized = (m as any).full_name_normalized || normalizeAssignee(m.full_name);
          selectedSellerNamesMap.set(normalized, m.full_name);
        }
      });

      const selectedSellerNamesNormalized = new Set(selectedSellerNamesMap.keys());

      console.log('[DashboardKanban] selectedSellersIds:', [...selectedSellerIds], 'selectedSellerNamesNormalized:', [...selectedSellerNamesNormalized]);

      result = result.filter((lead) => {
        const assigned = lead.assigned_to || '';
        if (!assigned) return false;

        // 1. Match direto por UUID (novo fluxo)
        if (selectedSellerIds.has(assigned)) return true;

        // 2. Match por nome normalizado (dados legados)
        const assignedNormalized = normalizeAssignee(assigned);
        if (selectedSellerNamesNormalized.has(assignedNormalized)) return true;

        // 3. Match parcial - verifica se algum nome normalizado está contido ou contém o assigned
        for (const name of selectedSellerNamesNormalized) {
          if (assignedNormalized.includes(name) || name.includes(assignedNormalized)) {
            return true;
          }
        }

        return false;
      });

      console.log('[DashboardKanban] After filtering:', result.length, 'leads');
    }
    
    // Filter by search term (lead name)
    if (searchTerm.trim().length >= 2) {
      const normalized = normalizeText(searchTerm.trim());
      result = result.filter(lead => normalizeText(lead.name || '').includes(normalized));
    }

    // Filter by inactivity (days without update)
    if (selectedInactivityDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - selectedInactivityDays);
      result = result.filter(lead => {
        const lastUpdate = new Date(lead.updated_at);
        return lastUpdate < cutoffDate;
      });
    }
    
    return result;
  }, [leads, selectedSellers, selectedInactivityDays, teamMembers, selectedManager, searchTerm]);

  const hasFilters = selectedStars !== null || selectedStage !== null || selectedResponsavel !== null || selectedSellers.length > 0 || selectedManager !== null || selectedInactivityDays !== null || searchTerm.trim().length > 0;

  // Handler para seleção de gerente - atualiza vendedores automaticamente
  const handleManagerSelect = (managerId: string | null, memberIds: string[]) => {
    console.log('[DashboardKanban] handleManagerSelect - managerId:', managerId, 'memberIds:', memberIds);
    setSelectedManager(managerId);
    if (managerId) {
      // Quando seleciona gerente, define os vendedores associados
      console.log('[DashboardKanban] Setting selectedSellers to:', memberIds);
      setSelectedSellers(memberIds);
    } else {
      // Quando limpa o gerente, limpa também os vendedores
      setSelectedSellers([]);
    }
  };

  if (isLoading || loadingStages || permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // If user only has delivery permissions, show simplified dashboard
  if (!canSeeLeads && canSeeDeliveries) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard Kanban</h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Bem-vindo! Acesse suas entregas abaixo.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Minhas Entregas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Visualize e gerencie as entregas atribuídas a você.
              </p>
              <Button onClick={() => navigate('/minhas-entregas')}>
                Ver Minhas Entregas
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // If user has no relevant permissions at all
  if (!canSeeLeads && !canSeeDeliveries) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard Kanban</h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Bem-vindo ao sistema!
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                Você ainda não tem permissões atribuídas. Entre em contato com o administrador da sua organização.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-destructive mb-2">Erro ao carregar leads</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Columns3 className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard Kanban</h1>
              <p className="text-muted-foreground mt-1 text-sm lg:text-base">
                Visualize leads por etapa do funil
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile Filters */}
            {isMobile && (
              <MobileFilters
                selectedStars={selectedStars}
                selectedStage={selectedStage}
                selectedResponsavel={selectedResponsavel}
                onSelectStars={setSelectedStars}
                onSelectStage={setSelectedStage}
                onSelectResponsavel={setSelectedResponsavel}
                responsaveis={responsaveis}
              />
            )}
            {hasFilters && (
              <button
                onClick={() => {
                  setSelectedStars(null);
                  setSelectedStage(null);
                  setSelectedResponsavel(null);
                  setSelectedSellers([]);
                  setSelectedManager(null);
                  setSelectedInactivityDays(null);
                  setSearchTerm('');
                }}
                className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Stats - use filteredLeads to reflect active filters */}
        <StatsCards leads={filteredLeads} />

        {/* Kanban View */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Kanban</h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar lead por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 h-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {!isMobile && (
                <div className="flex items-center gap-2 flex-wrap">
                  <StarsFilter
                    leads={filteredLeads}
                    selectedStars={selectedStars}
                    onSelectStars={setSelectedStars}
                    compact
                  />
                  <ResponsavelFilter
                    selectedResponsavel={selectedResponsavel}
                    onSelectResponsavel={setSelectedResponsavel}
                    compact
                  />
                  {showAdvancedFilters && (
                    <>
                      <ManagerFilter
                        selectedManager={selectedManager}
                        onSelectManager={handleManagerSelect}
                        compact
                      />
                      <SellerMultiSelect
                        selectedSellers={selectedSellers}
                        onSelectSellers={(sellers) => {
                          setSelectedSellers(sellers);
                          // Se o usuário mudar vendedores manualmente, limpa o gerente selecionado
                          if (selectedManager && sellers.length === 0) {
                            setSelectedManager(null);
                          }
                        }}
                        compact
                      />
                      <InactivityFilter
                        selectedDays={selectedInactivityDays}
                        onSelectDays={setSelectedInactivityDays}
                        compact
                      />
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Show filter indicators */}
            {(selectedManager || selectedSellers.length > 0 || selectedInactivityDays) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {selectedManager && (
                  <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded flex items-center gap-1">
                    👑 Gerente selecionado
                  </span>
                )}
                {selectedSellers.length > 0 && (
                  <span className="bg-muted px-2 py-1 rounded">
                    {selectedSellers.length} membro(s) selecionado(s)
                  </span>
                )}
                {selectedInactivityDays && (
                  <span className="bg-warning/20 text-warning-foreground px-2 py-1 rounded">
                    Sem movimentação há {selectedInactivityDays} dias
                  </span>
                )}
              </div>
            )}
          </div>
          <KanbanBoard
            leads={filteredLeads}
            stages={stages}
            selectedStars={selectedStars}
            selectedResponsavel={selectedResponsavel}
          />
        </div>
      </div>
    </Layout>
  );
}
