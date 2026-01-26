import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTeams } from '@/hooks/useTeams';

interface SellerMultiSelectProps {
  selectedSellers: string[];
  onSelectSellers: (sellers: string[]) => void;
  compact?: boolean;
}

export function SellerMultiSelect({ 
  selectedSellers, 
  onSelectSellers,
  compact = false 
}: SellerMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: teams = [] } = useTeams();

  // Group members by team
  const membersByTeam = useMemo(() => {
    const grouped: Record<string, typeof teamMembers> = {};
    const noTeam: typeof teamMembers = [];
    
    teamMembers.forEach(member => {
      if (member.team_id) {
        if (!grouped[member.team_id]) {
          grouped[member.team_id] = [];
        }
        grouped[member.team_id].push(member);
      } else {
        noTeam.push(member);
      }
    });

    return { grouped, noTeam };
  }, [teamMembers]);

  const getTeamName = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.name || 'Time';
  };

  const getTeamColor = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.color || '#6366f1';
  };

  const toggleSeller = (userId: string) => {
    if (selectedSellers.includes(userId)) {
      onSelectSellers(selectedSellers.filter(s => s !== userId));
    } else {
      onSelectSellers([...selectedSellers, userId]);
    }
  };

  const selectAllFromTeam = (teamId: string) => {
    const teamMemberIds = membersByTeam.grouped[teamId]?.map(m => m.user_id) || [];
    const allSelected = teamMemberIds.every(id => selectedSellers.includes(id));
    
    if (allSelected) {
      // Deselect all from this team
      onSelectSellers(selectedSellers.filter(s => !teamMemberIds.includes(s)));
    } else {
      // Select all from this team
      const newSelection = [...new Set([...selectedSellers, ...teamMemberIds])];
      onSelectSellers(newSelection);
    }
  };

  const clearAll = () => {
    onSelectSellers([]);
  };

  const selectedNames = useMemo(() => {
    return teamMembers
      .filter(m => selectedSellers.includes(m.user_id))
      .map(m => m.full_name);
  }, [selectedSellers, teamMembers]);

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-40 h-8 text-xs justify-between"
          >
            <span className="truncate">
              {selectedSellers.length === 0 
                ? 'Vendedores' 
                : `${selectedSellers.length} selecionados`}
            </span>
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end">
          <Command>
            <CommandInput placeholder="Buscar vendedor..." />
            <CommandList>
              <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
              
              {selectedSellers.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={clearAll} className="text-destructive">
                    <X className="mr-2 h-4 w-4" />
                    Limpar seleção ({selectedSellers.length})
                  </CommandItem>
                </CommandGroup>
              )}
              
              {Object.entries(membersByTeam.grouped).map(([teamId, members]) => (
                <CommandGroup key={teamId} heading={
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      selectAllFromTeam(teamId);
                    }}
                    className="flex items-center gap-2 w-full hover:opacity-80"
                  >
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getTeamColor(teamId) }}
                    />
                    <span>{getTeamName(teamId)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      (selecionar todos)
                    </span>
                  </button>
                }>
                  {members.map((member) => (
                    <CommandItem
                      key={member.user_id}
                      value={member.full_name}
                      onSelect={() => toggleSeller(member.user_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSellers.includes(member.user_id) 
                            ? "opacity-100" 
                            : "opacity-0"
                        )}
                      />
                      {member.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              
              {membersByTeam.noTeam.length > 0 && (
                <CommandGroup heading="Sem time">
                  {membersByTeam.noTeam.map((member) => (
                    <CommandItem
                      key={member.user_id}
                      value={member.full_name}
                      onSelect={() => toggleSeller(member.user_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSellers.includes(member.user_id) 
                            ? "opacity-100" 
                            : "opacity-0"
                        )}
                      />
                      {member.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // Full version (card)
  return (
    <div className="bg-card rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Vendedores</h3>
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedSellers.length === 0 
              ? 'Selecionar vendedores...' 
              : `${selectedSellers.length} vendedor(es) selecionado(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Command>
            <CommandInput placeholder="Buscar vendedor..." />
            <CommandList>
              <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
              
              {selectedSellers.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={clearAll} className="text-destructive">
                    <X className="mr-2 h-4 w-4" />
                    Limpar seleção ({selectedSellers.length})
                  </CommandItem>
                </CommandGroup>
              )}
              
              {Object.entries(membersByTeam.grouped).map(([teamId, members]) => (
                <CommandGroup key={teamId} heading={
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      selectAllFromTeam(teamId);
                    }}
                    className="flex items-center gap-2 w-full hover:opacity-80"
                  >
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getTeamColor(teamId) }}
                    />
                    <span>{getTeamName(teamId)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      (selecionar todos)
                    </span>
                  </button>
                }>
                  {members.map((member) => (
                    <CommandItem
                      key={member.user_id}
                      value={member.full_name}
                      onSelect={() => toggleSeller(member.user_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSellers.includes(member.user_id) 
                            ? "opacity-100" 
                            : "opacity-0"
                        )}
                      />
                      {member.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              
              {membersByTeam.noTeam.length > 0 && (
                <CommandGroup heading="Sem time">
                  {membersByTeam.noTeam.map((member) => (
                    <CommandItem
                      key={member.user_id}
                      value={member.full_name}
                      onSelect={() => toggleSeller(member.user_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSellers.includes(member.user_id) 
                            ? "opacity-100" 
                            : "opacity-0"
                        )}
                      />
                      {member.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Selected badges */}
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {selectedNames.slice(0, 3).map((name, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
          {selectedNames.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{selectedNames.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
