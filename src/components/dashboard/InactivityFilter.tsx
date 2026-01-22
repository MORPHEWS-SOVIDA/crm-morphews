import { Clock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InactivityFilterProps {
  selectedDays: number | null;
  onSelectDays: (days: number | null) => void;
  compact?: boolean;
}

const INACTIVITY_OPTIONS = [
  { value: 3, label: '3 dias' },
  { value: 7, label: '7 dias' },
  { value: 15, label: '15 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias' },
];

export function InactivityFilter({ selectedDays, onSelectDays, compact = false }: InactivityFilterProps) {
  if (compact) {
    return (
      <Select
        value={selectedDays?.toString() || 'all'}
        onValueChange={(value) => onSelectDays(value === 'all' ? null : Number(value))}
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Inatividade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {INACTIVITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              Sem mov. há {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Inatividade</h3>
      </div>
      
      <Select
        value={selectedDays?.toString() || 'all'}
        onValueChange={(value) => onSelectDays(value === 'all' ? null : Number(value))}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Todos os leads" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os leads</SelectItem>
          {INACTIVITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              Sem movimentação há {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
