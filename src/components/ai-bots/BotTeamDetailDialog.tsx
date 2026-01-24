import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Bot, 
  Route, 
  Settings, 
  Plus, 
  Trash2, 
  Save,
  Loader2,
  GripVertical,
  MessageSquare
} from "lucide-react";
import { 
  useBotTeam, 
  useBotTeamMembers, 
  useBotTeamRoutes,
  useUpdateBotTeam,
  useAddBotTeamMember,
  useRemoveBotTeamMember,
  useAddBotTeamRoute,
  useDeleteBotTeamRoute
} from "@/hooks/useBotTeams";
import { useAIBots } from "@/hooks/useAIBots";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const addRoute = useAddBotTeamRoute();
  const deleteRoute = useDeleteBotTeamRoute();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [initialBotId, setInitialBotId] = useState("");
  const [fallbackBotId, setFallbackBotId] = useState("");

  // New route form
  const [newRouteType, setNewRouteType] = useState<"keyword" | "intent">("keyword");
  const [newRouteKeywords, setNewRouteKeywords] = useState("");
  const [newRouteIntent, setNewRouteIntent] = useState("");
  const [newRouteTargetBot, setNewRouteTargetBot] = useState("");

  // New member
  const [newMemberBotId, setNewMemberBotId] = useState("");

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

  const handleAddRoute = async () => {
    if (!teamId || !newRouteTargetBot) return;
    
    await addRoute.mutateAsync({
      teamId,
      targetBotId: newRouteTargetBot,
      routeType: newRouteType,
      keywords: newRouteType === "keyword" ? newRouteKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      intentDescription: newRouteType === "intent" ? newRouteIntent : undefined,
      priority: (routes?.length || 0),
    });

    setNewRouteKeywords("");
    setNewRouteIntent("");
    setNewRouteTargetBot("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Configurar Time: {team.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="gap-1">
              <Settings className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1">
              <Bot className="h-4 w-4" />
              Membros
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-1">
              <Route className="h-4 w-4" />
              Rotas
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid gap-4">
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

              <div className="space-y-2">
                <Label>Robô Inicial (Maestro)</Label>
                <Select value={initialBotId} onValueChange={setInitialBotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o robô inicial" />
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
                  Este robô recebe todos os clientes e decide para qual especialista direcionar
                </p>
              </div>

              <div className="space-y-2">
                <Label>Robô Fallback</Label>
                <Select value={fallbackBotId || "__none__"} onValueChange={(value) => setFallbackBotId(value === "__none__" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o robô fallback" />
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
                  Assume quando nenhuma rota é identificada
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
              Salvar Alterações
            </Button>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4 mt-4">
            {membersLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="space-y-2">
                  {members?.map((member: any) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {member.bot?.avatar_url ? (
                          <img
                            src={member.bot.avatar_url}
                            alt={member.bot?.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{member.bot?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.bot?.service_type}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {member.bot_id === initialBotId && (
                          <Badge>Maestro</Badge>
                        )}
                        {member.bot_id === fallbackBotId && (
                          <Badge variant="secondary">Fallback</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removeMember.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {availableBotsForMember.length > 0 && (
                  <div className="flex gap-2">
                    <Select value={newMemberBotId} onValueChange={setNewMemberBotId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Adicionar robô ao time..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBotsForMember.map((bot) => (
                          <SelectItem key={bot.id} value={bot.id}>
                            {bot.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleAddMember}
                      disabled={!newMemberBotId || addMember.isPending}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Adicionar Rota</CardTitle>
                <CardDescription>
                  Defina quando cada robô deve assumir a conversa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de Rota</Label>
                    <Select 
                      value={newRouteType} 
                      onValueChange={(v) => setNewRouteType(v as "keyword" | "intent")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyword">Palavras-chave</SelectItem>
                        <SelectItem value="intent">Intenção (IA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Direcionar para</Label>
                    <Select value={newRouteTargetBot} onValueChange={setNewRouteTargetBot}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o robô" />
                      </SelectTrigger>
                      <SelectContent>
                        {members?.map((m: any) => (
                          <SelectItem key={m.bot_id} value={m.bot_id}>
                            {m.bot?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newRouteType === "keyword" ? (
                  <div className="space-y-2">
                    <Label>Palavras-chave (separadas por vírgula)</Label>
                    <Input
                      value={newRouteKeywords}
                      onChange={(e) => setNewRouteKeywords(e.target.value)}
                      placeholder="cancelar, cancelamento, desistir..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Descrição da Intenção</Label>
                    <Textarea
                      value={newRouteIntent}
                      onChange={(e) => setNewRouteIntent(e.target.value)}
                      placeholder="Quando o cliente demonstrar interesse em cancelar ou desistir da compra..."
                      rows={2}
                    />
                  </div>
                )}

                <Button 
                  onClick={handleAddRoute}
                  disabled={
                    !newRouteTargetBot || 
                    (newRouteType === "keyword" && !newRouteKeywords) ||
                    (newRouteType === "intent" && !newRouteIntent) ||
                    addRoute.isPending
                  }
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Rota
                </Button>
              </CardContent>
            </Card>

            {/* Existing Routes */}
            {routesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : routes && routes.length > 0 ? (
              <div className="space-y-2">
                <Label>Rotas Configuradas</Label>
                {routes.map((route: any, index: number) => (
                  <div 
                    key={route.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    
                    <Badge variant="outline">
                      {index + 1}
                    </Badge>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={route.route_type === "keyword" ? "default" : "secondary"}>
                          {route.route_type === "keyword" ? "Palavras" : "Intenção"}
                        </Badge>
                        <span className="text-sm font-medium">
                          → {route.target_bot?.name}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {route.route_type === "keyword" 
                          ? route.keywords?.join(", ")
                          : route.intent_description
                        }
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRoute(route.id)}
                      disabled={deleteRoute.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma rota configurada</p>
                <p className="text-sm">Adicione rotas para direcionar conversas</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
