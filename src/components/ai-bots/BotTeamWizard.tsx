import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Bot, 
  Route, 
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2
} from "lucide-react";
import { useAIBots } from "@/hooks/useAIBots";
import { useCreateBotTeam } from "@/hooks/useBotTeams";

interface BotTeamWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const STEPS = [
  { id: 1, title: 'Nome do Time', icon: Users, description: 'Identifique seu time' },
  { id: 2, title: 'Selecionar Robôs', icon: Bot, description: 'Escolha os especialistas' },
  { id: 3, title: 'Robô Inicial', icon: Route, description: 'Quem começa o atendimento?' },
  { id: 4, title: 'Revisão', icon: Sparkles, description: 'Confirme seu time!' },
];

export function BotTeamWizard({ open, onOpenChange, onComplete }: BotTeamWizardProps) {
  const { data: bots, isLoading: botsLoading } = useAIBots();
  const createTeam = useCreateBotTeam();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>([]);
  const [initialBotId, setInitialBotId] = useState<string>("");
  const [fallbackBotId, setFallbackBotId] = useState<string>("");

  const progress = (currentStep / STEPS.length) * 100;
  const activeBots = bots?.filter(b => b.is_active) || [];

  const handleBotToggle = (botId: string) => {
    setSelectedBotIds(prev => 
      prev.includes(botId) 
        ? prev.filter(id => id !== botId)
        : [...prev, botId]
    );
    // Clear initial/fallback if deselected
    if (selectedBotIds.includes(botId)) {
      if (initialBotId === botId) setInitialBotId("");
      if (fallbackBotId === botId) setFallbackBotId("");
    }
  };

  const selectedBots = activeBots.filter(b => selectedBotIds.includes(b.id));

  const canProceed = () => {
    switch (currentStep) {
      case 1: return name.trim().length >= 3;
      case 2: return selectedBotIds.length >= 2;
      case 3: return !!initialBotId;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    await createTeam.mutateAsync({
      name,
      description: description || undefined,
      initial_bot_id: initialBotId || undefined,
      fallback_bot_id: fallbackBotId || undefined,
      member_bot_ids: selectedBotIds,
    });
    
    // Reset form
    setCurrentStep(1);
    setName("");
    setDescription("");
    setSelectedBotIds([]);
    setInitialBotId("");
    setFallbackBotId("");
    
    onComplete?.();
    onOpenChange(false);
  };

  const handleClose = () => {
    setCurrentStep(1);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Criar Time de Robôs
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-4">
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-between">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex flex-col items-center gap-1 ${
                  step.id === currentStep
                    ? "text-primary"
                    : step.id < currentStep
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step.id === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step.id < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted"
                  }`}
                >
                  {step.id < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-xs hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[300px] py-4">
          {/* Step 1: Name */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Como vai se chamar seu time?</h3>
                <p className="text-muted-foreground">
                  Dê um nome que identifique a função do time
                </p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Time</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Atendimento Geral, Vendas Premium..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva a função deste time de robôs..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select Bots */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Escolha os robôs do time</h3>
                <p className="text-muted-foreground">
                  Selecione pelo menos 2 robôs especialistas
                </p>
              </div>

              {botsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activeBots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Você precisa criar robôs primeiro!</p>
                </div>
              ) : (
                <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                  {activeBots.map((bot) => (
                    <div
                      key={bot.id}
                      onClick={() => handleBotToggle(bot.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedBotIds.includes(bot.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedBotIds.includes(bot.id)}
                        onCheckedChange={() => handleBotToggle(bot.id)}
                      />
                      
                      {bot.avatar_url ? (
                        <img
                          src={bot.avatar_url}
                          alt={bot.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <p className="font-medium">{bot.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {bot.service_type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedBotIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">Selecionados:</span>
                  {selectedBots.map((bot) => (
                    <Badge key={bot.id} variant="secondary">
                      {bot.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Initial & Fallback Bot */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Configure os robôs chave</h3>
                <p className="text-muted-foreground">
                  Defina quem inicia e quem é o backup
                </p>
              </div>

              <div className="space-y-6 max-w-md mx-auto">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-primary" />
                    Robô Inicial (Maestro)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Este robô receberá todos os clientes e decidirá para qual especialista direcionar
                  </p>
                  <div className="grid gap-2">
                    {selectedBots.map((bot) => (
                      <div
                        key={bot.id}
                        onClick={() => setInitialBotId(bot.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          initialBotId === bot.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        {bot.avatar_url ? (
                          <img
                            src={bot.avatar_url}
                            alt={bot.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <span className="font-medium">{bot.name}</span>
                        {initialBotId === bot.id && (
                          <Badge className="ml-auto">Maestro</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    Robô Fallback (opcional)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Se nenhuma rota for identificada, este robô assume
                  </p>
                  <div className="grid gap-2">
                    {selectedBots.filter(b => b.id !== initialBotId).map((bot) => (
                      <div
                        key={bot.id}
                        onClick={() => setFallbackBotId(bot.id === fallbackBotId ? "" : bot.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          fallbackBotId === bot.id
                            ? "border-secondary bg-secondary/10"
                            : "border-border hover:border-secondary/50"
                        }`}
                      >
                        {bot.avatar_url ? (
                          <img
                            src={bot.avatar_url}
                            alt={bot.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-medium">{bot.name}</span>
                        {fallbackBotId === bot.id && (
                          <Badge variant="secondary" className="ml-auto">Fallback</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Revise seu Time de Robôs</h3>
                <p className="text-muted-foreground">
                  Confira tudo antes de criar!
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Nome:</span>
                  <p className="font-semibold text-lg">{name}</p>
                </div>
                
                {description && (
                  <div>
                    <span className="text-sm text-muted-foreground">Descrição:</span>
                    <p>{description}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-muted-foreground">Robôs no time ({selectedBots.length}):</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedBots.map((bot) => (
                      <Badge 
                        key={bot.id} 
                        variant={
                          bot.id === initialBotId 
                            ? "default" 
                            : bot.id === fallbackBotId 
                            ? "secondary" 
                            : "outline"
                        }
                      >
                        {bot.name}
                        {bot.id === initialBotId && " (Maestro)"}
                        {bot.id === fallbackBotId && " (Fallback)"}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t text-sm text-muted-foreground">
                  <p>💡 Após criar, você poderá adicionar rotas de direcionamento para definir quando cada robô deve assumir a conversa.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : handleClose()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? "Cancelar" : "Voltar"}
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createTeam.isPending}
              className="gap-2"
            >
              {createTeam.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Criar Time!
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
