import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Settings, Trash2, Zap, MessageSquare, Brain, Users } from "lucide-react";
import { useAgentsIA, useUpdateAgent, useDeleteAgent, type Agent } from "@/hooks/useAgentsIA";
import { AgentCreateDialog } from "@/components/agents-ia/AgentCreateDialog";
import { AgentConfigDialog } from "@/components/agents-ia/AgentConfigDialog";
import { AgentTeamsTab } from "@/components/agents-ia/AgentTeamsTab";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

const PERSONALITY_ICONS: Record<string, string> = {
  Profissional: "💼",
  Amigável: "😊",
  Direto: "🎯",
};

export default function AgentsIA() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || "";
  const { data: agents, isLoading } = useAgentsIA(organizationId);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleToggleActive = (agent: Agent) => {
    updateAgent.mutate({ id: agent.id, is_active: !agent.is_active });
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              Agentes IA 2.0
            </h1>
            <p className="text-muted-foreground mt-1">
              Sistema de agentes inteligentes de nova geração
            </p>
          </div>
        </div>

        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="h-4 w-4" />
              Agentes
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="h-4 w-4" />
              Times
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreate(true)} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Criar Novo Agente
              </Button>
            </div>

            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <Skeleton className="h-6 w-32 mt-2" />
                      <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : agents && agents.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                  <Card
                    key={agent.id}
                    className={`transition-all hover:shadow-lg cursor-pointer ${!agent.is_active ? "opacity-60" : ""}`}
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{agent.name}</CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {PERSONALITY_ICONS[agent.personality] || "💼"} {agent.personality}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={agent.is_active}
                            onCheckedChange={() => handleToggleActive(agent)}
                          />
                          <Badge variant={agent.is_active ? "default" : "secondary"}>
                            {agent.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Brain className="h-4 w-4" />
                          {agent.max_messages} msgs máx
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgent(agent);
                          }}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configurar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover agente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O agente "{agent.name}" será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteAgent.mutate(agent.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Bot className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Nenhum agente criado</h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    Crie seu primeiro agente inteligente 2.0 para automatizar atendimentos com IA avançada.
                  </p>
                  <Button onClick={() => setShowCreate(true)} size="lg" className="gap-2">
                    <Zap className="h-5 w-5" />
                    Criar Meu Primeiro Agente
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="teams">
            <AgentTeamsTab organizationId={organizationId} agents={agents || []} />
          </TabsContent>
        </Tabs>
      </div>

      <AgentCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        organizationId={organizationId}
      />

      <AgentConfigDialog
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => !open && setSelectedAgent(null)}
      />
    </Layout>
  );
}
