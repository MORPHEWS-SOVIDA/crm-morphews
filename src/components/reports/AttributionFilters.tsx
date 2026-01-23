import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Filter, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AttributionFilters {
  startDate?: Date;
  endDate?: Date;
  source?: string;
  medium?: string;
  campaign?: string;
}

interface AttributionFiltersProps {
  filters: AttributionFilters;
  onFiltersChange: (filters: AttributionFilters) => void;
  sources?: string[];
  mediums?: string[];
  campaigns?: string[];
}

const PRESET_RANGES = [
  { label: 'Últimos 7 dias', getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: 'Este mês', getValue: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
  { label: 'Mês passado', getValue: () => {
    const lastMonth = subDays(startOfMonth(new Date()), 1);
    return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
  }},
];

export function AttributionFiltersComponent({ 
  filters, 
  onFiltersChange,
  sources = [],
  mediums = [],
  campaigns = [],
}: AttributionFiltersProps) {
  const [dateOpen, setDateOpen] = useState(false);

  const handlePresetClick = (preset: typeof PRESET_RANGES[0]) => {
    const { start, end } = preset.getValue();
    onFiltersChange({ ...filters, startDate: start, endDate: end });
    setDateOpen(false);
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = filters.startDate || filters.source || filters.medium || filters.campaign;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Date Range */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.startDate && filters.endDate
              ? `${format(filters.startDate, 'dd/MM', { locale: ptBR })} - ${format(filters.endDate, 'dd/MM', { locale: ptBR })}`
              : 'Período'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b space-y-2">
            {PRESET_RANGES.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            selected={{ from: filters.startDate, to: filters.endDate }}
            onSelect={(range) => {
              onFiltersChange({ 
                ...filters, 
                startDate: range?.from, 
                endDate: range?.to 
              });
            }}
            locale={ptBR}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Source Filter */}
      <Select
        value={filters.source || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, source: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas origens</SelectItem>
          {sources.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Medium Filter */}
      <Select
        value={filters.medium || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, medium: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Mídia" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas mídias</SelectItem>
          {mediums.map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Campaign Filter */}
      <Select
        value={filters.campaign || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, campaign: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Campanha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas campanhas</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
