import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Phone, PhoneIncoming, PhoneOutgoing, Bot, Plus, 
  Settings, BarChart3, Clock, CheckCircle, XCircle,
  Loader2, Mic, Play
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VoiceAITestPanel } from "@/components/voice-ai/VoiceAITestPanel";

export function VoiceAITab() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("test");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    elevenlabs_agent_id: "",
    voice_id: "",
    voice_name: "",
    system_prompt: "",
    first_message: "",
    language: "pt-BR",
  });

  // Fetch call logs
  const { data: calls, isLoading: loadingCalls } = useQuery({
    queryKey: ["voice-ai-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_ai_calls")
        .select(`
          *,
          leads:lead_id (name, phone),
          organizations:organization_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch agents
  const { data: agents, isLoading: loadingAgents } = useQuery({
    queryKey: ["voice-ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_ai_agents")
        .select(`
          *,
          organizations:organization_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Stats
  const stats = {
    totalCalls: calls?.length || 0,
    completed: calls?.filter(c => c.status === "completed").length || 0,
    inProgress: calls?.filter(c => c.status === "in_progress").length || 0,
    failed: calls?.filter(c => c.status === "failed").length || 0,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      completed: { variant: "default", label: "Concluída" },
      in_progress: { variant: "secondary", label: "Em Andamento" },
      pending: { variant: "outline", label: "Pendente" },
      failed: { variant: "destructive", label: "Falhou" },
      no_answer: { variant: "outline", label: "Sem Resposta" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    const colors: Record<string, string> = {
      positive: "bg-green-100 text-green-800",
      neutral: "bg-gray-100 text-gray-800",
      negative: "bg-red-100 text-red-800",
      mixed: "bg-yellow-100 text-yellow-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[sentiment]}`}>
        {sentiment}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCalls}</p>
                <p className="text-sm text-muted-foreground">Total de Chamadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-sm text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="test" className="gap-2">
            <Play className="w-4 h-4" />
            Testar
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-2">
            <Phone className="w-4 h-4" />
            Chamadas
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="w-4 h-4" />
            Agentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="mt-4">
          <VoiceAITestPanel />
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Chamadas</CardTitle>
              <CardDescription>Todas as chamadas realizadas pelos agentes de voz</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCalls ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : calls?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma chamada registrada ainda</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Sentimento</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calls?.map((call: any) => (
                        <TableRow key={call.id}>
                          <TableCell>
                            {call.call_type === "inbound" ? (
                              <PhoneIncoming className="w-4 h-4 text-green-600" />
                            ) : (
                              <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{call.contact_name || call.leads?.name || "Desconhecido"}</p>
                              <p className="text-xs text-muted-foreground">{call.phone_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>{call.organizations?.name || "-"}</TableCell>
                          <TableCell>{getStatusBadge(call.status)}</TableCell>
                          <TableCell>
                            {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, "0")}` : "-"}
                          </TableCell>
                          <TableCell>{getSentimentBadge(call.sentiment)}</TableCell>
                          <TableCell>
                            {format(new Date(call.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Agentes de Voz</CardTitle>
                <CardDescription>Configure agentes de IA para atendimento por voz</CardDescription>
              </div>
              <Dialog open={isCreatingAgent} onOpenChange={setIsCreatingAgent}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Agente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Agente de Voz</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome do Agente</Label>
                      <Input
                        value={newAgent.name}
                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                        placeholder="Ex: Atendente Virtual"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ElevenLabs Agent ID</Label>
                      <Input
                        value={newAgent.elevenlabs_agent_id}
                        onChange={(e) => setNewAgent({ ...newAgent, elevenlabs_agent_id: e.target.value })}
                        placeholder="ID do agente no ElevenLabs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Voice ID</Label>
                      <Input
                        value={newAgent.voice_id}
                        onChange={(e) => setNewAgent({ ...newAgent, voice_id: e.target.value })}
                        placeholder="ID da voz"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem Inicial</Label>
                      <Textarea
                        value={newAgent.first_message}
                        onChange={(e) => setNewAgent({ ...newAgent, first_message: e.target.value })}
                        placeholder="Olá! Como posso ajudar?"
                        rows={2}
                      />
                    </div>
                    <Button className="w-full" disabled>
                      Criar Agente (Em breve)
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : agents?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum agente configurado</p>
                  <p className="text-sm mt-1">Crie um agente no ElevenLabs e adicione aqui</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {agents?.map((agent: any) => (
                    <Card key={agent.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Bot className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {agent.organizations?.name || "Global"}
                              </p>
                            </div>
                          </div>
                          <Badge variant={agent.is_active ? "default" : "secondary"}>
                            {agent.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
