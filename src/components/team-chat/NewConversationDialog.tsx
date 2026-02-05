import { useState } from 'react';
import { Users, Hash, Link2, Search, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import {
  TeamConversation,
  useCreateDirectConversation,
  useCreateGroupConversation,
} from '@/hooks/useTeamChat';
import { cn } from '@/lib/utils';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversation: TeamConversation) => void;
}

interface TeamMember {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export function NewConversationDialog({ open, onOpenChange, onCreated }: NewConversationDialogProps) {
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  
  const { data: tenantId } = useCurrentTenantId();
  const { user } = useAuth();
  const createDirect = useCreateDirectConversation();
  const createGroup = useCreateGroupConversation();

  // Buscar membros da organização
  // Usamos LEFT JOIN via profiles para garantir que membros apareçam mesmo sem perfil completo
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['org-members-for-chat', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Primeiro buscar os user_ids da org
      const { data: orgMembers, error: orgError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', tenantId);

      if (orgError) {
        console.error('[Conecta Time] Error fetching org members:', orgError);
        throw orgError;
      }

      if (!orgMembers?.length) {
        console.warn('[Conecta Time] No members found for tenant:', tenantId);
        return [];
      }

      const userIds = orgMembers.map(m => m.user_id);

      // Buscar perfis separadamente
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      if (profileError) {
        console.error('[Conecta Time] Error fetching profiles:', profileError);
        throw profileError;
      }

      // Criar mapa de perfis
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Combinar dados - mostra todos os membros, mesmo sem perfil
      return orgMembers.map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          avatar_url: profile?.avatar_url || null,
        };
      }) as TeamMember[];
    },
    enabled: open && !!tenantId,
  });

  // Filtrar membros (excluir usuário atual)
  const filteredMembers = members.filter((m) => {
    if (m.user_id === user?.id) return false;
    if (!searchQuery) return true;
    
    const name = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleSelectUser = (userId: string) => {
    if (tab === 'direct') {
      // Para chat direto, selecionar apenas um
      setSelectedUsers([userId]);
    } else {
      // Para grupo, toggle seleção
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    try {
      if (tab === 'direct') {
        const result = await createDirect.mutateAsync(selectedUsers[0]);
        onCreated(result as TeamConversation);
      } else {
        if (!groupName.trim()) return;
        const result = await createGroup.mutateAsync({
          name: groupName.trim(),
          memberIds: selectedUsers,
        });
        onCreated(result as TeamConversation);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setGroupName('');
    setSearchQuery('');
    onOpenChange(false);
  };

  const isCreating = createDirect.isPending || createGroup.isPending;
  const canCreate = tab === 'direct'
    ? selectedUsers.length === 1
    : selectedUsers.length > 0 && groupName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => {
          setTab(v as 'direct' | 'group');
          setSelectedUsers([]);
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Direto
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Grupo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pessoa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[250px] border rounded-md">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum membro encontrado
                </div>
              ) : (
                <div className="p-1">
                  {filteredMembers.map((member) => (
                    <MemberItem
                      key={member.user_id}
                      member={member}
                      selected={selectedUsers.includes(member.user_id)}
                      onSelect={() => handleSelectUser(member.user_id)}
                      showCheckbox={false}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div>
              <Label htmlFor="group-name">Nome do Grupo</Label>
              <Input
                id="group-name"
                placeholder="Ex: Equipe de Vendas"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Membros ({selectedUsers.length} selecionados)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar pessoas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="h-[200px] border rounded-md">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum membro encontrado
                </div>
              ) : (
                <div className="p-1">
                  {filteredMembers.map((member) => (
                    <MemberItem
                      key={member.user_id}
                      member={member}
                      selected={selectedUsers.includes(member.user_id)}
                      onSelect={() => handleSelectUser(member.user_id)}
                      showCheckbox={true}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
          >
            {isCreating ? 'Criando...' : 'Criar Conversa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MemberItemProps {
  member: TeamMember;
  selected: boolean;
  onSelect: () => void;
  showCheckbox: boolean;
}

function MemberItem({ member, selected, onSelect, showCheckbox }: MemberItemProps) {
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Usuário';

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left",
        selected && "bg-primary/10"
      )}
    >
      {showCheckbox && (
        <Checkbox checked={selected} className="pointer-events-none" />
      )}

      <Avatar className="h-8 w-8">
        {member.avatar_url && <AvatarImage src={member.avatar_url} />}
        <AvatarFallback className="text-xs">
          {name.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <span className="flex-1 text-sm">{name}</span>

      {!showCheckbox && selected && (
        <Check className="h-4 w-4 text-primary" />
      )}
    </button>
  );
}
