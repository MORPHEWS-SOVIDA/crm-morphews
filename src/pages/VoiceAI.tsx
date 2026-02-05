import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Bot, BarChart3, AlertCircle } from "lucide-react";
import { VoiceAIAgentConfig } from "@/components/voice-ai/VoiceAIAgentConfig";
import { VoiceAITestPanel } from "@/components/voice-ai/VoiceAITestPanel";
import { VoiceAIDashboard } from "@/components/voice-ai/VoiceAIDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
            Ligações receptivas e ativas com robô de voz inteligente
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Testar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <VoiceAIDashboard />
        </TabsContent>

        <TabsContent value="agents">
          <VoiceAIAgentConfig />
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
