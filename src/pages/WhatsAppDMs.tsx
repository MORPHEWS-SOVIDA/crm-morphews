import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Plus, QrCode, Settings, Users, Check, X, Loader2, ArrowLeft, RefreshCw, Unplug, Phone, Smartphone, Clock, Pencil, Trash2, Settings2, Cog, Bot, Star, BarChart3, Info } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppChat } from "@/components/whatsapp/WhatsAppChat";
import { InstancePermissions } from "@/components/whatsapp/InstancePermissions";
import { EvolutionSettingsDialog } from "@/components/whatsapp/EvolutionSettingsDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useEvolutionInstances } from "@/hooks/useEvolutionInstances";
import { useOrgAdmin } from "@/hooks/useOrgAdmin";
import { useMyPermissions } from "@/hooks/useUserPermissions";
import { useNavigate } from "react-router-dom";

// Status mapping for human-readable display
type InstanceStatus = "connected" | "waiting_qr" | "disconnected" | "error";

const STATUS_LABELS: Record<InstanceStatus, string> = {
  connected: "Conectado",
  waiting_qr: "Aguardando QR",
  disconnected: "Desconectado",
  error: "Erro",
};

const mapStatusToInternal = (status: string, isConnected: boolean): InstanceStatus => {
  if (isConnected) return "connected";
  if (status === "waiting_qr" || status === "pending") return "waiting_qr";
  if (status === "error") return "error";
  return "disconnected";
};

interface EvolutionInstance {
  id: string;
  name: string;
  status: string;
  is_connected: boolean;
  phone_number: string | null;
  qr_code_base64: string | null;
  evolution_instance_id: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
  manual_instance_number: string | null;
  manual_device_label: string | null;
  display_name_for_team: string | null;
}

export default function WhatsAppDMs() {
  const { profile, isAdmin, user } = useAuth();
  const { data: isOrgAdmin } = useOrgAdmin();
  const { data: permissions } = useMyPermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Hook para adicionar instância manual e Instagram
  const { addManualInstance, createInstagramInstance } = useEvolutionInstances();

  // Verificar se pode ver configurações globais
  const canViewGlobalConfig = Boolean(permissions?.whatsapp_ai_settings_view || isAdmin || isOrgAdmin);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceNumber, setNewInstanceNumber] = useState("");
  const [newDeviceLabel, setNewDeviceLabel] = useState("");
  const [newDisplayNameForTeam, setNewDisplayNameForTeam] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<string | null>(null);
  const [permissionsInstance, setPermissionsInstance] = useState<EvolutionInstance | null>(null);
  const [deleteInstance, setDeleteInstance] = useState<EvolutionInstance | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // QR Codes em memória (não salvar no banco por ser muito grande)
  const [qrCodesMap, setQrCodesMap] = useState<Record<string, string>>({});
  
  // Edit instance dialog
  const [editNameInstance, setEditNameInstance] = useState<EvolutionInstance | null>(null);
  const [newInstanceNameEdit, setNewInstanceNameEdit] = useState("");
  const [newInstanceNumberEdit, setNewInstanceNumberEdit] = useState("");
  const [newDeviceLabelEdit, setNewDeviceLabelEdit] = useState("");
  const [newDisplayNameForTeamEdit, setNewDisplayNameForTeamEdit] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  
  // Ver todas as conversas (todas as instâncias)
  const [viewAllConversations, setViewAllConversations] = useState(false);
  
  // Dialog para adicionar instância manualmente
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualInstanceId, setManualInstanceId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualInstanceNumber, setManualInstanceNumber] = useState("");
  const [manualDeviceLabel, setManualDeviceLabel] = useState("");
  const [manualDisplayNameForTeam, setManualDisplayNameForTeam] = useState("");

  // Dialog para configurações do Evolution
  const [evolutionSettingsInstance, setEvolutionSettingsInstance] = useState<EvolutionInstance | null>(null);

  // Dialog para Instagram
  const [showInstagramDialog, setShowInstagramDialog] = useState(false);
  const [instagramName, setInstagramName] = useState("");
  const [isCreatingInstagram, setIsCreatingInstagram] = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<"all" | "connected" | "disconnected">("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp" | "instagram">("all");

  // Polling interval ref
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch instances
  const { data: instances, isLoading, refetch } = useQuery({
    queryKey: ["evolution-instances", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", profile?.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EvolutionInstance[];
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 10000,
  });

  // Polling for non-connected instances
  useEffect(() => {
    const disconnectedInstances = instances?.filter(i => !i.is_connected && i.evolution_instance_id) || [];

    if (disconnectedInstances.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    pollingIntervalRef.current = setInterval(() => {
      disconnectedInstances.forEach(instance => {
        checkInstanceStatus(instance.id, true);
      });
    }, 8000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [instances]);

  const checkInstanceStatus = async (instanceId: string, silent = false) => {
    if (!silent) setIsCheckingStatus(instanceId);
    
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "status", instanceId },
      });

      if (error) throw error;

      if (data?.is_connected && !silent) {
        toast({ title: "WhatsApp conectado!", description: "Instância pronta para uso" });
      } else if (!silent && !data?.is_connected) {
        toast({ 
          title: "Não conectado", 
          description: STATUS_LABELS[mapStatusToInternal(data?.status, false)] || "Escaneie o QR Code" 
        });
      }

      refetch();
    } catch (error: any) {
      if (!silent) {
        toast({
          title: "Erro ao verificar status",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsCheckingStatus(null);
    }
  };

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast({ title: "Digite um nome para a instância", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-manager", {
        body: { 
          action: "create", 
          name: newInstanceName,
          manual_instance_number: newInstanceNumber.trim() || null,
          manual_device_label: newDeviceLabel.trim() || null,
          display_name_for_team: newDisplayNameForTeam.trim() || null,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Erro ao criar instância");
      }

      // Salvar QR code em memória se retornou
      if (data?.qr_code_base64 && data?.instance?.id) {
        setQrCodesMap(prev => ({
          ...prev,
          [data.instance.id]: data.qr_code_base64
        }));
      }

      toast({ 
        title: "Instância criada!", 
        description: "Escaneie o QR Code para conectar",
      });

      setShowCreateDialog(false);
      setNewInstanceName("");
      setNewInstanceNumber("");
      setNewDeviceLabel("");
      setNewDisplayNameForTeam("");
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleGetQRCode = async (instance: EvolutionInstance) => {
    if (instance.is_connected) {
      toast({ title: "WhatsApp já está conectado!" });
      return;
    }

    setIsGeneratingQR(instance.id);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "get_qr", instanceId: instance.id },
      });

      if (error) throw error;

      if (data?.qr_code_base64) {
        // Salvar QR code em memória (não no banco)
        setQrCodesMap(prev => ({
          ...prev,
          [instance.id]: data.qr_code_base64
        }));
        toast({ title: "QR Code atualizado!", description: "Escaneie com seu WhatsApp" });
      } else {
        toast({ 
          title: "Aguarde", 
          description: "QR Code está sendo gerado...",
        });
      }

      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao gerar QR Code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(null);
    }
  };

  const handleDisconnect = async (instance: EvolutionInstance) => {
    setIsGeneratingQR(instance.id);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "logout", instanceId: instance.id },
      });

      if (error) throw error;

      toast({ 
        title: "WhatsApp desconectado", 
        description: "Clique em 'Gerar QR Code' para reconectar",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(null);
    }
  };

  const handleDeleteInstance = async () => {
    if (!deleteInstance) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "delete", instanceId: deleteInstance.id },
      });

      if (error) throw error;

      toast({ title: "Instância excluída com sucesso" });
      setDeleteInstance(null);
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir instância",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateInstanceName = async () => {
    if (!editNameInstance || !newInstanceNameEdit.trim()) return;
    
    setIsUpdatingName(true);
    try {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ 
          name: newInstanceNameEdit.trim(),
          manual_instance_number: newInstanceNumberEdit.trim() || null,
          manual_device_label: newDeviceLabelEdit.trim() || null,
          display_name_for_team: newDisplayNameForTeamEdit.trim() || null,
        })
        .eq("id", editNameInstance.id);

      if (error) throw error;

      toast({ 
        title: "Instância atualizada!", 
        description: `Informações da instância salvas com sucesso.`,
      });

      setEditNameInstance(null);
      setNewInstanceNameEdit("");
      setNewInstanceNumberEdit("");
      setNewDeviceLabelEdit("");
      setNewDisplayNameForTeamEdit("");
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const getStatusBadge = (instance: EvolutionInstance) => {
    const internalStatus = mapStatusToInternal(instance.status, instance.is_connected);
    
    switch (internalStatus) {
      case "connected":
        return <Badge className="bg-green-500">{STATUS_LABELS.connected}</Badge>;
      case "waiting_qr":
        return <Badge variant="secondary">{STATUS_LABELS.waiting_qr}</Badge>;
      case "error":
        return <Badge variant="destructive">{STATUS_LABELS.error}</Badge>;
      case "disconnected":
      default:
        return <Badge className="bg-yellow-500 text-yellow-900">{STATUS_LABELS.disconnected}</Badge>;
    }
  };

  // If viewing all conversations (todas as instâncias)
  if (viewAllConversations) {
    return (
      <Layout>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setViewAllConversations(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-green-500" />
                Todas as Conversas
              </h1>
              <p className="text-muted-foreground">
                Visualizando conversas de todas as instâncias
              </p>
            </div>
          </div>
          <WhatsAppChat onBack={() => setViewAllConversations(false)} />
        </div>
      </Layout>
    );
  }

  // If viewing chat for a specific instance
  if (selectedInstance) {
    return (
      <Layout>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedInstance(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-green-500" />
                {selectedInstance.name}
              </h1>
              <p className="text-muted-foreground">
                {selectedInstance.phone_number || "Conversas do WhatsApp"}
              </p>
            </div>
          </div>
          <WhatsAppChat instanceId={selectedInstance.id} onBack={() => setSelectedInstance(null)} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-green-500" />
              WhatsApp DMs
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie múltiplas instâncias do WhatsApp e atenda seus clientes
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => setViewAllConversations(true)}
              variant="outline"
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Ver Todas as Conversas
            </Button>
            
            <Button 
              onClick={() => navigate("/whatsapp/nps")}
              variant="outline"
              className="gap-2"
            >
              <Star className="h-4 w-4 text-amber-500" />
              Resultado NPS
            </Button>
            
            {canViewGlobalConfig && (
              <Button 
                onClick={() => navigate("/whatsapp/global-config")}
                variant="outline"
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4 text-primary" />
                Global Config
              </Button>
            )}
            
            <Button 
              onClick={() => setShowManualDialog(true)}
              variant="outline"
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Adicionar Manualmente
            </Button>

            <Button 
              onClick={() => setShowInstagramDialog(true)}
              variant="outline"
              className="gap-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white border-0 hover:opacity-90"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Conectar Instagram
            </Button>

            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Nova Instância
            </Button>
          </div>
        </div>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Nova Instância WhatsApp
              </DialogTitle>
              <DialogDescription>
                Crie uma nova instância para conectar um número de WhatsApp
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="instance-name">Nome da Instância *</Label>
                <Input
                  id="instance-name"
                  placeholder="Ex: vendas123 (sem espaços e acentos)"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Sem espaços, acentos ou caracteres especiais. Esse é o ID enviado para o Evolution.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="instance-number">Número da Instância</Label>
                <Input
                  id="instance-number"
                  placeholder="Ex: 5551998874646"
                  value={newInstanceNumber}
                  onChange={(e) => setNewInstanceNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Somente números. Exemplo: 5551998874646</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="device-label">Celular / Localização</Label>
                <Input
                  id="device-label"
                  placeholder="Ex: Celular verde, Mesa 3..."
                  value={newDeviceLabel}
                  onChange={(e) => setNewDeviceLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Informação para identificar o dispositivo.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="display-name-team">Nome que time vai ver no chat</Label>
                <Input
                  id="display-name-team"
                  placeholder="Ex: Vendas Principal, Suporte..."
                  value={newDisplayNameForTeam}
                  onChange={(e) => setNewDisplayNameForTeam(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Este nome será exibido no chat para identificar a instância.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreateInstance}
                disabled={!newInstanceName.trim() || isCreating}
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Instância
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Instance Dialog */}
        <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Adicionar Instância Existente
              </DialogTitle>
              <DialogDescription>
                Adicione uma instância que já existe no Evolution API. Útil para conectar instâncias já configuradas em outros sistemas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="manual-name">Nome da Instância *</Label>
                <Input
                  id="manual-name"
                  placeholder="Ex: vendas123 (sem espaço, sem acento)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Esse é o ID da instância no Evolution API (campo instanceName). Sem espaços e sem acentos.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manual-instance-number">Número da Instância</Label>
                <Input
                  id="manual-instance-number"
                  placeholder="Ex: 5551998874646"
                  value={manualInstanceNumber}
                  onChange={(e) => setManualInstanceNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Somente números. Exemplo: 5551998874646</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manual-device-label">Celular / Localização da Instância</Label>
                <Input
                  id="manual-device-label"
                  placeholder="Ex: Celular verde, Mesa 3..."
                  value={manualDeviceLabel}
                  onChange={(e) => setManualDeviceLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Informação para identificar onde está o celular físico.</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manual-display-name-team">Nome que time vai ver no chat</Label>
                <Input
                  id="manual-display-name-team"
                  placeholder="Ex: Vendas Principal, Suporte..."
                  value={manualDisplayNameForTeam}
                  onChange={(e) => setManualDisplayNameForTeam(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Este nome será exibido no chat para identificar a instância.</p>
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
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowManualDialog(false)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={async () => {
                  if (!manualName.trim()) {
                    toast({ title: "O nome da instância é obrigatório", variant: "destructive" });
                    return;
                  }
                  try {
                    await addManualInstance.mutateAsync({
                      name: manualName.trim(),
                      evolution_instance_id: manualName.trim(),
                      evolution_api_token: manualToken.trim() || undefined,
                      manual_instance_number: manualInstanceNumber.trim() || undefined,
                      manual_device_label: manualDeviceLabel.trim() || undefined,
                      display_name_for_team: manualDisplayNameForTeam.trim() || undefined,
                    });
                    setManualName("");
                    setManualInstanceId("");
                    setManualToken("");
                    setManualInstanceNumber("");
                    setManualDeviceLabel("");
                    setManualDisplayNameForTeam("");
                    setShowManualDialog(false);
                    refetch();
                  } catch (e: any) {
                    toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" });
                  }
                }}
                disabled={!manualName.trim() || addManualInstance.isPending}
              >
                {addManualInstance.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar Instância
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground mr-2">Filtros:</span>
          
          {/* Status Filter */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            <Button
              variant={statusFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="h-7 px-3 text-xs"
            >
              Todas
              <Badge variant="outline" className="ml-1.5 h-5 px-1.5">
                {instances?.length || 0}
              </Badge>
            </Button>
            <Button
              variant={statusFilter === "connected" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("connected")}
              className="h-7 px-3 text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              Conectadas
              <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-green-600">
                {instances?.filter(i => i.is_connected).length || 0}
              </Badge>
            </Button>
            <Button
              variant={statusFilter === "disconnected" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("disconnected")}
              className="h-7 px-3 text-xs"
            >
              <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5" />
              Desconectadas
              <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-yellow-600">
                {instances?.filter(i => !i.is_connected).length || 0}
              </Badge>
            </Button>
          </div>
          
          {/* Channel Filter */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            <Button
              variant={channelFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChannelFilter("all")}
              className="h-7 px-3 text-xs"
            >
              Todos Canais
            </Button>
            <Button
              variant={channelFilter === "whatsapp" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChannelFilter("whatsapp")}
              className="h-7 px-3 text-xs"
            >
              <MessageSquare className="w-3 h-3 mr-1.5 text-green-500" />
              WhatsApp
              <Badge variant="outline" className="ml-1.5 h-5 px-1.5">
                {instances?.filter(i => (i as any).channel_type !== 'instagram').length || 0}
              </Badge>
            </Button>
            <Button
              variant={channelFilter === "instagram" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChannelFilter("instagram")}
              className="h-7 px-3 text-xs bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-400/10"
            >
              <svg className="w-3 h-3 mr-1.5 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
              <Badge variant="outline" className="ml-1.5 h-5 px-1.5">
                {instances?.filter(i => (i as any).channel_type === 'instagram').length || 0}
              </Badge>
            </Button>
          </div>
        </div>

        {/* Instances List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : instances?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Nenhuma instância criada</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Crie uma instância do WhatsApp para começar a atender seus clientes diretamente pelo CRM.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeira Instância
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances
              ?.filter(instance => {
                // Status filter
                if (statusFilter === "connected" && !instance.is_connected) return false;
                if (statusFilter === "disconnected" && instance.is_connected) return false;
                
                // Channel filter
                const channelType = (instance as any).channel_type || 'whatsapp';
                if (channelFilter === "whatsapp" && channelType === 'instagram') return false;
                if (channelFilter === "instagram" && channelType !== 'instagram') return false;
                
                return true;
              })
              .map((instance) => {
              const internalStatus = mapStatusToInternal(instance.status, instance.is_connected);
              const channelType = (instance as any).channel_type || 'whatsapp';
              const isInstagram = channelType === 'instagram';
              
              return (
                <Card key={instance.id} className={`relative overflow-hidden ${isInstagram ? 'ring-1 ring-pink-500/30' : ''}`}>
                  {/* Channel indicator bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${isInstagram ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400' : 'bg-green-500'}`} />
                  
                  <CardHeader className="pb-3 pt-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {isInstagram ? (
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                              </svg>
                            </div>
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                              <MessageSquare className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                          <CardTitle className="text-lg">{instance.name}</CardTitle>
                        </div>
                        {getStatusBadge(instance)}
                      </div>
                      
                      {/* Phone Number Display */}
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        {/* Número da Instância */}
                        <div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Número da instância:</span>
                          </div>
                          {(instance.manual_instance_number || instance.phone_number) ? (
                            <p className="text-base font-semibold font-mono">
                              +{instance.manual_instance_number || instance.phone_number}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              Nenhum número cadastrado
                            </p>
                          )}
                        </div>

                        {/* Celular / Dispositivo */}
                        {instance.manual_device_label && (
                          <div>
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Dispositivo:</span>
                            </div>
                            <p className="text-sm font-medium">
                              {instance.manual_device_label}
                            </p>
                          </div>
                        )}
                        
                        {/* Nome que time vai ver no chat */}
                        {instance.display_name_for_team && (
                          <div>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Nome no chat:</span>
                            </div>
                            <p className="text-sm font-medium">
                              {instance.display_name_for_team}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* QR Code Area - só mostra se NÃO conectado */}
                    {!instance.is_connected && (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        {(qrCodesMap[instance.id] || instance.qr_code_base64) ? (
                          <div className="space-y-3">
                            <div className="bg-white p-3 rounded-lg inline-block mx-auto">
                              <img 
                                src={(() => {
                                  const qr = qrCodesMap[instance.id] || instance.qr_code_base64;
                                  if (!qr) return '';
                                  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
                                })()}
                                alt="QR Code"
                                className="w-48 h-48"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Escaneie o QR Code com o WhatsApp
                            </p>
                            
                            <div className="flex gap-2 justify-center flex-wrap">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleGetQRCode(instance)}
                                disabled={isGeneratingQR === instance.id}
                              >
                                {isGeneratingQR === instance.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Atualizar QR
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => checkInstanceStatus(instance.id)}
                                disabled={isCheckingStatus === instance.id}
                              >
                                {isCheckingStatus === instance.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Check className="h-4 w-4 mr-2" />
                                )}
                                Verificar Status
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 py-4">
                            <QrCode className="h-12 w-12 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Clique para gerar o QR Code
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleGetQRCode(instance)}
                              disabled={isGeneratingQR === instance.id}
                            >
                              {isGeneratingQR === instance.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <QrCode className="h-4 w-4 mr-2" />
                              )}
                              Gerar QR Code
                            </Button>
                          </div>
                        )}
                        
                        {/* Botões de Editar Nome */}
                        <div className="flex gap-2 justify-center flex-wrap mt-3 pt-3 border-t border-border/50">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditNameInstance(instance);
                              setNewInstanceNameEdit(instance.name);
                              setNewInstanceNumberEdit(instance.manual_instance_number || "");
                              setNewDeviceLabelEdit(instance.manual_device_label || "");
                              setNewDisplayNameForTeamEdit(instance.display_name_for_team || "");
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDeleteInstance(instance)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Connected state */}
                    {internalStatus === "connected" && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center space-y-3">
                        <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
                        <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                          WhatsApp conectado e funcionando!
                        </p>
                        <div className="flex gap-2 justify-center flex-wrap">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditNameInstance(instance);
                              setNewInstanceNameEdit(instance.name);
                              setNewInstanceNumberEdit(instance.manual_instance_number || "");
                              setNewDeviceLabelEdit(instance.manual_device_label || "");
                              setNewDisplayNameForTeamEdit(instance.display_name_for_team || "");
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDisconnect(instance)}
                            disabled={isGeneratingQR === instance.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {isGeneratingQR === instance.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Unplug className="h-4 w-4 mr-2" />
                            )}
                            Desconectar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2" 
                        size="sm"
                        onClick={() => setPermissionsInstance(instance)}
                      >
                        <Users className="h-4 w-4" />
                        Permissões
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEvolutionSettingsInstance(instance)}
                        title="Configurações do WhatsApp (Evolution)"
                      >
                        <Cog className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Botão de conversas */}
                    <Button 
                      className="w-full gap-2" 
                      variant={instance.is_connected ? "default" : "outline"}
                      onClick={() => setSelectedInstance(instance)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {instance.is_connected ? "Abrir Conversas" : "Ver Histórico de Conversas"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {/* Add new instance card */}
            {isAdmin && (
              <Card 
                className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setShowCreateDialog(true)}
              >
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground">
                  <Plus className="h-12 w-12 mb-4" />
                  <p className="font-medium">Nova Instância</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Features Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50">
            <CardContent className="pt-6">
              <MessageSquare className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-semibold mb-1">Multi-Atendimento</h3>
              <p className="text-sm text-muted-foreground">
                Vários atendentes podem usar o mesmo WhatsApp simultaneamente
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200/50">
            <CardContent className="pt-6">
              <Users className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold mb-1">Vincule a Leads</h3>
              <p className="text-sm text-muted-foreground">
                Associe conversas aos seus leads e veja informações do cliente
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200/50">
            <CardContent className="pt-6">
              <Settings className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="font-semibold mb-1">Robô Inteligente</h3>
              <p className="text-sm text-muted-foreground">
                Configure um assistente IA para atender automaticamente
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Permissions Dialog */}
        {permissionsInstance && (
          <InstancePermissions
            instanceId={permissionsInstance.id}
            instanceName={permissionsInstance.name}
            open={!!permissionsInstance}
            onOpenChange={(open) => !open && setPermissionsInstance(null)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteInstance} onOpenChange={(open) => !open && setDeleteInstance(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir instância?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a instância "{deleteInstance?.name}"?
                Esta ação não pode ser desfeita e você perderá todo o histórico de conversas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteInstance}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Instance Dialog */}
        <Dialog open={!!editNameInstance} onOpenChange={(open) => !open && setEditNameInstance(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar Instância
              </DialogTitle>
              <DialogDescription>
                Altere as informações desta instância do WhatsApp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Instância *</Label>
                <Input
                  placeholder="Ex: vendas123"
                  value={newInstanceNameEdit}
                  onChange={(e) => setNewInstanceNameEdit(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Número da Instância</Label>
                <Input
                  placeholder="Ex: 5551998874646"
                  value={newInstanceNumberEdit}
                  onChange={(e) => setNewInstanceNumberEdit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Somente números. Exemplo: 5551998874646</p>
              </div>
              
              <div className="space-y-2">
                <Label>Celular / Localização</Label>
                <Input
                  placeholder="Ex: Celular verde, Mesa 3..."
                  value={newDeviceLabelEdit}
                  onChange={(e) => setNewDeviceLabelEdit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Informação para identificar o dispositivo.</p>
              </div>
              
              <div className="space-y-2">
                <Label>Nome que time vai ver no chat</Label>
                <Input
                  placeholder="Ex: Vendas Principal, Suporte..."
                  value={newDisplayNameForTeamEdit}
                  onChange={(e) => setNewDisplayNameForTeamEdit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Este nome será exibido no chat para identificar a instância.</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setEditNameInstance(null)}
                disabled={isUpdatingName}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUpdateInstanceName}
                disabled={!newInstanceNameEdit.trim() || isUpdatingName}
              >
                {isUpdatingName && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Configurações do Evolution */}
        {evolutionSettingsInstance && (
          <EvolutionSettingsDialog
            instanceId={evolutionSettingsInstance.id}
            instanceName={evolutionSettingsInstance.name}
            open={!!evolutionSettingsInstance}
            onOpenChange={(open) => {
              if (!open) setEvolutionSettingsInstance(null);
            }}
          />
        )}

        {/* Dialog Conectar Instagram */}
        <Dialog open={showInstagramDialog} onOpenChange={setShowInstagramDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
                Conectar Instagram Business
              </DialogTitle>
              <DialogDescription>
                Conecte sua conta Instagram Business para receber e responder DMs diretamente no chat.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome para identificar</Label>
                <Input
                  placeholder="Ex: Instagram Vendas, Suporte IG..."
                  value={instagramName}
                  onChange={(e) => setInstagramName(e.target.value)}
                />
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <strong>Requisitos:</strong>
                    <ul className="list-disc list-inside mt-1">
                      <li>Conta Instagram Business ou Creator</li>
                      <li>Página do Facebook vinculada</li>
                      <li>Acesso de admin à página</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={async () => {
                  if (!instagramName.trim()) {
                    toast({ title: "Digite um nome para identificar a conta", variant: "destructive" });
                    return;
                  }
                  setIsCreatingInstagram(true);
                  try {
                    await createInstagramInstance.mutateAsync({ name: instagramName.trim() });
                    setShowInstagramDialog(false);
                    setInstagramName("");
                    toast({ title: "Instagram configurado!", description: "Conecte-se na janela que será aberta." });
                    refetch();
                  } catch (error: any) {
                    toast({ title: "Erro ao conectar Instagram", description: error.message, variant: "destructive" });
                  } finally {
                    setIsCreatingInstagram(false);
                  }
                }}
                disabled={isCreatingInstagram || !instagramName.trim()}
                className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90"
              >
                {isCreatingInstagram ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Conectar com Facebook
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
