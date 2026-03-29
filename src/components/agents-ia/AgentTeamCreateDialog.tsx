import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users } from "lucide-react";
import { useCreateAgentTeam } from "@/hooks/useAgentTeams";
import { type Agent } from "@/hooks/useAgentsIA";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  agents: Agent[];
}

export function AgentTeamCreateDialog({ open, onOpenChange, organizationId, agents }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maestroId, setMaestroId] = useState("");
  const [fallbackId, setFallbackId] = useState("");

  const createTeam = useCreateAgentTeam();
  const activeAgents = agents.filter((a) => a.is_active);

  const handleCreate = () => {
    if (!name.trim() || !maestroId) return;
    createTeam.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        maestro_agent_id: maestroId,
        fallback_agent_id: fallbackId || undefined,
        organization_id: organizationId,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setMaestroId("");
          setFallbackId("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Criar Time de Agentes
          </DialogTitle>
          <DialogDescription>
            Monte um time com um Maestro que direciona para especialistas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome do Time *</Label>
            <Input placeholder="Ex: Time de Vendas" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea placeholder="Descrição opcional..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Agente Maestro *</Label>
            <Select value={maestroId} onValueChange={setMaestroId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o maestro..." />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">O maestro recebe a mensagem e decide qual especialista atende</p>
          </div>

          <div className="space-y-2">
            <Label>Agente Fallback</Label>
            <Select value={fallbackId} onValueChange={setFallbackId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {activeAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Agente que assume quando nenhuma rota combina</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={!name.trim() || !maestroId || createTeam.isPending}>
              {createTeam.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Time
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
