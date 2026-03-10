import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Bot, ChevronRight, ChevronLeft, Sparkles, Briefcase, MessageSquare, Wand2, Loader2 } from "lucide-react";
import { useCreateAIBot } from "@/hooks/useAIBots";
import { cn } from "@/lib/utils";

interface AIBotWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Nome e Função', icon: Bot, description: 'Identifique seu robô' },
  { id: 2, title: 'Personalidade', icon: MessageSquare, description: 'Descreva como ele é' },
  { id: 3, title: 'Revisar Prompt', icon: Sparkles, description: 'Confira o resultado' },
];

const SERVICE_TYPES = [
  { value: 'sales', label: '💰 Vendas', desc: 'Apresentar produtos e fechar vendas' },
  { value: 'support', label: '🔧 Suporte Técnico', desc: 'Resolver problemas técnicos' },
  { value: 'sac', label: '📞 SAC', desc: 'Atender reclamações e solicitações' },
  { value: 'social_selling', label: '🤝 Social Selling', desc: 'Criar relacionamento e engajamento' },
  { value: 'qualification', label: '📋 Qualificação', desc: 'Qualificar leads com perguntas' },
];

function generatePromptFromDescription(
  name: string,
  serviceType: string,
  description: string,
): string {
  const serviceLabels: Record<string, string> = {
    sales: 'vendas',
    support: 'suporte técnico',
    sac: 'SAC (atendimento ao cliente)',
    social_selling: 'social selling e relacionamento',
    qualification: 'qualificação de leads',
  };

  const serviceLabel = serviceLabels[serviceType] || serviceType;

  let prompt = `Você é ${name}, um assistente virtual especializado em ${serviceLabel}.`;

  if (description.trim()) {
    prompt += `\n\n${description.trim()}`;
  }

  prompt += `\n\nDiretrizes gerais:
- Seja sempre educado e profissional
- Responda de forma clara e objetiva
- Se não souber algo, seja honesto e ofereça buscar a informação
- Mantenha o foco no seu objetivo principal: ${serviceLabel}`;

  return prompt;
}

export function AIBotWizard({ open, onOpenChange, onComplete }: AIBotWizardProps) {
  const createBot = useCreateAIBot();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Nome + Tipo
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<string>('sales');
  
  // Step 2: Descrição livre
  const [description, setDescription] = useState('');
  
  // Step 3: Prompt gerado (editável)
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [promptEdited, setPromptEdited] = useState(false);
  
  const progress = (currentStep / STEPS.length) * 100;
  
  const goToStep = (step: number) => {
    if (step === 3 && !promptEdited) {
      // Generate prompt when entering step 3
      setGeneratedPrompt(generatePromptFromDescription(name, serviceType, description));
    }
    setCurrentStep(step);
  };
  
  const handleSubmit = async () => {
    try {
      await createBot.mutateAsync({
        name,
        service_type: serviceType,
        personality_description: description || null,
        system_prompt: generatedPrompt,
        response_length: 'medium',
        gender: 'neutral',
        age_range: '26-35',
      } as any);
      
      // Reset
      setCurrentStep(1);
      setName('');
      setServiceType('sales');
      setDescription('');
      setGeneratedPrompt('');
      setPromptEdited(false);
      
      onComplete();
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 1: return name.trim().length >= 2;
      case 2: return true;
      case 3: return generatedPrompt.trim().length > 0;
      default: return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Criar Novo Robô
          </DialogTitle>
        </DialogHeader>
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Passo {currentStep} de {STEPS.length}
            </span>
            <span className="font-medium">{STEPS[currentStep - 1].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div 
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-all",
                    isActive && "scale-110",
                    isCompleted && "text-primary",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-full transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-primary/20",
                    !isActive && !isCompleted && "bg-muted"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs hidden md:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Step Content */}
        <div className="py-6 min-h-[300px]">
          {/* Step 1: Nome + Tipo de Serviço */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Como vai se chamar seu robô?</h3>
                <p className="text-muted-foreground">
                  Escolha um nome e defina o que ele vai fazer
                </p>
              </div>
              
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Luna, Max, Aria..."
                className="text-center text-lg max-w-xs mx-auto"
                autoFocus
              />
              
              <div className="space-y-3">
                <Label className="text-center block">O que seu robô vai fazer?</Label>
                <RadioGroup value={serviceType} onValueChange={setServiceType} className="space-y-2">
                  {SERVICE_TYPES.map((option) => (
                    <Label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-4 p-3 border rounded-lg cursor-pointer transition-all hover:border-primary",
                        serviceType === option.value && "border-primary bg-primary/5"
                      )}
                    >
                      <RadioGroupItem value={option.value} />
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <p className="text-sm text-muted-foreground">{option.desc}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}
          
          {/* Step 2: Descrição livre da personalidade */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold mb-2">Descreva seu robô ideal</h3>
                <p className="text-muted-foreground">
                  Escreva livremente como quer que ele se comporte. Isso será transformado no prompt.
                </p>
              </div>
              
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Ex:\n- Vendedora jovem e simpática, usa gírias gaúchas como "bah" e "tchê"\n- Fala de forma informal e usa emojis\n- Conhece muito sobre os produtos\n- Sempre tenta fechar a venda oferecendo promoções\n- Se o cliente ficar em dúvida, manda áudio`}
                rows={8}
                className="text-sm"
                autoFocus
              />
              
              <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <strong>Dica:</strong> Quanto mais detalhes você der, melhor será o prompt gerado.
                  Inclua tom de voz, expressões regionais, forma de se apresentar, etc.
                </p>
              </div>
            </div>
          )}
          
          {/* Step 3: Revisar Prompt */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold mb-2">Revise o Prompt ✨</h3>
                <p className="text-muted-foreground">
                  Este é o prompt que define seu robô. Você pode editar livremente.
                </p>
              </div>
              
              <Textarea
                value={generatedPrompt}
                onChange={(e) => {
                  setGeneratedPrompt(e.target.value);
                  setPromptEdited(true);
                }}
                rows={12}
                className="font-mono text-sm"
              />
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGeneratedPrompt(generatePromptFromDescription(name, serviceType, description));
                    setPromptEdited(false);
                  }}
                >
                  Regenerar Prompt
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                💡 O prompt é o "cérebro" do robô. Após criar, você pode configurar mensagens, FAQ, produtos e interpretação de mídia separadamente.
              </p>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          
          {currentStep < STEPS.length ? (
            <Button
              onClick={() => goToStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createBot.isPending || !canProceed()}
              className="gap-2"
            >
              {createBot.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {createBot.isPending ? 'Criando...' : 'Criar Robô!'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
