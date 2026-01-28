import { useState } from "react";
import { 
  Clock, 
  Calendar, 
  ChevronRight, 
  Loader2,
  Send
} from "lucide-react";
import type { FunnelStage } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFunnelStages } from "@/hooks/useFunnelStages";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickLeadActionsProps {
  leadId: string | null;
  leadName?: string;
  leadStage?: string;
  funnelStageId?: string | null;
  instanceId?: string;
  onStageChange?: () => void;
}

export function QuickLeadActions({
  leadId,
  leadName,
  leadStage,
  funnelStageId,
  instanceId,
  onStageChange,
}: QuickLeadActionsProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: funnelStages } = useFunnelStages();
  
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showStagePopover, setShowStagePopover] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Buscar contagem de mensagens agendadas
  const { data: scheduledCount } = useQuery({
    queryKey: ["scheduled-count", leadId],
    queryFn: async () => {
      if (!leadId) return 0;
      const { count } = await supabase
        .from("lead_scheduled_messages")
        .select("*", { count: "exact", head: true })
        .eq("lead_id", leadId)
        .eq("status", "pending")
        .is("deleted_at", null);
      return count || 0;
    },
    enabled: !!leadId,
  });

  // Criar mensagem agendada
  const createScheduled = useMutation({
    mutationFn: async () => {
      if (!leadId || !profile?.organization_id || !newMessage.trim() || !scheduledDate || !scheduledTime) {
        throw new Error("Preencha todos os campos");
      }

      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

      const { error } = await supabase.from("lead_scheduled_messages").insert({
        organization_id: profile.organization_id,
        lead_id: leadId,
        final_message: newMessage.trim(),
        scheduled_at: scheduledAt,
        original_scheduled_at: scheduledAt,
        status: "pending",
        created_by: profile.user_id,
        whatsapp_instance_id: instanceId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem agendada!");
      setShowScheduleDialog(false);
      setNewMessage("");
      setScheduledDate("");
      setScheduledTime("");
      queryClient.invalidateQueries({ queryKey: ["scheduled-count", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-scheduled-messages", leadId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao agendar");
    },
  });

  // Alterar etapa do lead
  const changeStage = useMutation({
    mutationFn: async (newStage: FunnelStage) => {
      if (!leadId) throw new Error("Sem lead");

      const { error } = await supabase
        .from("leads")
        .update({ stage: newStage })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa atualizada!");
      setShowStagePopover(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations-org"] });
      onStageChange?.();
    },
    onError: () => {
      toast.error("Erro ao alterar etapa");
    },
  });

  // Encontrar nome da etapa atual - prioriza funnel_stage_id sobre o enum legado
  const getCurrentStageName = () => {
    if (!funnelStages) return leadStage || '';
    
    // Primeiro tenta pelo funnel_stage_id (mais preciso)
    if (funnelStageId) {
      const stage = funnelStages.find(s => s.id === funnelStageId);
      if (stage) return stage.name;
    }
    
    // Fallback: Map de enum_value para a etapa customizada
    if (leadStage) {
      const stage = funnelStages.find(s => s.enum_value === leadStage);
      if (stage) return stage.name;
    }
    
    return leadStage || '';
  };

  // Cor da etapa - prioriza funnel_stage_id
  const getStageColor = () => {
    if (!funnelStages) return undefined;
    
    // Primeiro tenta pelo funnel_stage_id (mais preciso)
    if (funnelStageId) {
      const stage = funnelStages.find(s => s.id === funnelStageId);
      if (stage) return stage.color;
    }
    
    // Fallback: Map de enum_value
    if (leadStage) {
      const stage = funnelStages.find(s => s.enum_value === leadStage);
      return stage?.color;
    }
    
    return undefined;
  };

  if (!leadId) return null;

  // Ordenar etapas por posição (sem filtro is_active - não existe no schema)
  const sortedStages = funnelStages
    ?.slice()
    .sort((a, b) => a.position - b.position) || [];

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Botão de etapa do funil */}
        <Popover open={showStagePopover} onOpenChange={setShowStagePopover}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs px-2"
              style={getStageColor() ? { 
                borderColor: getStageColor(),
                color: getStageColor()
              } : undefined}
            >
              <ChevronRight className="h-3 w-3" />
              {getCurrentStageName() || "Etapa"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Mover para:
              </p>
              {sortedStages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => stage.enum_value && changeStage.mutate(stage.enum_value)}
                  disabled={changeStage.isPending || stage.enum_value === leadStage}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors text-left",
                    stage.enum_value === leadStage && "bg-muted font-medium"
                  )}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color || '#888' }}
                  />
                  <span className="truncate">{stage.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Botão de agendar mensagem */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs px-2"
          onClick={() => setShowScheduleDialog(true)}
        >
          <Clock className="h-3 w-3" />
          Agendar
          {scheduledCount && scheduledCount > 0 && (
            <Badge 
              variant="secondary" 
              className="h-4 px-1 text-[10px] bg-yellow-100 text-yellow-700"
            >
              {scheduledCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Dialog de agendamento rápido */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendar Mensagem
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Para: {leadName}</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora</Label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createScheduled.mutate()}
              disabled={createScheduled.isPending || !newMessage.trim() || !scheduledDate || !scheduledTime}
              className="gap-1"
            >
              {createScheduled.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
