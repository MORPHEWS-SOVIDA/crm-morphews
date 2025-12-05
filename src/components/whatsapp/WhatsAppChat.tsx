import { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Smile, Phone, Search, ArrowLeft, User, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface WhatsAppChatProps {
  instanceId: string;
  onBack?: () => void;
}

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
}

interface Message {
  id: string;
  content: string | null;
  direction: string;
  message_type: string;
  created_at: string;
  is_from_bot: boolean;
  media_url: string | null;
  media_caption: string | null;
}

export function WhatsAppChat({ instanceId, onBack }: WhatsAppChatProps) {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ["whatsapp-conversations", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("instance_id", instanceId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!instanceId,
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["whatsapp-messages", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation?.id,
  });

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `instance_id=eq.${instanceId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedConversation) throw new Error("No conversation selected");

      // Call edge function to send message via Z-API
      const { data, error } = await supabase.functions.invoke("zapi-send-message", {
        body: {
          conversationId: selectedConversation.id,
          instanceId: instanceId,
          content: text,
          messageType: "text",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    },
    onError: (error: any) => {
      console.error("Error sending message:", error);
      // Message might still be saved locally even if Z-API fails
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessage.mutate(messageText);
  };

  const filteredConversations = conversations?.filter(
    (c) =>
      c.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone_number.includes(searchTerm)
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, "HH:mm");
    }
    return format(date, "dd/MM", { locale: ptBR });
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">
      {/* Conversations List */}
      <div className={cn(
        "w-full md:w-80 border-r flex flex-col",
        selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {/* Search Header */}
        <div className="p-3 border-b">
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

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando conversas...
            </div>
          ) : filteredConversations?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhuma conversa encontrada
            </div>
          ) : (
            filteredConversations?.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                  selectedConversation?.id === conversation.id && "bg-muted"
                )}
                onClick={() => setSelectedConversation(conversation)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conversation.contact_profile_pic || undefined} />
                  <AvatarFallback className="bg-green-100 text-green-700">
                    {conversation.contact_name?.charAt(0) || conversation.phone_number.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate">
                      {conversation.contact_name || conversation.phone_number}
                    </span>
                    {conversation.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conversation.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground truncate">
                      {conversation.phone_number}
                    </span>
                    {conversation.unread_count > 0 && (
                      <Badge className="bg-green-500 text-white h-5 min-w-5 flex items-center justify-center">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center justify-between px-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar>
                  <AvatarImage src={selectedConversation.contact_profile_pic || undefined} />
                  <AvatarFallback className="bg-green-100 text-green-700">
                    {selectedConversation.contact_name?.charAt(0) || selectedConversation.phone_number.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedConversation.contact_name || selectedConversation.phone_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.phone_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConversation.lead_id ? (
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    Ver Lead
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2">
                    <Star className="h-4 w-4" />
                    Criar Lead
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-[url('/whatsapp-bg.png')] bg-repeat bg-[length:400px]">
              <div className="space-y-2 max-w-3xl mx-auto">
                {loadingMessages ? (
                  <div className="text-center text-muted-foreground">
                    Carregando mensagens...
                  </div>
                ) : messages?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem ainda
                  </div>
                ) : (
                  messages?.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.direction === "outbound" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                          message.direction === "outbound"
                            ? "bg-green-100 dark:bg-green-900/40 text-foreground"
                            : "bg-background text-foreground",
                          message.is_from_bot && "border-l-2 border-blue-400"
                        )}
                      >
                        {message.is_from_bot && (
                          <span className="text-xs text-blue-500 font-medium block mb-1">
                            🤖 Robô
                          </span>
                        )}
                        {message.media_url && (
                          <img
                            src={message.media_url}
                            alt="Media"
                            className="rounded-lg max-w-full mb-2"
                          />
                        )}
                        <p className="whitespace-pre-wrap break-words">
                          {message.content || message.media_caption}
                        </p>
                        <span className="text-[10px] text-muted-foreground float-right mt-1 ml-2">
                          {format(new Date(message.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 border-t bg-muted/30">
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  className="shrink-0 bg-green-500 hover:bg-green-600"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sendMessage.isPending}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Phone className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm">Escolha um contato para ver as mensagens</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
