import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  ArrowLeft,
  RefreshCw,
  Link,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, normalizeText } from '@/lib/utils';
import { EmojiPicker } from '@/components/whatsapp/EmojiPicker';
import { ImageUpload } from '@/components/whatsapp/ImageUpload';
import { AudioRecorder } from '@/components/whatsapp/AudioRecorder';
import { MessageBubble } from '@/components/whatsapp/MessageBubble';
import { ConversationItem } from '@/components/whatsapp/ConversationItem';
import { LeadSearchDialog } from '@/components/whatsapp/LeadSearchDialog';

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string;
  chat_id?: string | null;
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
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  // State
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Media state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<{ base64: string; mimeType: string } | null>(null);
  
  // Dialog state
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch instances user has access to (incluindo desconectadas)
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
        // IMPORTANTE: Não filtra por is_connected - mostra todas instâncias
        const instancesList = data
          .map((d: any) => d.whatsapp_instances);
        setInstances(instancesList);
        if (instancesList.length > 0 && !selectedInstance) {
          // Prioriza instância conectada, mas aceita desconectada
          const connected = instancesList.find((i: Instance) => i.is_connected);
          setSelectedInstance(connected?.id || instancesList[0].id);
        }
      }
    };

    fetchInstances();
  }, [user]);

  // Send presence updates every 5 minutes
  useEffect(() => {
    const sendPresenceUpdate = async () => {
      try {
        await supabase.functions.invoke('whatsapp-presence-update');
      } catch (error) {
        console.error('Presence update error:', error);
      }
    };

    sendPresenceUpdate();
    const presenceInterval = setInterval(sendPresenceUpdate, 5 * 60 * 1000);
    return () => clearInterval(presenceInterval);
  }, []);

  // Fetch conversations for selected instance
  useEffect(() => {
    const fetchConversations = async () => {
      if (!selectedInstance || !profile?.organization_id) return;
      
      // Busca por organization_id ao invés de instance_id para ver conversas de todas as instâncias
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (!error && data) {
        // Filtrar pela instância selecionada ou mostrar todas se current_instance_id
        const filtered = data.filter(c => 
          c.instance_id === selectedInstance || 
          c.current_instance_id === selectedInstance
        );
        setConversations(filtered);
      }
    };

    fetchConversations();
    
    // Realtime subscription - escuta por organization_id para pegar todas as atualizações
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_conversations',
      }, (payload) => {
        console.log('[Realtime] Conversation update:', payload);
        // Refetch ao receber qualquer mudança
        fetchConversations();
      })
      .subscribe((status) => {
        console.log('[Realtime] Conversations subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedInstance, profile?.organization_id]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
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
  }, [selectedConversation]);

  useEffect(() => {
    fetchMessages();

    if (selectedConversation) {
      // Realtime for messages - escuta todos os eventos
      const channel = supabase
        .channel(`messages-realtime-${selectedConversation.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        }, (payload) => {
          console.log('[Realtime] New message:', payload);
          setMessages(prev => {
            const newMsg = payload.new as Message;
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) return prev;
            return [...prev, newMsg];
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        }, (payload) => {
          console.log('[Realtime] Message updated:', payload);
          setMessages(prev => prev.map(m => 
            m.id === (payload.new as Message).id ? payload.new as Message : m
          ));
        })
        .subscribe((status) => {
          console.log('[Realtime] Messages subscription status:', status);
        });

      // Polling backup every 5 seconds (reduced frequency since realtime should work)
      const pollInterval = setInterval(async () => {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('conversation_id', selectedConversation.id)
          .order('created_at', { ascending: true });
        
        if (data && data.length > messages.length) {
          console.log('[Polling] Found new messages:', data.length - messages.length);
          setMessages(data);
        }
      }, 5000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [selectedConversation?.id, fetchMessages]);

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

  const refreshMessages = async () => {
    setIsRefreshing(true);
    await fetchMessages();
    setIsRefreshing(false);
    toast.success('Mensagens atualizadas');
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage && !pendingAudio) || !selectedConversation || !selectedInstance) return;
    
    const messageText = newMessage.trim();
    const imageToSend = selectedImage;
    const audioToSend = pendingAudio;
    
    // Clear inputs
    setNewMessage('');
    setSelectedImage(null);
    setSelectedImageMime(null);
    setPendingAudio(null);
    setIsSending(true);
    
    // Determine message type
    let messageType = 'text';
    let mediaUrl = null;
    
    if (audioToSend) {
      messageType = 'audio';
      mediaUrl = audioToSend.base64;
    } else if (imageToSend) {
      messageType = 'image';
      mediaUrl = imageToSend;
    }
    
    // Add optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageText || null,
      direction: 'outbound',
      message_type: messageType,
      media_url: mediaUrl,
      media_caption: messageText || null,
      created_at: new Date().toISOString(),
      is_from_bot: false,
      status: 'sending'
    };
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const body: any = {
        organizationId: profile.organization_id,
        instanceId: selectedInstance,
        conversationId: selectedConversation.id,
        chatId: selectedConversation.chat_id || null,
        phone: selectedConversation.phone_number,
        messageType,
        content: messageText || '',
      };

      if (audioToSend) {
        body.mediaUrl = audioToSend.base64;
      } else if (imageToSend) {
        body.mediaUrl = imageToSend;
        body.mediaCaption = messageText || '';
      }

      console.log("[WhatsApp] Enviando mensagem:", {
        organization_id: profile.organization_id,
        instance_id: selectedInstance,
        conversation_id: selectedConversation.id,
        message_type: messageType,
      });

      const { data, error } = await supabase.functions.invoke('whatsapp-send-message', {
        body
      });

      if (error) {
        console.error("[WhatsApp] Edge function error:", error);
        throw new Error(error.message || 'Erro na função de envio');
      }

      if (data?.error) {
        console.error("[WhatsApp] API error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.success) {
        console.error("[WhatsApp] Send failed:", data);
        throw new Error(data?.error || 'Falha ao enviar mensagem');
      }

      console.log("[WhatsApp] Mensagem enviada:", data?.providerMessageId);
      
      // Replace optimistic message with real one
      if (data?.message) {
        setMessages(prev => prev.map(m => 
          m.id === optimisticMessage.id ? data.message : m
        ));
      }
      
      inputRef.current?.focus();
    } catch (error: any) {
      console.error("[WhatsApp] Error:", error);
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      toast.error('Erro ao enviar: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleImageSelect = (base64: string, mimeType: string) => {
    setSelectedImage(base64);
    setSelectedImageMime(mimeType);
  };

  const handleAudioReady = (base64: string, mimeType: string) => {
    setPendingAudio({ base64, mimeType });
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setSelectedImageMime(null);
  };

  const clearPendingAudio = () => {
    setPendingAudio(null);
  };

  // Lead management
  const handleLeadSelected = async (leadId: string) => {
    if (!selectedConversation) return;
    
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ lead_id: leadId })
      .eq('id', selectedConversation.id);
    
    if (!error) {
      setSelectedConversation(prev => prev ? { ...prev, lead_id: leadId } : null);
      toast.success('Lead vinculado!');
    }
  };

  const handleCreateLead = async (name: string, phone: string) => {
    if (!profile?.organization_id || !selectedConversation) return;
    
    try {
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          name,
          whatsapp: phone,
          instagram: '',
          assigned_to: `${profile.first_name} ${profile.last_name}`,
          organization_id: profile.organization_id,
          created_by: profile.user_id,
          stage: 'prospect',
          stars: 3,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation with lead_id
      await supabase
        .from('whatsapp_conversations')
        .update({ lead_id: lead.id })
        .eq('id', selectedConversation.id);

      // Add as lead responsible
      await supabase
        .from('lead_responsibles')
        .insert({
          lead_id: lead.id,
          user_id: profile.user_id,
          organization_id: profile.organization_id,
        });

      setSelectedConversation(prev => prev ? { ...prev, lead_id: lead.id } : null);
      toast.success('Lead criado e vinculado!');
    } catch (error: any) {
      toast.error('Erro ao criar lead: ' + error.message);
    }
  };

  const filteredConversations = conversations.filter(c => 
    (normalizeText(c.contact_name || '').includes(normalizeText(searchTerm)) ||
    c.phone_number.includes(searchTerm))
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <Layout>
      <div className="h-[calc(100vh-6rem)] lg:h-[calc(100vh-5rem)] flex bg-background -m-4 lg:-m-8">
        {/* Left Column - Conversations List */}
        <div className="w-80 border-r border-border flex flex-col bg-card overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Conversas
                {totalUnread > 0 && (
                  <Badge variant="destructive" className="text-xs rounded-full">
                    {totalUnread}
                  </Badge>
                )}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => navigate('/whatsapp')}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Instance selector */}
            {instances.length > 1 && (
              <select 
                className="w-full mb-2 p-2 rounded-md border border-input bg-background text-sm"
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
                className="pl-9 bg-background"
              />
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhuma conversa</p>
                <p className="text-xs mt-1">Mensagens recebidas aparecerão aqui</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversation?.id === conv.id}
                  onClick={() => setSelectedConversation(conv)}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Center Column - Chat */}
        <div className="flex-1 flex flex-col bg-[#e5ddd5] dark:bg-zinc-900">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedConversation.contact_profile_pic || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white">
                      {selectedConversation.contact_name?.[0]?.toUpperCase() || selectedConversation.phone_number.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {selectedConversation.contact_name || selectedConversation.phone_number}
                    </h3>
                    <p className="text-xs text-muted-foreground">{selectedConversation.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={refreshMessages}
                    disabled={isRefreshing}
                    className="h-8 w-8"
                  >
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center bg-white/80 dark:bg-zinc-800/80 rounded-lg p-6">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">Nenhuma mensagem</p>
                      <p className="text-sm">Envie uma mensagem para começar</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-w-3xl mx-auto">
                    {messages.map(msg => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Media Preview */}
              {(selectedImage || pendingAudio) && (
                <div className="px-4 py-2 border-t border-border bg-card">
                  <div className="flex items-center gap-3">
                    {selectedImage && (
                      <>
                        <img 
                          src={selectedImage} 
                          alt="Preview" 
                          className="h-16 w-16 object-cover rounded"
                        />
                        <span className="text-sm text-muted-foreground">Imagem selecionada</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearSelectedImage}
                          className="ml-auto"
                        >
                          Remover
                        </Button>
                      </>
                    )}
                    {pendingAudio && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm">Áudio pronto para enviar</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearPendingAudio}
                          className="ml-auto"
                        >
                          Remover
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-center gap-2">
                  <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  <ImageUpload 
                    onImageSelect={handleImageSelect}
                    isUploading={false}
                    selectedImage={null}
                    onClear={clearSelectedImage}
                  />
                  <AudioRecorder 
                    onAudioReady={handleAudioReady}
                    isRecording={isRecordingAudio}
                    setIsRecording={setIsRecordingAudio}
                  />
                  <Input
                    ref={inputRef}
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={isSending || isRecordingAudio}
                    className="flex-1 bg-background"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={isSending || isRecordingAudio || (!newMessage.trim() && !selectedImage && !pendingAudio)}
                    size="icon"
                    className="bg-green-600 hover:bg-green-700 h-9 w-9"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground bg-white/80 dark:bg-zinc-800/80 rounded-lg p-8">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-1">Selecione uma conversa</h3>
                <p className="text-sm">Escolha uma conversa para começar a atender</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Lead Info */}
        <div className="w-80 border-l border-border bg-card flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados do Contato
                </h3>
              </div>

              <ScrollArea className="flex-1 p-4">
                {lead ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-primary/20 text-primary text-xl">
                          {lead.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{lead.name}</h4>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              className={cn(
                                "h-4 w-4",
                                i < lead.stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.whatsapp}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">@</span>
                          <span>{lead.email}</span>
                        </div>
                      )}
                      {lead.instagram && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">IG</span>
                          <span>{lead.instagram}</span>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <span className="text-sm text-muted-foreground">Etapa do funil</span>
                      <Badge variant="secondary" className="mt-1 capitalize">
                        {lead.stage}
                      </Badge>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Lead Completo
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground mb-4 text-sm">
                      Nenhum lead vinculado
                    </p>
                    <Button onClick={() => setShowLeadDialog(true)} className="w-full">
                      <Link className="h-4 w-4 mr-2" />
                      Vincular Lead
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground p-4">
                <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa para ver os dados</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lead Search Dialog */}
      {selectedConversation && (
        <LeadSearchDialog
          open={showLeadDialog}
          onOpenChange={setShowLeadDialog}
          conversationPhone={selectedConversation.phone_number}
          contactName={selectedConversation.contact_name}
          onLeadSelected={handleLeadSelected}
          onCreateNew={handleCreateLead}
        />
      )}
    </Layout>
  );
}
