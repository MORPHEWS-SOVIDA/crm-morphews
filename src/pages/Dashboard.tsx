import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StarsFilter } from '@/components/dashboard/StarsFilter';
import { FunnelVisualization } from '@/components/dashboard/FunnelVisualization';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { mockLeads } from '@/data/mockLeads';
import { FunnelStage, FUNNEL_STAGES } from '@/types/lead';

export default function Dashboard() {
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);

  const filteredLeads = useMemo(() => {
    let leads = [...mockLeads];
    
    if (selectedStars !== null) {
      leads = leads.filter((lead) => lead.stars === selectedStars);
    }
    
    if (selectedStage !== null) {
      leads = leads.filter((lead) => lead.stage === selectedStage);
    }
    
    return leads;
  }, [selectedStars, selectedStage]);

  const getTableTitle = () => {
    const parts: string[] = [];
    
    if (selectedStage) {
      parts.push(FUNNEL_STAGES[selectedStage].label);
    }
    
    if (selectedStars) {
      parts.push(`${selectedStars} estrela${selectedStars > 1 ? 's' : ''}`);
    }
    
    if (parts.length === 0) {
      return 'Todos os Leads';
    }
    
    return parts.join(' - ');
  };

  const hasFilters = selectedStars !== null || selectedStage !== null;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral dos seus leads e vendas
            </p>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setSelectedStars(null);
                setSelectedStage(null);
              }}
              className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Stats */}
        <StatsCards leads={mockLeads} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Funnel */}
          <div className="lg:col-span-5">
            <FunnelVisualization
              leads={mockLeads}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
            />
          </div>

          {/* Stars Filter */}
          <div className="lg:col-span-3">
            <StarsFilter
              leads={mockLeads}
              selectedStars={selectedStars}
              onSelectStars={setSelectedStars}
            />
          </div>

          {/* Calendar */}
          <div className="lg:col-span-4">
            <CalendarWidget />
          </div>
        </div>

        {/* Leads Table */}
        <LeadsTable leads={filteredLeads} title={getTableTitle()} />
      </div>
    </Layout>
  );
}
