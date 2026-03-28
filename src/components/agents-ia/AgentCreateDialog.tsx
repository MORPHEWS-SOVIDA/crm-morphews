import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateAgent } from "@/hooks/useAgentsIA";

interface AgentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function AgentCreateDialog({ open, onOpenChange, organizationId }: AgentCreateDialogProps) {
  const createAgent = useCreateAgent();
  const [form, setForm] = useState({
    name: "",
    personality: "Profissional",
    system_prompt: "",
    welcome_message: "",
    max_messages: 30,
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createAgent.mutate(
      { ...form, organization_id: organizationId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm({ name: "", personality: "Profissional", system_prompt: "", welcome_message: "", max_messages: 30 });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Agente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome do Agente</Label>
            <Input
              placeholder="Ex: Assistente de Vendas"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Personalidade</Label>
            <Select value={form.personality} onValueChange={(v) => setForm({ ...form, personality: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              placeholder="Descreva o comportamento, tom e instruções do agente..."
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              rows={8}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem de Boas-vindas</Label>
            <Textarea
              placeholder="Mensagem enviada ao iniciar conversa..."
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
          <Button onClick={handleSubmit} disabled={!form.name.trim() || createAgent.isPending}>
            {createAgent.isPending ? "Criando..." : "Criar Agente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
