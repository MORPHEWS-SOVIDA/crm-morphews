import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Users, X, Crown } from 'lucide-react';
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
import { useManagers } from '@/hooks/useUserAssociations';

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
  const { data: managers = [] } = useManagers();

  // Criar mapa de gerente para nome
  const managerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    managers.forEach(m => {
      map[m.user_id] = m.full_name;
    });
    return map;
  }, [managers]);

  // Agrupar membros por gerente associado
  const membersByManager = useMemo(() => {
    const grouped: Record<string, typeof teamMembers> = {};
    const noManager: typeof teamMembers = [];
    
    teamMembers.forEach(member => {
      if (member.manager_user_id) {
        if (!grouped[member.manager_user_id]) {
          grouped[member.manager_user_id] = [];
        }
        grouped[member.manager_user_id].push(member);
      } else {
        noManager.push(member);
      }
    });

    return { grouped, noManager };
  }, [teamMembers]);

  const getManagerName = (managerId: string) => {
    return managerNameMap[managerId] || 'Gerente';
  };

  const toggleSeller = (userId: string) => {
    if (selectedSellers.includes(userId)) {
      onSelectSellers(selectedSellers.filter(s => s !== userId));
    } else {
      onSelectSellers([...selectedSellers, userId]);
    }
  };

  const selectAllFromManager = (managerId: string) => {
    const managerMemberIds = membersByManager.grouped[managerId]?.map(m => m.user_id) || [];
    const allSelected = managerMemberIds.every(id => selectedSellers.includes(id));
    
    if (allSelected) {
      // Deselecionar todos deste gerente
      onSelectSellers(selectedSellers.filter(s => !managerMemberIds.includes(s)));
    } else {
      // Selecionar todos deste gerente
      const newSelection = [...new Set([...selectedSellers, ...managerMemberIds])];
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

  const renderContent = () => (
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
        
        {/* Agrupado por gerente */}
        {Object.entries(membersByManager.grouped).map(([managerId, members]) => (
          <CommandGroup key={managerId} heading={
            <button 
              onClick={(e) => {
                e.preventDefault();
                selectAllFromManager(managerId);
              }}
              className="flex items-center gap-2 w-full hover:opacity-80"
            >
              <Crown className="w-3 h-3 text-purple-500" />
              <span>{getManagerName(managerId)}</span>
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
        
        {/* Sem gerente */}
        {membersByManager.noManager.length > 0 && (
          <CommandGroup heading="Sem associação">
            {membersByManager.noManager.map((member) => (
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
  );

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
          {renderContent()}
        </PopoverContent>
      </Popover>
    );
  }

  // Versão completa (card)
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
          {renderContent()}
        </PopoverContent>
      </Popover>
      
      {/* Badges selecionados */}
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
