import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from 'react';
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
  Settings,
  FileText,
  Users,
  Filter,
  Instagram,
  UserPlus,
  XCircle,
  Hand,
} from 'lucide-react';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, normalizeText } from '@/lib/utils';
import { EmojiPicker } from '@/components/whatsapp/EmojiPicker';
import { ImageUpload } from '@/components/whatsapp/ImageUpload';
import { AudioRecorder } from '@/components/whatsapp/AudioRecorder';
import { MessageBubble } from '@/components/whatsapp/MessageBubble';
import { ConversationItem } from '@/components/whatsapp/ConversationItem';
import { ConversationStatusTabs } from '@/components/whatsapp/ConversationStatusTabs';
import { ConversationTransferDialog } from '@/components/whatsapp/ConversationTransferDialog';
import { LeadSearchDialog } from '@/components/whatsapp/LeadSearchDialog';
import { NewConversationDialog } from '@/components/whatsapp/NewConversationDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConversationDistribution } from '@/hooks/useConversationDistribution';
import { useCrossInstanceConversations, getOtherInstanceConversations } from '@/hooks/useCrossInstanceConversations';
import { useQuery } from '@tanstack/react-query';

type StatusTab = 'pending' | 'autodistributed' | 'assigned' | 'closed';

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
  status?: string; // 'pending' | 'autodistributed' | 'assigned' | 'closed'
  assigned_user_id?: string | null;
  designated_user_id?: string | null; // Para auto-distribuição
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
  instance_id?: string | null; // IMPORTANTE: permite separar por instância dentro da mesma conversa

  // Multi-atendimento (sender)
  sent_by_user_id?: string | null;
  sender_name?: string | null;

  // Erro (quando falha envio)
  error_details?: string | null;
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
  display_name_for_team: string | null;
  manual_instance_number: string | null;
  distribution_mode: string; // 'manual' | 'auto'
}

interface InstanceUserPermission {
  user_id: string;
  instance_id: string;
  is_instance_admin: boolean;
}

export default function WhatsAppChat() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data: funnelStages } = useFunnelStages();
  const { claimConversation, closeConversation } = useConversationDistribution();
  const { data: crossInstanceMap } = useCrossInstanceConversations();
  
  const [isUpdatingStars, setIsUpdatingStars] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null); // sub-aba da instância dentro da conversa
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [lead, setLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimingConversationId, setClaimingConversationId] = useState<string | null>(null);
  const [closingConversationId, setClosingConversationId] = useState<string | null>(null);
  
  // Status tab filter
  const [statusFilter, setStatusFilter] = useState<StatusTab>('autodistributed');
  
  // Media state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [pendingAudio, setPendingAudio] = useState<{ base64: string; mimeType: string } | null>(null);
  const [pendingDocument, setPendingDocument] = useState<{ base64: string; mimeType: string; fileName: string } | null>(null);
  
  // Dialog state
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  
  // Filter state
  const [conversationTypeFilter, setConversationTypeFilter] = useState<'all' | 'individual' | 'group'>('all');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Fetch instances user has access to (incluindo desconectadas)
  useEffect(() => {
    const fetchInstances = async () => {
      if (!user) return;

      // 1) Primeiro busca as permissões do usuário
      const { data: perms, error: permsError } = await supabase
        .from('whatsapp_instance_users')
        .select('instance_id')
        .eq('user_id', user.id)
        .eq('can_view', true);

      if (permsError) {
        console.error('[WhatsAppChat] Erro ao buscar permissões de instâncias:', permsError);
        return;
      }

      const instanceIds = (perms || []).map((p: any) => p.instance_id).filter(Boolean) as string[];

      if (instanceIds.length === 0) {
        setInstances([]);
        setSelectedInstance(null);
        return;
      }

      // 2) Depois busca os dados completos da instância (incluindo campos de exibição)
      const { data: instancesData, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id, name, phone_number, is_connected, display_name_for_team, manual_instance_number, distribution_mode')
        .in('id', instanceIds)
        .order('name');

      if (instancesError) {
        console.error('[WhatsAppChat] Erro ao buscar instâncias:', instancesError);
        return;
      }

      const instancesList = (instancesData || []) as unknown as Instance[];
      setInstances(instancesList);

      if (instancesList.length > 0 && !selectedInstance) {
        // Se tiver mais de 1 instância, começa em "todas" para não esconder conversas.
        if (instancesList.length > 1) {
          setSelectedInstance('all');
        } else {
          setSelectedInstance(instancesList[0].id);
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
        // "all" = todas as conversas da organização
        if (selectedInstance === 'all') {
          setConversations(data);
          return;
        }

        // Filtrar pela instância selecionada ou mostrar as que estão com current_instance_id nela
        const filtered = data.filter((c: any) =>
          c.instance_id === selectedInstance || c.current_instance_id === selectedInstance
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

  // Mantém controle de qual instância está ativa dentro do chat (sub-abas)
  useEffect(() => {
    if (!selectedConversation) return;
    setActiveInstanceId(selectedConversation.instance_id);
  }, [selectedConversation?.id]);

  // Instâncias que já tiveram mensagens para esse contato dentro desta conversa (abas)
  // IMPORTANTE: hoje o backend pode "unificar" o mesmo lead em 1 conversation_id.
  // Então, a separação por instância precisa ser feita pelo instance_id da mensagem.
  const { data: samePhoneConversations = [] } = useQuery({
    queryKey: ['same-phone-instances', selectedConversation?.id],
    enabled: !!selectedConversation?.id,
    queryFn: async (): Promise<string[]> => {
      if (!selectedConversation?.id) return [];

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('instance_id, created_at')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const unique = new Set<string>();
      (data || []).forEach((m: any) => {
        if (m.instance_id) unique.add(m.instance_id);
      });

      // Garantir que a instância "base" da conversa esteja presente
      if (selectedConversation.instance_id) unique.add(selectedConversation.instance_id);

      return Array.from(unique);
    },
    staleTime: 15000,
  });

  // Fetch messages for selected conversation
  type FetchMessagesOptions = {
    silent?: boolean;
    resetUnread?: boolean;
  };

  const fetchMessages = useCallback(
    async (options: FetchMessagesOptions = {}) => {
      const { silent = false, resetUnread = true } = options;

      if (!selectedConversation) return;
      if (!silent) setIsLoading(true);

      // Buscar mensagens (sempre filtrar por instance_id para NÃO misturar instâncias)
      const effectiveInstanceId = activeInstanceId ?? selectedConversation.instance_id;

      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .eq('instance_id', effectiveInstanceId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        // Buscar nomes dos usuários que enviaram mensagens (outbound com sent_by_user_id)
        const userIds = [
          ...new Set(
            data
              .map((m: any) => m.sent_by_user_id)
              .filter(Boolean)
          ),
        ] as string[];

        let userNames: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds);

          if (profiles) {
            userNames = profiles.reduce((acc, p) => {
              const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Usuário';
              acc[p.user_id] = name;
              return acc;
            }, {} as Record<string, string>);
          }
        }

        // Adicionar sender_name às mensagens
        const messagesWithSender: Message[] = (data as any[]).map((m) => ({
          ...m,
          sender_name: m.sent_by_user_id ? userNames[m.sent_by_user_id] || null : null,
        }));

        setMessages(messagesWithSender);

        // Reset unread count (apenas quando abrimos a conversa)
        if (resetUnread) {
          await supabase
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('id', selectedConversation.id);
        }
      }

      if (!silent) setIsLoading(false);
    },
    [selectedConversation, activeInstanceId]
  );

  useEffect(() => {
    fetchMessages();

    if (selectedConversation) {
      // Realtime for messages - escuta todos os eventos
      const channel = supabase
        .channel(`messages-realtime-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'whatsapp_messages',
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          () => {
            // Sempre refaz o fetch para manter sender_name (multi-atendimento)
            fetchMessages({ silent: true, resetUnread: false });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'whatsapp_messages',
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          () => {
            fetchMessages({ silent: true, resetUnread: false });
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Messages subscription status:', status);
        });

      // Polling backup every 5 seconds
      const pollInterval = setInterval(() => {
        fetchMessages({ silent: true, resetUnread: false });
      }, 5000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [selectedConversation?.id, fetchMessages]);

  // Fetch lead data - usando RPC SECURITY DEFINER para permitir visualizar lead mesmo com RLS restritivo
  useEffect(() => {
    const fetchLead = async () => {
      if (!selectedConversation?.id) {
        setLead(null);
        return;
      }
      
      // Usar RPC que bypassa RLS para dados do lead vinculado à conversa
      const { data, error } = await supabase
        .rpc('get_linked_lead_for_conversation', { 
          p_conversation_id: selectedConversation.id 
        });

      if (error) {
        console.error('[WhatsAppChat] Erro ao buscar lead vinculado:', error);
        setLead(null);
        return;
      }
      
      // A RPC retorna um array, pegar o primeiro item
      if (data && data.length > 0) {
        const leadData = data[0];
        // Buscar dados completos do lead se tivermos acesso, senão usar dados da RPC
        const { data: fullLead, error: fullError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadData.lead_id)
          .maybeSingle();

        if (!fullError && fullLead) {
          setLead(fullLead);
        } else {
          // Fallback para dados básicos da RPC se RLS bloquear a query completa
          setLead({
            id: leadData.lead_id,
            name: leadData.lead_name || 'Lead Vinculado',
            instagram: leadData.lead_instagram || '',
            whatsapp: selectedConversation.phone_number,
            email: null,
            stage: leadData.lead_stage || 'prospect',
            stars: leadData.lead_stars || 0,
          });
        }
      } else {
        setLead(null);
      }
    };

    fetchLead();
  }, [selectedConversation?.id]);

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
    if ((!newMessage.trim() && !selectedImage && !pendingAudio && !pendingDocument) || !selectedConversation) return;
    
    // Usar a instância ativa da sub-aba (quando existe multi-instância)
    const conversationInstanceId = activeInstanceId ?? selectedConversation.instance_id;
    
    const messageText = newMessage.trim();
    const imageToSend = selectedImage;
    const audioToSend = pendingAudio;
    const documentToSend = pendingDocument;
    
    // Clear inputs
    setNewMessage('');
    setSelectedImage(null);
    setSelectedImageMime(null);
    setPendingAudio(null);
    setPendingDocument(null);
    setIsSending(true);
    
    // Determine message type
    let messageType = 'text';
    let mediaUrl: string | null = null;
    
    if (documentToSend) {
      messageType = 'document';
      mediaUrl = documentToSend.base64;
    } else if (audioToSend) {
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
      status: 'sending',
      instance_id: conversationInstanceId,
      sent_by_user_id: user?.id ?? null,
      sender_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    
    try {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const body: any = {
        organizationId: profile.organization_id,
        instanceId: conversationInstanceId, // Usar instance_id da conversa
        conversationId: selectedConversation.id,
        chatId: selectedConversation.chat_id || null,
        phone: selectedConversation.phone_number,
        messageType,
        content: messageText || '',
        senderUserId: user?.id, // ID do usuário para multi-atendimento
      };

      if (documentToSend) {
        body.mediaUrl = documentToSend.base64;
        body.mediaCaption = messageText || documentToSend.fileName;
        body.mediaMimeType = documentToSend.mimeType;
      } else if (audioToSend) {
        body.mediaUrl = audioToSend.base64;
      } else if (imageToSend) {
        body.mediaUrl = imageToSend;
        body.mediaCaption = messageText || '';
      }

      console.log("[WhatsApp] Enviando mensagem:", {
        organization_id: profile.organization_id,
        instance_id: conversationInstanceId,
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
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== optimisticMessage.id) return m;
            const incoming = data.message as Message;
            return {
              ...incoming,
              sender_name: incoming.sender_name ?? m.sender_name ?? null,
            };
          })
        );
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

  const handleDocumentSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      toast.error('Arquivo inválido. Envie PDF, DOC/DOCX, XLS/XLSX, TXT ou CSV.');
      e.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 20MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPendingDocument({ base64, mimeType: file.type, fileName: file.name });
    };
    reader.onerror = () => toast.error('Erro ao ler o arquivo.');
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setSelectedImageMime(null);
  };

  const clearPendingAudio = () => {
    setPendingAudio(null);
  };

  const clearPendingDocument = () => {
    setPendingDocument(null);
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

  // Buscar nomes dos usuários atribuídos
  const { data: userProfiles } = useQuery({
    queryKey: ['user-profiles-for-conversations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return {};
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', profile.organization_id);
      
      if (!members?.length) return {};
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', members.map(m => m.user_id));
      
      const map: Record<string, string> = {};
      profiles?.forEach(p => {
        map[p.user_id] = `${p.first_name} ${p.last_name}`.trim();
      });
      return map;
    },
    enabled: !!profile?.organization_id,
  });

  // Verificar se usuário é admin de alguma instância
  const { data: userInstancePermissions } = useQuery({
    queryKey: ['user-instance-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('whatsapp_instance_users')
        .select('instance_id, is_instance_admin')
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const isAdminOfInstance = (instanceId: string) => {
    return userInstancePermissions?.some(p => 
      (p.instance_id === instanceId && p.is_instance_admin) || 
      (selectedInstance === 'all' && p.is_instance_admin)
    ) || false;
  };

  // Calcular contagens por status (autodistributed só conta as do usuário logado)
  const statusCounts = useMemo(() => {
    return {
      pending: conversations.filter(c => c.status === 'pending' || !c.status).length,
      autodistributed: conversations.filter(c => 
        c.status === 'autodistributed' && c.designated_user_id === user?.id
      ).length,
      assigned: conversations.filter(c => c.status === 'assigned').length,
      closed: conversations.filter(c => c.status === 'closed').length,
    };
  }, [conversations, user?.id]);

  // Handler para assumir conversa
  const handleClaimConversation = async (conversationId: string) => {
    if (!user?.id) return;
    setClaimingConversationId(conversationId);
    try {
      await claimConversation.mutateAsync({ conversationId, userId: user.id });
      // Atualizar conversa local
      setConversations(prev => prev.map(c => 
        c.id === conversationId 
          ? { ...c, status: 'assigned', assigned_user_id: user.id }
          : c
      ));
      // Mover para aba atribuído
      setStatusFilter('assigned');
    } finally {
      setClaimingConversationId(null);
    }
  };

  // Handler para encerrar conversa (do header do chat)
  const handleCloseConversation = async () => {
    if (!selectedConversation) return;
    await closeConversation.mutateAsync(selectedConversation.id);
    setConversations(prev => prev.map(c => 
      c.id === selectedConversation.id 
        ? { ...c, status: 'closed' }
        : c
    ));
    setSelectedConversation(null);
  };

  // Handler para encerrar conversa (da lista)
  const handleCloseConversationById = async (conversationId: string) => {
    setClosingConversationId(conversationId);
    try {
      await closeConversation.mutateAsync(conversationId);
      setConversations(prev => prev.map(c => 
        c.id === conversationId 
          ? { ...c, status: 'closed' }
          : c
      ));
      // Se era a conversa selecionada, deselecionar
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
      // Mover para aba encerrado
      setStatusFilter('closed');
    } finally {
      setClosingConversationId(null);
    }
  };

  const filteredConversations = conversations.filter(c => {
    // Filtro por status (aba)
    const convStatus = c.status || 'pending';
    if (convStatus !== statusFilter) return false;
    
    // Para aba "autodistributed", mostrar APENAS conversas designadas para o usuário logado
    if (statusFilter === 'autodistributed' && c.designated_user_id !== user?.id) {
      return false;
    }
    
    // Para aba "assigned", mostrar apenas minhas conversas OU todas se for admin da instância
    if (statusFilter === 'assigned' && c.assigned_user_id !== user?.id) {
      // Verificar se é admin da instância para mostrar todas
      const isAdmin = isAdminOfInstance(c.instance_id);
      if (!isAdmin) return false;
    }
    
    // Filtro de busca por texto
    const matchesSearch = normalizeText(c.contact_name || '').includes(normalizeText(searchTerm)) ||
      c.phone_number.includes(searchTerm);
    
    // Filtro por tipo de conversa (individual/grupo)
    const isGroup = c.phone_number.includes('@g.us') || (c as any).is_group === true;
    const matchesType = conversationTypeFilter === 'all' ||
      (conversationTypeFilter === 'group' && isGroup) ||
      (conversationTypeFilter === 'individual' && !isGroup);
    
    return matchesSearch && matchesType;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Helper to get custom stage display name
  // Mapeamento: prospect→1, contacted→2, qualified→3, proposal→4, negotiation→5, cloud→stage_type=cloud, trash→stage_type=trash
  const getStageDisplayName = (stageKey: string | null | undefined) => {
    if (!stageKey || !funnelStages) return stageKey;
    
    // Special stage_type handling
    if (stageKey === 'cloud') {
      const cloudStage = funnelStages.find(s => s.stage_type === 'cloud');
      return cloudStage?.name || 'Aguardando';
    }
    if (stageKey === 'trash') {
      const trashStage = funnelStages.find(s => s.stage_type === 'trash');
      return trashStage?.name || 'Sem interesse';
    }
    
    // Funnel stages map enum values to positions 1-5
    const stagePositionMap: Record<string, number> = {
      'prospect': 1,
      'contacted': 2,
      'qualified': 3,
      'proposal': 4,
      'negotiation': 5,
    };
    const position = stagePositionMap[stageKey];
    if (position === undefined) return stageKey;
    const customStage = funnelStages.find(s => s.position === position && s.stage_type === 'funnel');
    return customStage?.name || stageKey;
  };

  // Helper to get instance display label
  const getInstanceLabel = (instId: string) => {
    const inst = instances.find((i) => i.id === instId);
    if (!inst) return null;

    const displayName = inst.display_name_for_team || inst.name || 'Instância';
    const number = inst.manual_instance_number || inst.phone_number;

    return number ? `${displayName} - ${number}` : displayName;
  };

  const getInstanceIsConnected = (instId: string) => {
    const inst = instances.find((i) => i.id === instId);
    return inst?.is_connected ?? null;
  };

  const getInstanceTabLabel = (instId: string) => {
    return getInstanceLabel(instId) || 'Instância';
  };

  // Verificar se a instância usa distribuição manual (permite botão ATENDER)
  const isManualDistribution = (instId: string): boolean => {
    const inst = instances.find(i => i.id === instId);
    return inst?.distribution_mode !== 'auto';
  };

  // Update lead stars
  const updateLeadStars = async (stars: number) => {
    if (!lead) return;
    setIsUpdatingStars(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ stars })
        .eq('id', lead.id);
      if (error) throw error;
      setLead(prev => prev ? { ...prev, stars } : null);
      toast.success('Estrelas atualizadas!');
    } catch (err: any) {
      toast.error('Erro ao atualizar estrelas');
    } finally {
      setIsUpdatingStars(false);
    }
  };

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
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowNewConversationDialog(true)}
                  title="Nova Conversa"
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigate('/whatsapp')} className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Instance selector */}
            {instances.length > 1 && (
              <Select
                value={selectedInstance || 'all'}
                onValueChange={(val) => {
                  setSelectedInstance(val);
                  setSelectedConversation(null);
                }}
              >
                <SelectTrigger className="w-full mb-2 text-sm">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as instâncias</SelectItem>
                  {instances.map((inst) => {
                    // Prioridade: "Nome que time vai ver no chat" - Número da Instância
                    const displayName = inst.display_name_for_team || inst.name;
                    const number = inst.manual_instance_number || inst.phone_number;
                    const label = displayName && number ? `${displayName} - ${number}` : displayName || number || inst.name;
                    const isConnected = inst.is_connected;
                    
                    return (
                      <SelectItem key={inst.id} value={inst.id}>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            isConnected ? "bg-funnel-positive" : "bg-destructive"
                          )} />
                          <span>{label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            
            {/* Filtro de tipo de conversa */}
            <div className="mb-2">
              <Select value={conversationTypeFilter} onValueChange={(v) => setConversationTypeFilter(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1.5" />
                  <SelectValue placeholder="Filtrar conversas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as conversas</SelectItem>
                  <SelectItem value="individual">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Conversas individuais
                    </div>
                  </SelectItem>
                  <SelectItem value="group">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Grupos
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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

          {/* Status Tabs */}
          <ConversationStatusTabs
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
            counts={statusCounts}
          />

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="font-medium">
                  {statusFilter === 'pending' && 'Nenhuma conversa pendente'}
                  {statusFilter === 'assigned' && 'Nenhuma conversa atribuída'}
                  {statusFilter === 'closed' && 'Nenhuma conversa encerrada'}
                </p>
                <p className="text-xs mt-1">
                  {statusFilter === 'pending' && 'Novas mensagens aparecerão aqui'}
                  {statusFilter === 'assigned' && 'Suas conversas em atendimento'}
                  {statusFilter === 'closed' && 'Conversas finalizadas'}
                </p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                // Obter conversas do mesmo contato em outras instâncias
                const otherInstances = getOtherInstanceConversations(
                  crossInstanceMap,
                  conv.phone_number,
                  conv.instance_id
                );
                
                return (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConversation?.id === conv.id}
                    onClick={() => {
                      setSelectedConversation(conv);
                      setActiveInstanceId(conv.instance_id);
                    }}
                    instanceLabel={getInstanceLabel(conv.instance_id)}
                    showClaimButton={statusFilter === 'pending' && isManualDistribution(conv.instance_id)}
                    onClaim={() => handleClaimConversation(conv.id)}
                    isClaiming={claimingConversationId === conv.id}
                    onClose={() => handleCloseConversationById(conv.id)}
                    isClosing={closingConversationId === conv.id}
                    assignedUserName={conv.assigned_user_id ? userProfiles?.[conv.assigned_user_id] : null}
                    currentUserId={user?.id}
                    otherInstanceConversations={otherInstances}
                  />
                );
              })
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
                  {/* Botão Transferir - apenas para conversas atribuídas */}
                  {selectedConversation.status === 'assigned' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowTransferDialog(true)}
                      className="h-8 text-xs"
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Transferir
                    </Button>
                  )}
                  {/* Botão Encerrar - para conversas atribuídas */}
                  {selectedConversation.status === 'assigned' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleCloseConversation}
                      disabled={closeConversation.isPending}
                      className="h-8 text-xs text-orange-600 hover:text-orange-700"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Encerrar
                    </Button>
                  )}
                  {/* Botão Atender - para conversas pendentes APENAS em modo manual */}
                  {(selectedConversation.status === 'pending' || !selectedConversation.status) && 
                   isManualDistribution(selectedConversation.instance_id) && (
                    <Button 
                      size="sm"
                      onClick={() => handleClaimConversation(selectedConversation.id)}
                      disabled={claimingConversationId === selectedConversation.id}
                      className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Hand className="h-4 w-4 mr-1" />
                      ATENDER
                    </Button>
                  )}
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

              {/* Dropdown de instância (quando contato está em múltiplas instâncias) */}
              {samePhoneConversations.length > 1 && (
                <div className="border-b border-border bg-muted/30 px-4 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Instância ({samePhoneConversations.length}):
                  </span>
                  <Select
                    value={activeInstanceId ?? selectedConversation.instance_id}
                    onValueChange={(instId) => setActiveInstanceId(instId)}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {samePhoneConversations.map((instId) => {
                        const label = getInstanceTabLabel(instId);
                        const isConnected = getInstanceIsConnected(instId);

                        return (
                          <SelectItem key={instId} value={instId} className="text-xs">
                            <div className="flex items-center gap-2">
                              {isConnected !== null && (
                                <div
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    isConnected ? "bg-funnel-positive" : "bg-destructive"
                                  )}
                                />
                              )}
                              <span>{label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
 
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
              {(selectedImage || pendingAudio || pendingDocument) && (
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
                    {pendingDocument && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm truncate max-w-[220px]">{pendingDocument.fileName}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearPendingDocument}
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
                  <button
                    type="button"
                    onClick={() => documentInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-md h-9 w-9 border border-border bg-background hover:bg-accent"
                    title="Enviar documento"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <input
                    ref={documentInputRef}
                    type="file"
                    className="hidden"
                    accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
                    onChange={handleDocumentSelect}
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
                    disabled={isSending || isRecordingAudio || (!newMessage.trim() && !selectedImage && !pendingAudio && !pendingDocument)}
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
                        <AvatarImage src={selectedConversation.contact_profile_pic || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xl">
                          {lead.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">{lead.name}</h4>
                        {/* Estrelas editáveis */}
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => updateLeadStars(i + 1)}
                              disabled={isUpdatingStars}
                              className="p-0 hover:scale-110 transition-transform disabled:opacity-50"
                            >
                              <Star 
                                className={cn(
                                  "h-4 w-4 cursor-pointer",
                                  i < lead.stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
                                )}
                              />
                            </button>
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
                      {/* Instagram com logo */}
                      {lead.instagram && (
                        <div className="flex items-center gap-2">
                          <Instagram className="h-4 w-4 text-pink-500" />
                          <a 
                            href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-600 hover:underline"
                          >
                            {lead.instagram}
                          </a>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Etapa do funil com nome correto */}
                    <div>
                      <span className="text-sm text-muted-foreground">Etapa do funil</span>
                      <Badge variant="secondary" className="mt-1 block w-fit">
                        {getStageDisplayName(lead.stage)}
                      </Badge>
                    </div>

                    {/* Instância ativa (sub-aba) */}
                    {getInstanceLabel(activeInstanceId ?? selectedConversation.instance_id) && (
                      <div>
                        <span className="text-sm text-muted-foreground">Instância</span>
                        <p className="text-sm font-medium truncate">
                          {getInstanceLabel(activeInstanceId ?? selectedConversation.instance_id)}
                        </p>
                      </div>
                    )}

                    {/* Abre em nova aba */}
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open(`/leads/${lead.id}`, '_blank')}
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
      
      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={showNewConversationDialog}
        onOpenChange={setShowNewConversationDialog}
      />

      {/* Transfer Conversation Dialog */}
      {selectedConversation && (
        <ConversationTransferDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          conversationId={selectedConversation.id}
          instanceId={selectedConversation.instance_id}
          currentUserId={selectedConversation.assigned_user_id}
          contactName={selectedConversation.contact_name || selectedConversation.phone_number}
        />
      )}
    </Layout>
  );
}
