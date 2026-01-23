import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Zap } from "lucide-react";
import { useBotTeams, useDeleteBotTeam } from "@/hooks/useBotTeams";
import { BotTeamCard } from "./BotTeamCard";
import { BotTeamWizard } from "./BotTeamWizard";
import { BotTeamDetailDialog } from "./BotTeamDetailDialog";

export function BotTeamsSection() {
  const { data: teams, isLoading } = useBotTeams();
  const deleteTeam = useDeleteBotTeam();
  
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Times de Robôs
          </h2>
          <p className="text-muted-foreground">
            Orquestre múltiplos robôs para um atendimento inteligente
          </p>
        </div>
        
        <Button onClick={() => setShowWizard(true)} className="gap-2">
          <Plus className="h-5 w-5" />
          Criar Time de Robôs
        </Button>
      </div>

      {/* Teams Grid */}
      {teams && teams.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <BotTeamCard
              key={team.id}
              team={team}
              onSelect={setSelectedTeamId}
              onDelete={(id) => deleteTeam.mutate(id)}
              isDeleting={deleteTeam.isPending}
            />
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
              Crie um time de robôs para orquestrar múltiplos especialistas.
              O robô "Maestro" vai direcionar cada cliente para o robô ideal!
            </p>
            <Button onClick={() => setShowWizard(true)} size="lg" className="gap-2">
              <Zap className="h-5 w-5" />
              Criar Meu Primeiro Time
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Wizard */}
      <BotTeamWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={() => setShowWizard(false)}
      />

      {/* Detail Dialog */}
      <BotTeamDetailDialog
        teamId={selectedTeamId}
        open={!!selectedTeamId}
        onOpenChange={(open) => !open && setSelectedTeamId(null)}
      />
    </div>
  );
}
