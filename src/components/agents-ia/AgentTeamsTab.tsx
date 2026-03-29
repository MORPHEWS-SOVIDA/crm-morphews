import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Zap, Bot, Route, Trash2 } from "lucide-react";
import { useAgentTeams, useDeleteAgentTeam, useAgentTeamRoutes, type AgentTeam } from "@/hooks/useAgentTeams";
import { type Agent } from "@/hooks/useAgentsIA";
import { AgentTeamCreateDialog } from "./AgentTeamCreateDialog";
import { AgentTeamConfigDialog } from "./AgentTeamConfigDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Props {
  organizationId: string;
  agents: Agent[];
}

function TeamCardRouteCount({ teamId }: { teamId: string }) {
  const { data: routes } = useAgentTeamRoutes(teamId);
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <Route className="h-3.5 w-3.5" />
      {routes?.length ?? 0} rotas
    </div>
  );
}

export function AgentTeamsTab({ organizationId, agents }: Props) {
  const { data: teams, isLoading } = useAgentTeams(organizationId);
  const deleteTeam = useDeleteAgentTeam();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<AgentTeam | null>(null);

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Times de Agentes
          </h2>
          <p className="text-muted-foreground">
            Orquestre múltiplos agentes 2.0 para atendimento especializado
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-5 w-5" />
          Criar Time
        </Button>
      </div>

      {teams && teams.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card
              key={team.id}
              className={`transition-all hover:shadow-lg cursor-pointer ${!team.is_active ? "opacity-60" : ""}`}
              onClick={() => setSelectedTeam(team)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      {team.name}
                    </CardTitle>
                    {team.description && (
                      <CardDescription className="mt-1">{team.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={team.is_active ? "default" : "secondary"}>
                    {team.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                    Maestro: <span className="font-medium text-foreground">{team.maestro?.name || "—"}</span>
                  </div>
                </div>
                <TeamCardRouteCount teamId={team.id} />
                <div className="flex items-center justify-between pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(team)}>
                    Configurar Rotas
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover time?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O time "{team.name}" e todas as suas rotas serão removidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteTeam.mutate(team.id)}
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
              <Users className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum time criado</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Crie um time para orquestrar múltiplos agentes especialistas. O agente Maestro direciona cada cliente para o agente ideal!
            </p>
            <Button onClick={() => setShowCreate(true)} size="lg" className="gap-2">
              <Zap className="h-5 w-5" />
              Criar Meu Primeiro Time
            </Button>
          </CardContent>
        </Card>
      )}

      <AgentTeamCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        organizationId={organizationId}
        agents={agents}
      />

      <AgentTeamConfigDialog
        team={selectedTeam}
        open={!!selectedTeam}
        onOpenChange={(open) => !open && setSelectedTeam(null)}
        agents={agents}
      />
    </div>
  );
}
