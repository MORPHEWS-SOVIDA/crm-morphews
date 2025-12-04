import { User } from 'lucide-react';
import { useUsers, UserProfile } from '@/hooks/useUsers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ResponsavelFilterProps {
  selectedResponsavel: string | null;
  onSelectResponsavel: (responsavel: string | null) => void;
  compact?: boolean;
}

export function ResponsavelFilter({ selectedResponsavel, onSelectResponsavel, compact = false }: ResponsavelFilterProps) {
  const { data: users = [] } = useUsers();

  if (compact) {
    return (
      <Select
        value={selectedResponsavel || 'all'}
        onValueChange={(value) => onSelectResponsavel(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="Responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={`${user.first_name} ${user.last_name}`}>
              {user.first_name} {user.last_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <User className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Responsável</h3>
      </div>
      
      <Select
        value={selectedResponsavel || 'all'}
        onValueChange={(value) => onSelectResponsavel(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Todos os responsáveis" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os responsáveis</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={`${user.first_name} ${user.last_name}`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                  {user.first_name[0]}
                </div>
                {user.first_name} {user.last_name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
