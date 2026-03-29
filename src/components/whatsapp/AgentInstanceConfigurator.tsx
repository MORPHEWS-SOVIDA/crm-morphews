import { useState, useEffect } from "react";
import { Bot, Calendar, Clock, Cpu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentsIA } from "@/hooks/useAgentsIA";
import { useAgentForInstance, useLinkAgentToInstance, useUnlinkAgentFromInstance } from "@/hooks/useAgentInstanceLink";
import { useAgentTeams } from "@/hooks/useAgentTeams";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

const DAYS_OF_WEEK = [
  { value: "0", label: "Dom", shortLabel: "D" },
  { value: "1", label: "Seg", shortLabel: "S" },
  { value: "2", label: "Ter", shortLabel: "T" },
  { value: "3", label: "Qua", shortLabel: "Q" },
  { value: "4", label: "Qui", shortLabel: "Q" },
  { value: "5", label: "Sex", shortLabel: "S" },
  { value: "6", label: "Sáb", shortLabel: "S" },
];

interface Props {
  instanceId: string;
  instanceName: string;
}

export function AgentInstanceConfigurator({ instanceId, instanceName }: Props) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: agents, isLoading: loadingAgents } = useAgentsIA(orgId);
  const { data: currentLink, isLoading: loadingLink } = useAgentForInstance(instanceId);
  const { data: teams } = useAgentTeams(orgId);
  const linkMutation = useLinkAgentToInstance();
  const unlinkMutation = useUnlinkAgentFromInstance();

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [workingDays, setWorkingDays] = useState<string[]>(["0", "1", "2", "3", "4", "5", "6"]);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  // Sync state with current link
  useEffect(() => {
    if (currentLink) {
      setSelectedAgentId(currentLink.agent_id);
      setWorkingDays(currentLink.working_days || ["0", "1", "2", "3", "4", "5", "6"]);
      setStartTime(currentLink.working_hours_start || "00:00");
      setEndTime(currentLink.working_hours_end || "23:59");
    }
  }, [currentLink]);

  const handleSave = () => {
    if (!selectedAgentId || !orgId) return;
    // Check if selected agent is a maestro of any team
    const teamForAgent = teams?.find(t => t.maestro_agent_id === selectedAgentId);
    linkMutation.mutate({
      agentId: selectedAgentId,
      instanceId,
      instanceName,
      organizationId: orgId,
      workingDays,
      workingHoursStart: startTime,
      workingHoursEnd: endTime,
      teamId: teamForAgent?.id || null,
    });
  };

  const toggleDay = (day: string) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (loadingAgents || loadingLink) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeAgents = agents?.filter(a => a.is_active) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-emerald-100/50 dark:bg-emerald-950/50 p-3 rounded-md">
        <Cpu className="h-4 w-4 text-emerald-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            Agente IA 2.0
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Selecione um agente e configure o horário de funcionamento
          </p>
        </div>
      </div>

      {/* Agent selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Agente
        </Label>
        {activeAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum agente ativo. Crie um em <span className="font-medium">Agentes IA</span>.
          </p>
        ) : (
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um agente..." />
            </SelectTrigger>
            <SelectContent>
              {activeAgents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-600" />
                    <span>{agent.name}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {agent.personality}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Schedule */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Dias de funcionamento
        </Label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS_OF_WEEK.map(day => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`w-9 h-9 rounded-full text-xs font-medium border transition-colors ${
                workingDays.includes(day.value)
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {day.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Início
          </Label>
          <Input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Fim
          </Label>
          <Input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={!selectedAgentId || linkMutation.isPending}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
        >
          {linkMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Cpu className="h-4 w-4 mr-2" />
          )}
          {currentLink ? "Atualizar Agente" : "Vincular Agente"}
        </Button>
        {currentLink && (
          <Button
            variant="outline"
            onClick={() => unlinkMutation.mutate(instanceId)}
            disabled={unlinkMutation.isPending}
            className="text-destructive border-destructive/30"
          >
            Desvincular
          </Button>
        )}
      </div>

      {currentLink?.agents && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          ✅ Agente atual: <span className="font-medium">{currentLink.agents.name}</span>
        </div>
      )}
    </div>
  );
}
