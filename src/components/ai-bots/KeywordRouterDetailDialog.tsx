import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, Settings, Bot, Plus, X, ArrowRight, Trash2, Save } from "lucide-react";
import { useKeywordRouter, useKeywordRouterRules, useUpdateKeywordRouter, useAddKeywordRule, useDeleteKeywordRule, KeywordBotRule } from "@/hooks/useKeywordRouters";
import { useAIBots } from "@/hooks/useAIBots";
import { Skeleton } from "@/components/ui/skeleton";

interface KeywordRouterDetailDialogProps {
  routerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeywordRouterDetailDialog({
  routerId,
  open,
  onOpenChange,
}: KeywordRouterDetailDialogProps) {
  const { data: router, isLoading: loadingRouter } = useKeywordRouter(routerId);
  const { data: rules, isLoading: loadingRules } = useKeywordRouterRules(routerId);
  const { data: bots } = useAIBots();
  const updateRouter = useUpdateKeywordRouter();
  const addRule = useAddKeywordRule();
  const deleteRule = useDeleteKeywordRule();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fallbackBotId, setFallbackBotId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // New rule form
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [newTargetBotId, setNewTargetBotId] = useState("");

  const activeBots = bots?.filter((b) => b.is_active) || [];

  // Initialize form when router loads
  useState(() => {
    if (router) {
      setName(router.name);
      setDescription(router.description || "");
      setFallbackBotId(router.fallback_bot_id);
      setIsActive(router.is_active);
      setHasChanges(false);
    }
  });

  // Reset form when router changes
  if (router && name !== router.name && !hasChanges) {
    setName(router.name);
    setDescription(router.description || "");
    setFallbackBotId(router.fallback_bot_id);
    setIsActive(router.is_active);
  }

  const handleSaveSettings = async () => {
    if (!routerId) return;

    await updateRouter.mutateAsync({
      id: routerId,
      name,
      description,
      fallback_bot_id: fallbackBotId,
      is_active: isActive,
    });
    setHasChanges(false);
  };

  const handleAddKeyword = () => {
    if (newKeywordInput.trim() && !newKeywords.includes(newKeywordInput.trim().toLowerCase())) {
      setNewKeywords([...newKeywords, newKeywordInput.trim().toLowerCase()]);
      setNewKeywordInput("");
    }
  };

  const handleRemoveNewKeyword = (keyword: string) => {
    setNewKeywords(newKeywords.filter((k) => k !== keyword));
  };

  const handleAddRule = async () => {
    if (!routerId || newKeywords.length === 0 || !newTargetBotId) return;

    await addRule.mutateAsync({
      router_id: routerId,
      keywords: newKeywords,
      target_bot_id: newTargetBotId,
      priority: (rules?.length || 0) + 1,
    });

    setNewKeywords([]);
    setNewTargetBotId("");
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!routerId) return;
    await deleteRule.mutateAsync({ id: ruleId, router_id: routerId });
  };

  const getBotName = (botId: string) => {
    return activeBots.find((b) => b.id === botId)?.name || "Robô não encontrado";
  };

  if (!routerId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" />
            {loadingRouter ? <Skeleton className="h-6 w-48" /> : router?.name}
          </DialogTitle>
        </DialogHeader>

        {loadingRouter ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="rules" className="gap-2">
                <Key className="h-4 w-4" />
                Regras ({rules?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setHasChanges(true);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setHasChanges(true);
                    }}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Robô Padrão (Fallback)</Label>
                  <Select
                    value={fallbackBotId}
                    onValueChange={(value) => {
                      setFallbackBotId(value);
                      setHasChanges(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o robô padrão..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBots.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id}>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            {bot.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Este robô atenderá quando nenhuma palavra-chave for encontrada
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Ativo</p>
                    <p className="text-sm text-muted-foreground">
                      Ativar/desativar este roteador
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      setIsActive(checked);
                      setHasChanges(true);
                    }}
                  />
                </div>

                {hasChanges && (
                  <Button
                    onClick={handleSaveSettings}
                    disabled={updateRouter.isPending}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateRouter.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              {/* Existing Rules */}
              {loadingRules ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : rules && rules.length > 0 ? (
                <div className="space-y-2">
                  {rules.map((rule, index) => (
                    <Card key={rule.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground font-medium">
                            #{index + 1}
                          </span>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {rule.keywords.map((kw) => (
                              <Badge key={kw} variant="secondary" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            {rule.target_bot?.avatar_url ? (
                              <img
                                src={rule.target_bot.avatar_url}
                                alt={rule.target_bot.name}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-3 w-3 text-primary" />
                              </div>
                            )}
                            <span className="font-medium text-sm">
                              {rule.target_bot?.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma regra configurada</p>
                </div>
              )}

              {/* Add New Rule */}
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Nova Regra
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite uma palavra-chave..."
                      value={newKeywordInput}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddKeyword();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddKeyword}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {newKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {newKeywords.map((kw) => (
                        <Badge key={kw} className="gap-1">
                          {kw}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => handleRemoveNewKeyword(kw)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Select value={newTargetBotId} onValueChange={setNewTargetBotId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o robô..." />
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
                    onClick={handleAddRule}
                    disabled={newKeywords.length === 0 || !newTargetBotId || addRule.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {addRule.isPending ? "Adicionando..." : "Adicionar Regra"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
