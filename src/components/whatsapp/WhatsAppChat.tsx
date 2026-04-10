import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Send, Phone, Search, ArrowLeft, User, Loader2, Plus, ExternalLink, Mic, Image as ImageIcon, Info, Link, FileText, MessageSquarePlus, Clock, Star, Instagram, Video, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppMessageInput } from "./WhatsAppMessageInput";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { NewConversationDialog } from "./NewConversationDialog";
import { ScheduledMessagesPanel } from "./ScheduledMessagesPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFunnelStages } from "@/hooks/useFunnelStages";
import { useCrossInstanceConversations, getOtherInstanceConversations } from "@/hooks/useCrossInstanceConversations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickMessagesPicker } from "./QuickMessagesPicker";
import { QuickMessage } from "@/hooks/useQuickMessages";
import { ConversationListItem } from "./ConversationListItem";

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
  lead_instagram?: string | null;

  contact_id: string | null;
  instance_id: string | null; // Pode ser null se instância foi excluída
  channel_name?: string;
  channel_phone_number?: string;
  chat_id?: string; // NOVO: ID estável do chat (JID)
  is_group?: boolean; // NOVO: indica se é grupo
  group_subject?: string; // NOVO: nome do grupo
  display_name?: string; // NOVO: nome para exibição
  
  // Status da instância (via view)
  instance_status?: 'connected' | 'disconnected' | 'deleted';
  instance_is_connected?: boolean;
  instance_deleted_at?: string | null;
  original_instance_name?: string | null; // Nome da instância quando foi excluída
}

interface InstanceInfo {
  id: string;
  name: string;
  display_name_for_team: string | null;
  manual_instance_number: string | null;
  phone_number: string | null;
  is_connected: boolean;
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
  sent_by_user_id: string | null;
}

export function WhatsAppChat({ instanceId, onBack }: WhatsAppChatProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { data: funnelStages } = useFunnelStages();
  const { data: crossInstanceMap } = useCrossInstanceConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null); // Sub-aba de instância ativa
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [showLeadInfoDrawer, setShowLeadInfoDrawer] = useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isSendingImage, setIsSendingImage] = useState(false);
  const [isSendingDocument, setIsSendingDocument] = useState(false);
  const [isSendingVideo, setIsSendingVideo] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File; preview: string } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ file: File; preview: string } | null>(null);

  // Wasender throttle: they enforce "1 message every ~5 seconds".
  const SEND_COOLDOWN_MS = 5000;
  const [lastSendAt, setLastSendAt] = useState<number>(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch instance status to know if connected
  const { data: instanceData } = useQuery({
    queryKey: ["whatsapp-instance-status", instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, name, is_connected, phone_number, display_name_for_team, manual_instance_number")
        .eq("id", instanceId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!instanceId,
    refetchInterval: 60000, // Check every 60 seconds
  });

  const isInstanceConnected = instanceData?.is_connected ?? true; // Default to true if no instanceId

  // Fetch all instances for display names in conversation list
  const { data: allInstances } = useQuery({
    queryKey: ["whatsapp-instances-info", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, name, display_name_for_team, manual_instance_number, phone_number, is_connected");
      if (error) return [];
      return data as InstanceInfo[];
    },
    enabled: !!profile?.organization_id,
  });

  // Create a map for quick instance lookup - memoized to prevent re-renders
  const instancesMap = useMemo(() => {
    return allInstances?.reduce((acc, inst) => {
      acc[inst.id] = inst;
      return acc;
    }, {} as Record<string, InstanceInfo>) || {};
  }, [allInstances]);

  // Helper to get instance display label - memoized as callback
  const getInstanceLabel = useCallback((instId: string | null) => {
    if (!instId) return null;
    const inst = instancesMap[instId];
    if (!inst) return null;
    const displayName = inst.display_name_for_team || inst.name;
    const number = inst.manual_instance_number || inst.phone_number;
    if (displayName && number) return `${displayName} · ${number}`;
    return displayName || number || inst.name;
  }, [instancesMap]);

  // Helper to get instance status badge
  const getInstanceStatusInfo = (conversation: Conversation) => {
    // Se não tem instance_id, foi excluída
    if (!conversation.instance_id) {
      return {
        status: 'deleted' as const,
        label: 'Instância Excluída',
        originalName: conversation.original_instance_name,
      };
    }
    // Checagem via view
    if (conversation.instance_status === 'deleted' || conversation.instance_deleted_at) {
      return {
        status: 'deleted' as const,
        label: 'Instância Excluída',
        originalName: conversation.original_instance_name || conversation.channel_name,
      };
    }
    if (conversation.instance_status === 'disconnected' || conversation.instance_is_connected === false) {
      return {
        status: 'disconnected' as const,
        label: 'Instância Desconectada',
        originalName: conversation.channel_name,
      };
    }
    return {
      status: 'connected' as const,
      label: null,
      originalName: null,
    };
  };

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
    refetchInterval: 120000, // Poll every 2 minutes (realtime handles instant updates)
  });

  // Buscar TODAS as conversas do mesmo phone_number em diferentes instâncias da organização
  // Isso permite mostrar sub-abas por instância quando o mesmo lead conversa por múltiplos números
  const { data: samePhoneConversations } = useQuery({
    queryKey: ["same-phone-conversations", selectedConversation?.phone_number, profile?.organization_id],
    queryFn: async () => {
      if (!selectedConversation?.phone_number || !profile?.organization_id) return [];

      // Primeiro pegar as instâncias da organização
      const { data: orgInstances } = await supabase
        .from("whatsapp_instances")
        .select("id, name, display_name_for_team, manual_instance_number, phone_number")
        .eq("organization_id", profile.organization_id);

      if (!orgInstances || orgInstances.length === 0) return [];

      const instanceIds = orgInstances.map(i => i.id);

      // Buscar conversas deste número em todas as instâncias da org
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("id, phone_number, instance_id, last_message_at, unread_count, lead_id, contact_name")
        .eq("phone_number", selectedConversation.phone_number)
        .in("instance_id", instanceIds)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("Error fetching same-phone conversations:", error);
        return [];
      }

      // Mesclar com info das instâncias
      const instanceMap = orgInstances.reduce((acc, inst) => {
        acc[inst.id] = inst;
        return acc;
      }, {} as Record<string, typeof orgInstances[0]>);

      return data?.map((conv) => {
        const inst = instanceMap[conv.instance_id];
        return {
          id: conv.id,
          phone_number: conv.phone_number,
          instance_id: conv.instance_id,
          last_message_at: conv.last_message_at,
          unread_count: conv.unread_count,
          lead_id: conv.lead_id,
          contact_name: conv.contact_name,
          instance_name: inst?.name || "Instância",
          instance_display_name: inst?.display_name_for_team,
          instance_number: inst?.manual_instance_number || inst?.phone_number,
        };
      }) || [];
    },
    enabled: !!selectedConversation?.phone_number && !!profile?.organization_id,
    staleTime: 5000, // Reduzido para atualizar mais rápido
  });

  // Determinar se temos múltiplas instâncias para este contato
  const hasMultipleInstances = (samePhoneConversations?.length || 0) > 1;
  
  // Conversa ativa baseada na instância selecionada
  const activeConversation = useMemo(() => {
    if (!hasMultipleInstances || !activeInstanceId) {
      return selectedConversation;
    }
    // Buscar a conversa da instância selecionada
    const conv = samePhoneConversations?.find(c => c.instance_id === activeInstanceId);
    if (conv) {
      // Merge com selectedConversation para manter campos extras
      return {
        ...selectedConversation,
        id: conv.id,
        instance_id: conv.instance_id,
      } as Conversation;
    }
    return selectedConversation;
  }, [selectedConversation, hasMultipleInstances, activeInstanceId, samePhoneConversations]);

  // Flag: instância da conversa ativa está desconectada/excluída?
  const isActiveInstanceOffline = useMemo(() => {
    if (!activeConversation) return false;
    const statusInfo = getInstanceStatusInfo(activeConversation);
    return statusInfo.status === 'disconnected' || statusInfo.status === 'deleted';
  }, [activeConversation]);

  // Atualizar activeInstanceId quando selecionar uma nova conversa
  // IMPORTANTE: usar id E instance_id como dependências para garantir atualização
  // quando clicar em card diferente do mesmo número
  useEffect(() => {
    if (selectedConversation?.instance_id) {
      setActiveInstanceId(selectedConversation.instance_id);
      // Forçar invalidação das mensagens quando mudar de conversa
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    }
  }, [selectedConversation?.id, selectedConversation?.instance_id, queryClient]);

  // Fetch pending scheduled messages count per lead - skip on mobile for performance
  const leadIds = (!isMobile && conversations) ? conversations.filter(c => c.lead_id).map(c => c.lead_id as string) : [];
  const { data: scheduledMessagesCount } = useQuery({
    queryKey: ["scheduled-messages-count", leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("lead_scheduled_messages")
        .select("lead_id")
        .in("lead_id", leadIds)
        .eq("status", "pending")
        .is("deleted_at", null);

      if (error) throw error;
      
      // Count per lead
      const counts: Record<string, number> = {};
      data?.forEach(row => {
        counts[row.lead_id] = (counts[row.lead_id] || 0) + 1;
      });
      return counts;
    },
    enabled: leadIds.length > 0 && !isMobile,
    refetchInterval: 120000, // Poll every 2 minutes
  });

  // Fetch lead details for drawer (stars, instagram, stage)
  // Usa RPC SECURITY DEFINER para permitir visualizar lead mesmo com leads_view_only_own
  const { data: leadDetails, refetch: refetchLead } = useQuery({
    queryKey: ["lead-details-chat", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation?.id) return null;
      
      // Usar RPC que bypassa RLS para dados do lead vinculado à conversa
      const { data, error } = await supabase
        .rpc("get_linked_lead_for_conversation", { 
          p_conversation_id: selectedConversation.id 
        });
      
      if (error) {
        console.error("[WhatsAppChat] Erro ao buscar lead vinculado:", error);
        return null;
      }
      
      // A RPC retorna um array, pegar o primeiro item
      if (data && data.length > 0) {
        const lead = data[0];
        return {
          id: lead.lead_id,
          name: lead.lead_name,
          stars: lead.lead_stars,
          instagram: lead.lead_instagram,
          stage: lead.lead_stage,
        };
      }
      return null;
    },
    enabled: !!selectedConversation?.id,
  });

  // Helper to get stage display name
  const getStageDisplayName = (stageKey: string | null | undefined) => {
    if (!stageKey || !funnelStages) return stageKey;
    // Map database stage enum to funnel position
    const stagePositionMap: Record<string, number> = {
      'prospect': 0,
      'contacted': 1,
      'qualified': 2,
      'proposal': 3,
      'negotiation': 4,
      'cloud': 5,
      'trash': 6,
    };
    const position = stagePositionMap[stageKey];
    if (position === undefined) return stageKey;
    const customStage = funnelStages.find(s => s.position === position);
    return customStage?.name || stageKey;
  };

  // Update lead stars
  const updateLeadStars = useMutation({
    mutationFn: async (stars: number) => {
      if (!selectedConversation?.lead_id) throw new Error("No lead");
      const { error } = await supabase
        .from("leads")
        .update({ stars })
        .eq("id", selectedConversation.lead_id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchLead();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
      toast({ title: "Estrelas atualizadas!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar estrelas", variant: "destructive" });
    },
  });


  // Usar activeConversation para buscar mensagens (respeita a sub-aba selecionada)
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["whatsapp-messages", activeConversation?.id],
    queryFn: async () => {
      if (!activeConversation) return [];
      
      // Buscar mensagens com nome do remetente
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(`
          *,
          profiles:sent_by_user_id (first_name, last_name)
        `)
        .eq("conversation_id", activeConversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Mapear para incluir sender_name
      const messagesWithSender = (data || []).map((msg: any) => ({
        ...msg,
        sender_name: msg.profiles 
          ? `${msg.profiles.first_name || ''} ${msg.profiles.last_name || ''}`.trim()
          : null,
      }));
      
      // Mark as read
      if (activeConversation.unread_count > 0) {
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0 })
          .eq("id", activeConversation.id);
        
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      }
      
      return messagesWithSender as Message[];
    },
    enabled: !!activeConversation?.id,
    refetchInterval: 60000, // Poll every 60 seconds (realtime handles instant updates)
  });

  // Real-time subscription for new messages - throttled conversation list invalidation
  const lastConvInvalidation = useRef(0);
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
        (payload) => {
          // Invalidar mensagens da conversa ativa
          if (activeConversation?.id && payload.new && (payload.new as any).conversation_id === activeConversation.id) {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", activeConversation.id] });
          }
          // Throttle conversation list invalidation
          const throttleMs = isMobile ? 3000 : 1000;
          const now = Date.now();
          if (now - lastConvInvalidation.current > throttleMs) {
            lastConvInvalidation.current = now;
            queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
        },
        (payload) => {
          // Auto-refresh conversation list on any conversation update (new message count, status, etc.)
          const throttleMs = isMobile ? 3000 : 1000;
          const now = Date.now();
          if (now - lastConvInvalidation.current > throttleMs) {
            lastConvInvalidation.current = now;
            queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
          }
          // Also refresh active conversation details if it was updated
          if (activeConversation?.id && payload.new && (payload.new as any).id === activeConversation.id) {
            queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", activeConversation.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, activeConversation?.id, queryClient, isMobile]);

  // Scroll to bottom when messages change or conversation switches
  const lastScrolledConvId = useRef<string | null>(null);
  const lastScrolledMsgCount = useRef(0);
  useEffect(() => {
    if (!messages) return;
    const convChanged = activeConversation?.id !== lastScrolledConvId.current;
    const msgCountChanged = messages.length !== lastScrolledMsgCount.current;
    
    if (convChanged || msgCountChanged) {
      lastScrolledConvId.current = activeConversation?.id || null;
      lastScrolledMsgCount.current = messages.length;
      // Use instant scroll on conversation change, smooth on new messages
      const behavior = convChanged ? "auto" : "smooth";
      // Double rAF to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior });
        });
      });
    }
  }, [messages, activeConversation?.id]);

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
  // Send message mutation - usa activeConversation para respeitar a sub-aba selecionada
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      if (!activeConversation) throw new Error("No conversation selected");
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      // Debug: track newlines through pipeline
      const nlCount = (text.match(/\n/g) || []).length;
      console.log("[WhatsApp] 📝 Enviando mensagem:", {
        newlines: nlCount,
        length: text.length,
        first50: JSON.stringify(text.substring(0, 50)),
        organization_id: profile.organization_id,
        conversation_id: activeConversation.id,
      });

      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          organizationId: profile.organization_id,
          conversationId: activeConversation.id,
          instanceId: activeConversation.instance_id,
          chatId: activeConversation.chat_id || null,
          phone: activeConversation.phone_number,
          content: text,
          messageType: "text",
          senderUserId: profile.user_id, // Para identificar quem enviou
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
    if (isActiveInstanceOffline) {
      toast({
        title: "Instância desconectada",
        description: "Esta instância está offline. Use outra instância para continuar a conversa.",
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
    sendMessage.mutate(messageText);
  };

  const handleQuickMessageText = (text: string) => {
    setMessageText(text);
  };

  const handleQuickMessageMedia = async (msg: QuickMessage) => {
    if (!activeConversation || !profile?.organization_id) return;
    if (isActiveInstanceOffline) {
      toast({ title: "Instância desconectada", variant: "destructive" });
      return;
    }
    const now = Date.now();
    if (now - lastSendAt < SEND_COOLDOWN_MS) {
      toast({ title: "Aguarde um pouco", description: "Envie no máximo 1 mensagem a cada 5 segundos.", variant: "destructive" });
      return;
    }
    setLastSendAt(now);

    // If it has text, send text first
    if (msg.message_text?.trim()) {
      sendMessage.mutate(msg.message_text);
    }

    // If it has media, send media via edge function
    if (msg.media_type && msg.media_url) {
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
          body: {
            organizationId: profile.organization_id,
            conversationId: activeConversation.id,
            instanceId: activeConversation.instance_id,
            chatId: activeConversation.chat_id || null,
            phone: activeConversation.phone_number,
            content: "",
            messageType: msg.media_type === "audio" ? "ptt" : msg.media_type,
            mediaUrl: msg.media_url,
            senderUserId: profile.user_id,
          },
        });
        if (error || data?.error || !data?.success) {
          throw new Error(data?.error || error?.message || "Falha ao enviar mídia");
        }
        queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
        toast({ title: "Mensagem rápida enviada!" });
      } catch (err: any) {
        toast({ title: "Erro ao enviar mídia", description: err.message, variant: "destructive" });
      }
    }
  };

  const handleSendAudio = async (base64: string, mimeType: string) => {
    if (!activeConversation) return;
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
        conversation_id: activeConversation.id,
        size_bytes: blob.size,
        mime_type: mimeType,
      });

      // 1. Obter signed upload URL
      const { data: uploadUrlData, error: uploadUrlError } = await supabase.functions.invoke(
        "whatsapp-create-upload-url",
        {
          body: {
            organizationId: profile.organization_id,
            conversationId: activeConversation.id,
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
          conversationId: activeConversation.id,
          instanceId: activeConversation.instance_id,
          chatId: activeConversation.chat_id || null,
          phone: activeConversation.phone_number,
          content: "",
          messageType: "audio",
          mediaStoragePath: uploadUrlData.path,
          mediaMimeType: mimeType,
          senderUserId: profile.user_id,
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
    if (!activeConversation || !selectedImage) return;
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
            conversationId: activeConversation.id,
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
          conversationId: activeConversation.id,
          instanceId: activeConversation.instance_id,
          chatId: activeConversation.chat_id || null,
          phone: activeConversation.phone_number,
          content: messageText || "",
          messageType: "image",
          mediaStoragePath: uploadUrlData.path,
          mediaMimeType: file.type,
          mediaCaption: messageText || "",
          senderUserId: profile.user_id,
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

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Aceitar PDF, DOC, DOCX, XLS, XLSX, etc.
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Arquivo inválido", description: "Selecione um documento (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV)", variant: "destructive" });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 20MB", variant: "destructive" });
      return;
    }

    setSelectedDocument(file);

    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  const handleSendDocument = async () => {
    if (!activeConversation || !selectedDocument) return;
    if (!profile?.organization_id) {
      toast({
        title: "Erro ao enviar documento",
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

    setIsSendingDocument(true);
    try {
      const file = selectedDocument;

      console.log("[WhatsApp] Criando URL de upload para documento:", {
        conversation_id: selectedConversation.id,
        size_bytes: file.size,
        mime_type: file.type,
        file_name: file.name,
      });

      // 1. Obter signed upload URL
      const { data: uploadUrlData, error: uploadUrlError } = await supabase.functions.invoke(
        "whatsapp-create-upload-url",
        {
          body: {
            organizationId: profile.organization_id,
            conversationId: activeConversation.id,
            mimeType: file.type,
            kind: "document",
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

      // 3. Enviar mensagem com path do storage
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          organizationId: profile.organization_id,
          conversationId: activeConversation.id,
          instanceId: activeConversation.instance_id,
          chatId: activeConversation.chat_id || null,
          phone: activeConversation.phone_number,
          content: file.name,
          messageType: "document",
          mediaStoragePath: uploadUrlData.path,
          mediaMimeType: file.type,
          mediaCaption: file.name,
          senderUserId: profile.user_id,
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
        throw new Error(data?.error || "Falha ao enviar documento para o WhatsApp");
      }

      console.log("[WhatsApp] Documento enviado com sucesso:", data?.providerMessageId);
      setSelectedDocument(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
      toast({ title: "Documento enviado!" });
    } catch (error: any) {
      console.error("[WhatsApp] Error sending document:", error);
      toast({
        title: "Erro ao enviar documento",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSendingDocument(false);
    }
  };

  // Video selection handler
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast({ title: "Arquivo inválido", description: "Selecione um vídeo", variant: "destructive" });
      return;
    }

    // Limite de 50MB para vídeos
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 50MB para vídeos", variant: "destructive" });
      return;
    }

    // Guardar file e criar preview
    const preview = URL.createObjectURL(file);
    setSelectedVideo({ file, preview });

    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  // Video send handler
  const handleSendVideo = async () => {
    if (!activeConversation || !selectedVideo) return;
    if (!profile?.organization_id) {
      toast({
        title: "Erro ao enviar vídeo",
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

    setIsSendingVideo(true);
    try {
      const file = selectedVideo.file;
      
      console.log("[WhatsApp] Criando URL de upload para vídeo:", {
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
            conversationId: activeConversation.id,
            mimeType: file.type,
            kind: "video",
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

      // 3. Enviar mensagem com path do storage
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          organizationId: profile.organization_id,
          conversationId: activeConversation.id,
          instanceId: activeConversation.instance_id,
          chatId: activeConversation.chat_id || null,
          phone: activeConversation.phone_number,
          content: messageText || "",
          messageType: "video",
          mediaStoragePath: uploadUrlData.path,
          mediaMimeType: file.type,
          mediaCaption: messageText || "",
          senderUserId: profile.user_id,
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
        throw new Error(data?.error || "Falha ao enviar vídeo para o WhatsApp");
      }

      console.log("[WhatsApp] Vídeo enviado com sucesso:", data?.providerMessageId);
      
      // Limpar preview URL
      URL.revokeObjectURL(selectedVideo.preview);
      setSelectedVideo(null);
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
      toast({ title: "Vídeo enviado!" });
    } catch (error: any) {
      console.error("[WhatsApp] Error sending video:", error);
      const errorMessage = error.message || "Erro desconhecido ao enviar vídeo";
      toast({
        title: "Erro ao enviar vídeo",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSendingVideo(false);
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
    // Prioriza o ID do leadDetails (que vem da RPC e bypassa RLS)
    const leadIdToView = leadDetails?.id || selectedConversation?.lead_id;
    if (leadIdToView) {
      // Abre em nova aba para não sair do chat
      window.open(`/leads/${leadIdToView}`, '_blank');
    }
  };

  // Handler para continuar conversa por outra instância
  const handleContinueOnOtherInstance = async (newInstanceId: string) => {
    if (!selectedConversation || !profile?.organization_id) return;

    try {
      // Verificar se já existe conversa com este contato na nova instância
      const { data: existingConv } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("instance_id", newInstanceId)
        .eq("phone_number", selectedConversation.phone_number)
        .single();

      if (existingConv) {
        // Já existe - apenas selecionar essa conversa
        const { data: fullConv } = await supabase
          .from("whatsapp_conversations_view")
          .select("*")
          .eq("id", existingConv.id)
          .single();

        if (fullConv) {
          setSelectedConversation(fullConv as Conversation);
          setActiveInstanceId(newInstanceId);
          toast({ title: "Conversa encontrada nesta instância" });
        }
      } else {
        // Criar nova conversa na nova instância
        const { data: newConv, error } = await supabase
          .from("whatsapp_conversations")
          .insert({
            instance_id: newInstanceId,
            organization_id: profile.organization_id,
            phone_number: selectedConversation.phone_number,
            contact_name: selectedConversation.contact_name,
            lead_id: selectedConversation.lead_id,
            status: "pending",
            unread_count: 0,
          })
          .select()
          .single();

        if (error) throw error;

        // Buscar conversa completa via view
        const { data: fullConv } = await supabase
          .from("whatsapp_conversations_view")
          .select("*")
          .eq("id", newConv.id)
          .single();

        if (fullConv) {
          setSelectedConversation(fullConv as Conversation);
          setActiveInstanceId(newInstanceId);
        }

        queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
        queryClient.invalidateQueries({ queryKey: ["same-phone-conversations"] });
        
        toast({ 
          title: "Pronto para continuar!", 
          description: "Você pode enviar mensagens por esta nova instância." 
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao mudar instância",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchTerm) return conversations;
    const normalized = normalizeText(searchTerm);
    return conversations.filter(
      (c) =>
        normalizeText(c.contact_name || '').includes(normalized) ||
        normalizeText(c.display_name || '').includes(normalized) ||
        c.phone_number.includes(searchTerm)
    );
  }, [conversations, searchTerm]);

  // Limitar conversas visíveis no mobile para performance
  const MOBILE_CONVERSATION_LIMIT = 40;
  const [visibleCount, setVisibleCount] = useState(MOBILE_CONVERSATION_LIMIT);
  
  // Reset visibleCount quando filtro muda
  useEffect(() => {
    setVisibleCount(MOBILE_CONVERSATION_LIMIT);
  }, [searchTerm]);

  const visibleConversations = useMemo(() => {
    if (!isMobile) return filteredConversations;
    return filteredConversations?.slice(0, visibleCount) || [];
  }, [filteredConversations, isMobile, visibleCount]);

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
        <div className="p-3 border-b space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setShowNewConversationDialog(true)}
              className="shrink-0"
              title="Nova conversa"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* New Conversation Dialog */}
        <NewConversationDialog
          open={showNewConversationDialog}
          onOpenChange={setShowNewConversationDialog}
          onConversationCreated={(conversationId, instId) => {
            // Recarregar conversas
            queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
          }}
        />

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
            <>
            {visibleConversations?.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onClick={() => {
                  setSelectedConversation(conversation);
                  setActiveInstanceId(conversation.instance_id);
                }}
                instanceLabel={getInstanceLabel(conversation.instance_id)}
                isMobile={isMobile}
                otherInstances={
                  // Skip cross-instance lookups on mobile for performance
                  isMobile
                    ? undefined
                    : getOtherInstanceConversations(
                        crossInstanceMap,
                        conversation.phone_number,
                        conversation.instance_id || ''
                      )
                }
                scheduledCount={conversation.lead_id ? scheduledMessagesCount?.[conversation.lead_id] : undefined}
              />
            ))}
            {/* Botão carregar mais no mobile */}
            {isMobile && filteredConversations && visibleCount < filteredConversations.length && (
              <div className="p-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setVisibleCount(prev => prev + MOBILE_CONVERSATION_LIMIT)}
                >
                  Carregar mais ({filteredConversations.length - visibleCount} restantes)
                </Button>
              </div>
            )}
            </>
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
                      : (leadDetails?.name?.charAt(0) || selectedConversation.display_name?.charAt(0) || selectedConversation.contact_name?.charAt(0) || "?")}
                  </AvatarFallback>
                </Avatar>

                {/* Contact Info */}
                <div className="flex-1 min-w-0" onClick={() => setShowLeadInfoDrawer(true)}>
                  <p className="font-semibold text-base truncate">
                    {selectedConversation.is_group && <span className="text-blue-500 mr-1">👥</span>}
                    {leadDetails?.name || selectedConversation.display_name || selectedConversation.contact_name || (selectedConversation.is_group ? "Grupo" : selectedConversation.phone_number)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedConversation.phone_number}
                    {(() => {
                      const inst = instancesMap[selectedConversation.instance_id];
                      if (!inst) return null;
                      const label = inst.display_name_for_team || inst.name;
                      return (
                        <span className="ml-1.5">
                          • {inst.is_connected ? '🟢' : '🔴'} {label}
                        </span>
                      );
                    })()}
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
              {/* Usa leadDetails (RPC) que bypassa RLS para mostrar lead vinculado corretamente */}
              {!selectedConversation.is_group && (
                <div className="border-t bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
                  {(leadDetails?.id || selectedConversation.lead_id) ? (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">
                          <User className="h-3 w-3 mr-1" />
                          Lead vinculado
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {leadDetails?.name || selectedConversation.lead_name || "Vinculado"}
                        </span>
                        {(leadDetails?.stage || selectedConversation.lead_stage) && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {getStageDisplayName(leadDetails?.stage || selectedConversation.lead_stage)}
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

              {/* Sub-abas de Instâncias - quando o mesmo contato tem conversas em múltiplos números */}
              {hasMultipleInstances && samePhoneConversations && samePhoneConversations.length > 1 && (
                <div className="border-t bg-muted/20 px-2 py-1.5">
                  <Tabs 
                    value={activeInstanceId || selectedConversation.instance_id} 
                    onValueChange={(value) => setActiveInstanceId(value)}
                    className="w-full"
                  >
                    <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                      {samePhoneConversations.map((conv: any) => {
                        const label = conv.instance_display_name || conv.instance_name;
                        const number = conv.instance_number;
                        return (
                          <TabsTrigger
                            key={conv.instance_id}
                            value={conv.instance_id}
                            className={cn(
                              "h-8 px-3 text-xs font-medium rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                              conv.unread_count > 0 && "ring-2 ring-green-500"
                            )}
                          >
                            <span className="truncate max-w-[100px]">
                              {label}
                              {number && ` · ${number.slice(-4)}`}
                            </span>
                            {conv.unread_count > 0 && (
                              <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-green-500">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    📱 Este contato conversou por {samePhoneConversations.length} números diferentes
                  </p>
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
            {/* Preview de imagem selecionada */}
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

            {/* Preview de documento selecionado */}
            {selectedDocument && (
              <div className="border-t bg-card shrink-0 p-2">
                <div className={cn(
                  "flex items-center gap-3 p-2 bg-muted/50 rounded-lg",
                  isMobile ? "" : "max-w-3xl mx-auto"
                )}>
                  <div className="h-14 w-14 flex items-center justify-center bg-primary/10 rounded-lg border">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedDocument.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedDocument.size / 1024 / 1024).toFixed(2)} MB - Pronto para enviar
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="shrink-0"
                    onClick={handleSendDocument}
                    disabled={isSendingDocument}
                  >
                    {isSendingDocument ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Enviar"
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setSelectedDocument(null)}
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
              {/* Banner para instância excluída/desconectada com opção de continuar por outra */}
              {(() => {
                const statusInfo = getInstanceStatusInfo(selectedConversation);
                const canSendViaOtherInstance = statusInfo.status !== 'connected' && allInstances && allInstances.filter(i => !instancesMap[i.id] || instancesMap[i.id]).length > 0;
                
                if (statusInfo.status === 'deleted') {
                  return (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-red-700 dark:text-red-300 text-sm font-medium flex items-center gap-1">
                            ⚠️ Instância Excluída
                          </p>
                          <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">
                            {statusInfo.originalName ? `A instância "${statusInfo.originalName}" foi excluída.` : "Esta instância foi excluída."} 
                            {" "}O histórico foi preservado.
                          </p>
                        </div>
                        {allInstances && allInstances.length > 0 && (
                          <select
                            className="text-xs border rounded px-2 py-1.5 bg-background"
                            onChange={(e) => {
                              const newInstanceId = e.target.value;
                              if (newInstanceId) {
                                // Criar nova conversa na instância selecionada
                                handleContinueOnOtherInstance(newInstanceId);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Continuar por outra instância...</option>
                            {allInstances.map(inst => (
                              <option key={inst.id} value={inst.id}>
                                {inst.is_connected ? '🟢' : '🔴'} {inst.display_name_for_team || inst.name} {inst.phone_number ? `(${inst.phone_number.slice(-4)})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                }
                
                if (statusInfo.status === 'disconnected' || !isInstanceConnected) {
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-amber-700 dark:text-amber-300 text-sm font-medium flex items-center gap-1">
                            ⚠️ WhatsApp Desconectado
                          </p>
                          <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">
                            Reconecte a instância ou continue a conversa por outro número.
                          </p>
                        </div>
                        {allInstances && allInstances.length > 0 && (
                          <select
                            className="text-xs border rounded px-2 py-1.5 bg-background"
                            onChange={(e) => {
                              const newInstanceId = e.target.value;
                              if (newInstanceId) {
                                handleContinueOnOtherInstance(newInstanceId);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Continuar por outra instância...</option>
                            {allInstances.filter(i => i.id !== selectedConversation.instance_id).map(inst => (
                              <option key={inst.id} value={inst.id}>
                                {inst.is_connected ? '🟢' : '🔴'} {inst.display_name_for_team || inst.name} {inst.phone_number ? `(${inst.phone_number.slice(-4)})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                }
                
                return null;
              })()}

              <>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={documentInputRef}
                  onChange={handleDocumentSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoSelect}
                  accept="video/*,video/mp4,video/webm,video/quicktime"
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
                          disabled={isSendingImage || isActiveInstanceOffline}
                          title="Enviar imagem"
                        >
                          {isSendingImage ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => documentInputRef.current?.click()}
                          disabled={isSendingDocument || isActiveInstanceOffline}
                          title="Enviar documento"
                        >
                          {isSendingDocument ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => videoInputRef.current?.click()}
                          disabled={isSendingVideo || isActiveInstanceOffline}
                          title="Enviar vídeo"
                        >
                          {isSendingVideo ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Video className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10"
                          onClick={() => setIsRecordingAudio(true)}
                          disabled={isActiveInstanceOffline}
                          title="Gravar áudio"
                        >
                          <Mic className="h-5 w-5 text-muted-foreground" />
                        </Button>
                        <QuickMessagesPicker
                          onSelectText={handleQuickMessageText}
                          onSelectMedia={handleQuickMessageMedia}
                          disabled={isActiveInstanceOffline}
                        />
                      </div>

                      {/* Video Preview */}
                      {selectedVideo && (
                        <div className="flex-1 relative rounded-lg overflow-hidden border bg-muted/30">
                          <video 
                            src={selectedVideo.preview} 
                            className="w-full max-h-32 object-contain"
                            controls={false}
                          />
                          <div className="absolute top-1 right-1 flex gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2"
                              onClick={() => {
                                URL.revokeObjectURL(selectedVideo.preview);
                                setSelectedVideo(null);
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                          <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                            🎬 {(selectedVideo.file.size / 1024 / 1024).toFixed(1)}MB
                          </div>
                        </div>
                      )}

                      {/* Text Input - Rich formatting */}
                      {!selectedVideo && (
                        <div className="flex-1">
                          <WhatsAppMessageInput
                            textareaRef={textareaRef}
                            value={messageText}
                            onChange={setMessageText}
                            onSend={() => {
                              if (selectedImage) {
                                handleSendImage();
                              } else {
                                handleSendMessage();
                              }
                            }}
                            disabled={sendMessage.isPending || isSendingImage || isSendingVideo || isActiveInstanceOffline}
                            isMobile={isMobile}
                          />
                        </div>
                      )}

                      {/* Send Button - Always visible on mobile */}
                      <Button
                        size="icon"
                        className={cn(
                          "shrink-0 rounded-full transition-all",
                          (selectedImage || selectedVideo || messageText.trim())
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-muted text-muted-foreground",
                          isMobile ? "h-12 w-12" : "h-10 w-10"
                        )}
                        onClick={() => {
                          if (selectedImage) {
                            handleSendImage();
                          } else if (selectedVideo) {
                            handleSendVideo();
                          } else {
                            handleSendMessage();
                          }
                        }}
                        disabled={sendMessage.isPending || isSendingImage || isSendingVideo || isActiveInstanceOffline || (!selectedImage && !selectedVideo && !messageText.trim())}
                      >
                        {sendMessage.isPending || isSendingImage || isSendingVideo ? (
                          <Loader2 className={cn("animate-spin", isMobile ? "h-6 w-6" : "h-5 w-5")} />
                        ) : (
                          <Send className={cn(isMobile ? "h-6 w-6" : "h-5 w-5")} />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </>
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
              {leadDetails?.name || selectedConversation?.display_name || selectedConversation?.contact_name || selectedConversation?.phone_number}
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
            
            <div className="space-y-3 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">WhatsApp:</span>
                <span className="font-medium">{selectedConversation?.phone_number || "-"}</span>
              </div>
              
              {/* Estrelas - Editável */}
              {selectedConversation?.lead_id && leadDetails && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Estrelas:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => updateLeadStars.mutate(star)}
                        disabled={updateLeadStars.isPending}
                        className="p-0.5 hover:scale-110 transition-transform disabled:opacity-50"
                      >
                        <Star 
                          className={cn(
                            "h-5 w-5",
                            star <= (leadDetails.stars || 0) 
                              ? "fill-yellow-400 text-yellow-400" 
                              : "text-gray-300"
                          )} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Instagram - com logo */}
              {selectedConversation?.lead_instagram && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Instagram:
                  </span>
                  <a 
                    href={`https://instagram.com/${selectedConversation.lead_instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-pink-600 hover:underline"
                  >
                    {selectedConversation.lead_instagram}
                  </a>
                </div>
              )}
              
              {/* Etapa do Funil - com nome correto */}
              {selectedConversation?.lead_id && leadDetails?.stage && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Etapa do funil:</span>
                  <Badge variant="outline">
                    {getStageDisplayName(leadDetails.stage)}
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
              
              {/* Instância */}
              {selectedConversation && getInstanceLabel(selectedConversation.instance_id) && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Instância:</span>
                  <span className="font-medium text-xs truncate max-w-[150px]">
                    {getInstanceLabel(selectedConversation.instance_id)}
                  </span>
                </div>
              )}
            </div>

            {/* Scheduled Messages Panel */}
            {selectedConversation?.lead_id && (
              <ScheduledMessagesPanel
                leadId={selectedConversation.lead_id}
                whatsappInstanceId={selectedConversation.instance_id}
                phoneNumber={selectedConversation.phone_number}
                compact
              />
            )}
          </div>
          <DrawerFooter>
            {(leadDetails?.id || selectedConversation?.lead_id) ? (
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
