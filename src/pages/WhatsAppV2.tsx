import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { 
  useWhatsAppV2Instances, 
  useWhatsAppV2Chats, 
  useWhatsAppV2Messages,
  useSendWhatsAppV2Message,
  useMarkWhatsAppV2ChatAsRead,
  type WhatsAppV2Chat,
  type WhatsAppV2Message,
} from '@/hooks/useWhatsAppV2';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Send, 
  Search, 
  Phone, 
  MoreVertical,
  Paperclip,
  Smile,
  MessageSquare,
  Users,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Settings,
  Loader2,
  Copy
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { SatisfactionDashboard } from '@/components/whatsapp/SatisfactionDashboard';
import { WhatsAppAISettingsManager } from '@/components/settings/WhatsAppAISettingsManager';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatMessageTime(dateString: string | null): string {
  if (!dateString) return '';
  
  try {
    const date = parseISO(dateString);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Ontem';
    } else {
      return format(date, 'dd/MM/yy');
    }
  } catch {
    return '';
  }
}

function formatFullMessageTime(dateString: string): string {
  try {
    return format(parseISO(dateString), "HH:mm", { locale: ptBR });
  } catch {
    return '';
  }
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function getStatusIcon(status: WhatsAppV2Message['status']) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

// =====================================================
// CHAT LIST ITEM COMPONENT
// =====================================================

interface ChatListItemProps {
  chat: WhatsAppV2Chat;
  isSelected: boolean;
  onClick: () => void;
}

function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-border/50",
        isSelected 
          ? "bg-accent" 
          : "hover:bg-muted/50"
      )}
    >
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={chat.image_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary">
          {chat.is_group ? <Users className="h-5 w-5" /> : getInitials(chat.name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium truncate">
            {chat.name || chat.whatsapp_id.split('@')[0]}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatMessageTime(chat.last_message_time)}
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm text-muted-foreground truncate">
            {chat.last_message || 'Sem mensagens'}
          </p>
          {chat.unread_count > 0 && (
            <Badge className="bg-primary text-primary-foreground h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MESSAGE BUBBLE COMPONENT
// =====================================================

interface MessageBubbleProps {
  message: WhatsAppV2Message;
  showSender?: boolean;
}

function MessageBubble({ message, showSender }: MessageBubbleProps) {
  const isFromMe = message.is_from_me;
  
  return (
    <div className={cn(
      "flex mb-1",
      isFromMe ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
        isFromMe 
          ? "bg-primary text-primary-foreground rounded-br-none" 
          : "bg-card border border-border rounded-bl-none"
      )}>
        {showSender && message.sender_name && !isFromMe && (
          <p className="text-xs font-medium text-primary mb-1">
            {message.sender_name}
          </p>
        )}
        
        {message.quoted_content && (
          <div className={cn(
            "text-xs p-2 rounded mb-1 border-l-2",
            isFromMe 
              ? "bg-primary-foreground/10 border-primary-foreground/50" 
              : "bg-muted border-primary"
          )}>
            {message.quoted_content}
          </div>
        )}
        
        {message.media_url && message.media_type === 'image' && (
          <img 
            src={message.media_url} 
            alt="Imagem" 
            className="rounded max-w-full mb-1"
          />
        )}
        
        {message.media_url && message.media_type === 'audio' && (
          <audio controls className="max-w-full mb-1">
            <source src={message.media_url} />
          </audio>
        )}
        
        {message.media_url && message.media_type === 'video' && (
          <video controls className="rounded max-w-full mb-1">
            <source src={message.media_url} />
          </video>
        )}
        
        {message.media_url && message.media_type === 'document' && (
          <a 
            href={message.media_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-background/10 rounded mb-1 hover:underline"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-sm">{message.media_filename || 'Documento'}</span>
          </a>
        )}
        
        {message.content && (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
        
        <div className={cn(
          "flex items-center gap-1 mt-1",
          isFromMe ? "justify-end" : "justify-start"
        )}>
          <span className={cn(
            "text-[10px]",
            isFromMe ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatFullMessageTime(message.created_at)}
          </span>
          {isFromMe && getStatusIcon(message.status)}
        </div>
        
        {message.error_message && (
          <p className="text-xs text-destructive mt-1">
            {message.error_message}
          </p>
        )}
      </div>
    </div>
  );
}

// =====================================================
// EMPTY STATE COMPONENT
// =====================================================

function EmptyState({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm">{description}</p>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function WhatsAppV2() {
  const isMobile = useIsMobile();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showChatList, setShowChatList] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: instances, isLoading: loadingInstances } = useWhatsAppV2Instances();
  const { data: chats, isLoading: loadingChats } = useWhatsAppV2Chats(selectedInstanceId);
  const { data: messages, isLoading: loadingMessages } = useWhatsAppV2Messages(selectedChatId);
  const sendMessage = useSendWhatsAppV2Message();
  const markAsRead = useMarkWhatsAppV2ChatAsRead();
  
  
  // Não auto-selecionar instância - deixar em "Todas" por padrão
  
  // Mark as read when chat is selected
  useEffect(() => {
    if (selectedChatId) {
      markAsRead.mutate(selectedChatId);
    }
  }, [selectedChatId]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Filter chats by search
  const filteredChats = chats?.filter(chat => 
    !searchQuery || 
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.whatsapp_id.includes(searchQuery)
  ) || [];
  
  // Get selected chat / instance info
  const selectedChat = chats?.find(c => c.id === selectedChatId);
  const selectedInstance = instances?.find(i => i.id === selectedInstanceId);
  const isInstanceConnected = selectedInstance?.is_connected ?? true;
  
  // Handle send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChatId || !selectedInstanceId) return;
    
    const content = messageInput.trim();
    setMessageInput('');
    
    try {
      await sendMessage.mutateAsync({
        chat_id: selectedChatId,
        instance_id: selectedInstanceId,
        content,
      });
      
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
      setMessageInput(content); // Restore message on error
    }
  };
  
  // Handle chat selection
  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    if (isMobile) {
      setShowChatList(false);
    }
  };
  
  // Handle back to list on mobile
  const handleBackToList = () => {
    setShowChatList(true);
    setSelectedChatId(null);
  };
  
  
  // Generate webhook URL for instance
  const getWebhookUrl = (instanceId: string) => {
    return `https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/whatsapp-webhook?instance_id=${instanceId}`;
  };
  
  // Copy webhook URL
  const copyWebhookUrl = (instanceId: string) => {
    navigator.clipboard.writeText(getWebhookUrl(instanceId));
    toast.success('URL do webhook copiada!');
  };
  
  // Check if there's a group to show sender names
  const isGroupChat = selectedChat?.is_group;
  
  return (
    <Layout>
      <div className="flex flex-col min-h-0 h-full">
        {/* Global AI Settings Section - sempre visível no topo */}
        <div className="border-b bg-background">
          <div className="p-4">
            <WhatsAppAISettingsManager />
          </div>
        </div>
        
        {/* Dashboard de Satisfação NPS */}
        <SatisfactionDashboard />
        
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">WhatsApp 2.0</h1>
              <p className="text-sm text-muted-foreground">Multi-instância</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {instances && instances.length > 0 && (
              <Select 
                value={selectedInstanceId || "all"} 
                onValueChange={(val) => setSelectedInstanceId(val === "all" ? null : val)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione instância" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      Todas as instâncias
                    </div>
                  </SelectItem>
                  {instances.map(instance => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          instance.is_connected ? 'bg-green-500' : 'bg-muted'
                        )} />
                        {instance.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Copy Webhook URL Button */}
            {selectedInstanceId && (
              <Button 
                variant="outline" 
                size="icon" 
                title="Copiar URL do Webhook"
                onClick={() => copyWebhookUrl(selectedInstanceId)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat List */}
          <div className={cn(
            "w-full md:w-80 lg:w-96 border-r bg-background flex flex-col",
            isMobile && !showChatList && "hidden"
          )}>
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            {/* Chat List */}
            <ScrollArea className="flex-1">
              {loadingInstances || loadingChats ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredChats.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nenhuma conversa"
                  description={
                    searchQuery 
                      ? "Nenhuma conversa encontrada com essa busca"
                      : "Suas conversas aparecerão aqui"
                  }
                />
              ) : (
                filteredChats.map(chat => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    isSelected={chat.id === selectedChatId}
                    onClick={() => handleSelectChat(chat.id)}
                  />
                ))
              )}
            </ScrollArea>
          </div>
          
          {/* Chat Area */}
          <div className={cn(
            "flex-1 flex flex-col bg-muted/30",
            isMobile && showChatList && "hidden"
          )}>
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center gap-3 p-3 border-b bg-background">
                  {isMobile && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleBackToList}
                      className="mr-1"
                    >
                      ←
                    </Button>
                  )}
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.image_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedChat.is_group 
                        ? <Users className="h-4 w-4" /> 
                        : getInitials(selectedChat.name)
                      }
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium truncate">
                      {selectedChat.name || selectedChat.whatsapp_id.split('@')[0]}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selectedInstance?.is_connected ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="Sem mensagens"
                      description="Envie uma mensagem para iniciar a conversa"
                    />
                  ) : (
                    <>
                      {messages?.map(message => (
                        <MessageBubble 
                          key={message.id} 
                          message={message}
                          showSender={isGroupChat}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </ScrollArea>
                
                {/* Input Area */}
                <div className="p-3 border-t bg-background">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <Smile className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <Paperclip className="h-5 w-5" />
                    </Button>

                    <Input
                      placeholder="Digite uma mensagem..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1"
                    />

                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || sendMessage.isPending}
                    >
                      {sendMessage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {!isInstanceConnected && (
                    <p className="text-xs text-destructive mt-2 text-center">
                      WhatsApp desconectado (ou status desatualizado). Vamos tentar enviar mesmo assim; se falhar, reconecte a instância.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="Selecione uma conversa"
                description="Escolha uma conversa da lista para começar a enviar mensagens"
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
