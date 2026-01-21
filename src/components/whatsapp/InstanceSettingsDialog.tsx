import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Settings, RefreshCw, Hand, Bot, Phone } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { WavoipSettings } from "./WavoipSettings";
import { AutoCloseSettings, type AutoCloseConfig } from "./AutoCloseSettings";

interface InstanceSettingsDialogProps {
  instanceId: string;
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstanceSettingsDialog({
  instanceId,
  instanceName,
  open,
  onOpenChange
}: InstanceSettingsDialogProps) {
  const queryClient = useQueryClient();

  // Buscar configurações atuais
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["instance-settings", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select(`
          distribution_mode, 
          display_name_for_team, 
          manual_instance_number, 
          redistribution_timeout_minutes, 
          wavoip_enabled,
          auto_close_enabled,
          auto_close_bot_minutes,
          auto_close_assigned_minutes,
          auto_close_only_business_hours,
          auto_close_business_start,
          auto_close_business_end,
          auto_close_send_message,
          auto_close_message_template,
          satisfaction_survey_enabled,
          satisfaction_survey_message
        `)
        .eq("id", instanceId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const [distributionMode, setDistributionMode] = useState<string>("manual");
  const [displayName, setDisplayName] = useState<string>("");
  const [instanceNumber, setInstanceNumber] = useState<string>("");
  const [redistributionTimeout, setRedistributionTimeout] = useState<number>(30);
  
  const [autoCloseConfig, setAutoCloseConfig] = useState<AutoCloseConfig>({
    auto_close_enabled: true,
    auto_close_bot_minutes: 60,
    auto_close_assigned_minutes: 480,
    auto_close_only_business_hours: false,
    auto_close_business_start: "08:00",
    auto_close_business_end: "20:00",
    auto_close_send_message: false,
    auto_close_message_template: "Olá! Como não recebemos resposta, estamos encerrando este atendimento. Caso precise, é só nos chamar novamente! 😊",
    satisfaction_survey_enabled: false,
    satisfaction_survey_message: "De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏"
  });

  // Atualizar state quando carregar dados
  useEffect(() => {
    if (settings) {
      setDistributionMode(settings.distribution_mode || "manual");
      setDisplayName(settings.display_name_for_team || "");
      setInstanceNumber(settings.manual_instance_number || "");
      setRedistributionTimeout(settings.redistribution_timeout_minutes || 30);
      
      setAutoCloseConfig({
        auto_close_enabled: settings.auto_close_enabled ?? true,
        auto_close_bot_minutes: settings.auto_close_bot_minutes ?? 60,
        auto_close_assigned_minutes: settings.auto_close_assigned_minutes ?? 480,
        auto_close_only_business_hours: settings.auto_close_only_business_hours ?? false,
        auto_close_business_start: settings.auto_close_business_start || "08:00",
        auto_close_business_end: settings.auto_close_business_end || "20:00",
        auto_close_send_message: settings.auto_close_send_message ?? false,
        auto_close_message_template: settings.auto_close_message_template || "Olá! Como não recebemos resposta, estamos encerrando este atendimento. Caso precise, é só nos chamar novamente! 😊",
        satisfaction_survey_enabled: settings.satisfaction_survey_enabled ?? false,
        satisfaction_survey_message: settings.satisfaction_survey_message || "De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏"
      });
    }
  }, [settings]);

  // Salvar configurações
  const updateSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          distribution_mode: distributionMode,
          display_name_for_team: displayName.trim() || null,
          manual_instance_number: instanceNumber.trim() || null,
          redistribution_timeout_minutes: distributionMode === 'auto' ? redistributionTimeout : null,
          ...autoCloseConfig
        })
        .eq("id", instanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-settings", instanceId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Configurações salvas!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar configurações");
    },
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações - {instanceName}
          </DialogTitle>
          <DialogDescription>
            Defina como as conversas serão distribuídas
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Nome para exibição */}
            <div className="space-y-2">
              <Label>Nome para o Time</Label>
              <Input
                placeholder="Ex: Vendas, Suporte..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nome amigável exibido para a equipe
              </p>
            </div>

            <div className="space-y-2">
              <Label>Número do WhatsApp</Label>
              <Input
                placeholder="Ex: (11) 99999-9999"
                value={instanceNumber}
                onChange={(e) => setInstanceNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Número associado para identificação
              </p>
            </div>

            <Separator />

            {/* Modo de Distribuição */}
            <div className="space-y-3">
              <Label>Modo de Atendimento</Label>
              <RadioGroup
                value={distributionMode}
                onValueChange={setDistributionMode}
                className="space-y-3"
              >
                {/* Modo Robô */}
                <div className={`flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 ${distributionMode === 'bot' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30' : ''}`}>
                  <RadioGroupItem value="bot" id="bot" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="bot" className="flex items-center gap-2 cursor-pointer">
                      <Bot className="h-4 w-4 text-purple-600" />
                      Robô de IA
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      O robô de IA atende primeiro, qualifica o lead e transfere para um humano quando necessário
                    </p>
                  </div>
                </div>

                {/* Modo Auto-Distribuição */}
                <div className={`flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 ${distributionMode === 'auto' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                  <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="auto" className="flex items-center gap-2 cursor-pointer">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      Distribuição Automática (Rodízio)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Novas conversas são designadas automaticamente para vendedores em rodízio
                    </p>
                  </div>
                </div>

                {/* Modo Manual */}
                <div className={`flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 ${distributionMode === 'manual' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                  <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
                      <Hand className="h-4 w-4 text-amber-600" />
                      Todas Pendentes (Manual)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Todas as conversas ficam pendentes até um atendente assumir manualmente
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {/* Nota sobre robô */}
              {distributionMode === 'bot' && (
                <div className="p-3 border rounded-lg bg-purple-50 dark:bg-purple-950/30 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Importante:</strong> Configure os robôs e horários de atendimento nas <strong>Permissões</strong> desta instância.
                  </p>
                </div>
              )}
              
              {/* Timeout de redistribuição - só aparece quando auto está selecionado */}
              {distributionMode === 'auto' && (
                <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30 space-y-2">
                  <Label className="text-sm">Tempo para redistribuição</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="5"
                      max="1440"
                      value={redistributionTimeout}
                      onChange={(e) => setRedistributionTimeout(parseInt(e.target.value) || 30)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      minutos
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se o vendedor não atender neste tempo, a conversa passa para o próximo na fila
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Chamadas via WhatsApp - Wavoip */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Chamadas via WhatsApp
              </Label>
              <WavoipSettings 
                instanceId={instanceId}
                instanceName={instanceName}
                wavoipEnabled={settings?.wavoip_enabled ?? false}
                onUpdate={() => refetch()}
              />
            </div>

            <Separator />

            {/* Encerramento Automático e Pesquisa de Satisfação */}
            <AutoCloseSettings 
              config={autoCloseConfig}
              onChange={setAutoCloseConfig}
            />

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => updateSettings.mutate()}
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}