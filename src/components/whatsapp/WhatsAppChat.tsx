import { useState, useEffect, useRef } from "react";
import { Send, Phone, Search, ArrowLeft, User, Loader2, Plus, ExternalLink, Mic, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { MessageBubble } from "./MessageBubble";
import { AudioRecorder } from "./AudioRecorder";
import { EmojiPicker } from "./EmojiPicker";

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
  status: string | null;
}

export function WhatsAppChat({ instanceId, onBack }: WhatsAppChatProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ["whatsapp-conversations", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("instance_id", instanceId)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!instanceId,
    refetchInterval: 5000, // Poll every 5 seconds
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
      
      // Mark as read
      if (selectedConversation.unread_count > 0) {
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0 })
          .eq("id", selectedConversation.id);
        
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      }
      
      return data as Message[];
    },
    enabled: !!selectedConversation?.id,
    refetchInterval: 3000, // Poll every 3 seconds
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
        () => {
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

      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
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
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    },
    onError: (error: any) => {
      console.error("Error sending message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessage.mutate(messageText);
  };

  const handleSendAudio = async (base64: string, mimeType: string) => {
    if (!selectedConversation) return;
    
    setIsSendingAudio(true);
    try {
      // Extract raw base64 without data: prefix
      const rawBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
      
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          conversationId: selectedConversation.id,
          instanceId: instanceId,
          content: "",
          messageType: "audio",
          mediaBase64: rawBase64,
          mediaMimeType: mimeType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error("Falha ao enviar áudio");

      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      toast({ title: "Áudio enviado!" });
    } catch (error: any) {
      console.error("Error sending audio:", error);
      toast({
        title: "Erro ao enviar áudio",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSendingAudio(false);
      setIsRecordingAudio(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setSelectedImage({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSendImage = async () => {
    if (!selectedConversation || !selectedImage) return;

    setIsSendingImage(true);
    try {
      // Extract raw base64 without data: prefix
      const rawBase64 = selectedImage.base64.includes(',') 
        ? selectedImage.base64.split(',')[1] 
        : selectedImage.base64;

      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          conversationId: selectedConversation.id,
          instanceId: instanceId,
          content: messageText || "",
          messageType: "image",
          mediaBase64: rawBase64,
          mediaMimeType: selectedImage.mimeType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error("Falha ao enviar imagem");

      setSelectedImage(null);
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      toast({ title: "Imagem enviada!" });
    } catch (error: any) {
      console.error("Error sending image:", error);
      toast({
        title: "Erro ao enviar imagem",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSendingImage(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessageText(prev => prev + emoji);
  };

  const handleCreateLead = async () => {
    if (!selectedConversation || !newLeadName.trim() || !profile?.organization_id) return;

    setIsCreatingLead(true);
    try {
      // Create lead
      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          name: newLeadName,
          instagram: "",
          whatsapp: selectedConversation.phone_number,
          assigned_to: `${profile.first_name} ${profile.last_name}`,
          organization_id: profile.organization_id,
          created_by: profile.user_id,
          stage: "prospect",
          stars: 3,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation with lead_id
      await supabase
        .from("whatsapp_conversations")
        .update({ lead_id: lead.id })
        .eq("id", selectedConversation.id);

      // Add as lead responsible
      await supabase
        .from("lead_responsibles")
        .insert({
          lead_id: lead.id,
          user_id: profile.user_id,
          organization_id: profile.organization_id,
        });

      // Update local state
      setSelectedConversation({ ...selectedConversation, lead_id: lead.id });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });

      toast({ title: "Lead criado com sucesso!" });
      setShowCreateLeadDialog(false);
      setNewLeadName("");
    } catch (error: any) {
      toast({
        title: "Erro ao criar lead",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingLead(false);
    }
  };

  const handleViewLead = () => {
    if (selectedConversation?.lead_id) {
      navigate(`/leads/${selectedConversation.lead_id}`);
    }
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

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "sent":
        return "✓";
      case "delivered":
        return "✓✓";
      case "read":
        return <span className="text-blue-500">✓✓</span>;
      default:
        return null;
    }
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
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando conversas...
            </div>
          ) : filteredConversations?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-xs mt-1">Aguardando mensagens...</p>
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
                    {conversation.contact_name?.charAt(0) || conversation.phone_number.slice(-2)}
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
                      {conversation.lead_id ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <User className="h-3 w-3" /> Lead vinculado
                        </span>
                      ) : (
                        conversation.phone_number
                      )}
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
                    {selectedConversation.contact_name?.charAt(0) || selectedConversation.phone_number.slice(-2)}
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={handleViewLead}
                  >
                    <User className="h-4 w-4" />
                    Ver Lead
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => {
                      setNewLeadName(selectedConversation.contact_name || "");
                      setShowCreateLeadDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Criar Lead
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-muted/20">
              <div className="space-y-2 max-w-3xl mx-auto">
                {loadingMessages ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando mensagens...
                  </div>
                ) : messages?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Phone className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-xs mt-1">Envie uma mensagem para iniciar</p>
                  </div>
                ) : (
                  messages?.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Image preview */}
            {selectedImage && (
              <div className="p-3 border-t bg-muted/30">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                  <img 
                    src={selectedImage.base64} 
                    alt="Preview" 
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                  <span className="text-sm text-muted-foreground flex-1">Imagem selecionada</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedImage(null)}>
                    Remover
                  </Button>
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t bg-muted/30">
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                {isRecordingAudio ? (
                  <div className="flex-1 flex items-center justify-center">
                    <AudioRecorder
                      onAudioReady={handleSendAudio}
                      isRecording={isRecordingAudio}
                      setIsRecording={setIsRecordingAudio}
                    />
                    {isSendingAudio && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Enviando...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="shrink-0"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isSendingImage}
                    >
                      {isSendingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Input
                      placeholder="Digite uma mensagem..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (selectedImage) {
                            handleSendImage();
                          } else {
                            handleSendMessage();
                          }
                        }
                      }}
                      className="flex-1"
                      disabled={sendMessage.isPending || isSendingImage}
                    />
                    {selectedImage ? (
                      <Button
                        size="icon"
                        className="shrink-0 bg-green-500 hover:bg-green-600"
                        onClick={handleSendImage}
                        disabled={isSendingImage}
                      >
                        {isSendingImage ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    ) : messageText.trim() ? (
                      <Button
                        size="icon"
                        className="shrink-0 bg-green-500 hover:bg-green-600"
                        onClick={handleSendMessage}
                        disabled={sendMessage.isPending}
                      >
                        {sendMessage.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => setIsRecordingAudio(true)}
                      >
                        <Mic className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    )}
                  </>
                )}
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

      {/* Create Lead Dialog */}
      <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Lead</Label>
              <Input
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                placeholder="Digite o nome do lead"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={selectedConversation?.phone_number || ""}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLeadDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateLead}
              disabled={!newLeadName.trim() || isCreatingLead}
            >
              {isCreatingLead ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Criar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
