import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Brain, FileText, Zap, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppAISettings {
  whatsapp_ai_memory_enabled: boolean;
  whatsapp_ai_learning_enabled: boolean;
  whatsapp_ai_seller_briefing_enabled: boolean;
  whatsapp_document_reading_enabled: boolean;
  whatsapp_document_auto_reply_message: string | null;
}

export function WhatsAppAISettingsManager() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<WhatsAppAISettings>({
    whatsapp_ai_memory_enabled: false,
    whatsapp_ai_learning_enabled: false,
    whatsapp_ai_seller_briefing_enabled: false,
    whatsapp_document_reading_enabled: false,
    whatsapp_document_auto_reply_message: "Nossa IA recebeu seu arquivo e interpretou assim:",
  });

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ["org-whatsapp-ai-settings", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from("organizations")
        .select(`
          whatsapp_ai_memory_enabled,
          whatsapp_ai_learning_enabled,
          whatsapp_ai_seller_briefing_enabled,
          whatsapp_document_reading_enabled,
          whatsapp_document_auto_reply_message
        `)
        .eq("id", profile.organization_id)
        .single();

      if (error) throw error;
      return data as WhatsAppAISettings;
    },
    enabled: !!profile?.organization_id,
  });

  useEffect(() => {
    if (orgSettings) {
      setSettings({
        whatsapp_ai_memory_enabled: orgSettings.whatsapp_ai_memory_enabled ?? false,
        whatsapp_ai_learning_enabled: orgSettings.whatsapp_ai_learning_enabled ?? false,
        whatsapp_ai_seller_briefing_enabled: orgSettings.whatsapp_ai_seller_briefing_enabled ?? false,
        whatsapp_document_reading_enabled: orgSettings.whatsapp_document_reading_enabled ?? false,
        whatsapp_document_auto_reply_message: orgSettings.whatsapp_document_auto_reply_message || "Nossa IA recebeu seu arquivo e interpretou assim:",
      });
    }
  }, [orgSettings]);

  const saveSettings = useMutation({
    mutationFn: async (newSettings: WhatsAppAISettings) => {
      if (!profile?.organization_id) throw new Error("No organization");

      const { error } = await supabase
        .from("organizations")
        .update(newSettings)
        .eq("id", profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-whatsapp-ai-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar");
    },
  });

  const handleSave = () => {
    saveSettings.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Memória de Longo Prazo */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Brain className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Memória de Longo Prazo (IA)</Label>
              <p className="text-sm text-muted-foreground">
                Robô lembra de conversas anteriores e dados do cliente
              </p>
            </div>
          </div>
          <Switch
            checked={settings.whatsapp_ai_memory_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsapp_ai_memory_enabled: checked }))
            }
          />
        </div>

        {settings.whatsapp_ai_memory_enabled && (
          <div className="ml-12 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 space-y-4">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Consome Energia IA (100 unidades/análise)</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Aprendizado Automático</span>
                  <p className="text-xs text-muted-foreground">
                    IA aprende preferências do cliente automaticamente
                  </p>
                </div>
                <Switch
                  checked={settings.whatsapp_ai_learning_enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, whatsapp_ai_learning_enabled: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Briefing para Vendedor</span>
                  <p className="text-xs text-muted-foreground">
                    Resumo automático ao assumir conversa
                  </p>
                </div>
                <Switch
                  checked={settings.whatsapp_ai_seller_briefing_enabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, whatsapp_ai_seller_briefing_enabled: checked }))
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Leitura de Documentos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Leitura de PDFs (Receitas Médicas)</Label>
              <p className="text-sm text-muted-foreground">
                IA interpreta documentos enviados pelos clientes
              </p>
            </div>
          </div>
          <Switch
            checked={settings.whatsapp_document_reading_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsapp_document_reading_enabled: checked }))
            }
          />
        </div>

        {settings.whatsapp_document_reading_enabled && (
          <div className="ml-12 p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/30 space-y-4">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Consome Energia IA (100 unidades/documento)</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 mt-1 text-muted-foreground" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">Mensagem de resposta automática</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Quando o robô estiver atendendo, esta mensagem será enviada antes do resumo
                  </p>
                  <Textarea
                    value={settings.whatsapp_document_auto_reply_message || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        whatsapp_document_auto_reply_message: e.target.value,
                      }))
                    }
                    placeholder="Nossa IA recebeu seu arquivo e interpretou assim:"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
              <p className="font-medium">Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>
                  <strong>Modo Robô:</strong> IA lê o documento e envia resumo para o cliente
                </li>
                <li>
                  <strong>Modo Atribuído:</strong> IA lê e mostra resumo para o vendedor (não envia para cliente)
                </li>
                <li>Extrai medicamentos, dosagens e informações do prescritor</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saveSettings.isPending}>
          {saveSettings.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
