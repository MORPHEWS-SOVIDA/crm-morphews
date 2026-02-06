import { useState } from 'react';
import { Hash, Lock, Plus, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePublicChannels, useCreateChannel, useJoinChannel } from '@/hooks/useTeamChatExtended';
import { useTeamConversations } from '@/hooks/useTeamChat';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChannelBrowserProps {
  onSelectChannel: (channelId: string) => void;
}

export function ChannelBrowser({ onSelectChannel }: ChannelBrowserProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: publicChannels = [], isLoading } = usePublicChannels();
  const { data: myConversations = [] } = useTeamConversations();
  const joinChannel = useJoinChannel();

  // IDs das conversas que o usuário já participa
  const myChannelIds = new Set(myConversations.map(c => c.id));

  // Filtrar canais por busca
  const filteredChannels = publicChannels.filter(channel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      channel.name?.toLowerCase().includes(query) ||
      channel.description?.toLowerCase().includes(query) ||
      channel.channel_slug?.toLowerCase().includes(query)
    );
  });

  const handleJoinChannel = async (channelId: string) => {
    try {
      await joinChannel.mutateAsync(channelId);
      toast.success('Você entrou no canal!');
      onSelectChannel(channelId);
    } catch (error) {
      toast.error('Erro ao entrar no canal');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Canais
          </h2>
          <CreateChannelDialog 
            open={showCreateDialog} 
            onOpenChange={setShowCreateDialog}
            onCreated={(id) => {
              setShowCreateDialog(false);
              onSelectChannel(id);
            }}
          />
        </div>
        <Input
          placeholder="Buscar canais..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Channel List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))
          ) : filteredChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Hash className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum canal encontrado</p>
              <p className="text-xs mt-1">Crie um novo canal para começar</p>
            </div>
          ) : (
            filteredChannels.map((channel) => {
              const isMember = myChannelIds.has(channel.id);
              
              return (
                <button
                  key={channel.id}
                  onClick={() => isMember ? onSelectChannel(channel.id) : handleJoinChannel(channel.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-lg text-left",
                    "hover:bg-muted/50 transition-colors",
                    isMember && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                    channel.is_public ? "bg-primary/10" : "bg-muted"
                  )}>
                    {channel.is_public ? (
                      <Hash className="h-5 w-5 text-primary" />
                    ) : (
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">#{channel.channel_slug || channel.name}</span>
                      {isMember && (
                        <span className="text-xs text-green-600 flex items-center gap-0.5">
                          <Check className="h-3 w-3" />
                          Membro
                        </span>
                      )}
                    </div>
                    {channel.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {channel.description}
                      </p>
                    )}
                    {channel.channel_topic && (
                      <p className="text-xs text-muted-foreground/60 truncate">
                        Tópico: {channel.channel_topic}
                      </p>
                    )}
                  </div>

                  {!isMember && (
                    <Button size="sm" variant="outline" className="shrink-0">
                      Entrar
                    </Button>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
}

function CreateChannelDialog({ open, onOpenChange, onCreated }: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  
  const createChannel = useCreateChannel();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Nome do canal é obrigatório');
      return;
    }

    try {
      const channel = await createChannel.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        topic: topic.trim() || undefined,
        isPublic,
      });
      
      toast.success('Canal criado com sucesso!');
      setName('');
      setDescription('');
      setTopic('');
      setIsPublic(true);
      onCreated(channel.id);
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        toast.error('Já existe um canal com esse nome');
      } else {
        toast.error('Erro ao criar canal');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Novo Canal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Canal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Nome do Canal *</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: vendas, suporte, geral"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use letras minúsculas, números e hífens
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-desc">Descrição</Label>
            <Textarea
              id="channel-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Do que se trata este canal?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-topic">Tópico Atual</Label>
            <Input
              id="channel-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Discussão atual do canal"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label>Canal Público</Label>
              <p className="text-xs text-muted-foreground">
                Qualquer membro da equipe pode encontrar e entrar
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createChannel.isPending}>
            {createChannel.isPending ? 'Criando...' : 'Criar Canal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
