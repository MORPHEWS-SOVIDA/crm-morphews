import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEvolutionInstances, InstanceFilter, ChannelType } from "@/hooks/useEvolutionInstances";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Smartphone, Wifi, WifiOff, Archive, ArchiveRestore, QrCode, RefreshCw, LogOut, Loader2, Settings2, Users, Settings, Info, Cog, ChevronDown, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { InstancePermissions } from "./InstancePermissions";
import { InstanceSettingsDialog } from "./InstanceSettingsDialog";
import { EvolutionSettingsDialog } from "./EvolutionSettingsDialog";

// Ícone do Instagram inline
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

interface EvolutionInstance {
  id: string;
  name: string;
  phone_number: string | null;
  evolution_instance_id: string | null;
  status: string;
  is_connected: boolean;
  qr_code_base64: string | null;
  created_at: string;
  deleted_at?: string | null;
  channel_type?: ChannelType;
  instagram_username?: string | null;
}

interface EvolutionInstancesManagerProps {
  onSelectInstance?: (instanceId: string) => void;
  selectedInstanceId?: string | null;
}

const FILTER_OPTIONS: { value: InstanceFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "connected", label: "Conectadas" },
  { value: "disconnected", label: "Desconectadas" },
  { value: "archived", label: "Arquivadas" },
];

export function EvolutionInstancesManager({ onSelectInstance, selectedInstanceId }: EvolutionInstancesManagerProps) {
  const {
    instances,
    isLoading,
    refetch,
    createInstance,
    getQrCode,
    checkStatus,
    archiveInstance,
    unarchiveInstance,
    logoutInstance,
    addManualInstance,
    pollingInstanceId,
    setPollingInstanceId,
  } = useEvolutionInstances();

  const queryClient = useQueryClient();

  const [newInstanceName, setNewInstanceName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedQrInstance, setSelectedQrInstance] = useState<EvolutionInstance | null>(null);
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [activeFilter, setActiveFilter] = useState<InstanceFilter>("all");
  
  // Estado para adicionar instância manualmente
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualInstanceId, setManualInstanceId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  // Estado para permissões e configurações
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [evolutionSettingsDialogOpen, setEvolutionSettingsDialogOpen] = useState(false);
  const [selectedInstanceForDialog, setSelectedInstanceForDialog] = useState<EvolutionInstance | null>(null);

  // Estado para dialog de Instagram
  const [instagramDialogOpen, setInstagramDialogOpen] = useState(false);
  const [instagramName, setInstagramName] = useState("");
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);

  // Estado para configurações avançadas no dialog de criação
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [createSettings, setCreateSettings] = useState({
    reject_call: true,
    msg_call: "Não posso atender agora, me envie uma mensagem.",
    groups_ignore: false,
    always_online: false,
    read_messages: true,
    read_status: false,
    sync_full_history: false,
  });

  // Filtrar instâncias
  const filteredInstances = useMemo(() => {
    if (!instances) return [];
    
    switch (activeFilter) {
      case "connected":
        return instances.filter(i => i.is_connected && !i.deleted_at);
      case "disconnected":
        return instances.filter(i => !i.is_connected && !i.deleted_at);
      case "archived":
        return instances.filter(i => i.deleted_at);
      case "all":
      default:
        return instances.filter(i => !i.deleted_at);
    }
  }, [instances, activeFilter]);

  // Contadores para os badges
  const counts = useMemo(() => {
    if (!instances) return { all: 0, connected: 0, disconnected: 0, archived: 0 };
    return {
      all: instances.filter(i => !i.deleted_at).length,
      connected: instances.filter(i => i.is_connected && !i.deleted_at).length,
      disconnected: instances.filter(i => !i.is_connected && !i.deleted_at).length,
      archived: instances.filter(i => i.deleted_at).length,
    };
  }, [instances]);

  // Polling para verificar conexão
  useEffect(() => {
    if (!pollingInstanceId) return;

    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const result = await checkStatus.mutateAsync(pollingInstanceId);
        if (result.is_connected) {
          setIsPolling(false);
          setQrDialogOpen(false);
          setPollingInstanceId(null);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [pollingInstanceId, checkStatus, setPollingInstanceId]);

  const handleCreate = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }

    try {
      const result = await createInstance.mutateAsync({
        name: newInstanceName.trim(),
        settings: createSettings,
      });
      setNewInstanceName("");
      setCreateDialogOpen(false);
      setShowAdvancedSettings(false);
      // Reset settings to defaults
      setCreateSettings({
        reject_call: true,
        msg_call: "Não posso atender agora, me envie uma mensagem.",
        groups_ignore: false,
        always_online: false,
        read_messages: true,
        read_status: false,
        sync_full_history: false,
      });
      
      // Abrir QR code automaticamente
      if (result?.instance) {
        setSelectedQrInstance(result.instance);
        setCurrentQrCode(result.qr_code_base64);
        setQrDialogOpen(true);
        setPollingInstanceId(result.instance.id);
      }
    } catch (e) {
      // Erro já tratado no hook
    }
  };

  const handleShowQrCode = async (instance: EvolutionInstance) => {
    setSelectedQrInstance(instance);
    setQrDialogOpen(true);
    setPollingInstanceId(instance.id);
    
    try {
      const result = await getQrCode.mutateAsync(instance.id);
      setCurrentQrCode(result.qr_code_base64);
    } catch (e) {
      toast.error("Erro ao buscar QR Code");
    }
  };

  const handleRefreshQrCode = async () => {
    if (!selectedQrInstance) return;
    
    try {
      const result = await getQrCode.mutateAsync(selectedQrInstance.id);
      setCurrentQrCode(result.qr_code_base64);
      toast.success("QR Code atualizado");
    } catch (e) {
      toast.error("Erro ao atualizar QR Code");
    }
  };

  const handleArchive = async (instance: EvolutionInstance) => {
    if (!confirm(`Arquivar a instância "${instance.name}"? O histórico de conversas será preservado.`)) {
      return;
    }
    
    try {
      await archiveInstance.mutateAsync(instance.id);
    } catch (e) {
      // Erro já tratado no hook
    }
  };

  const handleUnarchive = async (instance: EvolutionInstance) => {
    try {
      await unarchiveInstance.mutateAsync(instance.id);
    } catch (e) {
      // Erro já tratado no hook
    }
  };

  const handleLogout = async (instance: EvolutionInstance) => {
    if (!confirm(`Desconectar o WhatsApp da instância "${instance.name}"?`)) {
      return;
    }
    
    try {
      await logoutInstance.mutateAsync(instance.id);
    } catch (e) {
      // Erro já tratado no hook
    }
  };

  const handleAddManual = async () => {
    if (!manualInstanceId.trim()) {
      toast.error("O ID da instância é obrigatório");
      return;
    }

    try {
      await addManualInstance.mutateAsync({
        name: manualName.trim() || manualInstanceId.trim(),
        evolution_instance_id: manualInstanceId.trim(),
        evolution_api_token: manualToken.trim() || undefined,
        phone_number: manualPhone.trim() || undefined,
      });
      
      // Limpar campos e fechar dialog
      setManualName("");
      setManualInstanceId("");
      setManualToken("");
      setManualPhone("");
      setManualDialogOpen(false);
    } catch (e) {
      // Erro já tratado no hook
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
    <div className="space-y-4">
      {/* Alerta informativo sobre a regra */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Regra do Sistema:</strong> Instâncias não podem ser excluídas para preservar o histórico de conversas. 
          Você pode <strong>arquivar</strong> instâncias que não usa mais, ou <strong>desconectar</strong> e reconectar com outro número.
        </AlertDescription>
      </Alert>

      {/* Header com botões */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-medium">Canais de Atendimento</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie suas conexões de WhatsApp e Instagram
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Botão Adicionar Manualmente */}
          <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings2 className="h-4 w-4 mr-2" />
                Adicionar Manualmente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Instância Existente</DialogTitle>
                <DialogDescription>
                  Adicione uma instância que já existe no Evolution API. Útil para conectar instâncias já configuradas em outros sistemas.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-name">Nome de Exibição</Label>
                  <Input
                    id="manual-name"
                    placeholder="Ex: Vendas, Suporte..."
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Nome amigável para identificar a instância</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manual-instance-id">ID da Instância (Evolution) *</Label>
                  <Input
                    id="manual-instance-id"
                    placeholder="Ex: minhainstancia123"
                    value={manualInstanceId}
                    onChange={(e) => setManualInstanceId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">O nome/ID da instância no Evolution API (campo instanceName)</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manual-token">Token da API (opcional)</Label>
                  <Input
                    id="manual-token"
                    placeholder="Token da instância"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Token específico da instância, se houver</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manual-phone">Número do WhatsApp (opcional)</Label>
                  <Input
                    id="manual-phone"
                    placeholder="Ex: 5511999999999"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Número conectado (sem @s.whatsapp.net)</p>
                </div>
                
                <Button 
                  onClick={handleAddManual} 
                  disabled={addManualInstance.isPending || !manualInstanceId.trim()}
                  className="w-full"
                >
                  {addManualInstance.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    "Adicionar Instância"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Botão Conectar Instagram */}
          <Dialog open={instagramDialogOpen} onOpenChange={setInstagramDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white border-0 hover:opacity-90">
                <InstagramIcon className="h-4 w-4 mr-2" />
                Conectar Instagram
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                    <InstagramIcon className="h-5 w-5 text-white" />
                  </div>
                  Conectar Instagram Business
                </DialogTitle>
                <DialogDescription>
                  Conecte sua conta Instagram Business para receber e responder DMs diretamente no chat.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome para identificar</Label>
                  <Input
                    placeholder="Ex: Instagram Vendas, Suporte IG..."
                    value={instagramName}
                    onChange={(e) => setInstagramName(e.target.value)}
                  />
                </div>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Requisitos:</strong>
                    <ul className="list-disc list-inside mt-1 text-sm">
                      <li>Conta Instagram Business ou Creator</li>
                      <li>Página do Facebook vinculada</li>
                      <li>Acesso de admin à página</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={async () => {
                    if (!instagramName.trim()) {
                      toast.error("Digite um nome para identificar a conta");
                      return;
                    }
                    setIsConnectingInstagram(true);
                    try {
                      // Chamar edge function para criar instância Instagram
                      const response = await supabase.functions.invoke("evolution-instance-manager", {
                        body: { 
                          action: "create_instagram", 
                          name: instagramName.trim() 
                        },
                      });
                      
                      if (response.error) {
                        throw new Error(response.error.message);
                      }
                      
                      if (response.data?.oauth_url) {
                        // Abrir popup para OAuth do Meta
                        window.open(response.data.oauth_url, "_blank", "width=600,height=700");
                        toast.info("Complete a autenticação na janela do Facebook");
                      } else if (response.data?.instance) {
                        toast.success("Conta Instagram conectada!");
                        queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
                      }
                      
                      setInstagramDialogOpen(false);
                      setInstagramName("");
                    } catch (error) {
                      console.error("Error connecting Instagram:", error);
                      toast.error("Erro ao conectar Instagram: " + (error instanceof Error ? error.message : "Erro desconhecido"));
                    } finally {
                      setIsConnectingInstagram(false);
                    }
                  }}
                  disabled={isConnectingInstagram || !instagramName.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90"
                >
                  {isConnectingInstagram ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <InstagramIcon className="h-4 w-4 mr-2" />
                      Conectar com Facebook
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Botão Nova Instância WhatsApp (com QR Code) */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Instância WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instância</DialogTitle>
                <DialogDescription>
                  Crie uma nova conexão do WhatsApp para sua organização. 
                  <span className="block mt-1 text-amber-600 dark:text-amber-400">
                    Atenção: Uma vez criada, a instância não pode ser excluída, apenas arquivada.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input
                    placeholder="Ex: Vendas, Suporte, Marketing..."
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !showAdvancedSettings && handleCreate()}
                  />
                </div>

                {/* Configurações Avançadas (colapsável) */}
                <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Cog className="h-4 w-4" />
                        Configurações Avançadas
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <Separator />

                    {/* Rejeitar Chamadas */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Rejeitar Chamadas</Label>
                        <p className="text-xs text-muted-foreground">Rejeita automaticamente ligações</p>
                      </div>
                      <Switch
                        checked={createSettings.reject_call}
                        onCheckedChange={(checked) => setCreateSettings(prev => ({ ...prev, reject_call: checked }))}
                      />
                    </div>

                    {createSettings.reject_call && (
                      <div className="space-y-2 pl-4 border-l-2 border-muted">
                        <Label className="text-sm">Mensagem ao rejeitar</Label>
                        <Input
                          placeholder="Mensagem automática..."
                          value={createSettings.msg_call}
                          onChange={(e) => setCreateSettings(prev => ({ ...prev, msg_call: e.target.value }))}
                        />
                      </div>
                    )}

                    <Separator />

                    {/* Ignorar Grupos */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Ignorar Grupos</Label>
                        <p className="text-xs text-muted-foreground">Ignora mensagens de grupos</p>
                      </div>
                      <Switch
                        checked={createSettings.groups_ignore}
                        onCheckedChange={(checked) => setCreateSettings(prev => ({ ...prev, groups_ignore: checked }))}
                      />
                    </div>

                    <Separator />

                    {/* Sempre Online */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Sempre Online</Label>
                        <p className="text-xs text-muted-foreground">Mantém status "online"</p>
                      </div>
                      <Switch
                        checked={createSettings.always_online}
                        onCheckedChange={(checked) => setCreateSettings(prev => ({ ...prev, always_online: checked }))}
                      />
                    </div>

                    <Separator />

                    {/* Marcar Mensagens como Lidas */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Marcar Mensagens como Lidas</Label>
                        <p className="text-xs text-muted-foreground">Marca automaticamente como lidas</p>
                      </div>
                      <Switch
                        checked={createSettings.read_messages}
                        onCheckedChange={(checked) => setCreateSettings(prev => ({ ...prev, read_messages: checked }))}
                      />
                    </div>

                    <Separator />

                    {/* Sincronizar Histórico Completo */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Sincronizar Histórico Completo</Label>
                        <p className="text-xs text-muted-foreground">Sincroniza todo o histórico ao conectar</p>
                      </div>
                      <Switch
                        checked={createSettings.sync_full_history}
                        onCheckedChange={(checked) => setCreateSettings(prev => ({ ...prev, sync_full_history: checked }))}
                      />
                    </div>

                    <Separator />

                    {/* Marcar Status como Lido */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Marcar Status como Lido</Label>
                        <p className="text-xs text-muted-foreground">Visualiza status automaticamente</p>
                      </div>
                      <Switch
                        checked={createSettings.read_status}
                        onCheckedChange={(checked) => setCreateSettings(prev => ({ ...prev, read_status: checked }))}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Button 
                  onClick={handleCreate} 
                  disabled={createInstance.isPending}
                  className="w-full"
                >
                  {createInstance.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar e Conectar"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((filter) => (
          <Button
            key={filter.value}
            variant={activeFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.value)}
            className="gap-2"
          >
            {filter.label}
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {counts[filter.value]}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Lista de instâncias */}
      {filteredInstances.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {activeFilter === "archived" 
                ? "Nenhuma instância arquivada."
                : activeFilter === "connected"
                ? "Nenhuma instância conectada."
                : activeFilter === "disconnected"
                ? "Nenhuma instância desconectada."
                : "Nenhuma instância criada ainda."}
              {activeFilter === "all" && (
                <>
                  <br />
                  Clique em "Nova Instância" para começar.
                </>
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInstances.map((instance) => {
            const isArchived = !!instance.deleted_at;
            
            return (
              <Card 
                key={instance.id}
                className={`cursor-pointer transition-all ${
                  selectedInstanceId === instance.id 
                    ? "ring-2 ring-primary" 
                    : "hover:shadow-md"
                } ${isArchived ? "opacity-60" : ""}`}
                onClick={() => !isArchived && onSelectInstance?.(instance.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Channel type icon */}
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        (instance as any).channel_type === 'instagram' 
                          ? "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400"
                          : "bg-green-500"
                      }`}>
                        {(instance as any).channel_type === 'instagram' ? (
                          <InstagramIcon className="h-3.5 w-3.5 text-white" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5 text-white" />
                        )}
                      </div>
                      <CardTitle className="text-base">{instance.name}</CardTitle>
                    </div>
                    {isArchived ? (
                      <Badge variant="secondary">
                        <Archive className="h-3 w-3 mr-1" /> Arquivada
                      </Badge>
                    ) : (
                      <Badge 
                        variant={instance.is_connected ? "default" : "secondary"}
                        className={instance.is_connected ? "bg-green-500" : ""}
                      >
                        {instance.is_connected ? (
                          <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                        )}
                      </Badge>
                    )}
                  </div>
                  {(instance as any).channel_type === 'instagram' && (instance as any).instagram_username ? (
                    <CardDescription>
                      @{(instance as any).instagram_username}
                    </CardDescription>
                  ) : instance.phone_number && (
                    <CardDescription>
                      +{instance.phone_number}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {isArchived ? (
                      // Instância arquivada: apenas botão de restaurar
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnarchive(instance);
                        }}
                        disabled={unarchiveInstance.isPending}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-1" />
                        Restaurar
                      </Button>
                    ) : (
                      <>
                        {!instance.is_connected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowQrCode(instance);
                            }}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            QR Code
                          </Button>
                        )}
                        {instance.is_connected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLogout(instance);
                            }}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Desconectar
                          </Button>
                        )}
                        {/* Botão Configurações do CRM */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInstanceForDialog(instance);
                            setSettingsDialogOpen(true);
                          }}
                          title="Configurações do CRM"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        {/* Botão Configurações do Evolution */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInstanceForDialog(instance);
                            setEvolutionSettingsDialogOpen(true);
                          }}
                          title="Configurações do WhatsApp (Evolution)"
                        >
                          <Cog className="h-4 w-4" />
                        </Button>
                        {/* Botão Permissões */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInstanceForDialog(instance);
                            setPermissionsDialogOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        {/* Botão Arquivar */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(instance);
                          }}
                          disabled={archiveInstance.isPending}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog do QR Code */}
      <Dialog open={qrDialogOpen} onOpenChange={(open) => {
        setQrDialogOpen(open);
        if (!open) {
          setPollingInstanceId(null);
          setCurrentQrCode(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {currentQrCode ? (
              <div className="bg-white p-4 rounded-lg">
                <img 
                  src={currentQrCode.startsWith("data:") ? currentQrCode : `data:image/png;base64,${currentQrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {isPolling && (
              <p className="text-sm text-muted-foreground mt-4 flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Aguardando conexão...
              </p>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleRefreshQrCode}
              disabled={getQrCode.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${getQrCode.isPending ? "animate-spin" : ""}`} />
              Atualizar QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Permissões */}
      {selectedInstanceForDialog && (
        <InstancePermissions
          instanceId={selectedInstanceForDialog.id}
          instanceName={selectedInstanceForDialog.name}
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
        />
      )}

      {/* Dialog de Configurações do CRM */}
      {selectedInstanceForDialog && (
        <InstanceSettingsDialog
          instanceId={selectedInstanceForDialog.id}
          instanceName={selectedInstanceForDialog.name}
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
        />
      )}

      {/* Dialog de Configurações do Evolution */}
      {selectedInstanceForDialog && (
        <EvolutionSettingsDialog
          instanceId={selectedInstanceForDialog.id}
          instanceName={selectedInstanceForDialog.name}
          open={evolutionSettingsDialogOpen}
          onOpenChange={setEvolutionSettingsDialogOpen}
        />
      )}
    </div>
  );
}
