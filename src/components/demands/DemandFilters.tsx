import { useUsers } from '@/hooks/useUsers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DemandFiltersProps {
  filters: {
    assigneeId?: string;
    status?: string;
  };
  onFiltersChange: (filters: { assigneeId?: string; status?: string }) => void;
}

export function DemandFilters({ filters, onFiltersChange }: DemandFiltersProps) {
  const { data: users } = useUsers();

  const hasFilters = filters.assigneeId || filters.status;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select 
        value={filters.assigneeId || 'all'} 
        onValueChange={(value) => onFiltersChange({ 
          ...filters, 
          assigneeId: value === 'all' ? undefined : value 
        })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Filtrar por responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os responsáveis</SelectItem>
          {users?.map(user => (
            <SelectItem key={user.id} value={user.id}>
              {user.first_name} {user.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
