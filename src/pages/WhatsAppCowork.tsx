import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { agentsSupabase } from '@/integrations/agents-supabase/client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Search, Bot, MessageSquare, Send, ArrowLeft, RefreshCw,
  Bell, AlertTriangle, CheckCircle, Clock, Loader2, BellRing,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentNotification, AgentExecutionLog } from '@/integrations/agents-supabase/types';

// ─── Hooks para dados do Supabase externo (atomic-agents) ───

function useAgentNotifications(orgId: string | undefined) {
  return useQuery({
    queryKey: ['agent-notifications', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      // Agent notifications don't filter by org since the external DB may not have org matching
      const { data, error } = await agentsSupabase
        .from('agent_notifications')
        .select('*')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AgentNotification[];
    },
    enabled: !!orgId,
    refetchInterval: 10000,
  });
}

function useAgentLogs(orgId: string | undefined) {
  return useQuery({
    queryKey: ['agent-logs', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await agentsSupabase
        .from('agent_execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as AgentExecutionLog[];
    },
    enabled: !!orgId,
    refetchInterval: 15000,
  });
}

// ─── Tipos locais ───

interface CoworkConversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  last_message_at: string | null;
  status: string;
  instance_name: string | null;
  organization_id: string;
  unread_count: number;
  agent_active: boolean;
}

type CoworkTab = 'active' | 'notifications' | 'logs';

// ─── Componente Principal ───

export default function WhatsAppCowork() {
  const { user, organizationId } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<CoworkTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<CoworkConversation | null>(null);
  const [conversations, setConversations] = useState<CoworkConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const { data: notifications = [] } = useAgentNotifications(organizationId);
  const { data: logs = [] } = useAgentLogs(organizationId);

  // Buscar conversas do Supabase principal que estão com agente IA ativo
  const fetchConversations = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoadingConversations(true);
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, phone_number, contact_name, last_message_at, status, instance_id, organization_id')
        .eq('organization_id', organizationId)
        .in('status', ['with_bot', 'pending'])
        .order('last_message_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const mapped: CoworkConversation[] = (data || []).map((c: any) => ({
        id: c.id,
        phone_number: c.phone_number,
        contact_name: c.contact_name,
        last_message_at: c.last_message_at,
        status: c.status,
        instance_name: null,
        organization_id: c.organization_id,
        unread_count: 0,
        agent_active: c.status === 'with_bot',
      }));

      setConversations(mapped);
    } catch (err) {
      console.error('Erro ao buscar conversas:', err);
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoadingConversations(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Filtrar conversas
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.phone_number?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q)
    );
  });

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const handleMarkNotificationRead = async (notifId: string) => {
    await agentsSupabase
      .from('agent_notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notifId);
    queryClient.invalidateQueries({ queryKey: ['agent-notifications'] });
  };

  // ─── Renderização ───

  if (isMobile && selectedConversation) {
    return (
      <Layout>
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          <CoworkChatHeader
            conversation={selectedConversation}
            onBack={() => setSelectedConversation(null)}
          />
          <CoworkChatArea conversationId={selectedConversation.id} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className={cn(
          "flex flex-col border-r bg-background",
          "w-full md:w-[360px] lg:w-[400px]",
          selectedConversation && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Agentes IA 2.0</h1>
            </div>
            <div className="flex items-center gap-1">
              {unreadNotifications > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadNotifications}
                </Badge>
              )}
              <Button size="icon" variant="ghost" onClick={fetchConversations}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CoworkTab)} className="px-3 pt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active" className="text-xs flex items-center gap-1">
                <Bot className="h-3 w-3" />
                Ativos
              </TabsTrigger>
              <TabsTrigger value="notifications" className="text-xs flex items-center gap-1">
                <BellRing className="h-3 w-3" />
                Alertas
                {unreadNotifications > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-1">
                    {unreadNotifications}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Logs
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search (somente na aba active) */}
          {activeTab === 'active' && (
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1">
            {activeTab === 'active' && (
              <ConversationsList
                conversations={filteredConversations}
                loading={loadingConversations}
                selectedId={selectedConversation?.id}
                onSelect={setSelectedConversation}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsList
                notifications={notifications}
                onMarkRead={handleMarkNotificationRead}
              />
            )}
            {activeTab === 'logs' && (
              <LogsList logs={logs} />
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col",
          !selectedConversation && "hidden md:flex items-center justify-center bg-muted/20"
        )}>
          {selectedConversation ? (
            <>
              <CoworkChatHeader
                conversation={selectedConversation}
                onBack={() => setSelectedConversation(null)}
              />
              <CoworkChatArea conversationId={selectedConversation.id} />
            </>
          ) : (
            <div className="text-center p-8">
              <Bot className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground mb-2">
                Agentes IA 2.0 — WhatsApp Cowork
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Monitore os agentes de IA atendendo pelo WhatsApp em tempo real.
                Selecione uma conversa para acompanhar.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-componentes ───

function ConversationsList({
  conversations,
  loading,
  selectedId,
  onSelect,
}: {
  conversations: CoworkConversation[];
  loading: boolean;
  selectedId?: string;
  onSelect: (c: CoworkConversation) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma conversa ativa com agente IA
      </div>
    );
  }

  return (
    <div className="divide-y">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className={cn(
            "w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
            selectedId === c.id && "bg-muted"
          )}
        >
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {(c.contact_name || c.phone_number || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm truncate">
                {c.contact_name || c.phone_number}
              </span>
              {c.last_message_at && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(new Date(c.last_message_at), 'HH:mm', { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge
                variant={c.agent_active ? 'default' : 'secondary'}
                className="text-[10px] h-4 px-1"
              >
                {c.agent_active ? (
                  <><Bot className="h-2.5 w-2.5 mr-0.5" /> Agente ativo</>
                ) : (
                  'Pendente'
                )}
              </Badge>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function NotificationsList({
  notifications,
  onMarkRead,
}: {
  notifications: AgentNotification[];
  onMarkRead: (id: string) => void;
}) {
  if (!notifications.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nenhuma notificação
      </div>
    );
  }

  return (
    <div className="divide-y">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={cn(
            "p-3 flex gap-3",
            !n.read && "bg-primary/5"
          )}
        >
          <div className="shrink-0 mt-0.5">
            {n.urgency === 'high' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Bell className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{n.type === 'transfer_request' ? 'Pedido de Transferência' : n.type}</p>
            {n.reason && <p className="text-xs text-muted-foreground mt-0.5">{n.reason}</p>}
            {n.summary && <p className="text-xs text-muted-foreground mt-0.5">{n.summary}</p>}
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              {!n.read && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => onMarkRead(n.id)}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Marcar lido
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogsList({ logs }: { logs: AgentExecutionLog[] }) {
  if (!logs.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nenhum log de execução
      </div>
    );
  }

  return (
    <div className="divide-y">
      {logs.map((log) => (
        <div key={log.id} className="p-3">
          <div className="flex items-center justify-between">
            <Badge variant={log.success ? 'default' : 'destructive'} className="text-[10px]">
              {log.success ? 'OK' : 'Erro'}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{log.iterations} iter</span>
            <span>{log.total_tokens} tokens</span>
            {log.execution_time_ms && <span>{log.execution_time_ms}ms</span>}
          </div>
          {log.error_message && (
            <p className="text-xs text-destructive mt-1 truncate">{log.error_message}</p>
          )}
          {log.tools_used && Array.isArray(log.tools_used) && log.tools_used.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {log.tools_used.map((tool: any, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {typeof tool === 'string' ? tool : tool?.name || 'tool'}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CoworkChatHeader({
  conversation,
  onBack,
}: {
  conversation: CoworkConversation;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border-b bg-muted/30">
      <Button size="icon" variant="ghost" onClick={onBack} className="md:hidden">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {(conversation.contact_name || conversation.phone_number || '?')[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {conversation.contact_name || conversation.phone_number}
        </p>
        <div className="flex items-center gap-1">
          <Badge variant={conversation.agent_active ? 'default' : 'secondary'} className="text-[10px] h-4">
            {conversation.agent_active ? 'Agente IA ativo' : 'Pendente'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function CoworkChatArea({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(200);
        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Erro ao buscar mensagens:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-2 max-w-3xl mx-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                msg.direction === 'outgoing'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {msg.body && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
              {msg.created_at && (
                <span className={cn(
                  "text-[10px] block text-right mt-1",
                  msg.direction === 'outgoing' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        ))}
        {!messages.length && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma mensagem nesta conversa
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
