import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, Route, Users, Bot } from "lucide-react";
import {
  useAgentTeamRoutes,
  useCreateAgentTeamRoute,
  useDeleteAgentTeamRoute,
  type AgentTeam,
} from "@/hooks/useAgentTeams";
import { type Agent } from "@/hooks/useAgentsIA";

interface Props {
  team: AgentTeam | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  keyword: "Palavra-chave",
  intent: "Intenção (IA)",
  fallback: "Fallback",
};

const ROUTE_TYPE_COLORS: Record<string, string> = {
  keyword: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  intent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  fallback: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function AgentTeamConfigDialog({ team, open, onOpenChange, agents }: Props) {
  const { data: routes, isLoading } = useAgentTeamRoutes(team?.id);
  const createRoute = useCreateAgentTeamRoute();
  const deleteRoute = useDeleteAgentTeamRoute();

  // New route form
  const [showForm, setShowForm] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState("");
  const [routeType, setRouteType] = useState("keyword");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [intentDesc, setIntentDesc] = useState("");
  const [priority, setPriority] = useState(1);

  const activeAgents = agents.filter((a) => a.is_active);

  const handleAddRoute = () => {
    if (!team || !targetAgentId) return;
    createRoute.mutate(
      {
        team_id: team.id,
        target_agent_id: targetAgentId,
        route_type: routeType,
        keywords: routeType === "keyword" ? keywordsInput.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
        intent_description: routeType === "intent" ? intentDesc : undefined,
        priority,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setTargetAgentId("");
          setRouteType("keyword");
          setKeywordsInput("");
          setIntentDesc("");
          setPriority((routes?.length || 0) + 1);
        },
      }
    );
  };

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {team.name}
          </DialogTitle>
          <DialogDescription>
            {team.description || "Configure as rotas de direcionamento do time"}
          </DialogDescription>
        </DialogHeader>

        {/* Team info */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" />
            Maestro: <span className="font-medium text-foreground">{team.maestro?.name || "—"}</span>
          </div>
          {team.fallback?.name && (
            <div className="flex items-center gap-1">
              Fallback: <span className="font-medium text-foreground">{team.fallback.name}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Routes list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Route className="h-4 w-4" />
              Rotas ({routes?.length || 0})
            </h3>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setPriority((routes?.length || 0) + 1); }}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : routes && routes.length > 0 ? (
            <div className="space-y-2">
              {routes.map((route) => (
                <Card key={route.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={ROUTE_TYPE_COLORS[route.route_type] || ""}>
                          {ROUTE_TYPE_LABELS[route.route_type] || route.route_type}
                        </Badge>
                        <span className="text-sm font-medium">{route.target_agent?.name || "Agente removido"}</span>
                        <span className="text-xs text-muted-foreground">P{route.priority}</span>
                      </div>
                      {route.keywords && route.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {route.keywords.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>
                      )}
                      {route.intent_description && (
                        <p className="text-xs text-muted-foreground">{route.intent_description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteRoute.mutate({ id: route.id, teamId: team.id })}
                      disabled={deleteRoute.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma rota configurada. Adicione rotas para direcionar conversas aos especialistas.
            </p>
          )}
        </div>

        {/* Add route form */}
        {showForm && (
          <>
            <Separator />
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <h4 className="text-sm font-semibold">Nova Rota</h4>

              <div className="space-y-2">
                <Label className="text-xs">Agente Especialista *</Label>
                <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {activeAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo *</Label>
                  <Select value={routeType} onValueChange={setRouteType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Palavra-chave</SelectItem>
                      <SelectItem value="intent">Intenção (IA)</SelectItem>
                      <SelectItem value="fallback">Fallback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Prioridade</Label>
                  <Input type="number" min={1} value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 1)} />
                </div>
              </div>

              {routeType === "keyword" && (
                <div className="space-y-2">
                  <Label className="text-xs">Keywords (separadas por vírgula)</Label>
                  <Input placeholder="preço, valor, comprar" value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} />
                </div>
              )}

              {routeType === "intent" && (
                <div className="space-y-2">
                  <Label className="text-xs">Descrição da Intenção</Label>
                  <Input placeholder="Cliente quer informações sobre preços" value={intentDesc} onChange={(e) => setIntentDesc(e.target.value)} />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddRoute} disabled={!targetAgentId || createRoute.isPending}>
                  {createRoute.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Salvar Rota
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
