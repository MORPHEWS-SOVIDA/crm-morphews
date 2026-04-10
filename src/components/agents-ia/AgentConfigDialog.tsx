import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Wifi, Brain, ScrollText, Settings, CheckCircle, XCircle, Clock, Mic, Image, FileText } from "lucide-react";
import { useUpdateAgent, type Agent } from "@/hooks/useAgentsIA";
import { useAgentInstances, useCreateAgentInstance, useDeleteAgentInstance } from "@/hooks/useAgentInstances";
import { useAgentKnowledge, useCreateAgentKnowledge, useDeleteAgentKnowledge } from "@/hooks/useAgentKnowledge";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface AgentConfigDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentConfigDialog({ agent, open, onOpenChange }: AgentConfigDialogProps) {
  const { profile } = useAuth();
  const updateAgent = useUpdateAgent();
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

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        personality: agent.personality || "Profissional",
        system_prompt: agent.system_prompt || "",
        max_messages: agent.max_messages || 30,
        audio_enabled: agent.audio_enabled ?? true,
        audio_message: agent.audio_message || "🎤 Ouvi seu áudio! Aqui está o que você disse:",
        image_enabled: agent.image_enabled ?? false,
        image_message: agent.image_message || "🖼️ Analisei a imagem que você enviou:",
        file_enabled: agent.file_enabled ?? false,
        file_message: agent.file_message || "📄 Analisei o arquivo que você enviou:",
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Agente: {agent?.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config" className="gap-1"><Settings className="h-3.5 w-3.5" />Geral</TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1"><Brain className="h-3.5 w-3.5" />Conhecimento</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1"><ScrollText className="h-3.5 w-3.5" />Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prompt do Sistema</Label>
                <Textarea value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} rows={12} />
                <p className="text-xs text-muted-foreground">Para reconfigurar personalidade, mídia e limites, use o Wizard ao criar um novo agente.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={updateAgent.isPending}>
                {updateAgent.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </TabsContent>




          <TabsContent value="knowledge">
            <KnowledgeTab agentId={agent?.id} />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab agentId={agent?.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Instances Tab ───
function InstancesTab({ agentId, organizationId }: { agentId?: string; organizationId?: string }) {
  const { data: instances, isLoading } = useAgentInstances(agentId);
  const createInstance = useCreateAgentInstance();
  const deleteInstance = useDeleteAgentInstance();
  const [instanceName, setInstanceName] = useState("");
  const [instanceId, setInstanceId] = useState("");

  const handleAdd = () => {
    if (!agentId || !organizationId || !instanceName.trim() || !instanceId.trim()) return;
    createInstance.mutate(
      { agent_id: agentId, instance_name: instanceName, instance_id: instanceId, organization_id: organizationId },
      { onSuccess: () => { setInstanceName(""); setInstanceId(""); } }
    );
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex gap-2">
        <Input placeholder="Nome da instância" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} />
        <Input placeholder="ID da instância" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} />
        <Button onClick={handleAdd} disabled={createInstance.isPending} size="icon"><Plus className="h-4 w-4" /></Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : instances && instances.length > 0 ? (
        <div className="space-y-2">
          {instances.map((inst) => (
            <Card key={inst.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{inst.instance_name}</span>
                  <Badge variant="outline" className="text-xs">{inst.instance_id}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteInstance.mutate({ id: inst.id, agentId: agentId! })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma instância vinculada</p>
      )}
    </div>
  );
}

// ─── Knowledge Tab ───
function KnowledgeTab({ agentId }: { agentId?: string }) {
  const { data: items, isLoading } = useAgentKnowledge(agentId);
  const createKnowledge = useCreateAgentKnowledge();
  const deleteKnowledge = useDeleteAgentKnowledge();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const handleAdd = () => {
    if (!agentId || !question.trim() || !answer.trim()) return;
    createKnowledge.mutate(
      { agent_id: agentId, question, answer },
      { onSuccess: () => { setQuestion(""); setAnswer(""); } }
    );
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Input placeholder="Pergunta" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Textarea placeholder="Resposta" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
        <Button onClick={handleAdd} disabled={createKnowledge.isPending} className="gap-1"><Plus className="h-4 w-4" />Adicionar</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">❓ {item.question}</p>
                    <p className="text-sm text-muted-foreground">💬 {item.answer}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteKnowledge.mutate({ id: item.id, agentId: agentId! })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum conhecimento cadastrado</p>
      )}
    </div>
  );
}

// ─── Logs Tab ───
function LogsTab({ agentId }: { agentId?: string }) {
  const { data: logs, isLoading } = useAgentLogs(agentId);

  return (
    <div className="space-y-2 py-4 max-h-[400px] overflow-y-auto">
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : logs && logs.length > 0 ? (
        logs.map((log) => (
          <Card key={log.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                {log.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {log.created_at ? format(new Date(log.created_at), "dd/MM HH:mm:ss") : "—"}
                  </p>
                  {log.error_message && <p className="text-xs text-destructive">{log.error_message}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {log.execution_time_ms && <span>{log.execution_time_ms}ms</span>}
                {log.total_tokens && <span>{log.total_tokens} tokens</span>}
                {log.iterations && <span>{log.iterations} iter</span>}
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum log encontrado</p>
      )}
    </div>
  );
}
