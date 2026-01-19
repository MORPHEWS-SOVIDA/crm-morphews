import { useState, useEffect, useCallback } from "react";
import { Phone, MessageSquare, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
  is_connected: boolean;
  display_name_for_team: string | null;
  manual_instance_number: string | null;
  status: string | null;
  realTimeStatus?: 'checking' | 'connected' | 'disconnected' | 'unknown';
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber?: string;
  message?: string;
  onConversationCreated?: (conversationId: string, instanceId: string) => void;
}

export function NewConversationDialog({ 
  open, 
  onOpenChange, 
  phoneNumber = "", 
  message = "",
  onConversationCreated 
}: NewConversationDialogProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [phone, setPhone] = useState(phoneNumber);
  const [messageText, setMessageText] = useState(message);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  useEffect(() => {
    if (phoneNumber) {
      setPhone(phoneNumber);
    }
  }, [phoneNumber]);

  useEffect(() => {
    if (message) {
      setMessageText(message);
    }
  }, [message]);

  // Verificar status real de uma instância na Evolution API
  const checkInstanceRealStatus = useCallback(
    async (instance: WhatsAppInstance): Promise<'connected' | 'disconnected' | 'unknown'> => {
      try {
        // A SDK já envia o JWT automaticamente; se falhar, caímos para "unknown" (não bloquear operação).
        const { data, error } = await supabase.functions.invoke("evolution-instance-manager", {
          body: { action: "check_status", instanceId: instance.id },
        });

        if (error) {
          console.error("Error checking instance status:", error);
          return 'unknown';
        }

        if (typeof data?.is_connected === 'boolean') {
          return data.is_connected ? 'connected' : 'disconnected';
        }

        return 'unknown';
      } catch (e) {
        console.error("Failed to check instance status:", e);
        return 'unknown';
      }
    },
    []
  );

  // Buscar instâncias e verificar status real
  useEffect(() => {
    if (!open || !profile?.organization_id) return;

    const fetchInstances = async () => {
      setIsLoading(true);
      try {
        // Buscar instâncias (não arquivadas)
        const { data, error } = await supabase
          .from("whatsapp_instances")
          .select("id, name, phone_number, is_connected, display_name_for_team, manual_instance_number, status")
          .eq("organization_id", profile.organization_id)
          .is("deleted_at", null)
          .order("name");

        if (error) throw error;

        // Marcar todas como "checking" inicialmente
        const instancesWithStatus = (data || []).map(inst => ({
          ...inst,
          realTimeStatus: 'checking' as const,
        }));
        
        setInstances(instancesWithStatus);
        
        if (data && data.length === 1) {
          setSelectedInstanceId(data[0].id);
        }

        // Verificar status real de cada instância em paralelo (max 5 simultâneos)
        setIsCheckingStatus(true);
        const checkPromises = instancesWithStatus.map(async (inst) => {
          const realStatus = await checkInstanceRealStatus(inst);
          return { id: inst.id, realTimeStatus: realStatus };
        });

        const results = await Promise.all(checkPromises);
        
        setInstances(prev => prev.map(inst => {
          const result = results.find(r => r.id === inst.id);
          return result ? { ...inst, realTimeStatus: result.realTimeStatus } : inst;
        }));
        
        setIsCheckingStatus(false);
      } catch (error: any) {
        console.error("Error fetching instances:", error);
        toast({
          title: "Erro ao carregar instâncias",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstances();
  }, [open, profile?.organization_id, checkInstanceRealStatus]);

  // Limpar estado ao fechar
  const handleClose = () => {
    if (!phoneNumber) setPhone("");
    if (!message) setMessageText("");
    setSelectedInstanceId("");
    onOpenChange(false);
  };

  // Normalizar telefone brasileiro para SEMPRE ter 55 + DD + 9 + 8 dígitos
  const normalizePhone = (phone: string) => {
    let clean = phone.replace(/\D/g, "");
    if (!clean) return "";
    if (!clean.startsWith("55")) clean = `55${clean}`;
    // Se tem 12 dígitos (55 + DD + 8), adiciona o 9 (celular)
    if (clean.length === 12 && clean.startsWith("55")) {
      clean = clean.slice(0, 4) + "9" + clean.slice(4);
    }
    return clean;
  };

  // Iniciar conversa
  const handleStartConversation = async () => {
    const cleanPhone = normalizePhone(phone);
    
    if (!cleanPhone) {
      toast({
        title: "Digite o número",
        description: "Informe o número de WhatsApp para iniciar a conversa",
        variant: "destructive",
      });
      return;
    }

    if (!selectedInstanceId) {
      toast({
        title: "Selecione a instância",
        description: "Escolha qual número usar para enviar a mensagem",
        variant: "destructive",
      });
      return;
    }

    // Verificar se a instância selecionada está realmente conectada
    const selectedInstance = instances.find(i => i.id === selectedInstanceId);
    if (selectedInstance?.realTimeStatus === 'disconnected') {
      toast({
        title: "Instância desconectada",
        description: "A instância selecionada não está conectada. Reconecte-a em WhatsApp DMs.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      // Verificar se já existe conversa com esse número na organização (conversa é única por org + phone)
      const { data: existingConversation } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("organization_id", profile?.organization_id)
        .eq("phone_number", cleanPhone)
        .maybeSingle();

      let conversationId = existingConversation?.id;

      // Se não existe, criar nova conversa - já atribuída ao usuário que iniciou
      if (!conversationId) {
        const { data: newConversation, error: createError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            instance_id: selectedInstanceId,
            current_instance_id: selectedInstanceId,
            organization_id: profile?.organization_id,
            phone_number: cleanPhone,
            chat_id: `${cleanPhone}@s.whatsapp.net`,
            is_group: false,
            unread_count: 0,
            // ENVIO ATIVO: Conversa já nasce atribuída ao usuário que iniciou
            status: 'assigned',
            assigned_user_id: profile?.user_id,
            assigned_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createError) throw createError;
        conversationId = newConversation.id;
      }

      // Se tem mensagem, enviar
      if (messageText.trim() && conversationId) {
        const { error: sendError } = await supabase.functions.invoke("whatsapp-send-message", {
          body: {
            organizationId: profile?.organization_id,
            conversationId,
            instanceId: selectedInstanceId,
            phone: cleanPhone,
            content: messageText.trim(),
            messageType: "text",
            senderUserId: profile?.user_id,
          },
        });

        if (sendError) throw sendError;
      }

      toast({
        title: "Conversa iniciada!",
        description: message ? "Mensagem enviada com sucesso" : "Você pode começar a conversar",
      });

      handleClose();

      // Callback ou navegar para o chat
      if (onConversationCreated) {
        onConversationCreated(conversationId!, selectedInstanceId);
      } else {
        navigate("/whatsapp/chat");
      }
    } catch (error: any) {
      console.error("Error starting conversation:", error);
      
      // Mensagem amigável em PT-BR com opção de reportar
      const errorMessage = error.message || "Erro desconhecido";
      const whatsappLink = `https://wa.me/555130760116?text=${encodeURIComponent(
        `Erro ao iniciar conversa no CRM:\n\n${errorMessage}\n\nOrganização: ${profile?.organization_id}`
      )}`;
      
      toast({
        title: "Erro ao iniciar conversa",
        description: (
          <div className="space-y-2">
            <p>Não foi possível iniciar a conversa. Verifique se a instância está conectada.</p>
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline hover:no-underline"
            >
              Reportar erro para suporte
            </a>
          </div>
        ),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Nova Conversa WhatsApp
          </DialogTitle>
          <DialogDescription>
            Inicie uma conversa com um novo número
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Número de WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número de WhatsApp *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o número com código do país (ex: 5511999999999)
            </p>
          </div>

          {/* Seletor de Instância */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Enviar de qual número? *</Label>
              {isCheckingStatus && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Verificando conexões...
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : instances.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
                Nenhuma instância conectada.
                <br />
                <span className="text-xs">Conecte um número no WhatsApp DMs primeiro.</span>
              </div>
            ) : (
              <>
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => {
                      const displayName = instance.display_name_for_team || instance.name;
                      const number = instance.manual_instance_number || instance.phone_number;
                      const label = displayName && number ? `${displayName} - ${number}` : displayName || number || instance.name;
                      
                      // Status visual baseado na verificação em tempo real
                      // 'unknown' = não conseguiu verificar, tratamos como neutro (amarelo) e permitimos envio
                      const statusColor = instance.realTimeStatus === 'connected' 
                        ? 'bg-green-500' 
                        : instance.realTimeStatus === 'checking' 
                          ? 'bg-yellow-400 animate-pulse'
                          : instance.realTimeStatus === 'disconnected'
                            ? 'bg-red-500'
                            : 'bg-amber-400'; // unknown
                      
                      // Só bloqueia se CONFIRMOU que está desconectado
                      const isDisconnected = instance.realTimeStatus === 'disconnected';
                      
                      return (
                        <SelectItem 
                          key={instance.id} 
                          value={instance.id}
                          disabled={isDisconnected}
                          className={isDisconnected ? 'opacity-60' : ''}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                            <span>{label}</span>
                            {isDisconnected && (
                              <span className="text-xs text-red-500 ml-1">(desconectado)</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                {/* Aviso se a instância selecionada está desconectada */}
                {selectedInstanceId && instances.find(i => i.id === selectedInstanceId)?.realTimeStatus === 'disconnected' && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Esta instância está desconectada. Reconecte-a em WhatsApp DMs.</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mensagem (editável) */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem a enviar</Label>
            <textarea
              id="message"
              placeholder="Digite sua mensagem (opcional)"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full min-h-[80px] p-3 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleStartConversation}
            disabled={!phone || !selectedInstanceId || isSending || instances.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Iniciar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
