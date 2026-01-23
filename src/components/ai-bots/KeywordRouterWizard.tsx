import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, X, Zap, ArrowRight, ArrowLeft, Check, Key } from "lucide-react";
import { useAIBots } from "@/hooks/useAIBots";
import { useCreateKeywordRouter, useAddKeywordRule } from "@/hooks/useKeywordRouters";

interface KeywordRouterWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface KeywordRule {
  keywords: string[];
  target_bot_id: string;
  tempId: string;
}

export function KeywordRouterWizard({ open, onOpenChange, onComplete }: KeywordRouterWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fallbackBotId, setFallbackBotId] = useState("");
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [currentBotId, setCurrentBotId] = useState("");
  const [tempKeywords, setTempKeywords] = useState<string[]>([]);

  const { data: bots } = useAIBots();
  const createRouter = useCreateKeywordRouter();
  const addRule = useAddKeywordRule();

  const activeBots = bots?.filter(b => b.is_active) || [];

  const resetForm = () => {
    setStep(1);
    setName("");
    setDescription("");
    setFallbackBotId("");
    setRules([]);
    setCurrentKeyword("");
    setCurrentBotId("");
    setTempKeywords([]);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const addKeywordToTemp = () => {
    if (currentKeyword.trim() && !tempKeywords.includes(currentKeyword.trim().toLowerCase())) {
      setTempKeywords([...tempKeywords, currentKeyword.trim().toLowerCase()]);
      setCurrentKeyword("");
    }
  };

  const removeKeywordFromTemp = (keyword: string) => {
    setTempKeywords(tempKeywords.filter(k => k !== keyword));
  };

  const addRuleToList = () => {
    if (tempKeywords.length > 0 && currentBotId) {
      setRules([
        ...rules,
        {
          keywords: tempKeywords,
          target_bot_id: currentBotId,
          tempId: crypto.randomUUID(),
        },
      ]);
      setTempKeywords([]);
      setCurrentBotId("");
    }
  };

  const removeRule = (tempId: string) => {
    setRules(rules.filter(r => r.tempId !== tempId));
  };

  const handleSubmit = async () => {
    try {
      const router = await createRouter.mutateAsync({
        name,
        description: description || undefined,
        fallback_bot_id: fallbackBotId,
      });

      // Add all rules
      for (let i = 0; i < rules.length; i++) {
        await addRule.mutateAsync({
          router_id: router.id,
          keywords: rules[i].keywords,
          target_bot_id: rules[i].target_bot_id,
          priority: rules.length - i, // Higher priority for first rules
        });
      }

      handleClose();
      onComplete();
    } catch (error) {
      console.error("Error creating keyword router:", error);
    }
  };

  const getBotName = (botId: string) => {
    return activeBots.find(b => b.id === botId)?.name || "Robô não encontrado";
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = fallbackBotId.length > 0;
  const canProceedStep3 = rules.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Criar Robô por Palavra de Entrada
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div className={`w-12 h-1 mx-1 rounded ${step > s ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Name & Description */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Nome do Roteador</h3>
              <p className="text-sm text-muted-foreground">
                Dê um nome para identificar este roteador por palavras-chave
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Roteador de Produtos, Campanha Facebook..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descreva o propósito deste roteador..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Step 2: Fallback Bot */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Robô Padrão (Fallback)</h3>
              <p className="text-sm text-muted-foreground">
                Quando a primeira mensagem do cliente NÃO contiver nenhuma palavra-chave, qual robô vai atender?
              </p>
            </div>

            <div className="grid gap-3">
              {activeBots.map((bot) => (
                <div
                  key={bot.id}
                  onClick={() => setFallbackBotId(bot.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    fallbackBotId === bot.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
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
                      <p className="text-sm text-muted-foreground">{bot.service_type}</p>
                    </div>
                    {fallbackBotId === bot.id && (
                      <Badge>Padrão</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {activeBots.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum robô ativo encontrado.</p>
                <p className="text-sm">Crie um robô primeiro.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Keywords & Rules */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Palavras-Chave</h3>
              <p className="text-sm text-muted-foreground">
                Configure quais palavras-chave ativam quais robôs
              </p>
            </div>

            {/* Existing Rules */}
            {rules.length > 0 && (
              <div className="space-y-2 mb-6">
                <Label>Regras configuradas:</Label>
                {rules.map((rule) => (
                  <div
                    key={rule.tempId}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex-1 flex flex-wrap gap-1">
                      {rule.keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">{getBotName(rule.target_bot_id)}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeRule(rule.tempId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Rule */}
            <div className="space-y-3 p-4 rounded-lg border border-dashed">
              <Label>Adicionar nova regra:</Label>
              
              {/* Keywords Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma palavra-chave..."
                  value={currentKeyword}
                  onChange={(e) => setCurrentKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeywordToTemp();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addKeywordToTemp}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Temp Keywords */}
              {tempKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tempKeywords.map((kw) => (
                    <Badge key={kw} className="gap-1">
                      {kw}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeKeywordFromTemp(kw)}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Bot Selection */}
              <Select value={currentBotId} onValueChange={setCurrentBotId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o robô para estas palavras..." />
                </SelectTrigger>
                <SelectContent>
                  {activeBots
                    .filter((b) => b.id !== fallbackBotId)
                    .map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          {bot.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={tempKeywords.length === 0 || !currentBotId}
                onClick={addRuleToList}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Regra
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Revisar Configuração</h3>
              <p className="text-sm text-muted-foreground">
                Confira as configurações antes de criar
              </p>
            </div>

            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{name}</p>
              </div>

              {description && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrição</p>
                  <p className="font-medium">{description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground">Robô Padrão (Fallback)</p>
                <p className="font-medium">{getBotName(fallbackBotId)}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Regras de Palavras-Chave</p>
                {rules.map((rule, index) => (
                  <div key={rule.tempId} className="flex items-center gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span className="flex-1">{rule.keywords.join(", ")}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium">{getBotName(rule.target_bot_id)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? handleClose() : setStep(step - 1))}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3)
              }
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createRouter.isPending}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {createRouter.isPending ? "Criando..." : "Criar Roteador"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
