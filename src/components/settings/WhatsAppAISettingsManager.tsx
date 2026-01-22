import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Brain, FileText, Zap, MessageSquare, Mic, UserCircle, Clock, Star, Bot, User, Calendar, Info, Image } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WhatsAppAISettings {
  whatsapp_ai_memory_enabled: boolean;
  whatsapp_ai_learning_enabled: boolean;
  whatsapp_ai_seller_briefing_enabled: boolean;
  whatsapp_document_reading_enabled: boolean;
  whatsapp_document_auto_reply_message: string | null;
  whatsapp_document_medical_mode: boolean;
  whatsapp_image_interpretation: boolean;
  whatsapp_image_medical_mode: boolean;
  whatsapp_audio_transcription_enabled: boolean;
  whatsapp_sender_name_prefix_enabled: boolean;
  // Auto-close settings (global)
  auto_close_enabled: boolean;
  auto_close_bot_minutes: number;
  auto_close_assigned_minutes: number;
  auto_close_only_business_hours: boolean;
  auto_close_business_start: string;
  auto_close_business_end: string;
  auto_close_send_message: boolean;
  auto_close_message_template: string;
  satisfaction_survey_enabled: boolean;
  satisfaction_survey_message: string;
  satisfaction_survey_on_manual_close: boolean;
}

const DEFAULT_CLOSE_MESSAGE = "Olá! Como não recebemos resposta, estamos encerrando este atendimento. Caso precise, é só nos chamar novamente! 😊";
const DEFAULT_SURVEY_MESSAGE = "De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏";

export function WhatsAppAISettingsManager() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<WhatsAppAISettings>({
    whatsapp_ai_memory_enabled: false,
    whatsapp_ai_learning_enabled: false,
    whatsapp_ai_seller_briefing_enabled: false,
    whatsapp_document_reading_enabled: false,
    whatsapp_document_auto_reply_message: "Nossa IA recebeu seu arquivo e interpretou assim:",
    whatsapp_document_medical_mode: false,
    whatsapp_image_interpretation: false,
    whatsapp_image_medical_mode: false,
    whatsapp_audio_transcription_enabled: false,
    whatsapp_sender_name_prefix_enabled: false,
    auto_close_enabled: true,
    auto_close_bot_minutes: 60,
    auto_close_assigned_minutes: 480,
    auto_close_only_business_hours: false,
    auto_close_business_start: "08:00",
    auto_close_business_end: "20:00",
    auto_close_send_message: false,
    auto_close_message_template: DEFAULT_CLOSE_MESSAGE,
    satisfaction_survey_enabled: false,
    satisfaction_survey_message: DEFAULT_SURVEY_MESSAGE,
    satisfaction_survey_on_manual_close: true,
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
          whatsapp_document_auto_reply_message,
          whatsapp_document_medical_mode,
          whatsapp_image_interpretation,
          whatsapp_image_medical_mode,
          whatsapp_audio_transcription_enabled,
          whatsapp_sender_name_prefix_enabled,
          auto_close_enabled,
          auto_close_bot_minutes,
          auto_close_assigned_minutes,
          auto_close_only_business_hours,
          auto_close_business_start,
          auto_close_business_end,
          auto_close_send_message,
          auto_close_message_template,
          satisfaction_survey_enabled,
          satisfaction_survey_message,
          satisfaction_survey_on_manual_close
        `)
        .eq("id", profile.organization_id)
        .single();

      if (error) throw error;
      return data;
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
        whatsapp_document_medical_mode: (orgSettings as any).whatsapp_document_medical_mode ?? false,
        whatsapp_image_interpretation: (orgSettings as any).whatsapp_image_interpretation ?? false,
        whatsapp_image_medical_mode: (orgSettings as any).whatsapp_image_medical_mode ?? false,
        whatsapp_audio_transcription_enabled: orgSettings.whatsapp_audio_transcription_enabled ?? false,
        whatsapp_sender_name_prefix_enabled: orgSettings.whatsapp_sender_name_prefix_enabled ?? false,
        auto_close_enabled: orgSettings.auto_close_enabled ?? true,
        auto_close_bot_minutes: orgSettings.auto_close_bot_minutes ?? 60,
        auto_close_assigned_minutes: orgSettings.auto_close_assigned_minutes ?? 480,
        auto_close_only_business_hours: orgSettings.auto_close_only_business_hours ?? false,
        auto_close_business_start: orgSettings.auto_close_business_start || "08:00",
        auto_close_business_end: orgSettings.auto_close_business_end || "20:00",
        auto_close_send_message: orgSettings.auto_close_send_message ?? false,
        auto_close_message_template: orgSettings.auto_close_message_template || DEFAULT_CLOSE_MESSAGE,
        satisfaction_survey_enabled: orgSettings.satisfaction_survey_enabled ?? false,
        satisfaction_survey_message: orgSettings.satisfaction_survey_message || DEFAULT_SURVEY_MESSAGE,
        satisfaction_survey_on_manual_close: orgSettings.satisfaction_survey_on_manual_close ?? true,
      });
    }
  }, [orgSettings]);

  const saveSettings = useMutation({
    mutationFn: async (newSettings: WhatsAppAISettings) => {
      if (!profile?.organization_id) throw new Error("No organization");

      const { error } = await supabase
        .from("organizations")
        .update(newSettings as any)
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

  const formatMinutesToDisplay = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
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
      {/* ============= PESQUISA DE SATISFAÇÃO (NPS) ============= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Pesquisa de Satisfação (NPS)</Label>
              <p className="text-sm text-muted-foreground">
                Enviar pesquisa de 0 a 10 ao encerrar conversas
              </p>
            </div>
          </div>
          <Switch
            checked={settings.satisfaction_survey_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, satisfaction_survey_enabled: checked }))
            }
          />
        </div>

        {settings.satisfaction_survey_enabled && (
          <div className="ml-12 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Mensagem da pesquisa</Label>
                <Textarea
                  value={settings.satisfaction_survey_message}
                  onChange={(e) => setSettings(prev => ({ ...prev, satisfaction_survey_message: e.target.value }))}
                  placeholder={DEFAULT_SURVEY_MESSAGE}
                  rows={2}
                  className="text-sm mt-2"
                />
              </div>

              {/* Quando enviar a pesquisa */}
              <div className="space-y-3 p-3 border rounded-lg bg-background/50">
                <p className="text-sm font-medium">Quando enviar a pesquisa:</p>
                
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Encerramento automático</span>
                    <p className="text-xs text-muted-foreground">
                      Quando a conversa for fechada por inatividade
                    </p>
                  </div>
                  <Switch 
                    checked={settings.auto_close_enabled && settings.auto_close_send_message}
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure nas opções de Encerramento Automático abaixo
                </p>

                <Separator className="my-2" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm">Encerramento manual pelo atendente</span>
                    <p className="text-xs text-muted-foreground">
                      Quando o vendedor clicar em "Encerrar" conversa
                    </p>
                  </div>
                  <Switch 
                    checked={settings.satisfaction_survey_on_manual_close}
                    onCheckedChange={(checked) => setSettings(prev => ({ 
                      ...prev,
                      satisfaction_survey_on_manual_close: checked
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
              <p className="font-medium">Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Cliente recebe pergunta "De 0 a 10, como você avalia?"</li>
                <li>Resposta é registrada automaticamente no NPS</li>
                <li>Notas ≤6 ficam marcadas para revisão gerencial</li>
                <li>Todas as notas contribuem para métricas da equipe</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ============= ENCERRAMENTO AUTOMÁTICO ============= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Encerramento Automático</Label>
              <p className="text-sm text-muted-foreground">
                Fechar conversas inativas automaticamente
              </p>
            </div>
          </div>
          <Switch
            checked={settings.auto_close_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, auto_close_enabled: checked }))
            }
          />
        </div>

        {settings.auto_close_enabled && (
          <div className="ml-12 p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/30 space-y-4">
            {/* Timeout diferenciado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs">
                  <Bot className="h-3.5 w-3.5 text-purple-500" />
                  Conversas com Robô
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="5"
                    max="1440"
                    value={settings.auto_close_bot_minutes}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      auto_close_bot_minutes: parseInt(e.target.value) || 60 
                    }))}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    min ({formatMinutesToDisplay(settings.auto_close_bot_minutes)})
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs">
                  <User className="h-3.5 w-3.5 text-blue-500" />
                  Conversas Atribuídas
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="30"
                    max="2880"
                    value={settings.auto_close_assigned_minutes}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      auto_close_assigned_minutes: parseInt(e.target.value) || 480 
                    }))}
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    min ({formatMinutesToDisplay(settings.auto_close_assigned_minutes)})
                  </span>
                </div>
              </div>
            </div>

            {/* Horário comercial */}
            <div className="space-y-3 p-3 border rounded-lg bg-background/50">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Só em horário comercial
                </Label>
                <Switch 
                  checked={settings.auto_close_only_business_hours}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev,
                    auto_close_only_business_hours: checked 
                  }))}
                />
              </div>
              
              {settings.auto_close_only_business_hours && (
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    type="time"
                    value={settings.auto_close_business_start}
                    onChange={(e) => setSettings(prev => ({ ...prev, auto_close_business_start: e.target.value }))}
                    className="w-28 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="time"
                    value={settings.auto_close_business_end}
                    onChange={(e) => setSettings(prev => ({ ...prev, auto_close_business_end: e.target.value }))}
                    className="w-28 h-8 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Mensagem de encerramento */}
            <div className="space-y-3 p-3 border rounded-lg bg-background/50">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Enviar mensagem ao encerrar
                </Label>
                <Switch 
                  checked={settings.auto_close_send_message}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev,
                    auto_close_send_message: checked 
                  }))}
                />
              </div>
              
              {settings.auto_close_send_message && (
                <Textarea
                  value={settings.auto_close_message_template}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_close_message_template: e.target.value }))}
                  placeholder={DEFAULT_CLOSE_MESSAGE}
                  rows={2}
                  className="text-sm"
                />
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ============= MEMÓRIA DE LONGO PRAZO ============= */}
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

      {/* ============= TRANSCRIÇÃO DE ÁUDIO ============= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Mic className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Transcrição de Áudio</Label>
              <p className="text-sm text-muted-foreground">
                IA transcreve automaticamente áudios recebidos dos clientes
              </p>
            </div>
          </div>
          <Switch
            checked={settings.whatsapp_audio_transcription_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsapp_audio_transcription_enabled: checked }))
            }
          />
        </div>

        {settings.whatsapp_audio_transcription_enabled && (
          <div className="ml-12 p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 space-y-3">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Consome Energia IA (50 unidades/áudio)</span>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
              <p className="font-medium">Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Áudios recebidos são transcritos automaticamente</li>
                <li>Texto aparece logo abaixo do áudio no chat</li>
                <li>Permite pesquisa e indexação do conteúdo</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ============= INTERPRETAÇÃO DE FOTOS ============= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Image className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Interpretação de Fotos (IA)</Label>
              <p className="text-sm text-muted-foreground">
                IA analisa e interpreta fotos enviadas pelos clientes
              </p>
            </div>
          </div>
          <Switch
            checked={settings.whatsapp_image_interpretation}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsapp_image_interpretation: checked }))
            }
          />
        </div>

        {settings.whatsapp_image_interpretation && (
          <div className="ml-12 p-4 border rounded-lg bg-cyan-50 dark:bg-cyan-950/30 space-y-4">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Consome Energia IA (150 unidades/imagem)</span>
            </div>

            {/* Modo Turbo para Receitas em Fotos */}
            <div className={cn(
              "space-y-3 p-3 border rounded-lg",
              settings.whatsapp_image_medical_mode && "border-pink-500/50 bg-pink-50/50 dark:bg-pink-950/20"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium flex items-center gap-2">
                    📸 Modo Turbo para Fotos de Receitas
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Otimizado para interpretar fotos de receitas médicas
                  </p>
                </div>
                <Switch 
                  checked={settings.whatsapp_image_medical_mode}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev,
                    whatsapp_image_medical_mode: checked
                  }))}
                />
              </div>
              
              {settings.whatsapp_image_medical_mode && (
                <div className="p-3 bg-pink-100/50 dark:bg-pink-900/20 rounded-lg text-xs space-y-1">
                  <p className="font-medium text-pink-800 dark:text-pink-200">IA especializada para fotos de receitas:</p>
                  <ul className="text-pink-700 dark:text-pink-300 list-disc list-inside space-y-0.5">
                    <li>Interpretação de caligrafia médica em fotos</li>
                    <li>Extração de nome do medicamento/fórmula</li>
                    <li>Componentes e concentração (mg, mcg, UI)</li>
                    <li>Quantidade de cápsulas/doses prescritas</li>
                    <li>Posologia e forma de uso</li>
                    <li>Nome e CRM do médico prescritor</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
              <p className="font-medium">Como funciona:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Cliente envia foto de receita, pedido ou documento</li>
                <li>IA analisa a imagem e extrai informações relevantes</li>
                <li>Resposta automática com interpretação da foto</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <Separator />


      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Leitura de Documentos (IA)</Label>
              <p className="text-sm text-muted-foreground">
                IA interpreta PDFs, receitas, orçamentos, notas, listas e outros documentos
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

            {/* Modo Turbo para Receitas Médicas */}
            <div className={cn(
              "space-y-3 p-3 border rounded-lg",
              settings.whatsapp_document_medical_mode && "border-pink-500/50 bg-pink-50/50 dark:bg-pink-950/20"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium flex items-center gap-2">
                    🏥 Modo Turbo para Receitas Médicas
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Prompt especializado para farmácias e manipuladoras
                  </p>
                </div>
                <Switch 
                  checked={settings.whatsapp_document_medical_mode}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev,
                    whatsapp_document_medical_mode: checked
                  }))}
                />
              </div>
              
              {settings.whatsapp_document_medical_mode && (
                <div className="p-3 bg-pink-100/50 dark:bg-pink-900/20 rounded-lg text-xs space-y-1">
                  <p className="font-medium text-pink-800 dark:text-pink-200">IA otimizada para extrair:</p>
                  <ul className="text-pink-700 dark:text-pink-300 list-disc list-inside space-y-0.5">
                    <li>Nome do medicamento/fórmula manipulada</li>
                    <li>Componentes e concentração (mg, mcg, UI)</li>
                    <li>Quantidade de cápsulas/doses prescritas</li>
                    <li>Posologia detalhada</li>
                    <li>Nome e CRM do médico prescritor</li>
                    <li>Interpretação de caligrafia médica difícil</li>
                  </ul>
                </div>
              )}
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
                <li>Extrai itens, valores, quantidades e informações do remetente</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ============= PREFIXO COM NOME DO VENDEDOR ============= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <UserCircle className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Prefixo com Nome do Vendedor</Label>
              <p className="text-sm text-muted-foreground">
                Mensagens enviadas começam com "*Nome:*" do vendedor
              </p>
            </div>
          </div>
          <Switch
            checked={settings.whatsapp_sender_name_prefix_enabled}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, whatsapp_sender_name_prefix_enabled: checked }))
            }
          />
        </div>

        {settings.whatsapp_sender_name_prefix_enabled && (
          <div className="ml-12 p-4 border rounded-lg bg-indigo-50 dark:bg-indigo-950/30 space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
              <p className="font-medium">Exemplo de mensagem:</p>
              <div className="p-2 bg-background rounded border text-xs">
                <span className="font-bold">*João Silva:*</span>
                <br />
                Olá! Tudo bem? Como posso ajudar?
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O cliente verá quem está falando com ele, útil para equipes com múltiplos atendentes.
              </p>
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
