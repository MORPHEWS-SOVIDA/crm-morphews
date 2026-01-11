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
import { Loader2, Settings, Clock, RefreshCw, Hand } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

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
  const { data: settings, isLoading } = useQuery({
    queryKey: ["instance-settings", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("distribution_mode, auto_close_hours, display_name_for_team, manual_instance_number, redistribution_timeout_minutes")
        .eq("id", instanceId)
        .single();

      if (error) throw error;
      return data as unknown as {
        distribution_mode: string | null;
        auto_close_hours: number | null;
        display_name_for_team: string | null;
        manual_instance_number: string | null;
        redistribution_timeout_minutes: number | null;
      };
    },
    enabled: open,
  });

  const [distributionMode, setDistributionMode] = useState<string>(settings?.distribution_mode || "manual");
  const [autoCloseHours, setAutoCloseHours] = useState<number>(settings?.auto_close_hours || 24);
  const [displayName, setDisplayName] = useState<string>(settings?.display_name_for_team || "");
  const [instanceNumber, setInstanceNumber] = useState<string>(settings?.manual_instance_number || "");
  const [redistributionTimeout, setRedistributionTimeout] = useState<number>(settings?.redistribution_timeout_minutes || 30);

  // Atualizar state quando carregar dados
  useEffect(() => {
    if (settings) {
      setDistributionMode(settings.distribution_mode || "manual");
      setAutoCloseHours(settings.auto_close_hours || 24);
      setDisplayName(settings.display_name_for_team || "");
      setInstanceNumber(settings.manual_instance_number || "");
      setRedistributionTimeout(settings.redistribution_timeout_minutes || 30);
    }
  }, [settings]);

  // Salvar configurações
  const updateSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          distribution_mode: distributionMode,
          auto_close_hours: autoCloseHours,
          display_name_for_team: displayName.trim() || null,
          manual_instance_number: instanceNumber.trim() || null,
          redistribution_timeout_minutes: distributionMode === 'auto' ? redistributionTimeout : null,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações - {instanceName}
          </DialogTitle>
          <DialogDescription>
            Defina o modo de distribuição e encerramento automático
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
              <Label>Modo de Distribuição de Leads</Label>
              <RadioGroup
                value={distributionMode}
                onValueChange={setDistributionMode}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="manual" id="manual" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
                      <Hand className="h-4 w-4" />
                      Distribuição Manual
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Conversas ficam pendentes até um atendente assumir clicando em "ATENDER"
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="auto" className="flex items-center gap-2 cursor-pointer">
                      <RefreshCw className="h-4 w-4" />
                      Auto-Distribuição (Rodízio)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Novas conversas são designadas automaticamente para usuários em rodízio.
                      O vendedor designado verá a conversa na aba "Pra você" e deve clicar ATENDER.
                    </p>
                  </div>
                </div>
              </RadioGroup>
              
              {/* Timeout de redistribuição - só aparece quando auto está selecionado */}
              {distributionMode === 'auto' && (
                <div className="ml-6 p-3 border rounded-lg bg-muted/30 space-y-2">
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

            <p className="text-xs text-muted-foreground bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
              💡 Para configurar robôs IA com agendamento de horários, acesse as <strong>Permissões</strong> desta instância.
            </p>

            <Separator />

            {/* Encerramento Automático */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Encerramento Automático
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="168"
                  value={autoCloseHours}
                  onChange={(e) => setAutoCloseHours(parseInt(e.target.value) || 24)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  horas sem mensagens
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Conversas serão encerradas automaticamente após este período de inatividade
              </p>
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
