import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { MobileLeadsList } from '@/components/dashboard/MobileLeadsList';
import { MobileFilters } from '@/components/dashboard/MobileFilters';
import { useLeads } from '@/hooks/useLeads';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';

export default function LeadsList() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading, error } = useLeads();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [starsFilter, setStarsFilter] = useState<string>('all');
  const [responsavelFilter, setResponsavelFilter] = useState<string | null>(null);

  const responsaveis = useMemo(() => {
    const uniqueResponsaveis = [...new Set(leads.map(lead => lead.assigned_to))];
    return uniqueResponsaveis.filter(Boolean);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(searchLower) ||
          lead.specialty?.toLowerCase().includes(searchLower) ||
          lead.instagram.toLowerCase().includes(searchLower) ||
          (lead.email && lead.email.toLowerCase().includes(searchLower))
      );
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.stage === stageFilter);
    }

    if (starsFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.stars === parseInt(starsFilter));
    }

    if (responsavelFilter) {
      filtered = filtered.filter((lead) => lead.assigned_to === responsavelFilter);
    }

    return filtered;
  }, [leads, search, stageFilter, starsFilter, responsavelFilter]);

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
      <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Todos os Leads</h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Gerencie e acompanhe todos os seus leads
            </p>
          </div>
          <Button onClick={() => navigate('/leads/new')} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl p-3 lg:p-4 shadow-card">
          <div className="flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Desktop Filters */}
            <div className="hidden sm:flex gap-3">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {Object.entries(FUNNEL_STAGES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={starsFilter} onValueChange={setStarsFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estrelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="5">5 estrelas</SelectItem>
                  <SelectItem value="4">4 estrelas</SelectItem>
                  <SelectItem value="3">3 estrelas</SelectItem>
                  <SelectItem value="2">2 estrelas</SelectItem>
                  <SelectItem value="1">1 estrela</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mobile Filter Button */}
            {isMobile && (
              <MobileFilters
                selectedStars={starsFilter !== 'all' ? parseInt(starsFilter) : null}
                selectedStage={stageFilter !== 'all' ? stageFilter as FunnelStage : null}
                selectedResponsavel={responsavelFilter}
                onSelectStars={(stars) => setStarsFilter(stars?.toString() || 'all')}
                onSelectStage={(stage) => setStageFilter(stage || 'all')}
                onSelectResponsavel={setResponsavelFilter}
                responsaveis={responsaveis}
              />
            )}
          </div>
        </div>

        {/* Table / List */}
        {isMobile ? (
          <MobileLeadsList 
            leads={filteredLeads} 
            title={`${filteredLeads.length} leads encontrados`} 
          />
        ) : (
          <LeadsTable 
            leads={filteredLeads} 
            title={`${filteredLeads.length} leads encontrados`} 
          />
        )}
      </div>
    </Layout>
  );
}
