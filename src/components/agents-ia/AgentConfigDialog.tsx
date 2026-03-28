import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateAgent, type Agent } from "@/hooks/useAgentsIA";

interface AgentConfigDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentConfigDialog({ agent, open, onOpenChange }: AgentConfigDialogProps) {
  const updateAgent = useUpdateAgent();
  const [form, setForm] = useState({
    name: "",
    personality: "Profissional",
    system_prompt: "",
    welcome_message: "",
    max_messages: 30,
  });

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        personality: agent.personality || "Profissional",
        system_prompt: agent.system_prompt || "",
        welcome_message: agent.welcome_message || "",
        max_messages: agent.max_messages || 30,
      });
    }
  }, [agent]);

  const handleSave = () => {
    if (!agent) return;
    updateAgent.mutate(
      { id: agent.id, ...form },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Agente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Personalidade</Label>
            <Select value={form.personality} onValueChange={(v) => setForm({ ...form, personality: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Profissional">Profissional</SelectItem>
                <SelectItem value="Amigável">Amigável</SelectItem>
                <SelectItem value="Direto">Direto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prompt do Sistema</Label>
            <Textarea
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              rows={8}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Boas-vindas</Label>
            <Textarea
              value={form.welcome_message}
              onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Limite de Mensagens</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={form.max_messages}
              onChange={(e) => setForm({ ...form, max_messages: Number(e.target.value) })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={updateAgent.isPending}>
            {updateAgent.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
