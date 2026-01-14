import { useMemo, useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useLeads } from '@/hooks/useLeads';
import { useDemandLabels } from '@/hooks/useDemandDetails';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { MultiSelect } from '@/components/MultiSelect';
import { X, ChevronsUpDown, Check, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { URGENCY_CONFIG, type DemandUrgency } from '@/types/demand';
import type { DemandsFilters } from '@/types/demands-filters';

export type DemandsKanbanFilters = Omit<DemandsFilters, 'archived'>;

interface DemandFiltersProps {
  filters: DemandsKanbanFilters;
  onFiltersChange: (filters: DemandsKanbanFilters) => void;
}

export function DemandFilters({ filters, onFiltersChange }: DemandFiltersProps) {
  const { data: users } = useUsers();
  const { data: leads } = useLeads();
  const { data: labels } = useDemandLabels();

  const [leadSearchOpen, setLeadSearchOpen] = useState(false);

  const selectedLead = useMemo(
    () => leads?.find(l => l.id === filters.leadId),
    [leads, filters.leadId]
  );

  const userOptions = useMemo(
    () => (users || []).map(u => ({ value: u.user_id, label: `${u.first_name} ${u.last_name}` })),
    [users]
  );

  const labelOptions = useMemo(
    () => (labels || []).map(l => ({ value: l.id, label: l.name })),
    [labels]
  );

  const hasFilters = !!(
    filters.assigneeId ||
    filters.leadId ||
    filters.urgency ||
    filters.createdFrom ||
    filters.createdTo ||
    (filters.labelIds && filters.labelIds.length > 0)
  );

  const clearFilters = () => onFiltersChange({});

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Responsável</Label>
        <Select
          value={filters.assigneeId || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              assigneeId: value === 'all' ? undefined : value,
            })
          }
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar por responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {userOptions.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Urgência</Label>
        <Select
          value={filters.urgency || 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              urgency: value === 'all' ? undefined : (value as DemandUrgency),
            })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Urgência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {(Object.keys(URGENCY_CONFIG) as DemandUrgency[]).map((key) => (
              <SelectItem key={key} value={key}>
                {URGENCY_CONFIG[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Cliente/Lead</Label>
        <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-64 justify-between">
              {selectedLead ? selectedLead.name : <span className="text-muted-foreground">Selecionar...</span>}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  {(leads || []).slice(0, 50).map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={lead.name || ''}
                      onSelect={() => {
                        onFiltersChange({ ...filters, leadId: lead.id });
                        setLeadSearchOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          filters.leadId === lead.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{lead.name}</span>
                        {lead.whatsapp && (
                          <span className="text-xs text-muted-foreground">{lead.whatsapp}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Criado de</Label>
        <Input
          type="date"
          value={filters.createdFrom || ''}
          onChange={(e) => onFiltersChange({ ...filters, createdFrom: e.target.value || undefined })}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">até</Label>
        <Input
          type="date"
          value={filters.createdTo || ''}
          onChange={(e) => onFiltersChange({ ...filters, createdTo: e.target.value || undefined })}
          className="w-40"
        />
      </div>

      {labelOptions.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-2">
            <Tag className="h-3.5 w-3.5" />
            Etiquetas (AND)
          </Label>
          <MultiSelect
            options={labelOptions}
            selected={filters.labelIds || []}
            onChange={(ids) => onFiltersChange({ ...filters, labelIds: ids.length ? ids : undefined })}
            placeholder="Etiquetas..."
          />
        </div>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
