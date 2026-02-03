import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Plus, Save, Phone, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "@/hooks/use-toast";

interface VoiceAIAgent {
  id: string;
  name: string;
  elevenlabs_agent_id: string | null;
  voice_id: string | null;
  voice_name: string | null;
  welcome_message: string | null;
  system_prompt: string | null;
  is_active: boolean;
  organization_id: string;
  created_at: string;
}

export function VoiceAIAgentConfig() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingAgent, setEditingAgent] = useState<VoiceAIAgent | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    elevenlabs_agent_id: "",
    voice_id: "",
    voice_name: "",
    welcome_message: "",
    system_prompt: "",
    is_active: true,
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["voice-ai-agents", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("voice_ai_agents")
        .select("*")
        .eq("organization_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as VoiceAIAgent[];
    },
    enabled: !!tenantId,
  });

  const createAgent = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("voice_ai_agents")
        .insert({
          organization_id: tenantId,
          name: data.name,
          elevenlabs_agent_id: data.elevenlabs_agent_id || null,
          voice_id: data.voice_id || null,
          voice_name: data.voice_name || null,
          welcome_message: data.welcome_message || null,
          system_prompt: data.system_prompt || null,
          is_active: data.is_active,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-ai-agents"] });
      setIsCreating(false);
      resetForm();
      toast({ title: "Agente criado!", description: "Agente de voz IA criado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("voice_ai_agents")
        .update({
          name: data.name,
          elevenlabs_agent_id: data.elevenlabs_agent_id || null,
          voice_id: data.voice_id || null,
          voice_name: data.voice_name || null,
          welcome_message: data.welcome_message || null,
          system_prompt: data.system_prompt || null,
          is_active: data.is_active,
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-ai-agents"] });
      setEditingAgent(null);
      resetForm();
      toast({ title: "Agente atualizado!", description: "Configurações salvas." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      elevenlabs_agent_id: "",
      voice_id: "",
      voice_name: "",
      welcome_message: "",
      system_prompt: "",
      is_active: true,
    });
  };

  const startEditing = (agent: VoiceAIAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name || "",
      elevenlabs_agent_id: agent.elevenlabs_agent_id || "",
      voice_id: agent.voice_id || "",
      voice_name: agent.voice_name || "",
      welcome_message: agent.welcome_message || "",
      system_prompt: agent.system_prompt || "",
      is_active: agent.is_active,
    });
    setIsCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAgent) {
      updateAgent.mutate({ id: editingAgent.id, data: formData });
    } else {
      createAgent.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent List */}
      {!isCreating && !editingAgent && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Agentes de Voz IA</h3>
              <p className="text-sm text-muted-foreground">
                Configure agentes para realizar e receber chamadas com inteligência artificial
              </p>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agente
            </Button>
          </div>

          {agents?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="font-medium">Nenhum agente configurado</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie seu primeiro agente de voz IA para começar
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Agente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {agents?.map((agent) => (
                <Card key={agent.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {agent.elevenlabs_agent_id 
                              ? `ID: ${agent.elevenlabs_agent_id.substring(0, 12)}...`
                              : "Sem Agent ID configurado"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={agent.is_active ? "default" : "secondary"}>
                        {agent.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => startEditing(agent)}
                      >
                        <Settings2 className="h-4 w-4 mr-1" />
                        Configurar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingAgent) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingAgent ? "Editar Agente" : "Novo Agente de Voz IA"}
            </CardTitle>
            <CardDescription>
              Configure as informações do agente ElevenLabs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Agente *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Atendente Virtual"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="elevenlabs_agent_id">ElevenLabs Agent ID *</Label>
                  <Input
                    id="elevenlabs_agent_id"
                    value={formData.elevenlabs_agent_id}
                    onChange={(e) => setFormData({ ...formData, elevenlabs_agent_id: e.target.value })}
                    placeholder="Crie em elevenlabs.io → Conversational AI"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Crie um agente em{" "}
                    <a 
                      href="https://elevenlabs.io/conversational-ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      elevenlabs.io/conversational-ai
                    </a>
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="voice_id">Voice ID (opcional)</Label>
                  <Input
                    id="voice_id"
                    value={formData.voice_id}
                    onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                    placeholder="ID da voz do ElevenLabs"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="voice_name">Nome da Voz (opcional)</Label>
                  <Input
                    id="voice_name"
                    value={formData.voice_name}
                    onChange={(e) => setFormData({ ...formData, voice_name: e.target.value })}
                    placeholder="Ex: Laura, Roger, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome_message">Mensagem de Boas-vindas</Label>
                <Textarea
                  id="welcome_message"
                  value={formData.welcome_message}
                  onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                  placeholder="Mensagem inicial quando a ligação é atendida..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="system_prompt">System Prompt</Label>
                <Textarea
                  id="system_prompt"
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  placeholder="Instruções para o comportamento do agente..."
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Agente ativo</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingAgent(null);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createAgent.isPending || updateAgent.isPending}
                >
                  {(createAgent.isPending || updateAgent.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingAgent ? "Salvar Alterações" : "Criar Agente"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
