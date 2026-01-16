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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Cog, Phone, Users, Wifi, MessageSquare, History, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EvolutionSettingsDialogProps {
  instanceId: string;
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EvolutionSettings {
  reject_call: boolean;
  msg_call: string;
  groups_ignore: boolean;
  always_online: boolean;
  read_messages: boolean;
  read_status: boolean;
  sync_full_history: boolean;
}

const defaultSettings: EvolutionSettings = {
  reject_call: true,
  msg_call: "Não posso atender agora, me envie uma mensagem.",
  groups_ignore: false,
  always_online: false,
  read_messages: true,
  read_status: false,
  sync_full_history: false,
};

export function EvolutionSettingsDialog({
  instanceId,
  instanceName,
  open,
  onOpenChange
}: EvolutionSettingsDialogProps) {
  const queryClient = useQueryClient();

  // Estado local para os settings
  const [settings, setSettings] = useState<EvolutionSettings>(defaultSettings);

  // Buscar configurações atuais do banco
  const { data: instanceData, isLoading } = useQuery({
    queryKey: ["evolution-settings", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("evolution_settings, evolution_instance_id")
        .eq("id", instanceId)
        .single();

      if (error) throw error;
      return data as unknown as {
        evolution_settings: EvolutionSettings | null;
        evolution_instance_id: string | null;
      };
    },
    enabled: open,
  });

  // Atualizar state quando carregar dados
  useEffect(() => {
    if (instanceData?.evolution_settings) {
      setSettings({
        ...defaultSettings,
        ...instanceData.evolution_settings,
      });
    } else {
      setSettings(defaultSettings);
    }
  }, [instanceData]);

  // Salvar configurações
  const updateSettings = useMutation({
    mutationFn: async () => {
      // Chamar a edge function para atualizar no Evolution E salvar no banco
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-instance-manager`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "update_settings",
            instanceId,
            settings,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao salvar configurações");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evolution-settings", instanceId] });
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
      toast.success("Configurações do Evolution salvas!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar configurações");
    },
  });

  const handleToggle = (key: keyof EvolutionSettings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Configurações do Evolution - {instanceName}
          </DialogTitle>
          <DialogDescription>
            Configure o comportamento da instância no WhatsApp
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Essas configurações são sincronizadas diretamente com o Evolution API e afetam o comportamento do WhatsApp.
              </AlertDescription>
            </Alert>

            {/* Rejeitar Chamadas */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Rejeitar Chamadas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Rejeita automaticamente todas as ligações recebidas
                </p>
              </div>
              <Switch
                checked={settings.reject_call}
                onCheckedChange={() => handleToggle("reject_call")}
              />
            </div>

            {/* Mensagem de rejeição de chamada */}
            {settings.reject_call && (
              <div className="space-y-2 pl-6 border-l-2 border-muted">
                <Label>Mensagem ao rejeitar chamada</Label>
                <Input
                  placeholder="Mensagem enviada ao rejeitar..."
                  value={settings.msg_call}
                  onChange={(e) => setSettings(prev => ({ ...prev, msg_call: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Mensagem automática enviada quando uma ligação é rejeitada
                </p>
              </div>
            )}

            <Separator />

            {/* Ignorar Grupos */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Ignorar Grupos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ignora todas as mensagens recebidas de grupos
                </p>
              </div>
              <Switch
                checked={settings.groups_ignore}
                onCheckedChange={() => handleToggle("groups_ignore")}
              />
            </div>

            <Separator />

            {/* Sempre Online */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  Sempre Online
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mantém o WhatsApp sempre mostrando "online"
                </p>
              </div>
              <Switch
                checked={settings.always_online}
                onCheckedChange={() => handleToggle("always_online")}
              />
            </div>

            <Separator />

            {/* Marcar Mensagens como Lidas */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Marcar Mensagens como Lidas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Marca automaticamente todas as mensagens como lidas
                </p>
              </div>
              <Switch
                checked={settings.read_messages}
                onCheckedChange={() => handleToggle("read_messages")}
              />
            </div>

            <Separator />

            {/* Sincronizar Histórico Completo */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Sincronizar Histórico Completo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Sincroniza todo o histórico de conversas ao escanear o QR Code
                </p>
              </div>
              <Switch
                checked={settings.sync_full_history}
                onCheckedChange={() => handleToggle("sync_full_history")}
              />
            </div>

            <Separator />

            {/* Marcar Status como Lido */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Marcar Status como Lido
                </Label>
                <p className="text-xs text-muted-foreground">
                  Marca automaticamente todos os status como visualizados
                </p>
              </div>
              <Switch
                checked={settings.read_status}
                onCheckedChange={() => handleToggle("read_status")}
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
                Salvar no Evolution
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
