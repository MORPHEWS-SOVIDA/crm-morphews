import { useState, useEffect, useMemo } from "react";
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
import { useEvolutionInstances, InstanceFilter } from "@/hooks/useEvolutionInstances";
import { Plus, Smartphone, Wifi, WifiOff, Archive, ArchiveRestore, QrCode, RefreshCw, LogOut, Loader2, Settings2, Users, Settings, Info, Cog, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { InstancePermissions } from "./InstancePermissions";
import { InstanceSettingsDialog } from "./InstanceSettingsDialog";
import { EvolutionSettingsDialog } from "./EvolutionSettingsDialog";

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
          <h3 className="text-lg font-medium">Instâncias WhatsApp</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie suas conexões do WhatsApp
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
          
          {/* Botão Nova Instância (com QR Code) */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Instância
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
                    <CardTitle className="text-base">{instance.name}</CardTitle>
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
                  {instance.phone_number && (
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
