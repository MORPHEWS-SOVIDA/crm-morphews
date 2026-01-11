import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, ChevronRight, ChevronLeft, Sparkles, User, MapPin, Briefcase, MessageSquare, Heart, Wand2 } from "lucide-react";
import { useCreateAIBot } from "@/hooks/useAIBots";
import { cn } from "@/lib/utils";

interface AIBotWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

const REGIONAL_EXPRESSIONS: Record<string, string[]> = {
  'RS': ['bah', 'tchê', 'tri', 'guri', 'guria', 'tu'],
  'SC': ['ô', 'né', 'então'],
  'PR': ['então', 'pois é'],
  'SP': ['mano', 'véio', 'é nóis'],
  'RJ': ['cara', 'mermão', 'é isso aí'],
  'MG': ['uai', 'sô', 'trem', 'bão'],
  'BA': ['oxe', 'meu rei', 'massa'],
  'PE': ['oxente', 'arretado', 'visse'],
  'CE': ['macho', 'cabra'],
  'default': [],
};

const STEPS = [
  { id: 1, title: 'Nome', icon: Bot, description: 'Dê um nome ao seu robô' },
  { id: 2, title: 'Identidade', icon: User, description: 'Defina a personalidade' },
  { id: 3, title: 'Localização', icon: MapPin, description: 'De onde é seu robô?' },
  { id: 4, title: 'Função', icon: Briefcase, description: 'O que ele vai fazer?' },
  { id: 5, title: 'Comunicação', icon: MessageSquare, description: 'Como ele fala?' },
  { id: 6, title: 'Personalidade', icon: Heart, description: 'Toque final!' },
];

export function AIBotWizard({ open, onOpenChange, onComplete }: AIBotWizardProps) {
  const createBot = useCreateAIBot();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('neutral');
  const [ageRange, setAgeRange] = useState<'18-25' | '26-35' | '36-50' | '50+'>('26-35');
  const [brazilianState, setBrazilianState] = useState<string>('');
  const [regionalExpressions, setRegionalExpressions] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState<'sales' | 'support' | 'sac' | 'social_selling' | 'qualification'>('sales');
  const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [companyDifferential, setCompanyDifferential] = useState('');
  const [personalityDescription, setPersonalityDescription] = useState('');
  
  const progress = (currentStep / STEPS.length) * 100;
  
  const handleStateChange = (state: string) => {
    setBrazilianState(state);
    // Sugerir expressões regionais baseado no estado
    const expressions = REGIONAL_EXPRESSIONS[state] || REGIONAL_EXPRESSIONS['default'];
    setRegionalExpressions(expressions);
  };
  
  const handleSubmit = async () => {
    try {
      await createBot.mutateAsync({
        name,
        gender,
        age_range: ageRange,
        brazilian_state: brazilianState || null,
        regional_expressions: regionalExpressions.length > 0 ? regionalExpressions : null,
        service_type: serviceType,
        response_length: responseLength,
        company_differential: companyDifferential || null,
        personality_description: personalityDescription || null,
      });
      
      // Reset form
      setCurrentStep(1);
      setName('');
      setGender('neutral');
      setAgeRange('26-35');
      setBrazilianState('');
      setRegionalExpressions([]);
      setServiceType('sales');
      setResponseLength('medium');
      setCompanyDifferential('');
      setPersonalityDescription('');
      
      onComplete();
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 1: return name.trim().length >= 2;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      case 6: return true;
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
          
          {/* Step indicators */}
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
          {/* Step 1: Nome */}
          {currentStep === 1 && (
            <div className="space-y-6 text-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Como vai se chamar seu robô?</h3>
                <p className="text-muted-foreground">
                  Escolha um nome que represente bem seu assistente virtual
                </p>
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Luna, Max, Aria..."
                className="text-center text-lg max-w-xs mx-auto"
                autoFocus
              />
            </div>
          )}
          
          {/* Step 2: Identidade */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Seu robô é...</h3>
                <p className="text-muted-foreground">Isso influencia como ele se comunica</p>
              </div>
              
              <RadioGroup value={gender} onValueChange={(v) => setGender(v as any)} className="grid grid-cols-3 gap-4">
                {[
                  { value: 'male', label: 'Homem', emoji: '👨' },
                  { value: 'female', label: 'Mulher', emoji: '👩' },
                  { value: 'neutral', label: 'Robô Neutro', emoji: '🤖' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 border rounded-lg cursor-pointer transition-all hover:border-primary",
                      gender === option.value && "border-primary bg-primary/5"
                    )}
                  >
                    <RadioGroupItem value={option.value} className="sr-only" />
                    <span className="text-4xl">{option.emoji}</span>
                    <span className="font-medium">{option.label}</span>
                  </Label>
                ))}
              </RadioGroup>
              
              <div className="space-y-3">
                <Label>Qual a idade/maturidade do robô?</Label>
                <RadioGroup value={ageRange} onValueChange={(v) => setAgeRange(v as any)} className="grid grid-cols-2 gap-3">
                  {[
                    { value: '18-25', label: '18-25 anos', desc: 'Jovem, informal, moderno' },
                    { value: '26-35', label: '26-35 anos', desc: 'Profissional, acessível' },
                    { value: '36-50', label: '36-50 anos', desc: 'Formal, objetivo' },
                    { value: '50+', label: '50+ anos', desc: 'Muito formal, tradicional' },
                  ].map((option) => (
                    <Label
                      key={option.value}
                      className={cn(
                        "flex flex-col gap-1 p-4 border rounded-lg cursor-pointer transition-all hover:border-primary",
                        ageRange === option.value && "border-primary bg-primary/5"
                      )}
                    >
                      <RadioGroupItem value={option.value} className="sr-only" />
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.desc}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}
          
          {/* Step 3: Localização */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">De qual estado é seu robô?</h3>
                <p className="text-muted-foreground">Isso ajuda a usar expressões regionais</p>
              </div>
              
              <Select value={brazilianState} onValueChange={handleStateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {regionalExpressions.length > 0 && (
                <div className="space-y-2">
                  <Label>Expressões sugeridas para {brazilianState}:</Label>
                  <div className="flex flex-wrap gap-2">
                    {regionalExpressions.map((expr) => (
                      <Badge key={expr} variant="secondary">
                        "{expr}"
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Você pode editar isso depois nas configurações avançadas
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Step 4: Função */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">O que seu robô vai fazer?</h3>
                <p className="text-muted-foreground">Escolha o tipo principal de atendimento</p>
              </div>
              
              <RadioGroup value={serviceType} onValueChange={(v) => setServiceType(v as any)} className="space-y-3">
                {[
                  { value: 'sales', label: '💰 Vendas', desc: 'Apresentar produtos e fechar vendas' },
                  { value: 'support', label: '🔧 Suporte Técnico', desc: 'Resolver problemas técnicos' },
                  { value: 'sac', label: '📞 SAC', desc: 'Atender reclamações e solicitações' },
                  { value: 'social_selling', label: '🤝 Social Selling', desc: 'Criar relacionamento e engajamento' },
                  { value: 'qualification', label: '📋 Qualificação', desc: 'Qualificar leads com perguntas' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    className={cn(
                      "flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all hover:border-primary",
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
          )}
          
          {/* Step 5: Comunicação */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Como seu robô responde?</h3>
                <p className="text-muted-foreground">Define o tamanho das mensagens</p>
              </div>
              
              <RadioGroup value={responseLength} onValueChange={(v) => setResponseLength(v as any)} className="space-y-3">
                {[
                  { value: 'short', label: '⚡ Respostas Curtas', desc: 'Direto ao ponto, máximo 50 palavras', example: 'Oi! Tudo bem? Como posso ajudar?' },
                  { value: 'medium', label: '📝 Respostas Médias', desc: 'Equilibrado, 50-100 palavras', example: 'Olá! Seja bem-vindo! Estou aqui para ajudar com qualquer dúvida que você tiver sobre nossos produtos e serviços.' },
                  { value: 'detailed', label: '📚 Respostas Detalhadas', desc: 'Completo e explicativo', example: 'Olá! É um prazer recebê-lo! Meu nome é [Nome] e sou o assistente virtual da empresa. Estou aqui para ajudar você com informações detalhadas sobre...' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    className={cn(
                      "flex flex-col gap-2 p-4 border rounded-lg cursor-pointer transition-all hover:border-primary",
                      responseLength === option.value && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={option.value} />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">{option.desc}</p>
                    <div className="ml-6 p-2 bg-muted rounded text-sm italic">
                      "{option.example}"
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}
          
          {/* Step 6: Personalidade */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold mb-2">Toque final! ✨</h3>
                <p className="text-muted-foreground">Conte mais sobre seu robô ideal</p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Qual o diferencial da sua empresa?</Label>
                  <Textarea
                    value={companyDifferential}
                    onChange={(e) => setCompanyDifferential(e.target.value)}
                    placeholder="Ex: Atendimento humanizado, entrega rápida, produtos exclusivos..."
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Descreva a personalidade ideal do seu robô</Label>
                  <Textarea
                    value={personalityDescription}
                    onChange={(e) => setPersonalityDescription(e.target.value)}
                    placeholder="Ex: Simpático, prestativo, bem-humorado, conhece muito sobre os produtos..."
                    rows={3}
                  />
                </div>
              </div>
              
              {/* Preview */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Preview do seu robô
                </h4>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{name || 'Seu Robô'}</p>
                    <p className="text-sm text-muted-foreground">
                      {gender === 'male' ? '👨 Homem' : gender === 'female' ? '👩 Mulher' : '🤖 Neutro'} • {ageRange} anos
                      {brazilianState && ` • ${brazilianState}`}
                    </p>
                  </div>
                </div>
              </div>
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
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createBot.isPending}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {createBot.isPending ? 'Criando...' : 'Criar Robô!'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
