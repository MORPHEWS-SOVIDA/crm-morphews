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
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings, RefreshCw, Hand, Bot, Phone, Star, Clock, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { WavoipSettings } from "./WavoipSettings";

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
          satisfaction_survey_enabled,
          auto_close_enabled
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
  const [satisfactionSurveyEnabled, setSatisfactionSurveyEnabled] = useState<boolean>(false);
  const [autoCloseEnabled, setAutoCloseEnabled] = useState<boolean>(true);

  // Atualizar state quando carregar dados
  useEffect(() => {
    if (settings) {
      setDistributionMode(settings.distribution_mode || "manual");
      setDisplayName(settings.display_name_for_team || "");
      setInstanceNumber(settings.manual_instance_number || "");
      setRedistributionTimeout(settings.redistribution_timeout_minutes || 30);
      setSatisfactionSurveyEnabled(settings.satisfaction_survey_enabled ?? false);
      setAutoCloseEnabled(settings.auto_close_enabled ?? true);
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
          satisfaction_survey_enabled: satisfactionSurveyEnabled,
          auto_close_enabled: autoCloseEnabled,
        } as any)
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
                {/* Modo Time de Agentes 2.0 */}
                <div className={`flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 ${distributionMode === 'agent_team' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : ''}`}>
                  <RadioGroupItem value="agent_team" id="agent_team" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="agent_team" className="flex items-center gap-2 cursor-pointer">
                      <Users className="h-4 w-4 text-emerald-600" />
                      Time de Agentes IA 2.0
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Um time de agentes especialistas com maestro que direciona automaticamente
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

            {/* Pesquisa de Satisfação NPS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <Label className="text-sm font-medium">Pesquisa de Satisfação (NPS)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          Ao encerrar conversas desta instância, o cliente recebe uma pergunta de 0 a 10.
                          A resposta é registrada automaticamente no NPS.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch 
                  checked={satisfactionSurveyEnabled}
                  onCheckedChange={setSatisfactionSurveyEnabled}
                />
              </div>
              {satisfactionSurveyEnabled && (
                <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  ✅ NPS ativo para esta instância. A mensagem e configurações gerais são definidas em <strong>Configurações Globais</strong>.
                </p>
              )}
            </div>

            <Separator />

            {/* Encerramento Automático */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium">Encerramento Automático</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          Quando ativado, conversas inativas serão encerradas automaticamente após o tempo configurado nas Configurações Globais.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch 
                  checked={autoCloseEnabled}
                  onCheckedChange={setAutoCloseEnabled}
                />
              </div>
              {autoCloseEnabled ? (
                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
                  ✅ O auto-close usará os tempos definidos em <strong>Configurações Globais</strong> (robô: X min, atribuído: Y min).
                </p>
              ) : (
                <p className="text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/30 p-2 rounded">
                  ⚠️ As conversas desta instância não serão encerradas automaticamente.
                </p>
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
