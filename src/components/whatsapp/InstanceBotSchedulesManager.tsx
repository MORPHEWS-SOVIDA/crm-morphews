import { useState } from "react";
import { Bot, Calendar, Clock, Plus, Trash2, ChevronUp, ChevronDown, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  useInstanceBotSchedules,
  useAddInstanceBotSchedule,
  useUpdateInstanceBotSchedule,
  useRemoveInstanceBotSchedule,
  type InstanceBotSchedule,
} from "@/hooks/useInstanceBotSchedules";
import { useAIBots } from "@/hooks/useAIBots";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom", shortLabel: "D" },
  { value: 1, label: "Seg", shortLabel: "S" },
  { value: 2, label: "Ter", shortLabel: "T" },
  { value: 3, label: "Qua", shortLabel: "Q" },
  { value: 4, label: "Qui", shortLabel: "Q" },
  { value: 5, label: "Sex", shortLabel: "S" },
  { value: 6, label: "Sáb", shortLabel: "S" },
];

interface InstanceBotSchedulesManagerProps {
  instanceId: string;
}

export function InstanceBotSchedulesManager({ instanceId }: InstanceBotSchedulesManagerProps) {
  const { data: schedules = [], isLoading } = useInstanceBotSchedules(instanceId);
  const { data: bots = [] } = useAIBots();
  const addSchedule = useAddInstanceBotSchedule();
  const updateSchedule = useUpdateInstanceBotSchedule();
  const removeSchedule = useRemoveInstanceBotSchedule();

  const [selectedBotId, setSelectedBotId] = useState<string>("");

  const activeBots = bots.filter((b) => b.is_active);
  const usedBotIds = schedules.map((s) => s.bot_id);
  const availableBots = activeBots.filter((b) => !usedBotIds.includes(b.id));

  const handleAddSchedule = () => {
    if (!selectedBotId) return;
    addSchedule.mutate({
      instanceId,
      botId: selectedBotId,
    });
    setSelectedBotId("");
  };

  const handleDayToggle = (schedule: InstanceBotSchedule, day: number) => {
    const currentDays = schedule.days_of_week || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    
    updateSchedule.mutate({
      id: schedule.id,
      instanceId,
      days_of_week: newDays,
    });
  };

  const handleTimeChange = (schedule: InstanceBotSchedule, field: "start_time" | "end_time", value: string) => {
    updateSchedule.mutate({
      id: schedule.id,
      instanceId,
      [field]: value,
    });
  };

  const handlePriorityChange = (schedule: InstanceBotSchedule, delta: number) => {
    updateSchedule.mutate({
      id: schedule.id,
      instanceId,
      priority: Math.max(0, (schedule.priority || 0) + delta),
    });
  };

  const handleToggleActive = (schedule: InstanceBotSchedule) => {
    updateSchedule.mutate({
      id: schedule.id,
      instanceId,
      is_active: !schedule.is_active,
    });
  };

  const formatTime = (time: string) => {
    // Converte '08:00:00' para '08:00'
    return time?.substring(0, 5) || "00:00";
  };

  const getDaysLabel = (days: number[]) => {
    if (!days || days.length === 0) return "Nenhum dia";
    if (days.length === 7) return "Todos os dias";
    if (JSON.stringify(days.sort()) === JSON.stringify([1, 2, 3, 4, 5])) return "Seg-Sex";
    if (JSON.stringify(days.sort()) === JSON.stringify([0, 6])) return "Fim de semana";
    return days.map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.shortLabel).join(", ");
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-600" />
          Robôs IA com Agendamento
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        Configure múltiplos robôs para diferentes horários. O robô com maior prioridade que estiver no horário será usado.
      </p>

      {/* Lista de agendamentos */}
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
            Nenhum robô configurado para esta instância
          </div>
        ) : (
          schedules.map((schedule) => (
            <Card
              key={schedule.id}
              className={`relative ${!schedule.is_active ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handlePriorityChange(schedule, 1)}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <span className="text-xs font-mono text-muted-foreground">
                        {schedule.priority}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handlePriorityChange(schedule, -1)}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">{schedule.bot?.name || "Robô"}</span>
                        {!schedule.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getDaysLabel(schedule.days_of_week)} · {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={schedule.is_active ? "text-green-600" : "text-muted-foreground"}
                      onClick={() => handleToggleActive(schedule)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeSchedule.mutate({ id: schedule.id, instanceId })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Dias da semana */}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground mr-2" />
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      variant={schedule.days_of_week?.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => handleDayToggle(schedule, day.value)}
                    >
                      {day.shortLabel}
                    </Button>
                  ))}
                </div>

                {/* Horários */}
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={formatTime(schedule.start_time)}
                      onChange={(e) => handleTimeChange(schedule, "start_time", e.target.value)}
                      className="w-24 h-8"
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={formatTime(schedule.end_time)}
                      onChange={(e) => handleTimeChange(schedule, "end_time", e.target.value)}
                      className="w-24 h-8"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(schedule.start_time) > formatTime(schedule.end_time) && "(vira o dia)"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Adicionar novo robô */}
      {availableBots.length > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t">
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione um robô..." />
            </SelectTrigger>
            <SelectContent>
              {availableBots.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  <span className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 text-purple-600" />
                    {bot.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddSchedule}
            disabled={!selectedBotId || addSchedule.isPending}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      )}

      {availableBots.length === 0 && schedules.length > 0 && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Todos os robôs ativos já estão configurados nesta instância.
        </p>
      )}

      {activeBots.length === 0 && (
        <p className="text-xs text-amber-600 pt-2">
          ⚠️ Nenhum robô ativo encontrado. Crie um robô na página de Robôs IA.
        </p>
      )}
    </div>
  );
}
