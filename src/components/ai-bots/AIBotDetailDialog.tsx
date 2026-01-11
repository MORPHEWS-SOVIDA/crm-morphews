import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Settings, Brain, Package, Clock, MessageSquare, Plus, Trash2, Save, Sparkles } from "lucide-react";
import { useAIBot, useUpdateAIBot, useAIBotKnowledge, useAddAIBotKnowledge, useRemoveAIBotKnowledge, useAIBotProducts, useToggleAIBotProduct } from "@/hooks/useAIBots";
import { useProducts } from "@/hooks/useProducts";
import { AvatarGenerator } from "./AvatarGenerator";

interface AIBotDetailDialogProps {
  botId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIBotDetailDialog({ botId, open, onOpenChange }: AIBotDetailDialogProps) {
  const { data: bot, isLoading } = useAIBot(botId);
  const updateBot = useUpdateAIBot();
  const { data: knowledge = [] } = useAIBotKnowledge(botId);
  const addKnowledge = useAddAIBotKnowledge();
  const removeKnowledge = useRemoveAIBotKnowledge();
  const { data: linkedProducts = [] } = useAIBotProducts(botId);
  const toggleProduct = useToggleAIBotProduct();
  const { data: allProducts = [] } = useProducts();
  
  // Form state for editing
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>();
  const [transferMessage, setTransferMessage] = useState<string | undefined>();
  const [outOfHoursMessage, setOutOfHoursMessage] = useState<string | undefined>();
  const [workingHoursStart, setWorkingHoursStart] = useState<string | undefined>();
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string | undefined>();
  const [maxMessages, setMaxMessages] = useState<number | undefined>();
  
  // FAQ form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  
  // Initialize form when bot loads
  const initializeForm = () => {
    if (bot) {
      setIsActive(bot.is_active);
      setWelcomeMessage(bot.welcome_message || '');
      setTransferMessage(bot.transfer_message || '');
      setOutOfHoursMessage(bot.out_of_hours_message || '');
      setWorkingHoursStart(bot.working_hours_start?.slice(0, 5) || '08:00');
      setWorkingHoursEnd(bot.working_hours_end?.slice(0, 5) || '18:00');
      setMaxMessages(bot.max_messages_before_transfer || 10);
    }
  };
  
  // Reset form when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && bot) {
      initializeForm();
    }
    onOpenChange(open);
  };
  
  const handleSave = () => {
    if (!botId) return;
    
    updateBot.mutate({
      id: botId,
      is_active: isActive,
      welcome_message: welcomeMessage,
      transfer_message: transferMessage,
      out_of_hours_message: outOfHoursMessage,
      working_hours_start: workingHoursStart,
      working_hours_end: workingHoursEnd,
      max_messages_before_transfer: maxMessages,
    });
  };
  
  const handleAddFAQ = () => {
    if (!botId || !newQuestion.trim() || !newAnswer.trim()) return;
    
    addKnowledge.mutate({
      bot_id: botId,
      knowledge_type: 'faq',
      question: newQuestion,
      answer: newAnswer,
    });
    
    setNewQuestion('');
    setNewAnswer('');
  };
  
  const linkedProductIds = new Set(linkedProducts.map((p: any) => p.product_id));

  if (!botId) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <>
                {bot?.avatar_url ? (
                  <img src={bot.avatar_url} alt={bot.name} className="h-8 w-8 rounded-full" />
                ) : (
                  <Bot className="h-6 w-6 text-primary" />
                )}
                Configurar {bot?.name}
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : bot ? (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Mensagens</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Conhecimento</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Produtos</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Tab: Geral */}
            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Avatar Generator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Avatar do Robô
                  </CardTitle>
                  <CardDescription>
                    Gere um avatar com IA baseado na personalidade do robô
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <AvatarGenerator
                    botId={bot.id}
                    currentAvatarUrl={bot.avatar_url}
                    name={bot.name}
                    gender={bot.gender}
                    ageRange={bot.age_range}
                    serviceType={bot.service_type}
                    brazilianState={bot.brazilian_state || undefined}
                    personalityDescription={bot.personality_description || undefined}
                    size="lg"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status do Robô</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Robô Ativo</Label>
                      <p className="text-sm text-muted-foreground">
                        Quando ativo, o robô responde automaticamente
                      </p>
                    </div>
                    <Switch
                      checked={isActive ?? bot.is_active}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Horário de Funcionamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input
                        type="time"
                        value={workingHoursStart ?? bot.working_hours_start?.slice(0, 5)}
                        onChange={(e) => setWorkingHoursStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input
                        type="time"
                        value={workingHoursEnd ?? bot.working_hours_end?.slice(0, 5)}
                        onChange={(e) => setWorkingHoursEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Máximo de mensagens antes de transferir</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={maxMessages ?? bot.max_messages_before_transfer}
                      onChange={(e) => setMaxMessages(parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Após esse número de mensagens, o robô transfere para um humano
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Prompt do Sistema</CardTitle>
                  <CardDescription>
                    Gerado automaticamente baseado nas suas configurações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {bot.system_prompt}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab: Mensagens */}
            <TabsContent value="messages" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mensagens Padrão</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mensagem de Boas-vindas</Label>
                    <Textarea
                      value={welcomeMessage ?? bot.welcome_message ?? ''}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="Olá! Sou o assistente virtual..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mensagem de Transferência</Label>
                    <Textarea
                      value={transferMessage ?? bot.transfer_message ?? ''}
                      onChange={(e) => setTransferMessage(e.target.value)}
                      placeholder="Vou transferir você para um atendente..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mensagem Fora do Horário</Label>
                    <Textarea
                      value={outOfHoursMessage ?? bot.out_of_hours_message ?? ''}
                      onChange={(e) => setOutOfHoursMessage(e.target.value)}
                      placeholder="Obrigado pelo contato! Nosso horário..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab: Conhecimento */}
            <TabsContent value="knowledge" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">FAQs</CardTitle>
                  <CardDescription>
                    Perguntas e respostas que o robô conhece
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de FAQs existentes */}
                  {knowledge.filter((k: any) => k.knowledge_type === 'faq').map((faq: any) => (
                    <div key={faq.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">❓ {faq.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">💬 {faq.answer}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeKnowledge.mutate({ id: faq.id, botId: botId! })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Adicionar novo FAQ */}
                  <div className="border-t pt-4 space-y-3">
                    <Label>Adicionar Nova Pergunta</Label>
                    <Input
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="Qual é a pergunta?"
                    />
                    <Textarea
                      value={newAnswer}
                      onChange={(e) => setNewAnswer(e.target.value)}
                      placeholder="Qual é a resposta?"
                      rows={2}
                    />
                    <Button
                      onClick={handleAddFAQ}
                      disabled={!newQuestion.trim() || !newAnswer.trim()}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab: Produtos */}
            <TabsContent value="products" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Produtos Vinculados</CardTitle>
                  <CardDescription>
                    Produtos que o robô conhece e pode apresentar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {allProducts.map((product: any) => {
                      const isLinked = linkedProductIds.has(product.id);
                      return (
                        <div
                          key={product.id}
                          onClick={() => toggleProduct.mutate({ botId: botId!, productId: product.id, isLinked })}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isLinked ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{product.name}</p>
                              {product.price_1_unit && (
                                <p className="text-xs text-muted-foreground">
                                  R$ {(product.price_1_unit / 100).toFixed(2)}
                                </p>
                              )}
                            </div>
                            {isLinked && (
                              <Badge variant="default" className="shrink-0">✓</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
        
        {/* Save Button */}
        {bot && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={updateBot.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateBot.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
