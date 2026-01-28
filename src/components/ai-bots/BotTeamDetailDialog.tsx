import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, 
  Bot, 
  Plus, 
  Save,
  Loader2,
  Crown,
  Shield,
  Settings,
} from "lucide-react";
import { 
  useBotTeam, 
  useBotTeamMembers, 
  useBotTeamRoutes,
  useUpdateBotTeam,
  useAddBotTeamMember,
  useRemoveBotTeamMember,
  useDeleteBotTeamRoute
} from "@/hooks/useBotTeams";
import { useAddAdvancedBotTeamRoute, useRoutesGroupedByBot } from "@/hooks/useBotTeamRoutes";
import { useAIBots } from "@/hooks/useAIBots";
import { BotTeamMemberRouteCard, RouteData } from "./BotTeamMemberRouteCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface BotTeamDetailDialogProps {
  teamId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BotTeamDetailDialog({ teamId, open, onOpenChange }: BotTeamDetailDialogProps) {
  const { data: team, isLoading: teamLoading } = useBotTeam(teamId);
  const { data: members, isLoading: membersLoading } = useBotTeamMembers(teamId);
  const { data: routes, isLoading: routesLoading } = useBotTeamRoutes(teamId);
  const { data: allBots } = useAIBots();
  
  const updateTeam = useUpdateBotTeam();
  const addMember = useAddBotTeamMember();
  const removeMember = useRemoveBotTeamMember();
  const addAdvancedRoute = useAddAdvancedBotTeamRoute();
  const deleteRoute = useDeleteBotTeamRoute();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [initialBotId, setInitialBotId] = useState("");
  const [fallbackBotId, setFallbackBotId] = useState("");
  const [newMemberBotId, setNewMemberBotId] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // Group routes by target bot
  const routesByBot = useRoutesGroupedByBot(teamId, routes);

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description || "");
      setIsActive(team.is_active);
      setInitialBotId(team.initial_bot_id || "");
      setFallbackBotId(team.fallback_bot_id || "");
    }
  }, [team]);

  const memberBotIds = members?.map(m => m.bot_id) || [];
  const availableBotsForMember = allBots?.filter(b => 
    b.is_active && !memberBotIds.includes(b.id)
  ) || [];

  const handleSave = async () => {
    if (!teamId) return;
    await updateTeam.mutateAsync({
      id: teamId,
      name,
      description: description || null,
      is_active: isActive,
      initial_bot_id: initialBotId || null,
      fallback_bot_id: fallbackBotId || null,
    });
  };

  const handleAddMember = async () => {
    if (!teamId || !newMemberBotId) return;
    await addMember.mutateAsync({ teamId, botId: newMemberBotId });
    setNewMemberBotId("");
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!teamId) return;
    await removeMember.mutateAsync({ teamId, memberId });
  };

  const handleAddRoute = async (botId: string, routeData: Omit<RouteData, "id">) => {
    if (!teamId) return;
    await addAdvancedRoute.mutateAsync({
      teamId,
      targetBotId: botId,
      conditionType: routeData.condition_type,
      keywords: routeData.keywords || undefined,
      intentDescription: routeData.intent_description || undefined,
      crmConditions: routeData.crm_conditions || undefined,
      sentimentConditions: routeData.sentiment_conditions || undefined,
      timeConditions: routeData.time_conditions || undefined,
      conditionLabel: routeData.condition_label || undefined,
      priority: routeData.priority,
    });
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!teamId) return;
    await deleteRoute.mutateAsync({ id: routeId, teamId });
  };

  if (teamLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  if (!team) return null;

  // Sort members: initial bot first, then fallback, then others
  const sortedMembers = [...(members || [])].sort((a, b) => {
    if (a.bot_id === initialBotId) return -1;
    if (b.bot_id === initialBotId) return 1;
    if (a.bot_id === fallbackBotId) return -1;
    if (b.bot_id === fallbackBotId) return 1;
    return 0;
  });

  const initialBot = members?.find(m => m.bot_id === initialBotId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <DialogTitle>{team.name}</DialogTitle>
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Configure a secretária e os robôs especialistas do seu time
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6 pb-4">
            {/* Settings Panel (collapsible) */}
            {showSettings && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Time Ativo</Label>
                    <p className="text-sm text-muted-foreground">
                      Desativar para pausar o time
                    </p>
                  </div>
                  <Switch 
                    checked={isActive} 
                    onCheckedChange={setIsActive}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Time</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-primary" />
                      Robô Secretária
                    </Label>
                    <Select value={initialBotId} onValueChange={setInitialBotId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {members?.map((m: any) => (
                          <SelectItem key={m.bot_id} value={m.bot_id}>
                            {m.bot?.name || "Robô"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Atende primeiro e direciona
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      Robô Fallback
                    </Label>
                    <Select 
                      value={fallbackBotId || "__none__"} 
                      onValueChange={(value) => setFallbackBotId(value === "__none__" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {members?.filter((m: any) => m.bot_id !== initialBotId).map((m: any) => (
                          <SelectItem key={m.bot_id} value={m.bot_id}>
                            {m.bot?.name || "Robô"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Quando nenhuma rota bater
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={updateTeam.isPending}
                  className="w-full"
                >
                  {updateTeam.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            )}

            {/* Secretária Info */}
            {initialBot && (
              <div className="p-4 border border-primary/30 rounded-lg bg-primary/5">
                <div className="flex items-center gap-3">
                  {initialBot.bot?.avatar_url ? (
                    <img
                      src={initialBot.bot.avatar_url}
                      alt={initialBot.bot?.name}
                      className="h-14 w-14 rounded-full object-cover border-2 border-primary"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
                      <Bot className="h-7 w-7 text-primary" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{initialBot.bot?.name}</h3>
                      <Badge className="gap-1">
                        <Crown className="h-3 w-3" />
                        Secretária
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Recebe todos os clientes e entrevista até entender como ajudar. 
                      Depois direciona para o especialista correto baseado nas condições abaixo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Members Section Title */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Robôs Especialistas</h3>
                <p className="text-sm text-muted-foreground">
                  Configure quando cada robô deve assumir a conversa
                </p>
              </div>
            </div>

            {/* Members with inline routes */}
            {membersLoading || routesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMembers
                  .filter(m => m.bot_id !== initialBotId) // Don't show initial bot in specialist list
                  .map((member: any) => (
                    <BotTeamMemberRouteCard
                      key={member.id}
                      member={member}
                      routes={(routesByBot[member.bot_id] || []) as RouteData[]}
                      isInitialBot={member.bot_id === initialBotId}
                      isFallbackBot={member.bot_id === fallbackBotId}
                      onAddRoute={(routeData) => handleAddRoute(member.bot_id, routeData)}
                      onDeleteRoute={handleDeleteRoute}
                      onRemoveMember={() => handleRemoveMember(member.id)}
                      isRemoving={removeMember.isPending}
                      isAddingRoute={addAdvancedRoute.isPending}
                    />
                  ))}
              </div>
            )}

            {/* Add new member */}
            {availableBotsForMember.length > 0 && (
              <div className="flex gap-2 p-4 border-2 border-dashed rounded-lg">
                <Select value={newMemberBotId} onValueChange={setNewMemberBotId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Adicionar robô especialista ao time..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBotsForMember.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        <div className="flex items-center gap-2">
                          {bot.avatar_url ? (
                            <img src={bot.avatar_url} alt={bot.name} className="h-5 w-5 rounded-full" />
                          ) : (
                            <Bot className="h-5 w-5" />
                          )}
                          {bot.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddMember}
                  disabled={!newMemberBotId || addMember.isPending}
                >
                  {addMember.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Empty state for members */}
            {!membersLoading && sortedMembers.filter(m => m.bot_id !== initialBotId).length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum robô especialista no time ainda</p>
                <p className="text-sm">Adicione robôs para a secretária poder direcionar</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
