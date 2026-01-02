import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StarsFilter } from '@/components/dashboard/StarsFilter';
import { FunnelVisualization } from '@/components/dashboard/FunnelVisualization';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { MobileLeadsList } from '@/components/dashboard/MobileLeadsList';
import { MobileFilters } from '@/components/dashboard/MobileFilters';
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings';
import { ResponsavelFilter } from '@/components/dashboard/ResponsavelFilter';
import { OnboardingGuide } from '@/components/dashboard/OnboardingGuide';
import { useLeads } from '@/hooks/useLeads';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { FunnelStage, FUNNEL_STAGES } from '@/types/lead';
import { Loader2, Filter, Kanban, Truck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: stages = [], isLoading: loadingStages } = useFunnelStages();
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'funnel' | 'kanban'>('funnel');
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Check if user can see leads
  const canSeeLeads = isAdmin || permissions?.leads_view;
  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;

  const responsaveis = useMemo(() => {
    const uniqueResponsaveis = [...new Set(leads.map(lead => lead.assigned_to))];
    return uniqueResponsaveis.filter(Boolean);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];
    
    if (selectedStars !== null) {
      filtered = filtered.filter((lead) => lead.stars === selectedStars);
    }
    
    if (selectedStage !== null) {
      filtered = filtered.filter((lead) => lead.stage === selectedStage);
    }

    if (selectedResponsavel !== null) {
      filtered = filtered.filter((lead) => lead.assigned_to === selectedResponsavel);
    }
    
    return filtered;
  }, [leads, selectedStars, selectedStage, selectedResponsavel]);

  const getTableTitle = () => {
    const parts: string[] = [];
    
    if (selectedStage) {
      const customStage = stages.find(s => {
        const positionToEnum: Record<number, string> = {
          0: 'cloud', 1: 'prospect', 2: 'contacted', 3: 'convincing',
          4: 'scheduled', 5: 'positive', 6: 'waiting_payment', 7: 'success', 8: 'trash',
        };
        return positionToEnum[s.position] === selectedStage;
      });
      parts.push(customStage?.name || FUNNEL_STAGES[selectedStage].label);
    }
    
    if (selectedStars) {
      parts.push(`${selectedStars} estrela${selectedStars > 1 ? 's' : ''}`);
    }

    if (selectedResponsavel) {
      parts.push(selectedResponsavel);
    }
    
    if (parts.length === 0) {
      return 'Todos os Leads';
    }
    
    return parts.join(' - ');
  };

  const hasFilters = selectedStars !== null || selectedStage !== null || selectedResponsavel !== null;

  const hasStageUpdates = useMemo(() => {
    return leads.some(lead => lead.stage !== 'cloud' && lead.stage !== 'prospect');
  }, [leads]);

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
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
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
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
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
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Visão geral dos seus leads e vendas
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'funnel' | 'kanban')}>
              <TabsList className="h-9">
                <TabsTrigger value="funnel" className="text-xs px-3">
                  <Filter className="w-4 h-4 mr-1.5" />
                  Funil
                </TabsTrigger>
                <TabsTrigger value="kanban" className="text-xs px-3">
                  <Kanban className="w-4 h-4 mr-1.5" />
                  Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>

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
                }}
                className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Onboarding Guide - Shows for new users */}
        <OnboardingGuide leadsCount={leads.length} hasStageUpdates={hasStageUpdates} />

        {/* Stats */}
        <StatsCards leads={leads} />

        {/* View Mode Content */}
        {viewMode === 'kanban' ? (
          /* Kanban View */
          <div className="bg-card rounded-xl p-4 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Kanban</h3>
              {!isMobile && (
                <div className="flex items-center gap-4">
                  <StarsFilter
                    leads={leads}
                    selectedStars={selectedStars}
                    onSelectStars={setSelectedStars}
                    compact
                  />
                  <ResponsavelFilter
                    selectedResponsavel={selectedResponsavel}
                    onSelectResponsavel={setSelectedResponsavel}
                    compact
                  />
                </div>
              )}
            </div>
            <KanbanBoard
              leads={leads}
              stages={stages}
              selectedStars={selectedStars}
              selectedResponsavel={selectedResponsavel}
            />
          </div>
        ) : (
          /* Funnel View */
          <>
            {/* Main Grid - Desktop */}
            <div className="hidden lg:grid grid-cols-12 gap-6">
              {/* Funnel */}
              <div className="col-span-5">
                <FunnelVisualization
                  leads={leads}
                  stages={stages}
                  selectedStage={selectedStage}
                  onSelectStage={setSelectedStage}
                  onSwitchToKanban={() => setViewMode('kanban')}
                />
              </div>

              {/* Stars Filter */}
              <div className="col-span-4">
                <StarsFilter
                  leads={leads}
                  selectedStars={selectedStars}
                  onSelectStars={setSelectedStars}
                />
              </div>

              {/* Upcoming Meetings */}
              <div className="col-span-3">
                <UpcomingMeetings leads={leads} />
              </div>
            </div>

            {/* Mobile Funnel & Meetings */}
            {isMobile && (
              <div className="space-y-4">
                <FunnelVisualization
                  leads={leads}
                  stages={stages}
                  selectedStage={selectedStage}
                  onSelectStage={setSelectedStage}
                  onSwitchToKanban={() => setViewMode('kanban')}
                />
                <UpcomingMeetings leads={leads} />
              </div>
            )}

            {/* Leads Table / List */}
            {isMobile ? (
              <MobileLeadsList leads={filteredLeads} title={getTableTitle()} />
            ) : (
              <LeadsTable 
                leads={filteredLeads} 
                title={getTableTitle()}
                headerRight={
                  <ResponsavelFilter
                    selectedResponsavel={selectedResponsavel}
                    onSelectResponsavel={setSelectedResponsavel}
                    compact
                  />
                }
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
