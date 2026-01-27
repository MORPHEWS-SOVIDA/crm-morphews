import { useState, useMemo } from 'react';
import { Users, Crown, Check, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useUserAssociations,
  useManagers,
  useAllOrgMembers,
  useSetManagerMembers,
} from '@/hooks/useUserAssociations';

export function UserAssociationsManager() {
  const { data: associations = [], isLoading: loadingAssociations } = useUserAssociations();
  const { data: managers = [], isLoading: loadingManagers } = useManagers();
  const { data: allMembers = [], isLoading: loadingMembers } = useAllOrgMembers();
  const setManagerMembers = useSetManagerMembers();

  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingMembers, setPendingMembers] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Obter membros associados ao gerente selecionado
  const currentMembers = useMemo(() => {
    if (!selectedManagerId) return [];
    return associations
      .filter(a => a.manager_user_id === selectedManagerId)
      .map(a => a.team_member_user_id);
  }, [associations, selectedManagerId]);

  // Quando seleciona um gerente, carregar seus membros
  const handleSelectManager = (managerId: string) => {
    setSelectedManagerId(managerId);
    const members = associations
      .filter(a => a.manager_user_id === managerId)
      .map(a => a.team_member_user_id);
    setPendingMembers(members);
    setHasChanges(false);
  };

  // Toggle de membro
  const toggleMember = (memberId: string) => {
    setPendingMembers(prev => {
      const newList = prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId];
      setHasChanges(true);
      return newList;
    });
  };

  // Salvar associações
  const handleSave = () => {
    if (!selectedManagerId) return;
    setManagerMembers.mutate(
      { managerUserId: selectedManagerId, memberUserIds: pendingMembers },
      { onSuccess: () => setHasChanges(false) }
    );
  };

  // Filtrar membros pela busca (excluindo o próprio gerente)
  const filteredMembers = useMemo(() => {
    return allMembers
      .filter(m => m.user_id !== selectedManagerId)
      .filter(m =>
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [allMembers, selectedManagerId, searchTerm]);

  // Calcular quantos membros cada gerente tem
  const memberCountByManager = useMemo(() => {
    const counts: Record<string, number> = {};
    associations.forEach(a => {
      counts[a.manager_user_id] = (counts[a.manager_user_id] || 0) + 1;
    });
    return counts;
  }, [associations]);

  const isLoading = loadingAssociations || loadingManagers || loadingMembers;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (managers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Crown className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum gerente encontrado</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Para criar associações, primeiro marque usuários como "Gerente de Vendas" 
            na edição do membro. Gerentes podem ter vendedores associados a eles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Lista de Gerentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-500" />
            Gerentes
          </CardTitle>
          <CardDescription>
            Selecione um gerente para gerenciar seus vendedores associados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {managers.map(manager => (
              <button
                key={manager.user_id}
                onClick={() => handleSelectManager(manager.user_id)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  selectedManagerId === manager.user_id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 font-semibold">
                    {manager.full_name[0]?.toUpperCase() || 'G'}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{manager.full_name}</p>
                    <p className="text-xs text-muted-foreground">Gerente de Vendas</p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {memberCountByManager[manager.user_id] || 0} vendedor(es)
                </Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gerenciamento de Membros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Vendedores Associados
          </CardTitle>
          <CardDescription>
            {selectedManagerId
              ? 'Marque os vendedores que pertencem a este gerente'
              : 'Selecione um gerente à esquerda'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedManagerId ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p>Selecione um gerente para ver e editar seus vendedores</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar membro..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Lista de membros com checkbox */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredMembers.map(member => {
                    const isSelected = pendingMembers.includes(member.user_id);
                    return (
                      <label
                        key={member.user_id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleMember(member.user_id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {member.role}
                            {member.is_sales_manager && ' • Gerente'}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </label>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum membro encontrado
                    </p>
                  )}
                </div>
              </ScrollArea>

              {/* Resumo e botão salvar */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {pendingMembers.length} vendedor(es) selecionado(s)
                </p>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || setManagerMembers.isPending}
                >
                  {setManagerMembers.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
