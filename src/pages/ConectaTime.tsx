import { useState } from 'react';
import { Search, Plus, Users, Hash, Link2, MessageSquare } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamConversations, TeamConversation } from '@/hooks/useTeamChat';
import { TeamConversationList } from '@/components/team-chat/TeamConversationList';
import { TeamChatView } from '@/components/team-chat/TeamChatView';
import { NewConversationDialog } from '@/components/team-chat/NewConversationDialog';
import { cn } from '@/lib/utils';

type TabType = 'all' | 'direct' | 'groups' | 'contextual';

export default function ConectaTime() {
  const [selectedConversation, setSelectedConversation] = useState<TeamConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const { data: conversations = [], isLoading } = useTeamConversations();

  // Filtrar conversas
  const filteredConversations = conversations.filter((conv) => {
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

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar de conversas */}
        <div
          className={cn(
            "flex flex-col border-r bg-background",
            "w-full md:w-[380px] lg:w-[420px]",
            selectedConversation && "hidden md:flex"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Conecta Time</h1>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowNewDialog(true)}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabType)}
            className="flex-1 flex flex-col min-h-0"
          >
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
                  selectedId={selectedConversation?.id}
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Área de chat */}
        <div
          className={cn(
            "flex-1 flex flex-col",
            !selectedConversation && "hidden md:flex items-center justify-center bg-muted/20"
          )}
        >
          {selectedConversation ? (
            <TeamChatViewFull
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <div className="text-center p-8">
              <MessageSquare className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                Selecione uma conversa
              </h2>
              <p className="text-muted-foreground text-sm max-w-md">
                Escolha uma conversa na lista ou clique em{' '}
                <button
                  onClick={() => setShowNewDialog(true)}
                  className="text-primary hover:underline"
                >
                  nova conversa
                </button>{' '}
                para começar.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={(conv) => {
          setShowNewDialog(false);
          setSelectedConversation(conv);
        }}
      />
    </Layout>
  );
}

/**
 * Versão full-page do chat view (sem modal overlay)
 */
interface TeamChatViewFullProps {
  conversation: TeamConversation;
  onBack: () => void;
}

function TeamChatViewFull({ conversation, onBack }: TeamChatViewFullProps) {
  return (
    <TeamChatView
      conversation={conversation}
      onBack={onBack}
      onClose={onBack}
      isFullPage
    />
  );
}
