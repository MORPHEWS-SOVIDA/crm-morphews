import { useState, useEffect } from "react";
import { Phone, MessageSquare, Loader2 } from "lucide-react";
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
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber?: string; // Telefone pré-preenchido (quando vem do botão WhatsApp)
  message?: string; // Mensagem pré-preenchida
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

  // Atualiza o telefone e mensagem quando mudam as props
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

  // Buscar instâncias conectadas
  useEffect(() => {
    if (!open || !profile?.organization_id) return;

    const fetchInstances = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("whatsapp_instances")
          .select("id, name, phone_number, is_connected")
          .eq("organization_id", profile.organization_id)
          .eq("is_connected", true)
          .order("name");

        if (error) throw error;

        setInstances(data || []);
        
        // Auto-selecionar se só tem uma instância
        if (data && data.length === 1) {
          setSelectedInstanceId(data[0].id);
        }
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
  }, [open, profile?.organization_id]);

  // Limpar estado ao fechar
  const handleClose = () => {
    if (!phoneNumber) setPhone("");
    if (!message) setMessageText("");
    setSelectedInstanceId("");
    onOpenChange(false);
  };

  // Normalizar telefone
  const normalizePhone = (phone: string) => {
    return phone.replace(/\D/g, "");
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

    setIsSending(true);
    try {
      // Verificar se já existe conversa com esse número nessa instância
      const { data: existingConversation } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("instance_id", selectedInstanceId)
        .eq("phone_number", cleanPhone)
        .maybeSingle();

      let conversationId = existingConversation?.id;

      // Se não existe, criar nova conversa
      if (!conversationId) {
        const { data: newConversation, error: createError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            instance_id: selectedInstanceId,
            organization_id: profile?.organization_id,
            phone_number: cleanPhone,
            chat_id: `${cleanPhone}@s.whatsapp.net`,
            is_group: false,
          })
          .select("id")
          .single();

        if (createError) throw createError;
        conversationId = newConversation.id;
      }

      // Se tem mensagem, enviar
      if (messageText.trim() && conversationId) {
        await supabase.functions.invoke("whatsapp-send-message", {
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
      toast({
        title: "Erro ao iniciar conversa",
        description: error.message,
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
            <Label>Enviar de qual número? *</Label>
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
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>{instance.name}</span>
                        {instance.phone_number && (
                          <span className="text-muted-foreground text-xs">
                            ({instance.phone_number})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
