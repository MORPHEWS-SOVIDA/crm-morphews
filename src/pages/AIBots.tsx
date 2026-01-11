import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Settings, Trash2, Zap, MessageSquare, Clock, Brain } from "lucide-react";
import { useAIBots, useOrganizationEnergy, useDeleteAIBot } from "@/hooks/useAIBots";
import { AIBotWizard } from "@/components/ai-bots/AIBotWizard";
import { AIBotDetailDialog } from "@/components/ai-bots/AIBotDetailDialog";
import { EnergyDashboard } from "@/components/ai-bots/EnergyDashboard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  sales: "Vendas",
  support: "Suporte Técnico",
  sac: "SAC",
  social_selling: "Social Selling",
  qualification: "Qualificação",
};

const AGE_RANGE_LABELS: Record<string, string> = {
  '18-25': "Jovem (18-25)",
  '26-35': "Profissional (26-35)",
  '36-50': "Experiente (36-50)",
  '50+': "Sênior (50+)",
};

export default function AIBots() {
  const { data: bots, isLoading } = useAIBots();
  const { data: energy } = useOrganizationEnergy();
  const deleteBot = useDeleteAIBot();
  
  const [showWizard, setShowWizard] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              Robôs IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie seus assistentes virtuais inteligentes
            </p>
          </div>
          
          <Button onClick={() => setShowWizard(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Criar Novo Robô
          </Button>
        </div>

        {/* Energy Dashboard */}
        {energy && <EnergyDashboard energy={energy} />}

        {/* Bots Grid */}
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
        ) : bots && bots.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <Card 
                key={bot.id} 
                className={`transition-all hover:shadow-lg cursor-pointer ${!bot.is_active ? 'opacity-60' : ''}`}
                onClick={() => setSelectedBotId(bot.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {bot.avatar_url ? (
                        <img 
                          src={bot.avatar_url} 
                          alt={bot.name}
                          className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{bot.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {SERVICE_TYPE_LABELS[bot.service_type] || bot.service_type}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <Badge variant={bot.is_active ? "default" : "secondary"}>
                      {bot.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {bot.gender === 'male' ? '👨 Homem' : bot.gender === 'female' ? '👩 Mulher' : '🤖 Neutro'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {AGE_RANGE_LABELS[bot.age_range] || bot.age_range}
                    </Badge>
                    {bot.brazilian_state && (
                      <Badge variant="outline" className="text-xs">
                        📍 {bot.brazilian_state}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {bot.working_hours_start?.slice(0, 5)} - {bot.working_hours_end?.slice(0, 5)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Brain className="h-4 w-4" />
                      {bot.max_messages_before_transfer} msgs
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBotId(bot.id);
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
                          <AlertDialogTitle>Remover robô?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O robô "{bot.name}" será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBot.mutate(bot.id)}
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
              <h3 className="text-xl font-semibold mb-2">Nenhum robô criado</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Crie seu primeiro assistente virtual para automatizar o atendimento no WhatsApp.
                É rápido, divertido e vai revolucionar seu atendimento!
              </p>
              <Button onClick={() => setShowWizard(true)} size="lg" className="gap-2">
                <Zap className="h-5 w-5" />
                Criar Meu Primeiro Robô
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Wizard de Criação */}
      <AIBotWizard 
        open={showWizard} 
        onOpenChange={setShowWizard}
        onComplete={() => setShowWizard(false)}
      />
      
      {/* Dialog de Detalhes/Edição */}
      <AIBotDetailDialog
        botId={selectedBotId}
        open={!!selectedBotId}
        onOpenChange={(open) => !open && setSelectedBotId(null)}
      />
    </Layout>
  );
}
