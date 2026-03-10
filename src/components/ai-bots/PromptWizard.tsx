import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PromptWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  botName: string;
  currentServiceType: string;
  currentPrompt: string;
  onPromptGenerated: (prompt: string) => void;
}

const SERVICE_TYPES = [
  { value: 'sales', label: '💰 Vendas' },
  { value: 'support', label: '🔧 Suporte' },
  { value: 'sac', label: '📞 SAC' },
  { value: 'social_selling', label: '🤝 Social Selling' },
  { value: 'qualification', label: '📋 Qualificação' },
];

export function PromptWizard({ open, onOpenChange, botName, currentServiceType, currentPrompt, onPromptGenerated }: PromptWizardProps) {
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

  const handleApply = () => {
    onPromptGenerated(generatedPrompt);
    onOpenChange(false);
    // Reset
    setStep('describe');
    setDescription('');
    setGeneratedPrompt('');
    toast.success('Prompt aplicado! Não esqueça de salvar.');
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('describe');
    setDescription('');
    setGeneratedPrompt('');
  };

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
                💡 Quanto mais detalhes, melhor o prompt gerado. Inclua: tom de voz, expressões regionais, regras de negócio, diferenciais.
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
              Revise o prompt gerado. Você pode editar antes de aplicar.
            </p>

            <Textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              rows={14}
              className="font-mono text-sm"
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('describe')} className="flex-1">
                ← Voltar e descrever novamente
              </Button>
              <Button onClick={handleGenerate} variant="outline" disabled={isGenerating} className="gap-1">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Regenerar
              </Button>
              <Button onClick={handleApply} className="flex-1 gap-2">
                <Wand2 className="h-4 w-4" />
                Aplicar Prompt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
