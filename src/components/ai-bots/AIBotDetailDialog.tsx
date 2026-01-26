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
import { Bot, Settings, Brain, Package, MessageSquare, Plus, Trash2, Save, Sparkles, ClipboardList, Zap, Cpu, Volume2, Pencil, RotateCcw } from "lucide-react";
import { useAIBot, useUpdateAIBot, useAIBotKnowledge, useAddAIBotKnowledge, useRemoveAIBotKnowledge, useAIBotProducts } from "@/hooks/useAIBots";
import { AvatarGenerator } from "./AvatarGenerator";
import { BotQualificationConfig } from "./BotQualificationConfig";
import { BotProductSelector } from "./BotProductSelector";
import { BotInterpretationConfig } from "./BotInterpretationConfig";
import { BotVoiceConfig } from "./BotVoiceConfig";
import { AIModelSelector, CHAT_MODELS } from "@/components/ai/AIModelSelector";
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
  
  // Form state for editing
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
  
  // System prompt state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [promptWasEdited, setPromptWasEdited] = useState(false);
  
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
      setMaxMessages(bot.max_messages_before_transfer || 10);
      setQualificationEnabled(bot.initial_qualification_enabled || false);
      setInitialQuestions((bot.initial_questions as InitialQuestion[]) || []);
      setProductScope((bot.product_scope as 'all' | 'selected' | 'none') || 'all');
      setUseRagSearch(bot.use_rag_search ?? false);
      // Interpretation settings
      setInterpretAudio((bot as any).interpret_audio ?? false);
      setInterpretDocuments((bot as any).interpret_documents ?? false);
      setInterpretImages((bot as any).interpret_images ?? false);
      setDocumentReplyMessage((bot as any).document_reply_message || 'Nossa IA analisou seu documento e identificou as seguintes informações:');
      setImageReplyMessage((bot as any).image_reply_message || 'Nossa IA analisou sua imagem e identificou:');
      // AI Model
      setAiModelChat((bot as any).ai_model_chat || 'google/gemini-3-flash-preview');
      // Voice settings
      setVoiceEnabled((bot as any).voice_enabled ?? false);
      setVoiceId((bot as any).voice_id || 'JBFqnCBsd6RMkjVDRZzb');
      setVoiceName((bot as any).voice_name || 'George');
      setAudioResponseProbability((bot as any).audio_response_probability ?? 30);
      setVoiceStyle((bot as any).voice_style || 'natural');
      // Product media settings
      setSendProductImages((bot as any).send_product_images ?? true);
      setSendProductVideos((bot as any).send_product_videos ?? true);
      setSendProductLinks((bot as any).send_product_links ?? true);
      // System prompt
      setSystemPrompt(bot.system_prompt || '');
      setIsEditingPrompt(false);
      setPromptWasEdited(false);
    }
  };
  
  // Initialize selected products from linked products
  useEffect(() => {
    if (linkedProducts.length > 0) {
      setSelectedProductIds(linkedProducts.map((p: any) => p.product_id));
    }
  }, [linkedProducts]);
  
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
      // Voice settings
      voice_enabled: voiceEnabled,
      voice_id: voiceId,
      voice_name: voiceName,
      audio_response_probability: audioResponseProbability,
      voice_style: voiceStyle,
      // Product media settings
      send_product_images: sendProductImages,
      send_product_videos: sendProductVideos,
      send_product_links: sendProductLinks,
      // System prompt - sempre salva se foi editado
      ...(promptWasEdited && { system_prompt: systemPrompt }),
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
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="general" className="gap-1">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Geral</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Mensagens</span>
              </TabsTrigger>
              <TabsTrigger value="qualification" className="gap-1">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Qualificação</span>
              </TabsTrigger>
              <TabsTrigger value="interpretation" className="gap-1">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Interpretação</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1">
                <Volume2 className="h-4 w-4" />
                <span className="hidden sm:inline">Voz IA</span>
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
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Prompt do Sistema</CardTitle>
                    <CardDescription>
                      {isEditingPrompt 
                        ? 'Edite o prompt manualmente' 
                        : 'Gerado automaticamente baseado nas suas configurações'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {isEditingPrompt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSystemPrompt(bot.system_prompt || '');
                          setIsEditingPrompt(false);
                          setPromptWasEdited(false);
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restaurar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingPrompt(true)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditingPrompt ? (
                    <div className="space-y-2">
                      <Textarea
                        value={systemPrompt}
                        onChange={(e) => {
                          setSystemPrompt(e.target.value);
                          setPromptWasEdited(true);
                        }}
                        placeholder="Defina as instruções para o robô..."
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Este prompt será usado como instrução principal para o robô. Alterações manuais serão preservadas.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {bot.system_prompt}
                    </div>
                  )}
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
            
            {/* Tab: Qualificação */}
            <TabsContent value="qualification" className="space-y-4 mt-4">
              <BotQualificationConfig
                botId={botId!}
                enabled={qualificationEnabled}
                initialQuestions={initialQuestions}
                onEnabledChange={setQualificationEnabled}
                onQuestionsChange={setInitialQuestions}
              />
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
