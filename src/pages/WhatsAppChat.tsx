import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Search, 
  MessageSquare, 
  User, 
  Phone,
  Star,
  ExternalLink,
  Plus,
  Bot,
  UserCheck,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string;
}

interface Message {
  id: string;
  content: string | null;
  direction: string;
  message_type: string;
  media_url: string | null;
  media_caption: string | null;
  created_at: string;
  is_from_bot: boolean;
  status: string | null;
}

interface Lead {
  id: string;
  name: string;
  instagram: string;
  whatsapp: string;
  email: string | null;
  stage: string;
  stars: number;
}

interface Instance {
  id: string;
  name: string;
  phone_number: string | null;
  is_connected: boolean;
}

export default function WhatsAppChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [lead, setLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch instances user has access to
  useEffect(() => {
    const fetchInstances = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .select(`
          instance_id,
          can_view,
          whatsapp_instances!inner (
            id,
            name,
            phone_number,
            is_connected
          )
        `)
        .eq('user_id', user.id)
        .eq('can_view', true);

      if (!error && data) {
        const instancesList = data
          .map((d: any) => d.whatsapp_instances)
          .filter((i: Instance) => i.is_connected);
        setInstances(instancesList);
        if (instancesList.length > 0 && !selectedInstance) {
          setSelectedInstance(instancesList[0].id);
        }
      }
    };

    fetchInstances();
  }, [user]);

  // Fetch conversations for selected instance
  useEffect(() => {
    const fetchConversations = async () => {
      if (!selectedInstance) return;
      
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('instance_id', selectedInstance)
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        setConversations(data);
      }
    };

    fetchConversations();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('conversations-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_conversations',
        filter: `instance_id=eq.${selectedInstance}`
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedInstance]);

  // Fetch messages for selected conversation
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversation) return;
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
        // Reset unread count
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: 0 })
          .eq('id', selectedConversation.id);
      }
      setIsLoading(false);
    };

    fetchMessages();

    // Realtime for messages
    if (selectedConversation) {
      const channel = supabase
        .channel('messages-changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  // Fetch lead data
  useEffect(() => {
    const fetchLead = async () => {
      if (!selectedConversation?.lead_id) {
        setLead(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', selectedConversation.lead_id)
        .single();

      if (!error && data) {
        setLead(data);
      }
    };

    fetchLead();
  }, [selectedConversation?.lead_id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedInstance) return;
    
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-send-message', {
        body: {
          instanceId: selectedInstance,
          conversationId: selectedConversation.id,
          content: newMessage.trim(),
          messageType: 'text'
        }
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const createLead = async () => {
    if (!selectedConversation) return;
    
    // Navigate to new lead page with phone pre-filled
    navigate(`/leads/new?whatsapp=${selectedConversation.phone_number}&name=${selectedConversation.contact_name || ''}`);
  };

  const filteredConversations = conversations.filter(c => 
    (c.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone_number.includes(searchTerm))
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex bg-background">
        {/* Left Column - Conversations List */}
        <div className="w-80 border-r border-border flex flex-col bg-card">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Conversas
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="text-xs">{totalUnread}</Badge>
                )}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => navigate('/whatsapp')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Instance selector */}
            {instances.length > 1 && (
              <select 
                className="w-full mb-3 p-2 rounded-md border border-input bg-background text-sm"
                value={selectedInstance || ''}
                onChange={(e) => {
                  setSelectedInstance(e.target.value);
                  setSelectedConversation(null);
                }}
              >
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} {inst.phone_number && `(${inst.phone_number})`}
                  </option>
                ))}
              </select>
            )}
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">Mensagens recebidas aparecerão aqui</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedConversation?.id === conv.id && "bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.contact_profile_pic || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {conv.contact_name?.[0] || conv.phone_number.slice(-2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {conv.contact_name || conv.phone_number}
                          </span>
                          {conv.last_message_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(conv.last_message_at), 'HH:mm', { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-sm text-muted-foreground truncate">
                            {conv.phone_number}
                          </span>
                          {conv.unread_count > 0 && (
                            <Badge variant="destructive" className="text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        {conv.lead_id && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Lead vinculado
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Center Column - Chat */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.contact_profile_pic || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {selectedConversation.contact_name?.[0] || selectedConversation.phone_number.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">
                      {selectedConversation.contact_name || selectedConversation.phone_number}
                    </h3>
                    <p className="text-sm text-muted-foreground">{selectedConversation.phone_number}</p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4 bg-muted/30">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhuma mensagem ainda
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === 'outgoing' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-4 py-2 shadow-sm",
                            msg.direction === 'outgoing'
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-border"
                          )}
                        >
                          {msg.is_from_bot && (
                            <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                              <Bot className="h-3 w-3" />
                              Bot
                            </div>
                          )}
                          {msg.media_url && (
                            <img 
                              src={msg.media_url} 
                              alt="Media" 
                              className="rounded mb-2 max-w-full"
                            />
                          )}
                          <p className="whitespace-pre-wrap">{msg.content || msg.media_caption}</p>
                          <span className={cn(
                            "text-xs mt-1 block",
                            msg.direction === 'outgoing' ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={isSending}
                    className="flex-1"
                  />
                  <Button onClick={sendMessage} disabled={isSending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/30">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium">Selecione uma conversa</h3>
                <p className="text-sm">Escolha uma conversa para começar a atender</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Lead Info */}
        <div className="w-80 border-l border-border bg-card flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados do Contato
                </h3>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                {lead ? (
                  <div className="space-y-4">
                    {/* Lead Name */}
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">{lead.name}</p>
                    </div>

                    {/* Phone */}
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{lead.whatsapp}</p>
                    </div>

                    {/* Stars */}
                    <div>
                      <p className="text-sm text-muted-foreground">Prioridade</p>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={cn(
                              "h-4 w-4",
                              star <= lead.stars ? "fill-yellow-400 text-yellow-400" : "text-muted"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Stage */}
                    <div>
                      <p className="text-sm text-muted-foreground">Etapa do Funil</p>
                      <Badge variant="outline">{lead.stage}</Badge>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Lead Completo
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-4">
                      Nenhum lead vinculado a esta conversa
                    </p>
                    <Button onClick={createLead} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Lead
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground p-4">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecione uma conversa para ver os dados do lead</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
