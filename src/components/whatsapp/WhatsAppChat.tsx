import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Phone, Search, ArrowLeft, User, Loader2, Plus, ExternalLink, Mic, Image as ImageIcon, Info, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, normalizeText } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { MessageBubble } from "./MessageBubble";
import { AudioRecorder } from "./AudioRecorder";
import { EmojiPicker } from "./EmojiPicker";
import { useIsMobile } from "@/hooks/use-mobile";

interface WhatsAppChatProps {
  instanceId?: string; // Agora opcional - se não passar, busca todas da org
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
  // Campos do lead (via whatsapp_conversations_view)
  lead_name?: string | null;
  lead_stage?: string | null;

  contact_id: string | null;
  instance_id: string;
  channel_name?: string;
  channel_phone_number?: string;
  chat_id?: string; // NOVO: ID estável do chat (JID)
  is_group?: boolean; // NOVO: indica se é grupo
  group_subject?: string; // NOVO: nome do grupo
  display_name?: string; // NOVO: nome para exibição
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
  contact_id: string | null;
}

export function WhatsAppChat({ instanceId, onBack }: WhatsAppChatProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [showLeadInfoDrawer, setShowLeadInfoDrawer] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File; preview: string } | null>(null);

  // Wasender throttle: they enforce "1 message every ~5 seconds".
  const SEND_COOLDOWN_MS = 5000;
  const [lastSendAt, setLastSendAt] = useState<number>(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch instance status to know if connected
  const { data: instanceData } = useQuery({
    queryKey: ["whatsapp-instance-status", instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, name, is_connected, phone_number")
        .eq("id", instanceId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!instanceId,
    refetchInterval: 10000, // Check every 10 seconds
  });

  const isInstanceConnected = instanceData?.is_connected ?? true; // Default to true if no instanceId

  // Fetch conversations - CONTACT CENTRIC: busca da org, não de uma instância
  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ["whatsapp-conversations-org", instanceId, profile?.organization_id],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_conversations_view")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      // Se passou instanceId, filtra por ele; senão busca todas da org
      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!profile?.organization_id,
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

  // Real-time subscription for new messages - agora pela org
  useEffect(() => {
    if (!profile?.organization_id) return;
    
    const channel = supabase
      .channel(`messages-org-${profile.organization_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow textarea (min/max variam no mobile)
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const lineHeight = 24; // approx line height
    const minLines = isMobile ? 3 : 2;
    const maxLines = isMobile ? 8 : 6;

    const minHeight = lineHeight * minLines;
    const maxHeight = lineHeight * maxLines;
    const scrollHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${scrollHeight}px`;
  }, [isMobile]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [messageText, adjustTextareaHeight]);
  // Send message mutation - usa o instance_id da conversa
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      console.log("[WhatsApp] Enviando mensagem de texto:", {
        organization_id: profile.organization_id,
        conversation_id: selectedConversation.id,
        instance_id: selectedConversation.instance_id,
        has_chat_id: !!selectedConversation.chat_id,
      });

      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          organizationId: profile.organization_id,
          conversationId: selectedConversation.id,
          instanceId: selectedConversation.instance_id,
          chatId: selectedConversation.chat_id || null,
          phone: selectedConversation.phone_number,
          content: text,
          messageType: "text",
        },
      });

      // Melhorado tratamento de erro
      if (error) {
        console.error("[WhatsApp] Edge function error:", error);
        throw new Error(error.message || "Erro na função de envio");
      }
      
      if (data?.error) {
        console.error("[WhatsApp] API error:", data.error);
        throw new Error(data.error);
      }

      if (!data?.success) {
        console.error("[WhatsApp] Send failed:", data);
        throw new Error(data?.error || "Falha ao enviar mensagem para o WhatsApp");
      }

      console.log("[WhatsApp] Mensagem enviada com sucesso:", data?.providerMessageId);
      return data;
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
    },
    onError: (error: any) => {
      console.error("[WhatsApp] Error sending message:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!messageText.trim()) return;

    const now = Date.now();
    if (now - lastSendAt < SEND_COOLDOWN_MS) {
      toast({
        title: "Aguarde um pouco",
        description: "Para evitar bloqueio do WhatsApp, envie no máximo 1 mensagem a cada 5 segundos.",
        variant: "destructive",
      });
      return;
    }

    setLastSendAt(now);
    sendMessage.mutate(messageText);
  };

  const handleSendAudio = async (base64: string, mimeType: string) => {
    if (!selectedConversation) return;
    if (!profile?.organization_id) {
      toast({
        title: "Erro ao enviar áudio",
        description: "Organização não encontrada.",
        variant: "destructive",
      });
      return;
    }

    const now = Date.now();
    if (now - lastSendAt < SEND_COOLDOWN_MS) {
      toast({
        title: "Aguarde um pouco",
        description: "Para evitar bloqueio do WhatsApp, envie no máximo 1 mensagem a cada 5 segundos.",
        variant: "destructive",
      });
      return;
    }
    setLastSendAt(now);

    setIsSendingAudio(true);
    try {
      // Converter base64 para blob para upload direto
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      console.log("[WhatsApp] Criando URL de upload para áudio:", {
        conversation_id: selectedConversation.id,
        size_bytes: blob.size,
        mime_type: mimeType,
      });

      // 1. Obter signed upload URL
      const { data: uploadUrlData, error: uploadUrlError } = await supabase.functions.invoke(
        "whatsapp-create-upload-url",
        {
          body: {
            organizationId: profile.organization_id,
            conversationId: selectedConversation.id,
            mimeType: mimeType,
            kind: "audio",
          },
        }
      );

      if (uploadUrlError || !uploadUrlData?.success) {
        throw new Error(uploadUrlData?.error || uploadUrlError?.message || "Falha ao criar URL de upload");
      }

      console.log("[WhatsApp] Upload URL obtida, fazendo upload direto...");

      // 2. Upload direto para storage
      const uploadResponse = await fetch(uploadUrlData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Falha no upload: ${uploadResponse.status}`);
      }

      console.log("[WhatsApp] Upload concluído, enviando mensagem...");

      // 3. Enviar mensagem com path do storage (não base64!)
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          organizationId: profile.organization_id,
          conversationId: selectedConversation.id,
          instanceId: selectedConversation.instance_id,
          chatId: selectedConversation.chat_id || null,
          phone: selectedConversation.phone_number,
          content: "",
          messageType: "audio",
          mediaStoragePath: uploadUrlData.path,
          mediaMimeType: mimeType,
        },
      });

      if (error) {
        console.error("[WhatsApp] Edge function error:", error);
        throw new Error(error.message || "Erro na função de envio");
      }
      
      if (data?.error) {
        console.error("[WhatsApp] API error:", data.error);
        throw new Error(data.error);
      }
      
      if (!data?.success) {
        console.error("[WhatsApp] Send failed:", data);
        throw new Error(data?.error || "Falha ao enviar áudio para o WhatsApp");
      }

      console.log("[WhatsApp] Áudio enviado com sucesso:", data?.providerMessageId);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
      toast({ title: "Áudio enviado!" });
    } catch (error: any) {
      console.error("[WhatsApp] Error sending audio:", error);
      const errorMessage = error.message || "Erro desconhecido ao enviar áudio";
      toast({
        title: "Erro ao enviar áudio",
        description: errorMessage,
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

    // Aumentar limite para 10MB (o upload direto suporta arquivos maiores)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }

    // Guardar file e criar preview
    const preview = URL.createObjectURL(file);
    setSelectedImage({ file, preview });

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSendImage = async () => {
    if (!selectedConversation || !selectedImage) return;
    if (!profile?.organization_id) {
      toast({
        title: "Erro ao enviar imagem",
        description: "Organização não encontrada.",
        variant: "destructive",
      });
      return;
    }

    const now = Date.now();
    if (now - lastSendAt < SEND_COOLDOWN_MS) {
      toast({
        title: "Aguarde um pouco",
        description: "Para evitar bloqueio do WhatsApp, envie no máximo 1 mensagem a cada 5 segundos.",
        variant: "destructive",
      });
      return;
    }
    setLastSendAt(now);

    setIsSendingImage(true);
    try {
      const file = selectedImage.file;
      
      console.log("[WhatsApp] Criando URL de upload para imagem:", {
        conversation_id: selectedConversation.id,
        size_bytes: file.size,
        mime_type: file.type,
      });

      // 1. Obter signed upload URL
      const { data: uploadUrlData, error: uploadUrlError } = await supabase.functions.invoke(
        "whatsapp-create-upload-url",
        {
          body: {
            organizationId: profile.organization_id,
            conversationId: selectedConversation.id,
            mimeType: file.type,
            kind: "image",
          },
        }
      );

      if (uploadUrlError || !uploadUrlData?.success) {
        throw new Error(uploadUrlData?.error || uploadUrlError?.message || "Falha ao criar URL de upload");
      }

      console.log("[WhatsApp] Upload URL obtida, fazendo upload direto...");

      // 2. Upload direto para storage
      const uploadResponse = await fetch(uploadUrlData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Falha no upload: ${uploadResponse.status}`);
      }

      console.log("[WhatsApp] Upload concluído, enviando mensagem...");

      // 3. Enviar mensagem com path do storage (não base64!)
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          organizationId: profile.organization_id,
          conversationId: selectedConversation.id,
          instanceId: selectedConversation.instance_id,
          chatId: selectedConversation.chat_id || null,
          phone: selectedConversation.phone_number,
          content: messageText || "",
          messageType: "image",
          mediaStoragePath: uploadUrlData.path,
          mediaMimeType: file.type,
          mediaCaption: messageText || "",
        },
      });

      if (error) {
        console.error("[WhatsApp] Edge function error:", error);
        throw new Error(error.message || "Erro na função de envio");
      }
      
      if (data?.error) {
        console.error("[WhatsApp] API error:", data.error);
        throw new Error(data.error);
      }
      
      if (!data?.success) {
        console.error("[WhatsApp] Send failed:", data);
        throw new Error(data?.error || "Falha ao enviar imagem para o WhatsApp");
      }

      console.log("[WhatsApp] Imagem enviada com sucesso:", data?.providerMessageId);
      
      // Limpar preview URL
      URL.revokeObjectURL(selectedImage.preview);
      setSelectedImage(null);
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
      toast({ title: "Imagem enviada!" });
    } catch (error: any) {
      console.error("[WhatsApp] Error sending image:", error);
      const errorMessage = error.message || "Erro desconhecido ao enviar imagem";
      toast({
        title: "Erro ao enviar imagem",
        description: errorMessage,
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
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });

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
      normalizeText(c.contact_name || '').includes(normalizeText(searchTerm)) ||
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
    <div className={cn(
      "flex overflow-hidden bg-background",
      isMobile 
        ? "fixed inset-0 z-50 flex-col" 
        : "h-[calc(100vh-200px)] min-h-[400px] border rounded-lg"
    )}>
      {/* Conversations List */}
      <div className={cn(
        "flex flex-col bg-background",
        isMobile 
          ? cn("w-full h-full", selectedConversation ? "hidden" : "flex")
          : cn("w-80 border-r", selectedConversation ? "hidden md:flex" : "flex")
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
                  <AvatarFallback className={cn(
                    "text-white",
                    conversation.is_group ? "bg-blue-500" : "bg-green-500"
                  )}>
                    {conversation.is_group 
                      ? "G" 
                      : (conversation.display_name?.charAt(0) || conversation.contact_name?.charAt(0) || conversation.phone_number.slice(-2))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate flex items-center gap-1">
                      {conversation.is_group && (
                        <span className="text-xs text-blue-500">👥</span>
                      )}
                      {conversation.display_name || conversation.contact_name || (conversation.is_group ? (conversation.group_subject || "Grupo") : conversation.phone_number)}
                    </span>
                    {conversation.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conversation.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground truncate">
                      {conversation.is_group ? (
                        <span className="text-blue-600 flex items-center gap-1">
                          Grupo
                        </span>
                      ) : conversation.lead_id ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <User className="h-3 w-3" /> Lead vinculado
                        </span>
                      ) : (
                        <span>{conversation.phone_number}</span>
                      )}
                      {conversation.channel_name && (
                        <span className="text-xs opacity-60 ml-1">
                          · {conversation.channel_name}
                        </span>
                      )}
                    </div>
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
        "flex flex-col bg-background",
        isMobile
          ? cn("w-full h-full", !selectedConversation ? "hidden" : "flex")
          : cn("flex-1", !selectedConversation ? "hidden md:flex" : "flex")
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header - Mobile Optimized */}
            <div className={cn(
              "border-b bg-card shrink-0",
              isMobile ? "safe-area-top" : ""
            )}>
              {/* Main Header Row */}
              <div className="flex items-center gap-2 px-2 py-2 md:px-4 md:py-3">
                {/* Back Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                {/* Avatar */}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={selectedConversation.contact_profile_pic || undefined} />
                  <AvatarFallback className={cn(
                    "text-white font-medium",
                    selectedConversation.is_group ? "bg-blue-500" : "bg-green-500"
                  )}>
                    {selectedConversation.is_group 
                      ? "G" 
                      : (selectedConversation.display_name?.charAt(0) || selectedConversation.contact_name?.charAt(0) || "?")}
                  </AvatarFallback>
                </Avatar>

                {/* Contact Info */}
                <div className="flex-1 min-w-0" onClick={() => setShowLeadInfoDrawer(true)}>
                  <p className="font-semibold text-base truncate">
                    {selectedConversation.is_group && <span className="text-blue-500 mr-1">👥</span>}
                    {selectedConversation.display_name || selectedConversation.contact_name || (selectedConversation.is_group ? "Grupo" : selectedConversation.phone_number)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConversation.phone_number}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10"
                    onClick={() => setShowLeadInfoDrawer(true)}
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Lead Status Bar - Compact on Mobile */}
              {!selectedConversation.is_group && (
                <div className="border-t bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
                  {selectedConversation.lead_id ? (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">
                          <User className="h-3 w-3 mr-1" />
                          Lead
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {selectedConversation.lead_name || "Vinculado"}
                        </span>
                        {selectedConversation.lead_stage && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {selectedConversation.lead_stage}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 shrink-0"
                        onClick={handleViewLead}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground">Nenhum lead vinculado</span>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1 shrink-0"
                        onClick={() => {
                          setNewLeadName(selectedConversation.contact_name || "");
                          setShowCreateLeadDialog(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Vincular Lead
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Messages Area - Fullscreen on mobile */}
            <ScrollArea className={cn(
              "flex-1 bg-[#ece5dd] dark:bg-muted/20",
              isMobile ? "px-2 py-3" : "p-4"
            )}>
              <div className={cn(
                "space-y-1",
                isMobile ? "max-w-full" : "max-w-3xl mx-auto space-y-2"
              )}>
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

            {/* Removed floating back button - already have one in header */}


            {/* Image preview - improved for mobile */}
            {selectedImage && (
              <div className="border-t bg-card shrink-0 p-2">
                <div className={cn(
                  "flex items-center gap-3 p-2 bg-muted/50 rounded-lg",
                  isMobile ? "" : "max-w-3xl mx-auto"
                )}>
                  <img 
                    src={selectedImage.preview} 
                    alt="Preview" 
                    className="h-14 w-14 object-cover rounded-lg border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Imagem selecionada</p>
                    <p className="text-xs text-muted-foreground">Pronta para enviar</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (selectedImage) URL.revokeObjectURL(selectedImage.preview);
                      setSelectedImage(null);
                    }}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            )}

            {/* Input Area - Mobile Optimized with safe area */}
            <div className={cn(
              "border-t bg-card shrink-0",
              isMobile ? "safe-area-bottom" : ""
            )}>
              {!isInstanceConnected ? (
                /* Aviso quando instância desconectada */
                <div className="p-4 text-center bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                  <p className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                    ⚠️ WhatsApp desconectado
                  </p>
                  <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                    Reconecte a instância para enviar novas mensagens. O histórico está preservado.
                  </p>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  <div className={cn(
                    "flex items-end gap-2",
                    isMobile ? "p-2" : "p-3 max-w-3xl mx-auto"
                  )}>
                    {isRecordingAudio ? (
                      <div className="flex-1 flex items-center justify-center py-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <AudioRecorder
                          onAudioReady={handleSendAudio}
                          isRecording={isRecordingAudio}
                          setIsRecording={setIsRecordingAudio}
                        />
                        {isSendingAudio && (
                          <div className="flex items-center gap-2 text-muted-foreground ml-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Enviando...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Media buttons - Compact on mobile */}
                        <div className="flex items-center shrink-0">
                          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isSendingImage}
                          >
                            {isSendingImage ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10"
                            onClick={() => setIsRecordingAudio(true)}
                          >
                            <Mic className="h-5 w-5 text-muted-foreground" />
                          </Button>
                        </div>

                        {/* Text Input - Larger on mobile */}
                        <Textarea
                          ref={textareaRef}
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
                          className={cn(
                            "flex-1 resize-none rounded-2xl border-2 focus-visible:ring-1",
                            isMobile 
                              ? "min-h-[48px] max-h-[120px] py-3 px-4 text-base" 
                              : "min-h-[44px] max-h-[144px] py-2.5 px-3"
                          )}
                          disabled={sendMessage.isPending || isSendingImage}
                          rows={1}
                        />

                        {/* Send Button - Always visible on mobile */}
                        <Button
                          size="icon"
                          className={cn(
                            "shrink-0 rounded-full transition-all",
                            (selectedImage || messageText.trim())
                              ? "bg-green-500 hover:bg-green-600"
                              : "bg-muted text-muted-foreground",
                            isMobile ? "h-12 w-12" : "h-10 w-10"
                          )}
                          onClick={selectedImage ? handleSendImage : handleSendMessage}
                          disabled={sendMessage.isPending || isSendingImage || (!selectedImage && !messageText.trim())}
                        >
                          {sendMessage.isPending || isSendingImage ? (
                            <Loader2 className={cn("animate-spin", isMobile ? "h-6 w-6" : "h-5 w-5")} />
                          ) : (
                            <Send className={cn(isMobile ? "h-6 w-6" : "h-5 w-5")} />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
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

      {/* Lead Info Drawer - Mobile */}
      <Drawer open={showLeadInfoDrawer} onOpenChange={setShowLeadInfoDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>
              {selectedConversation?.is_group ? "Informações do Grupo" : "Informações do Contato"}
            </DrawerTitle>
            <DrawerDescription>
              {selectedConversation?.display_name || selectedConversation?.contact_name || selectedConversation?.phone_number}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={selectedConversation?.contact_profile_pic || undefined} />
                <AvatarFallback className={cn(
                  "text-xl",
                  selectedConversation?.is_group ? "bg-blue-500 text-white" : "bg-green-500 text-white"
                )}>
                  {selectedConversation?.is_group 
                    ? "G" 
                    : (selectedConversation?.display_name?.charAt(0) || selectedConversation?.contact_name?.charAt(0) || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg">
                  {selectedConversation?.is_group && <span className="text-blue-500 mr-1">👥</span>}
                  {selectedConversation?.display_name || selectedConversation?.contact_name || "Sem nome"}
                </p>
                {selectedConversation?.is_group ? (
                  <p className="text-sm text-muted-foreground">Grupo de WhatsApp</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{selectedConversation?.phone_number}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">WhatsApp:</span>
                <span className="font-medium">{selectedConversation?.phone_number || "-"}</span>
              </div>
              {selectedConversation?.lead_id ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    Lead Vinculado
                  </Badge>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                    Sem Lead
                  </Badge>
                </div>
              )}
              {selectedConversation?.is_group && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                    Grupo
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <DrawerFooter>
            {selectedConversation?.lead_id ? (
              <Button onClick={() => { setShowLeadInfoDrawer(false); handleViewLead(); }}>
                <User className="h-4 w-4 mr-2" />
                Ver Lead Completo
              </Button>
            ) : !selectedConversation?.is_group ? (
              <Button onClick={() => { 
                setShowLeadInfoDrawer(false);
                setNewLeadName(selectedConversation?.contact_name || "");
                setShowCreateLeadDialog(true);
              }}>
                <Link className="h-4 w-4 mr-2" />
                Vincular/Criar Lead
              </Button>
            ) : null}
            <DrawerClose asChild>
              <Button variant="outline">Fechar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
