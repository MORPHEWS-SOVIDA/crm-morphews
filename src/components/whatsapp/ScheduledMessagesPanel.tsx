import { useState } from "react";
import { Clock, Plus, Send, X, Calendar, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ScheduledMessagesPanelProps {
  leadId: string | null;
  whatsappInstanceId?: string;
  phoneNumber?: string;
  compact?: boolean;
}

interface ScheduledMessage {
  id: string;
  final_message: string;
  scheduled_at: string;
  status: string;
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export function ScheduledMessagesPanel({ 
  leadId, 
  whatsappInstanceId, 
  phoneNumber,
  compact = false 
}: ScheduledMessagesPanelProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Fetch scheduled messages for this lead
  const { data: messages, isLoading } = useQuery({
    queryKey: ["lead-scheduled-messages", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from("lead_scheduled_messages")
        .select("*")
        .eq("lead_id", leadId)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as ScheduledMessage[];
    },
    enabled: !!leadId,
  });

  // Create scheduled message
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!leadId || !profile?.organization_id || !newMessage.trim() || !scheduledDate || !scheduledTime) {
        throw new Error("Preencha todos os campos");
      }

      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      const { error } = await supabase
        .from("lead_scheduled_messages")
        .insert({
          organization_id: profile.organization_id,
          lead_id: leadId,
          final_message: newMessage.trim(),
          scheduled_at: scheduledAt,
          original_scheduled_at: scheduledAt,
          status: "pending",
          created_by: profile.user_id,
          whatsapp_instance_id: whatsappInstanceId || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mensagem agendada com sucesso!" });
      setShowCreateDialog(false);
      setNewMessage("");
      setScheduledDate("");
      setScheduledTime("");
      queryClient.invalidateQueries({ queryKey: ["lead-scheduled-messages", leadId] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao agendar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update scheduled message
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingMessage || !newMessage.trim() || !scheduledDate || !scheduledTime) {
        throw new Error("Preencha todos os campos");
      }

      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      const { error } = await supabase
        .from("lead_scheduled_messages")
        .update({
          final_message: newMessage.trim(),
          scheduled_at: scheduledAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingMessage.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mensagem atualizada!" });
      setShowEditDialog(false);
      setEditingMessage(null);
      setNewMessage("");
      setScheduledDate("");
      setScheduledTime("");
      queryClient.invalidateQueries({ queryKey: ["lead-scheduled-messages", leadId] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel scheduled message
  const cancelMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("lead_scheduled_messages")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mensagem cancelada" });
      queryClient.invalidateQueries({ queryKey: ["lead-scheduled-messages", leadId] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (msg: ScheduledMessage) => {
    setEditingMessage(msg);
    setNewMessage(msg.final_message);
    const date = new Date(msg.scheduled_at);
    setScheduledDate(format(date, "yyyy-MM-dd"));
    setScheduledTime(format(date, "HH:mm"));
    setShowEditDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pendente</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Enviada</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300">Cancelada</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingMessages = messages?.filter(m => m.status === "pending") || [];
  const otherMessages = messages?.filter(m => m.status !== "pending") || [];

  if (!leadId) {
    return null;
  }

  return (
    <div className={cn("space-y-3", compact ? "" : "border-t pt-4")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Mensagens Agendadas</span>
          {pendingMessages.length > 0 && (
            <Badge className="bg-yellow-500 text-white h-5 min-w-5">
              {pendingMessages.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setNewMessage("");
            setScheduledDate("");
            setScheduledTime("");
            setShowCreateDialog(true);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Agendar
        </Button>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-2">
          Carregando...
        </div>
      ) : messages?.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-2">
          Nenhuma mensagem agendada
        </div>
      ) : (
        <ScrollArea className={cn(compact ? "max-h-40" : "max-h-60")}>
          <div className="space-y-2">
            {/* Pending messages first */}
            {pendingMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 text-yellow-700 dark:text-yellow-300">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {format(new Date(msg.scheduled_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => handleEdit(msg)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-destructive"
                      onClick={() => cancelMutation.mutate(msg.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-foreground line-clamp-2">{msg.final_message}</p>
              </div>
            ))}
            
            {/* Other messages */}
            {!compact && otherMessages.slice(0, 3).map((msg) => (
              <div
                key={msg.id}
                className="bg-muted/50 border rounded-lg p-2 text-xs opacity-70"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">
                    {format(new Date(msg.scheduled_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                  {getStatusBadge(msg.status)}
                </div>
                <p className="text-foreground/80 line-clamp-1">{msg.final_message}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Agendar Nova Mensagem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div>
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newMessage.trim() || !scheduledDate || !scheduledTime}
            >
              <Send className="h-4 w-4 mr-2" />
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Mensagem Agendada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <div>
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !newMessage.trim() || !scheduledDate || !scheduledTime}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
