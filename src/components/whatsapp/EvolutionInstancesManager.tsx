import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";
import { Plus, Smartphone, Wifi, WifiOff, Trash2, QrCode, RefreshCw, LogOut, Loader2, Users, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface EvolutionInstance {
  id: string;
  name: string;
  phone_number: string | null;
  evolution_instance_id: string | null;
  status: string;
  is_connected: boolean;
  qr_code_base64: string | null;
  created_at: string;
}

interface EvolutionInstancesManagerProps {
  onSelectInstance?: (instanceId: string) => void;
  selectedInstanceId?: string | null;
}

export function EvolutionInstancesManager({ onSelectInstance, selectedInstanceId }: EvolutionInstancesManagerProps) {
  const {
    instances,
    isLoading,
    refetch,
    createInstance,
    getQrCode,
    checkStatus,
    deleteInstance,
    logoutInstance,
    enableGroups,
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
  
  // Estado para adicionar instância manualmente
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualInstanceId, setManualInstanceId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualPhone, setManualPhone] = useState("");

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
      const result = await createInstance.mutateAsync(newInstanceName.trim());
      setNewInstanceName("");
      setCreateDialogOpen(false);
      
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

  const handleDelete = async (instance: EvolutionInstance) => {
    if (!confirm(`Tem certeza que deseja excluir a instância "${instance.name}"?`)) {
      return;
    }
    
    try {
      await deleteInstance.mutateAsync(instance.id);
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

  const handleEnableGroups = async (instance: EvolutionInstance) => {
    try {
      await enableGroups.mutateAsync(instance.id);
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
                  Crie uma nova conexão do WhatsApp para sua organização
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input
                    placeholder="Ex: Vendas, Suporte, Marketing..."
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
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

      {/* Lista de instâncias */}
      {!instances || instances.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhuma instância criada ainda.
              <br />
              Clique em "Nova Instância" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((instance) => (
            <Card 
              key={instance.id}
              className={`cursor-pointer transition-all ${
                selectedInstanceId === instance.id 
                  ? "ring-2 ring-primary" 
                  : "hover:shadow-md"
              }`}
              onClick={() => onSelectInstance?.(instance.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{instance.name}</CardTitle>
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
                </div>
                {instance.phone_number && (
                  <CardDescription>
                    +{instance.phone_number}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
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
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnableGroups(instance);
                        }}
                        disabled={enableGroups.isPending}
                        title="Habilitar mensagens de grupos"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Grupos
                      </Button>
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
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(instance);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}
