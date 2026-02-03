import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Loader2, Bot, User, AlertCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

interface VoiceAITestPanelProps {
  agentId?: string;
  organizationId?: string;
}

export function VoiceAITestPanel({ agentId, organizationId }: VoiceAITestPanelProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [testAgentId, setTestAgentId] = useState(agentId || "");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      toast.success("Conectado ao agente de voz!");
    },
    onDisconnect: () => {
      console.log("Disconnected from agent");
      setIsConnecting(false);
    },
    onMessage: (message: any) => {
      console.log("Message received:", message);
      
      if (message.type === "user_transcript") {
        setMessages(prev => [...prev, {
          role: "user",
          text: message.user_transcription_event?.user_transcript || "",
          timestamp: new Date(),
        }]);
      } else if (message.type === "agent_response") {
        setMessages(prev => [...prev, {
          role: "agent",
          text: message.agent_response_event?.agent_response || "",
          timestamp: new Date(),
        }]);
      }
    },
    onError: (error: any) => {
      console.error("Conversation error:", error);
      toast.error("Erro na conversação: " + (error?.message || "Erro desconhecido"));
      setIsConnecting(false);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = useCallback(async () => {
    if (!testAgentId) {
      toast.error("Informe o Agent ID do ElevenLabs");
      return;
    }

    setIsConnecting(true);
    setMessages([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { agentId: testAgentId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.token) {
        throw new Error("Token não recebido");
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });

    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast.error("Erro ao iniciar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
      setIsConnecting(false);
    }
  }, [testAgentId, conversation]);

  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      toast.info("Conversa encerrada");
    } catch (error) {
      console.error("Error ending conversation:", error);
    }
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
    // Note: ElevenLabs SDK handles muting internally
  }, [isMuted]);

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setVolume(newVolume);
    try {
      await conversation.setVolume({ volume: newVolume });
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  }, [conversation]);

  const isActive = conversation.status === "connected";

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Teste de Voz IA
            </CardTitle>
            <CardDescription>
              Teste conversas com agentes ElevenLabs
            </CardDescription>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Agent ID Input */}
        <div className="space-y-2">
          <Label htmlFor="agentId">ElevenLabs Agent ID</Label>
          <Input
            id="agentId"
            value={testAgentId}
            onChange={(e) => setTestAgentId(e.target.value)}
            placeholder="Ex: abc123xyz..."
            disabled={isActive}
          />
          <p className="text-xs text-muted-foreground">
            Encontre o Agent ID no painel do ElevenLabs em Conversational AI
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isActive ? (
            <Button 
              onClick={startConversation} 
              disabled={isConnecting || !testAgentId}
              className="flex-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Iniciar Conversa
                </>
              )}
            </Button>
          ) : (
            <>
              <Button 
                onClick={stopConversation} 
                variant="destructive"
                className="flex-1"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Encerrar
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
              >
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>

        {/* Speaking indicator */}
        {isActive && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <div className={cn(
              "w-3 h-3 rounded-full",
              conversation.isSpeaking ? "bg-green-500 animate-pulse" : "bg-gray-400"
            )} />
            <span className="text-sm">
              {conversation.isSpeaking ? "Agente falando..." : "Aguardando..."}
            </span>
          </div>
        )}

        {/* Conversation transcript */}
        <div className="space-y-2">
          <Label>Transcrição</Label>
          <ScrollArea className="h-[300px] border rounded-lg p-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Inicie uma conversa para ver a transcrição</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "agent" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p>{msg.text}</p>
                      <p className="text-[10px] opacity-60 mt-1">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
