import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Send, Loader2, Lightbulb, MessageCircle, 
  ChevronRight, User, Bot, X, FileText, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import morphewsAvatar from "@/assets/morphews-avatar.png";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: string;
}

interface Tip {
  id: string;
  module: string;
  category: string | null;
  title: string;
  content: string;
  icon: string | null;
}

interface DonnaHelperPanelProps {
  onClose: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  leads: "Leads",
  sales: "Vendas",
  whatsapp: "WhatsApp",
  products: "Produtos",
  team: "Equipe",
  reports: "Relatórios",
  general: "Geral",
  integrations: "Integrações",
  ai: "IA e Robôs",
  financial: "Financeiro",
  postsale: "Pós-Venda",
};

export function DonnaHelperPanel({ onClose }: DonnaHelperPanelProps) {
  const { user } = useAuth();
  const { tenantId: organizationId } = useTenant();
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar dicas
  useEffect(() => {
    const fetchTips = async () => {
      const { data } = await supabase
        .from("helper_tips")
        .select("*")
        .eq("is_active", true)
        .order("position");
      
      if (data) setTips(data);
    };
    fetchTips();
  }, []);

  // Scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mensagem inicial do Morphews
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: `Olá! Eu sou o Morphews. 🚀

Seu assistente virtual inteligente, sempre pronto para te ajudar!

Posso te guiar por qualquer canto desse CRM:
• **Criar robôs de IA** que atendem seus clientes 24h
• **Configurar seu funil** de vendas do zero
• **Fazer integrações** funcionarem (e debug quando não funcionam 😅)
• **Dominar** cada módulo do sistema

Me diz: no que posso te ajudar agora?`,
        created_at: new Date().toISOString(),
      }]);
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("donna-helper-chat", {
        body: {
          message: inputValue,
          conversationId,
          organizationId,
          userId: user?.id,
        },
      });

      if (error) throw error;

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        id: Date.now().toString() + "-assistant",
        role: "assistant",
        content: data.response,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.humanRequested) {
        toast.success("Solicitação enviada!", {
          description: "Um atendente entrará em contato em breve.",
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const groupedTips = tips.reduce((acc, tip) => {
    if (!acc[tip.module]) acc[tip.module] = [];
    acc[tip.module].push(tip);
    return acc;
  }, {} as Record<string, Tip[]>);

  const filteredTips = selectedModule 
    ? { [selectedModule]: groupedTips[selectedModule] || [] }
    : groupedTips;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-24 right-4 z-50 w-[380px] h-[520px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-4 flex items-center gap-3 relative">
        <img 
          src={morphewsAvatar} 
          alt="Morphews" 
          className="w-12 h-12 rounded-full border-2 border-white/50 object-cover"
        />
        <div className="flex-1">
          <h3 className="font-semibold text-white">Morphews</h3>
          <p className="text-xs text-white/80">Assistente Virtual IA</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20 bg-white/10 rounded-full h-9 w-9"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b bg-zinc-50 dark:bg-zinc-800/50">
          <TabsTrigger value="chat" className="flex-1 gap-2">
            <MessageCircle className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="tips" className="flex-1 gap-2">
            <Lightbulb className="w-4 h-4" />
            Dicas
          </TabsTrigger>
          <TabsTrigger value="legal" className="flex-1 gap-2">
            <Scale className="w-4 h-4" />
            Legal
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role !== "user" && (
                    <img
                      src={morphewsAvatar}
                      alt="Morphews"
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 max-w-[80%] text-sm",
                      message.role === "user"
                        ? "bg-emerald-500 text-white rounded-tr-sm"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <img
                    src={morphewsAvatar}
                    alt="Morphews"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua dúvida..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2 text-center">
              Digite "humano" se precisar falar com atendente
            </p>
          </div>
        </TabsContent>

        {/* Tips Tab */}
        <TabsContent value="tips" className="flex-1 m-0 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Module Filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedModule === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedModule(null)}
                  className="text-xs"
                >
                  Todos
                </Button>
                {Object.keys(groupedTips).map((module) => (
                  <Button
                    key={module}
                    variant={selectedModule === module ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedModule(module)}
                    className="text-xs"
                  >
                    {MODULE_LABELS[module] || module}
                  </Button>
                ))}
              </div>

              {/* Tips List */}
              {Object.entries(filteredTips).map(([module, moduleTips]) => (
                <div key={module} className="space-y-2">
                  <h4 className="font-semibold text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {MODULE_LABELS[module] || module}
                  </h4>
                  {moduleTips.map((tip) => (
                    <div
                      key={tip.id}
                      className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="font-medium text-sm text-zinc-900 dark:text-white">
                            {tip.title}
                          </h5>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                            {tip.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Legal Tab */}
        <TabsContent value="legal" className="flex-1 m-0 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <a
                href="/legal?section=termos"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h5 className="font-medium text-zinc-900 dark:text-white">
                      Termos de Uso
                    </h5>
                    <p className="text-xs text-zinc-500">
                      Condições de utilização do sistema
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </a>

              <a
                href="/legal?section=privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Scale className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h5 className="font-medium text-zinc-900 dark:text-white">
                      Política de Privacidade
                    </h5>
                    <p className="text-xs text-zinc-500">
                      Como tratamos seus dados
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </a>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                <h5 className="font-medium text-emerald-800 dark:text-emerald-300 mb-2">
                  Precisa de ajuda?
                </h5>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  Nossa equipe está disponível para ajudar! Entre em contato pelo WhatsApp: 
                  <a 
                    href="https://wa.me/5551999984646" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium underline ml-1"
                  >
                    (51) 99998-4646
                  </a>
                </p>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
