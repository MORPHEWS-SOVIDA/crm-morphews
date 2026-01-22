import { Users } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamFilterProps {
  selectedTeam: string | null;
  onSelectTeam: (teamId: string | null) => void;
  compact?: boolean;
}

export function TeamFilter({ selectedTeam, onSelectTeam, compact = false }: TeamFilterProps) {
  const { data: teams = [] } = useTeams();

  if (compact) {
    return (
      <Select
        value={selectedTeam || 'all'}
        onValueChange={(value) => onSelectTeam(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Time</h3>
      </div>
      
      <Select
        value={selectedTeam || 'all'}
        onValueChange={(value) => onSelectTeam(value === 'all' ? null : value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Todos os times" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os times</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
