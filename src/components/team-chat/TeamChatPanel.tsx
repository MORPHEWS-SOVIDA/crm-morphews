import { useState } from 'react';
import { X, Search, Plus, Users, MessageSquare, Hash, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamConversations, TeamConversation } from '@/hooks/useTeamChat';
import { TeamConversationList } from './TeamConversationList';
import { TeamChatView } from './TeamChatView';
import { NewConversationDialog } from './NewConversationDialog';
import { cn } from '@/lib/utils';

interface TeamChatPanelProps {
  onClose: () => void;
}

type TabType = 'all' | 'direct' | 'groups' | 'contextual';

export function TeamChatPanel({ onClose }: TeamChatPanelProps) {
  const [selectedConversation, setSelectedConversation] = useState<TeamConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  
  const { data: conversations = [], isLoading } = useTeamConversations();

  // Filtrar conversas
  const filteredConversations = conversations.filter(conv => {
    // Filtro por tab
    if (activeTab === 'direct' && conv.conversation_type !== 'direct') return false;
    if (activeTab === 'groups' && conv.conversation_type !== 'group') return false;
    if (activeTab === 'contextual' && conv.conversation_type !== 'contextual') return false;

    // Filtro por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = conv.name?.toLowerCase() || '';
      const preview = conv.last_message_preview?.toLowerCase() || '';
      const contextName = conv.context_name?.toLowerCase() || '';
      return name.includes(query) || preview.includes(query) || contextName.includes(query);
    }

    return true;
  });

  // Se uma conversa está selecionada, mostrar o chat
  if (selectedConversation) {
    return (
      <TeamChatView
        conversation={selectedConversation}
        onBack={() => setSelectedConversation(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className={cn(
      "fixed bottom-24 left-6 z-50",
      "w-[380px] max-h-[600px] h-[calc(100vh-120px)]",
      "bg-background border rounded-xl shadow-2xl",
      "flex flex-col overflow-hidden",
      "lg:bottom-28 lg:left-8"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Conecta Time</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNewDialog(true)}
            className="h-8 w-8"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 mx-3 mt-2" style={{ width: 'calc(100% - 24px)' }}>
          <TabsTrigger value="all" className="text-xs px-2">
            Todos
          </TabsTrigger>
          <TabsTrigger value="direct" className="text-xs px-2 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Direto
          </TabsTrigger>
          <TabsTrigger value="groups" className="text-xs px-2 flex items-center gap-1">
            <Hash className="h-3 w-3" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="contextual" className="text-xs px-2 flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Contexto
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <TeamConversationList
              conversations={filteredConversations}
              isLoading={isLoading}
              onSelect={setSelectedConversation}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={(conv) => {
          setShowNewDialog(false);
          setSelectedConversation(conv);
        }}
      />
    </div>
  );
}
