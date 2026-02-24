import { useState, useMemo } from 'react';
import { normalizeInstagramHandle } from '@/lib/instagram';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { MobileLeadsList } from '@/components/dashboard/MobileLeadsList';
import { MobileFilters } from '@/components/dashboard/MobileFilters';
import { useLeads } from '@/hooks/useLeads';
import { useLeadsSalesData } from '@/hooks/useLeadsSalesData';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LeadsAdvancedFilters, LeadsFilters } from '@/components/leads/LeadsAdvancedFilters';
import { FunnelStage } from '@/types/lead';

export default function LeadsList() {
  const navigate = useNavigate();
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: salesData = {} } = useLeadsSalesData();
  const isMobile = useIsMobile();
  const { isAdmin: isGlobalAdmin } = useAuth();
  const { isAdmin: isTenantAdmin, isOwner } = useTenant();
  const { data: permissions } = useMyPermissions();
  const [search, setSearch] = useState('');
  
  const [filters, setFilters] = useState<LeadsFilters>({
    stage: 'all',
    stars: 'all',
    responsavel: null,
    assignedUserId: null,
    salesStatus: 'all',
    noSalesDays: null,
  });
  
  // Check if user can see "Novo Lead" button
  const isAdmin = isGlobalAdmin || isTenantAdmin || isOwner;
  const canShowNewLeadButton = (isAdmin || permissions?.leads_create) && !permissions?.leads_hide_new_button;

  const responsaveis = useMemo(() => {
    const uniqueResponsaveis = [...new Set(leads.map(lead => lead.assigned_to))];
    return uniqueResponsaveis.filter(Boolean);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Text search
    if (search) {
      const searchLower = search.toLowerCase().replace(/^@/, '');
      filtered = filtered.filter(
        (lead) => {
          const normalizedInsta = normalizeInstagramHandle(lead.instagram)?.toLowerCase() || '';
          return (
            lead.name?.toLowerCase().includes(searchLower) ||
            lead.specialty?.toLowerCase().includes(searchLower) ||
            normalizedInsta.includes(searchLower) ||
            lead.instagram?.toLowerCase().includes(searchLower) ||
            lead.email?.toLowerCase().includes(searchLower) ||
            lead.whatsapp?.toLowerCase().includes(searchLower)
          );
        }
      );
    }

    // Stage filter
    if (filters.stage !== 'all') {
      filtered = filtered.filter((lead) => lead.stage === filters.stage);
    }

    // Stars filter
    if (filters.stars !== 'all') {
      filtered = filtered.filter((lead) => lead.stars === parseInt(filters.stars));
    }

    // Responsavel filter (legacy)
    if (filters.responsavel) {
      filtered = filtered.filter((lead) => lead.assigned_to === filters.responsavel);
    }

    // Assigned user filter (new - by user_id)
    if (filters.assignedUserId) {
      filtered = filtered.filter((lead) => lead.assigned_to === filters.assignedUserId);
    }

    // Sales status filters
    if (filters.salesStatus === 'no_sales') {
      // Leads that have no sales at all
      filtered = filtered.filter((lead) => !salesData[lead.id]?.has_any_sale);
    } else if (filters.salesStatus === 'has_sales_this_month') {
      // Leads with sales this month
      filtered = filtered.filter((lead) => salesData[lead.id]?.has_sale_this_month);
    } else if (filters.salesStatus === 'no_sales_x_days' && filters.noSalesDays) {
      // Leads with last sale older than X days OR no sales at all
      filtered = filtered.filter((lead) => {
        const data = salesData[lead.id];
        if (!data?.has_any_sale) return true; // No sales = include
        return (data.days_since_last_sale ?? 0) >= filters.noSalesDays!;
      });
    }

    return filtered;
  }, [leads, search, filters, salesData]);

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
          {canShowNewLeadButton && (
            <Button onClick={() => navigate('/leads/new')} className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl p-3 lg:p-4 shadow-card">
          <div className="flex flex-col gap-4">
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
            
            {/* Desktop Advanced Filters */}
            {!isMobile && (
              <LeadsAdvancedFilters
                filters={filters}
                onFiltersChange={setFilters}
                responsaveis={responsaveis}
              />
            )}

            {/* Mobile Filter Button */}
            {isMobile && (
              <MobileFilters
                selectedStars={filters.stars !== 'all' ? parseInt(filters.stars) : null}
                selectedStage={filters.stage !== 'all' ? filters.stage as FunnelStage : null}
                selectedResponsavel={filters.responsavel}
                onSelectStars={(stars) => setFilters(f => ({ ...f, stars: stars?.toString() || 'all' }))}
                onSelectStage={(stage) => setFilters(f => ({ ...f, stage: stage || 'all' }))}
                onSelectResponsavel={(resp) => setFilters(f => ({ ...f, responsavel: resp }))}
                responsaveis={responsaveis}
              />
            )}
          </div>
        </div>

        {/* Table / List */}
        {filteredLeads.length === 0 && search ? (
          <div className="bg-card rounded-xl p-8 shadow-card text-center">
            <p className="text-muted-foreground mb-4">Nenhum lead encontrado para "{search}"</p>
            {canShowNewLeadButton && (
              <Button onClick={() => navigate('/leads/new')} className="gap-2">
                <Plus className="w-4 h-4" />
                Cadastrar Lead
              </Button>
            )}
          </div>
        ) : isMobile ? (
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
