import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Bot, History, Zap, AlertCircle } from "lucide-react";
import { VoiceAIAgentConfig } from "@/components/voice-ai/VoiceAIAgentConfig";
import { VoiceAICallHistory } from "@/components/voice-ai/VoiceAICallHistory";
import { VoiceAITestPanel } from "@/components/voice-ai/VoiceAITestPanel";
import { useOrgHasFeature } from "@/hooks/usePlanFeatures";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function VoiceAI() {
  const { data: hasVoiceAI, isLoading } = useOrgHasFeature("voice_ai_calls");

  // Show feature not available message
  if (!isLoading && !hasVoiceAI) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Recurso não disponível</AlertTitle>
          <AlertDescription>
            O Voice AI não está incluído no seu plano atual. 
            Entre em contato com o suporte para ativar este recurso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Voice AI
          </h1>
          <p className="text-muted-foreground">
            Chamadas de voz com inteligência artificial via ElevenLabs
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Zap className="h-3 w-3" />
          100⚡ / minuto
        </Badge>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Agentes de IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Configure agentes de voz personalizados para atender e realizar chamadas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-500" />
              Inbound & Outbound
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Receba e faça ligações automatizadas com transcrição em tempo real
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-green-500" />
              Histórico Completo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Acesse transcrições, análise de sentimento e resultados das chamadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Testar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <VoiceAIAgentConfig />
        </TabsContent>

        <TabsContent value="history">
          <VoiceAICallHistory />
        </TabsContent>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Testar Agente de Voz</CardTitle>
              <CardDescription>
                Faça uma chamada de teste para verificar se o agente está funcionando corretamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoiceAITestPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
