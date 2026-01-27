import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Crown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useManagers } from '@/hooks/useUserAssociations';
import { useTeamMembers } from '@/hooks/useTeamMembers';

interface ManagerFilterProps {
  selectedManager: string | null;
  onSelectManager: (managerId: string | null, memberIds: string[]) => void;
  compact?: boolean;
}

export function ManagerFilter({ 
  selectedManager, 
  onSelectManager,
  compact = false 
}: ManagerFilterProps) {
  const [open, setOpen] = useState(false);
  const { data: managers = [] } = useManagers();
  const { data: teamMembers = [] } = useTeamMembers();

  // Mapa de gerente -> vendedores associados
  const managerMembersMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    teamMembers.forEach(member => {
      if (member.manager_user_id) {
        if (!map[member.manager_user_id]) {
          map[member.manager_user_id] = [];
        }
        map[member.manager_user_id].push(member.user_id);
      }
    });
    return map;
  }, [teamMembers]);

  // Contagem de vendedores por gerente
  const getManagerMemberCount = (managerId: string) => {
    return managerMembersMap[managerId]?.length || 0;
  };

  const handleSelect = (managerId: string | null) => {
    if (managerId === selectedManager) {
      // Deselecionar
      onSelectManager(null, []);
    } else if (managerId) {
      // Selecionar gerente e passar os IDs dos vendedores associados
      const memberIds = managerMembersMap[managerId] || [];
      onSelectManager(managerId, memberIds);
    }
    setOpen(false);
  };

  const selectedManagerName = useMemo(() => {
    if (!selectedManager) return null;
    return managers.find(m => m.user_id === selectedManager)?.full_name || 'Gerente';
  }, [selectedManager, managers]);

  const renderContent = () => (
    <Command>
      <CommandInput placeholder="Buscar gerente..." />
      <CommandList>
        <CommandEmpty>Nenhum gerente encontrado.</CommandEmpty>
        
        {selectedManager && (
          <CommandGroup>
            <CommandItem 
              onSelect={() => handleSelect(null)} 
              className="text-destructive"
            >
              <X className="mr-2 h-4 w-4" />
              Limpar seleção
            </CommandItem>
          </CommandGroup>
        )}
        
        <CommandGroup heading="Gerentes de Vendas">
          {managers.map((manager) => {
            const memberCount = getManagerMemberCount(manager.user_id);
            return (
              <CommandItem
                key={manager.user_id}
                value={manager.full_name}
                onSelect={() => handleSelect(manager.user_id)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedManager === manager.user_id 
                      ? "opacity-100" 
                      : "opacity-0"
                  )}
                />
                <Crown className="mr-2 h-4 w-4 text-purple-500" />
                <span className="flex-1">{manager.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {memberCount} vendedor{memberCount !== 1 ? 'es' : ''}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
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
            className={cn(
              "w-40 h-8 text-xs justify-between",
              selectedManager && "border-purple-500 bg-purple-50 dark:bg-purple-950"
            )}
          >
            <Crown className="mr-1 h-3 w-3 text-purple-500" />
            <span className="truncate flex-1 text-left">
              {selectedManagerName || 'Gerente'}
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
        <Crown className="w-4 h-4 text-purple-500" />
        <h3 className="font-semibold text-foreground">Gerente</h3>
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedManagerName || 'Selecionar gerente...'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          {renderContent()}
        </PopoverContent>
      </Popover>
    </div>
  );
}
