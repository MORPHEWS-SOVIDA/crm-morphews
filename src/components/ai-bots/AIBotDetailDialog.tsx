import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Settings, Brain, Package, MessageSquare, Plus, Trash2, Save, Sparkles, ClipboardList, Zap, Cpu, Volume2, Pencil, RotateCcw, Wand2 } from "lucide-react";
import { useAIBot, useUpdateAIBot, useAIBotKnowledge, useAddAIBotKnowledge, useRemoveAIBotKnowledge, useAIBotProducts } from "@/hooks/useAIBots";
import { AvatarGenerator } from "./AvatarGenerator";
import { BotQualificationConfig } from "./BotQualificationConfig";
import { BotProductSelector } from "./BotProductSelector";
import { BotInterpretationConfig } from "./BotInterpretationConfig";
import { BotVoiceConfig } from "./BotVoiceConfig";
import { AIModelSelector, CHAT_MODELS } from "@/components/ai/AIModelSelector";
import { PromptWizard } from "./PromptWizard";
import { useAuth } from "@/hooks/useAuth";

interface InitialQuestion {
  questionId: string;
  questionText: string;
  questionType: string;
  position: number;
}
interface AIBotDetailDialogProps {
  botId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIBotDetailDialog({ botId, open, onOpenChange }: AIBotDetailDialogProps) {
  const { profile } = useAuth();
  const { data: bot, isLoading } = useAIBot(botId);
  const updateBot = useUpdateAIBot();
  const { data: knowledge = [] } = useAIBotKnowledge(botId);
  const addKnowledge = useAddAIBotKnowledge();
  const removeKnowledge = useRemoveAIBotKnowledge();
  const { data: linkedProducts = [] } = useAIBotProducts(botId);
  
  // Form state
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>();
  const [transferMessage, setTransferMessage] = useState<string | undefined>();
  const [outOfHoursMessage, setOutOfHoursMessage] = useState<string | undefined>();
  const [maxMessages, setMaxMessages] = useState<number | undefined>();
  
  // Qualification state
  const [qualificationEnabled, setQualificationEnabled] = useState<boolean>(false);
  const [initialQuestions, setInitialQuestions] = useState<InitialQuestion[]>([]);
  
  // Product RAG state
  const [productScope, setProductScope] = useState<'all' | 'selected' | 'none'>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [useRagSearch, setUseRagSearch] = useState<boolean>(false);
  
  // Interpretation state
  const [interpretAudio, setInterpretAudio] = useState(false);
  const [interpretDocuments, setInterpretDocuments] = useState(false);
  const [interpretImages, setInterpretImages] = useState(false);
  const [documentReplyMessage, setDocumentReplyMessage] = useState('');
  const [imageReplyMessage, setImageReplyMessage] = useState('');
  
  // AI Model state
  const [aiModelChat, setAiModelChat] = useState('google/gemini-3-flash-preview');
  
  // Emoji state
  const [useEmojis, setUseEmojis] = useState(true);
  
  // Voice state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [voiceName, setVoiceName] = useState('George');
  const [audioResponseProbability, setAudioResponseProbability] = useState(30);
  const [voiceStyle, setVoiceStyle] = useState('natural');
  
  // Product media sharing state
  const [sendProductImages, setSendProductImages] = useState(true);
  const [sendProductVideos, setSendProductVideos] = useState(true);
  const [sendProductLinks, setSendProductLinks] = useState(true);
  
  // System prompt state - CENTRAL
  const [systemPrompt, setSystemPrompt] = useState('');
  
  // FAQ form state
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  
  // Prompt Wizard state
  const [showPromptWizard, setShowPromptWizard] = useState(false);
  
  // Initialize form when bot loads
  const initializeForm = () => {
    if (bot) {
      setIsActive(bot.is_active);
      setWelcomeMessage(bot.welcome_message || '');
      setTransferMessage(bot.transfer_message || '');
      setOutOfHoursMessage(bot.out_of_hours_message || '');
      setMaxMessages(bot.max_messages_before_transfer || 10);
      setQualificationEnabled(bot.initial_qualification_enabled || false);
      setInitialQuestions((bot.initial_questions as InitialQuestion[]) || []);
      setProductScope((bot.product_scope as 'all' | 'selected' | 'none') || 'all');
      setUseRagSearch(bot.use_rag_search ?? false);
      setInterpretAudio((bot as any).interpret_audio ?? false);
      setInterpretDocuments((bot as any).interpret_documents ?? false);
      setInterpretImages((bot as any).interpret_images ?? false);
      setDocumentReplyMessage((bot as any).document_reply_message || 'Nossa IA analisou seu documento e identificou as seguintes informações:');
      setImageReplyMessage((bot as any).image_reply_message || 'Nossa IA analisou sua imagem e identificou:');
      setAiModelChat((bot as any).ai_model_chat || 'google/gemini-3-flash-preview');
      setUseEmojis((bot as any).use_emojis ?? true);
      setVoiceEnabled((bot as any).voice_enabled ?? false);
      setVoiceId((bot as any).voice_id || 'JBFqnCBsd6RMkjVDRZzb');
      setVoiceName((bot as any).voice_name || 'George');
      setAudioResponseProbability((bot as any).audio_response_probability ?? 30);
      setVoiceStyle((bot as any).voice_style || 'natural');
      setSendProductImages((bot as any).send_product_images ?? true);
      setSendProductVideos((bot as any).send_product_videos ?? true);
      setSendProductLinks((bot as any).send_product_links ?? true);
      setSystemPrompt(bot.system_prompt || '');
    }
  };
  
  useEffect(() => {
    if (linkedProducts.length > 0) {
      setSelectedProductIds(linkedProducts.map((p: any) => p.product_id));
    }
  }, [linkedProducts]);
  
  useEffect(() => {
    if (bot && open) {
      initializeForm();
    }
  }, [bot, open]);
  
  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };
  
  const isFormReady = bot && botId && bot.id === botId;
  
  const handleSave = () => {
    if (!botId || !isFormReady) return;
    
    updateBot.mutate({
      id: botId,
      is_active: isActive,
      welcome_message: welcomeMessage,
      transfer_message: transferMessage,
      out_of_hours_message: outOfHoursMessage,
      max_messages_before_transfer: maxMessages,
      initial_qualification_enabled: qualificationEnabled,
      initial_questions: initialQuestions,
      product_scope: productScope,
      use_rag_search: useRagSearch,
      interpret_audio: interpretAudio,
      interpret_documents: interpretDocuments,
      interpret_images: interpretImages,
      document_reply_message: documentReplyMessage,
      image_reply_message: imageReplyMessage,
      ai_model_chat: aiModelChat,
      use_emojis: useEmojis,
      voice_enabled: voiceEnabled,
      voice_id: voiceId,
      voice_name: voiceName,
      audio_response_probability: audioResponseProbability,
      voice_style: voiceStyle,
      send_product_images: sendProductImages,
      send_product_videos: sendProductVideos,
      send_product_links: sendProductLinks,
      system_prompt: systemPrompt,
      selectedProductIds: productScope === 'selected' ? selectedProductIds : undefined,
    } as any);
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
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="prompt" className="gap-1">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Prompt</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Mensagens</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Conhecimento</span>
              </TabsTrigger>
              <TabsTrigger value="interpretation" className="gap-1">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Interpretação</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1">
                <Volume2 className="h-4 w-4" />
                <span className="hidden sm:inline">Voz IA</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Produtos</span>
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Avançado</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Tab: Prompt (CENTRAL - primeira aba) */}
            <TabsContent value="prompt" className="space-y-4 mt-4">
              {/* Avatar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Avatar do Robô
                  </CardTitle>
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

              {/* O Prompt - protagonista */}
              <Card className="border-primary/30">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Pencil className="h-5 w-5 text-primary" />
                      Prompt do Sistema
                    </CardTitle>
                    <CardDescription>
                      O prompt é o cérebro do robô. Tudo que ele é e como se comporta está aqui.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPromptWizard(true)}
                    className="gap-1"
                  >
                    <Wand2 className="h-4 w-4" />
                    Assistente IA
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Defina as instruções para o robô..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Inclua aqui: personalidade, tom de voz, expressões regionais, regras de atendimento, diferencial da empresa. Ou use o Assistente IA para gerar automaticamente.
                  </p>
                </CardContent>
              </Card>

              {/* Status */}
              <Card>
                <CardContent className="pt-6">
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
            </TabsContent>
            
            {/* Tab: Mensagens */}
            <TabsContent value="messages" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mensagens Padrão</CardTitle>
                  <CardDescription>
                    Mensagens fixas usadas em momentos específicos (não fazem parte do prompt)
                  </CardDescription>
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
                    <p className="text-xs text-muted-foreground">Enviada quando o cliente inicia a conversa</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mensagem de Transferência</Label>
                    <Textarea
                      value={transferMessage ?? bot.transfer_message ?? ''}
                      onChange={(e) => setTransferMessage(e.target.value)}
                      placeholder="Vou transferir você para um atendente..."
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">Enviada quando o robô transfere para humano</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mensagem Fora do Horário</Label>
                    <Textarea
                      value={outOfHoursMessage ?? bot.out_of_hours_message ?? ''}
                      onChange={(e) => setOutOfHoursMessage(e.target.value)}
                      placeholder="Obrigado pelo contato! Nosso horário..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Enviada fora do horário de atendimento</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab: Conhecimento (FAQ) */}
            <TabsContent value="knowledge" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Base de Conhecimento</CardTitle>
                  <CardDescription>
                    Perguntas e respostas que o robô consulta automaticamente. São injetadas quando o assunto do cliente corresponde — não fazem parte do prompt.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Qualificação */}
                  <BotQualificationConfig
                    botId={botId!}
                    enabled={qualificationEnabled}
                    initialQuestions={initialQuestions}
                    onEnabledChange={setQualificationEnabled}
                    onQuestionsChange={setInitialQuestions}
                  />
                  
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">FAQs</h4>
                    
                    {/* Lista de FAQs existentes */}
                    {knowledge.filter((k: any) => k.knowledge_type === 'faq').map((faq: any) => (
                      <div key={faq.id} className="p-3 border rounded-lg space-y-2 mb-2">
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab: Interpretação */}
            <TabsContent value="interpretation" className="space-y-4 mt-4">
              <BotInterpretationConfig
                interpretAudio={interpretAudio}
                interpretDocuments={interpretDocuments}
                interpretImages={interpretImages}
                documentReplyMessage={documentReplyMessage}
                imageReplyMessage={imageReplyMessage}
                onInterpretAudioChange={setInterpretAudio}
                onInterpretDocumentsChange={setInterpretDocuments}
                onInterpretImagesChange={setInterpretImages}
                onDocumentReplyMessageChange={setDocumentReplyMessage}
                onImageReplyMessageChange={setImageReplyMessage}
              />
            </TabsContent>
            
            {/* Tab: Voz IA */}
            <TabsContent value="voice" className="space-y-4 mt-4">
              <BotVoiceConfig
                voiceEnabled={voiceEnabled}
                voiceId={voiceId}
                voiceName={voiceName}
                audioResponseProbability={audioResponseProbability}
                voiceStyle={voiceStyle}
                onVoiceEnabledChange={setVoiceEnabled}
                onVoiceIdChange={(id, name) => {
                  setVoiceId(id);
                  setVoiceName(name);
                }}
                onAudioResponseProbabilityChange={setAudioResponseProbability}
                onVoiceStyleChange={setVoiceStyle}
                organizationId={profile?.organization_id}
              />
            </TabsContent>
            
            {/* Tab: Produtos */}
            <TabsContent value="products" className="space-y-4 mt-4">
              <BotProductSelector
                botId={botId!}
                productScope={productScope}
                selectedProductIds={selectedProductIds}
                useRagSearch={useRagSearch}
                onProductScopeChange={setProductScope}
                onSelectedProductsChange={setSelectedProductIds}
                onUseRagSearchChange={setUseRagSearch}
                sendProductImages={sendProductImages}
                sendProductVideos={sendProductVideos}
                sendProductLinks={sendProductLinks}
                onSendProductImagesChange={setSendProductImages}
                onSendProductVideosChange={setSendProductVideos}
                onSendProductLinksChange={setSendProductLinks}
              />
            </TabsContent>
            
            {/* Tab: Avançado */}
            <TabsContent value="advanced" className="space-y-4 mt-4">
              {/* AI Model Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    Modelo de IA
                  </CardTitle>
                  <CardDescription>
                    Escolha o modelo usado para conversação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AIModelSelector
                    value={aiModelChat}
                    onChange={setAiModelChat}
                    models={CHAT_MODELS}
                    description="Modelos mais avançados são mais inteligentes mas consomem mais energia"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Comportamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <Label>Usar Emojis</Label>
                      <p className="text-sm text-muted-foreground">
                        Permitir que o robô use emojis nas respostas
                      </p>
                    </div>
                    <Switch
                      checked={useEmojis}
                      onCheckedChange={setUseEmojis}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
        
        {/* Save Button */}
        {bot && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={updateBot.isPending || !isFormReady}>
              <Save className="h-4 w-4 mr-2" />
              {updateBot.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
