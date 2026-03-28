import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Mic, Image, FileText } from "lucide-react";
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
    max_messages: 30,
    audio_enabled: true,
    audio_message: "🎤 Ouvi seu áudio! Aqui está o que você disse:",
    image_enabled: false,
    image_message: "🖼️ Analisei a imagem que você enviou:",
    file_enabled: false,
    file_message: "📄 Analisei o arquivo que você enviou:",
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createAgent.mutate(
      { ...form, organization_id: organizationId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setForm({
            name: "", personality: "Profissional", system_prompt: "", max_messages: 30,
            audio_enabled: true, audio_message: "🎤 Ouvi seu áudio! Aqui está o que você disse:",
            image_enabled: false, image_message: "🖼️ Analisei a imagem que você enviou:",
            file_enabled: false, file_message: "📄 Analisei o arquivo que você enviou:",
          });
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
              placeholder="Descreva o comportamento, tom e instruções do agente..."
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              rows={8}
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

          <Separator />

          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Capacidades de Mídia</h4>
            <p className="text-xs text-muted-foreground">Configure quais tipos de mídia o agente pode processar</p>
          </div>

          {/* Audio */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                <Label className="font-medium">Processar Áudio</Label>
              </div>
              <Switch
                checked={form.audio_enabled}
                onCheckedChange={(v) => setForm({ ...form, audio_enabled: v })}
              />
            </div>
            {form.audio_enabled && (
              <Input
                placeholder="Mensagem após transcrição"
                value={form.audio_message}
                onChange={(e) => setForm({ ...form, audio_message: e.target.value })}
                className="text-sm"
              />
            )}
          </div>

          {/* Image */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                <Label className="font-medium">Analisar Imagens</Label>
              </div>
              <Switch
                checked={form.image_enabled}
                onCheckedChange={(v) => setForm({ ...form, image_enabled: v })}
              />
            </div>
            {form.image_enabled && (
              <Input
                placeholder="Mensagem após análise de imagem"
                value={form.image_message}
                onChange={(e) => setForm({ ...form, image_message: e.target.value })}
                className="text-sm"
              />
            )}
          </div>

          {/* File */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <Label className="font-medium">Analisar Arquivos</Label>
              </div>
              <Switch
                checked={form.file_enabled}
                onCheckedChange={(v) => setForm({ ...form, file_enabled: v })}
              />
            </div>
            {form.file_enabled && (
              <Input
                placeholder="Mensagem após análise de arquivo"
                value={form.file_message}
                onChange={(e) => setForm({ ...form, file_message: e.target.value })}
                className="text-sm"
              />
            )}
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
