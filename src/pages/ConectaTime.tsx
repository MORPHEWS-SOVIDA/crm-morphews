import { useState, useEffect } from 'react';
import { Search, Plus, Users, Hash, Link2, MessageSquare, Menu, X } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTeamConversations, TeamConversation } from '@/hooks/useTeamChat';
import { usePresenceHeartbeat, usePresenceRealtime } from '@/hooks/useTeamChatExtended';
import { TeamConversationList } from '@/components/team-chat/TeamConversationList';
import { TeamChatView } from '@/components/team-chat/TeamChatView';
import { NewConversationDialog } from '@/components/team-chat/NewConversationDialog';
import { ChannelBrowser } from '@/components/team-chat/ChannelBrowser';
import { MessageSearch } from '@/components/team-chat/MessageSearch';
import { OnlineUsersList } from '@/components/team-chat/UserPresenceIndicator';
import { cn } from '@/lib/utils';

type TabType = 'all' | 'direct' | 'groups' | 'contextual';
type ViewType = 'conversations' | 'channels' | 'search';

export default function ConectaTime() {
  const [selectedConversation, setSelectedConversation] = useState<TeamConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('conversations');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: conversations = [], isLoading } = useTeamConversations();

  // Ativar presença e realtime
  usePresenceHeartbeat();
  usePresenceRealtime();

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

  const handleSelectChannel = (channelId: string) => {
    const channel = conversations.find(c => c.id === channelId);
    if (channel) {
      setSelectedConversation(channel);
      setCurrentView('conversations');
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar de navegação (desktop) */}
        <div className="hidden lg:flex flex-col w-16 bg-muted/30 border-r">
          <div className="flex flex-col items-center py-4 gap-2">
            <Button
              variant={currentView === 'conversations' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setCurrentView('conversations')}
              title="Conversas"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Button
              variant={currentView === 'channels' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setCurrentView('channels')}
              title="Canais"
            >
              <Hash className="h-5 w-5" />
            </Button>
            <Button
              variant={currentView === 'search' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setCurrentView('search')}
              title="Buscar"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>
          <div className="mt-auto pb-4">
            <OnlineUsersList className="px-2" />
          </div>
        </div>

        {/* Sidebar de conversas */}
        <div
          className={cn(
            "flex flex-col border-r bg-background",
            "w-full md:w-[320px] lg:w-[360px]",
            selectedConversation && "hidden md:flex"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {/* Mobile menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b">
                      <h2 className="font-semibold">Conecta Time</h2>
                    </div>
                    <div className="flex-1 p-4 space-y-2">
                      <Button
                        variant={currentView === 'conversations' ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => {
                          setCurrentView('conversations');
                          setMobileMenuOpen(false);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Conversas
                      </Button>
                      <Button
                        variant={currentView === 'channels' ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => {
                          setCurrentView('channels');
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Hash className="h-4 w-4 mr-2" />
                        Canais
                      </Button>
                      <Button
                        variant={currentView === 'search' ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => {
                          setCurrentView('search');
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Buscar Mensagens
                      </Button>
                    </div>
                    <div className="p-4 border-t">
                      <OnlineUsersList />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <MessageSquare className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">
                {currentView === 'conversations' && 'Conversas'}
                {currentView === 'channels' && 'Canais'}
                {currentView === 'search' && 'Buscar'}
              </h1>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setShowNewDialog(true)}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Content based on view */}
          {currentView === 'conversations' && (
            <>
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
            </>
          )}

          {currentView === 'channels' && (
            <ChannelBrowser onSelectChannel={handleSelectChannel} />
          )}

          {currentView === 'search' && (
            <MessageSearch
              onSelectMessage={(messageId, convId) => {
                const conv = conversations.find(c => c.id === convId);
                if (conv) {
                  setSelectedConversation(conv);
                  setCurrentView('conversations');
                }
              }}
            />
          )}
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
                Escolha uma conversa na lista, explore{' '}
                <button
                  onClick={() => setCurrentView('channels')}
                  className="text-primary hover:underline"
                >
                  canais públicos
                </button>
                , ou clique em{' '}
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
