import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StarsFilter } from '@/components/dashboard/StarsFilter';
import { FunnelVisualization } from '@/components/dashboard/FunnelVisualization';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { MobileLeadsList } from '@/components/dashboard/MobileLeadsList';
import { MobileFilters } from '@/components/dashboard/MobileFilters';
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings';
import { ResponsavelFilter } from '@/components/dashboard/ResponsavelFilter';
import { OnboardingGuide } from '@/components/dashboard/OnboardingGuide';
import { useLeads } from '@/hooks/useLeads';
import { useIsMobile } from '@/hooks/use-mobile';
import { FunnelStage, FUNNEL_STAGES } from '@/types/lead';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { data: leads = [], isLoading, error } = useLeads();
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const isMobile = useIsMobile();

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
      parts.push(FUNNEL_STAGES[selectedStage].label);
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

  // Check if user has any stage updates (for onboarding)
  const hasStageUpdates = useMemo(() => {
    return leads.some(lead => lead.stage !== 'cloud' && lead.stage !== 'prospect');
  }, [leads]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

        {/* Main Grid - Desktop */}
        <div className="hidden lg:grid grid-cols-12 gap-6">
          {/* Funnel */}
          <div className="col-span-5">
            <FunnelVisualization
              leads={leads}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
            />
          </div>

          {/* Stars Filter */}
          <div className="col-span-2">
            <StarsFilter
              leads={leads}
              selectedStars={selectedStars}
              onSelectStars={setSelectedStars}
            />
          </div>

          {/* Responsavel Filter */}
          <div className="col-span-2">
            <ResponsavelFilter
              selectedResponsavel={selectedResponsavel}
              onSelectResponsavel={setSelectedResponsavel}
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
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
            />
            <UpcomingMeetings leads={leads} />
          </div>
        )}

        {/* Leads Table / List */}
        {isMobile ? (
          <MobileLeadsList leads={filteredLeads} title={getTableTitle()} />
        ) : (
          <LeadsTable leads={filteredLeads} title={getTableTitle()} />
        )}
      </div>
    </Layout>
  );
}
