import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { mockLeads } from '@/data/mockLeads';
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
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [starsFilter, setStarsFilter] = useState<string>('all');

  const filteredLeads = useMemo(() => {
    let leads = [...mockLeads];

    if (search) {
      const searchLower = search.toLowerCase();
      leads = leads.filter(
        (lead) =>
          lead.name.toLowerCase().includes(searchLower) ||
          lead.specialty.toLowerCase().includes(searchLower) ||
          lead.instagram.toLowerCase().includes(searchLower) ||
          lead.email.toLowerCase().includes(searchLower)
      );
    }

    if (stageFilter !== 'all') {
      leads = leads.filter((lead) => lead.stage === stageFilter);
    }

    if (starsFilter !== 'all') {
      leads = leads.filter((lead) => lead.stars === parseInt(starsFilter));
    }

    return leads;
  }, [search, stageFilter, starsFilter]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Todos os Leads</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie e acompanhe todos os seus leads
            </p>
          </div>
          <Button onClick={() => navigate('/leads/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl p-4 shadow-card">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, especialidade, Instagram..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-3">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
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
          </div>
        </div>

        {/* Table */}
        <LeadsTable 
          leads={filteredLeads} 
          title={`${filteredLeads.length} leads encontrados`} 
        />
      </div>
    </Layout>
  );
}
