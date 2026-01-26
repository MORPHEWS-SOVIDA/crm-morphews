import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StarsFilter } from '@/components/dashboard/StarsFilter';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { MobileFilters } from '@/components/dashboard/MobileFilters';
import { ResponsavelFilter } from '@/components/dashboard/ResponsavelFilter';
import { TeamFilter } from '@/components/dashboard/TeamFilter';
import { InactivityFilter } from '@/components/dashboard/InactivityFilter';
import { useLeads } from '@/hooks/useLeads';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { FunnelStage, Lead } from '@/types/lead';
import { Loader2, Columns3, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function DashboardKanban() {
  const { isAdmin, profile } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: stages = [], isLoading: loadingStages } = useFunnelStages();
  const { data: teamMembers = [] } = useTeamMembers();
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedInactivityDays, setSelectedInactivityDays] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const canSeeLeads = isAdmin || permissions?.leads_view;
  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;
  
  // Check if user can see all leads (not restricted to only own)
  const canSeeAllLeads = permissions?.leads_view && !permissions?.leads_view_only_own;
  const showAdvancedFilters = isAdmin || canSeeAllLeads;

  const responsaveis = useMemo(() => {
    const uniqueResponsaveis = [...new Set(leads.map(lead => lead.assigned_to))];
    return uniqueResponsaveis.filter(Boolean);
  }, [leads]);

  // Filter leads by team (using teamMembers to find which seller belongs to which team)
  const filteredLeads = useMemo(() => {
    let result = [...leads];
    
    // Filter by team - compare by user_id since assigned_to stores user_id
    if (selectedTeam) {
      const teamUserIds = teamMembers
        .filter(m => m.team_id === selectedTeam)
        .map(m => m.user_id);
      result = result.filter(lead => teamUserIds.includes(lead.assigned_to || ''));
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
  }, [leads, selectedTeam, selectedInactivityDays, teamMembers]);

  const hasFilters = selectedStars !== null || selectedStage !== null || selectedResponsavel !== null || selectedTeam !== null || selectedInactivityDays !== null;

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
                  setSelectedTeam(null);
                  setSelectedInactivityDays(null);
                }}
                className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <StatsCards leads={leads} />

        {/* Kanban View */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Kanban</h3>
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
                      <TeamFilter
                        selectedTeam={selectedTeam}
                        onSelectTeam={setSelectedTeam}
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
            {(selectedTeam || selectedInactivityDays) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedTeam && (
                  <span className="bg-muted px-2 py-1 rounded">
                    Filtro Time ativo
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
