import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Loader2, Wand2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BotSettings {
  useEmojis?: boolean;
  interpretAudio?: boolean;
  interpretImages?: boolean;
  interpretDocuments?: boolean;
  voiceEnabled?: boolean;
  voiceStyle?: string;
  maxMessages?: number;
  qualificationEnabled?: boolean;
  qualificationQuestions?: { questionText: string }[];
  productScope?: string;
  sendProductImages?: boolean;
  sendProductVideos?: boolean;
  sendProductLinks?: boolean;
}

interface PromptWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  botName: string;
  currentServiceType: string;
  currentPrompt: string;
  botSettings: BotSettings;
  onPromptGenerated: (prompt: string) => void;
  onSaveAll: () => void;
}

const SERVICE_TYPES = [
  { value: 'sales', label: '💰 Vendas' },
  { value: 'support', label: '🔧 Suporte' },
  { value: 'sac', label: '📞 SAC' },
  { value: 'social_selling', label: '🤝 Social Selling' },
  { value: 'qualification', label: '📋 Qualificação' },
];

export function PromptWizard({ open, onOpenChange, botName, currentServiceType, currentPrompt, botSettings, onPromptGenerated, onSaveAll }: PromptWizardProps) {
  const [serviceType, setServiceType] = useState(currentServiceType || 'sales');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [step, setStep] = useState<'describe' | 'review'>('describe');

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-bot-prompt', {
        body: {
          name: botName,
          serviceType,
          description,
          currentPrompt: currentPrompt || undefined,
          // Pass all behavioral settings
          useEmojis: botSettings.useEmojis,
          interpretAudio: botSettings.interpretAudio,
          interpretImages: botSettings.interpretImages,
          interpretDocuments: botSettings.interpretDocuments,
          voiceEnabled: botSettings.voiceEnabled,
          voiceStyle: botSettings.voiceStyle,
          maxMessages: botSettings.maxMessages,
          qualificationEnabled: botSettings.qualificationEnabled,
          qualificationQuestions: botSettings.qualificationQuestions,
          productScope: botSettings.productScope,
          sendProductImages: botSettings.sendProductImages,
          sendProductVideos: botSettings.sendProductVideos,
          sendProductLinks: botSettings.sendProductLinks,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedPrompt(data.prompt);
      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAndSave = () => {
    onPromptGenerated(generatedPrompt);
    // Small delay to let state propagate, then save
    setTimeout(() => {
      onSaveAll();
    }, 100);
    onOpenChange(false);
    setStep('describe');
    setDescription('');
    setGeneratedPrompt('');
    toast.success('Prompt gerado e configurações salvas!');
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('describe');
    setDescription('');
    setGeneratedPrompt('');
  };

  // Build summary of active settings
  const settingsSummary: string[] = [];
  if (botSettings.useEmojis) settingsSummary.push('😊 Emojis ativos');
  if (botSettings.interpretAudio) settingsSummary.push('🎙️ Interpreta áudios');
  if (botSettings.interpretImages) settingsSummary.push('📷 Interpreta imagens');
  if (botSettings.interpretDocuments) settingsSummary.push('📄 Interpreta documentos');
  if (botSettings.voiceEnabled) settingsSummary.push('🔊 Voz IA ativa');
  if (botSettings.qualificationEnabled) settingsSummary.push('📋 Qualificação ativa');
  if (botSettings.productScope === 'all') settingsSummary.push('📦 Todos os produtos');
  else if (botSettings.productScope === 'selected') settingsSummary.push('📦 Produtos selecionados');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Assistente de Prompt — {botName}
          </DialogTitle>
        </DialogHeader>

        {step === 'describe' && (
          <div className="space-y-5">
            <div className="space-y-3">
              <Label>Tipo de serviço</Label>
              <RadioGroup value={serviceType} onValueChange={setServiceType} className="flex flex-wrap gap-2">
                {SERVICE_TYPES.map((st) => (
                  <Label
                    key={st.value}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all hover:border-primary text-sm",
                      serviceType === st.value && "border-primary bg-primary/5"
                    )}
                  >
                    <RadioGroupItem value={st.value} className="sr-only" />
                    {st.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Settings summary */}
            {settingsSummary.length > 0 && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-xs font-medium text-primary mb-2">⚙️ Configurações que serão incorporadas no prompt:</p>
                <div className="flex flex-wrap gap-1.5">
                  {settingsSummary.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descreva como quer que o robô se comporte</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Ex:\n- Vendedora jovem e simpática, fala de forma informal\n- Usa gírias gaúchas como "bah" e "tchê"\n- Sempre tenta fechar a venda\n- Conhece muito sobre os produtos\n- Nome da empresa: Loja ABC\n- Diferencial: entrega rápida e atendimento humanizado`}
                rows={8}
                className="text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                💡 Quanto mais detalhes, melhor o prompt gerado. As configurações das outras abas (emojis, voz, interpretação, produtos) serão automaticamente incorporadas.
              </p>
            </div>

            {currentPrompt && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
                O prompt atual será usado como referência para manter o que já funciona.
              </p>
            )}

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando com IA...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar Prompt com IA
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revise o prompt gerado. Ele já incorpora todas as configurações. Você pode editar antes de aplicar.
            </p>

            <Textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              rows={14}
              className="font-mono text-sm"
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('describe')} className="flex-1">
                ← Voltar
              </Button>
              <Button onClick={handleGenerate} variant="outline" disabled={isGenerating} className="gap-1">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Regenerar
              </Button>
              <Button onClick={handleApplyAndSave} className="flex-1 gap-2">
                <Save className="h-4 w-4" />
                Aplicar e Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
