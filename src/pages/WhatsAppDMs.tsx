import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Plus, QrCode, Settings, Users, Check, X, Loader2, Tag, ArrowLeft, RefreshCw, Unplug, Globe, Phone, Smartphone, Clock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWhatsAppInstances, useValidateCoupon, useCreateWhatsAppInstance, useOrganizationWhatsAppCredits, useUpdateWhatsAppInstance, DiscountCoupon, WhatsAppInstance } from "@/hooks/useWhatsAppInstances";
import { useOrganizationWhatsAppProviders, PROVIDER_PRICES, DEFAULT_PROVIDER, type WhatsAppProvider } from "@/hooks/useWhatsAppProviders";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppChat } from "@/components/whatsapp/WhatsAppChat";
import { InstancePermissions } from "@/components/whatsapp/InstancePermissions";

// Status mapping for human-readable display
type InstanceStatus = "connected" | "waiting_qr" | "disconnected" | "logged_out" | "error";

const STATUS_LABELS: Record<InstanceStatus, string> = {
  connected: "Conectado",
  waiting_qr: "Aguardando QR",
  disconnected: "Desconectado",
  logged_out: "Sessão expirada",
  error: "Erro",
};

const mapStatusToInternal = (status: string, isConnected: boolean): InstanceStatus => {
  if (isConnected) return "connected";
  if (status === "pending") return "waiting_qr";
  if (status === "active" && !isConnected) return "disconnected";
  if (status === "disconnected") return "disconnected";
  if (status === "logged_out") return "logged_out";
  if (status === "error") return "error";
  return "disconnected";
};

export default function WhatsAppDMs() {
  const { profile, isAdmin, user } = useAuth();
  const { data: instances, isLoading, refetch } = useWhatsAppInstances();
  const { data: credits } = useOrganizationWhatsAppCredits();
  const { data: enabledProviders } = useOrganizationWhatsAppProviders();
  const validateCoupon = useValidateCoupon();
  const createInstance = useCreateWhatsAppInstance();
  const updateInstance = useUpdateWhatsAppInstance();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState<string | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<string | null>(null);
  const [permissionsInstance, setPermissionsInstance] = useState<WhatsAppInstance | null>(null);
  
  // WasenderAPI phone number dialog
  const [phoneDialogInstance, setPhoneDialogInstance] = useState<WhatsAppInstance | null>(null);
  const [wasenderPhoneNumber, setWasenderPhoneNumber] = useState("");
  const [wasenderCountryCode, setWasenderCountryCode] = useState("55");
  const [wasenderSessionName, setWasenderSessionName] = useState("");
  
  // Change phone number dialog
  const [changePhoneInstance, setChangePhoneInstance] = useState<WhatsAppInstance | null>(null);
  const [isChangingPhone, setIsChangingPhone] = useState(false);

  // Polling and auto-refresh state
  const [lastStatusCheck, setLastStatusCheck] = useState<Record<string, Date>>({});
  const [qrRefreshCount, setQrRefreshCount] = useState<Record<string, number>>({});
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if master admin
  const isMasterAdmin = user?.email === "thiago.morphews@gmail.com";

  // Get price for provider (always wasenderapi now)
  const getProviderPrice = () => {
    const orgProvider = enabledProviders?.find(p => p.provider === "wasenderapi");
    return orgProvider?.price_cents ?? PROVIDER_PRICES.wasenderapi;
  };

  const currentPrice = getProviderPrice();

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  // Polling logic for status checks (every 8-10 seconds for non-connected instances)
  const checkInstanceStatus = useCallback(async (instance: WhatsAppInstance) => {
    if (!instance.wasender_api_key) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "status", instanceId: instance.id },
      });

      if (error) {
        console.error("Status check error:", error);
        return;
      }

      setLastStatusCheck(prev => ({ ...prev, [instance.id]: new Date() }));

      // If was disconnected but now connected, stop polling for this instance
      if (data?.isConnected && !instance.is_connected) {
        toast({ title: "WhatsApp conectado!", description: `Número: ${data.phoneNumber || "Desconhecido"}` });
        refetch();
      }
      
      // If was connected but now disconnected, try auto-restart once
      if (!data?.isConnected && instance.is_connected) {
        console.log("Connection lost, attempting restart...");
        try {
          await supabase.functions.invoke("wasenderapi-instance-manager", {
            body: { action: "restart", instanceId: instance.id },
          });
          refetch();
        } catch (e) {
          console.error("Auto-restart failed:", e);
        }
      }
    } catch (e) {
      console.error("Status polling error:", e);
    }
  }, [refetch]);

  // Auto-refresh QR code (every 30-40 seconds, max 3 times)
  const refreshQRCode = useCallback(async (instance: WhatsAppInstance) => {
    const refreshCount = qrRefreshCount[instance.id] || 0;
    
    if (refreshCount >= 3) {
      console.log("Max QR refresh attempts reached for", instance.id);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "refresh_qr", instanceId: instance.id },
      });

      if (error) throw error;

      setQrRefreshCount(prev => ({ ...prev, [instance.id]: refreshCount + 1 }));
      
      if (data?.qrCode) {
        refetch();
      }
    } catch (e) {
      console.error("QR refresh error:", e);
    }
  }, [qrRefreshCount, refetch]);

  // Setup polling for non-connected instances
  useEffect(() => {
    const disconnectedInstances = instances?.filter(
      i => !i.is_connected && i.wasender_api_key
    ) || [];

    if (disconnectedInstances.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Poll every 8 seconds
    pollingIntervalRef.current = setInterval(() => {
      disconnectedInstances.forEach(instance => {
        checkInstanceStatus(instance);
      });
    }, 8000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [instances, checkInstanceStatus]);

  // Setup QR auto-refresh for waiting_qr instances
  useEffect(() => {
    const waitingQrInstances = instances?.filter(
      i => !i.is_connected && i.qr_code_base64 && i.status === "pending"
    ) || [];

    if (waitingQrInstances.length === 0) {
      if (qrRefreshIntervalRef.current) {
        clearInterval(qrRefreshIntervalRef.current);
        qrRefreshIntervalRef.current = null;
      }
      return;
    }

    // Refresh QR every 35 seconds
    qrRefreshIntervalRef.current = setInterval(() => {
      waitingQrInstances.forEach(instance => {
        if ((qrRefreshCount[instance.id] || 0) < 3) {
          refreshQRCode(instance);
        }
      });
    }, 35000);

    return () => {
      if (qrRefreshIntervalRef.current) {
        clearInterval(qrRefreshIntervalRef.current);
      }
    };
  }, [instances, qrRefreshCount, refreshQRCode]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setIsValidatingCoupon(true);
    try {
      const coupon = await validateCoupon.mutateAsync(couponCode);
      setAppliedCoupon(coupon);
      toast({ title: "Cupom aplicado!", description: `Desconto de ${formatPrice(coupon.discount_value_cents)}` });
    } catch (error) {
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const finalPrice = appliedCoupon 
    ? Math.max(0, currentPrice - appliedCoupon.discount_value_cents)
    : currentPrice;

  const freeInstancesAvailable = (credits?.free_instances_count || 0) - (instances?.filter(i => i.payment_source === "admin_grant").length || 0);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast({ title: "Digite um nome para a instância", variant: "destructive" });
      return;
    }

    try {
      const instance = await createInstance.mutateAsync({
        name: newInstanceName,
        couponId: appliedCoupon?.id,
        discountCents: appliedCoupon?.discount_value_cents,
        provider: DEFAULT_PROVIDER,
        priceCents: currentPrice,
      });
      
      setShowCreateDialog(false);
      setNewInstanceName("");
      setCouponCode("");
      setAppliedCoupon(null);

      // If there are free credits available or coupon covers full price, activate directly
      if (freeInstancesAvailable > 0 || finalPrice === 0) {
        toast({ 
          title: "Instância criada!", 
          description: "Agora gere o QR Code para conectar.",
        });
        return;
      }

      // Otherwise, redirect to Stripe checkout
      const { data, error } = await supabase.functions.invoke("whatsapp-instance-checkout", {
        body: {
          instanceId: instance.id,
          couponId: appliedCoupon?.id,
          discountCents: appliedCoupon?.discount_value_cents,
          successUrl: `${window.location.origin}/whatsapp-dms?success=true`,
          cancelUrl: `${window.location.origin}/whatsapp-dms`,
          priceCents: currentPrice,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.success) {
        toast({ title: "Instância ativada!", description: data.message });
        refetch();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateQRCode = async (instance: WhatsAppInstance) => {
    const needsSession = !instance.wasender_session_id || !instance.wasender_api_key;
    
    if (needsSession) {
      // Open dialog to get phone number and session name first
      setPhoneDialogInstance(instance);
      setWasenderPhoneNumber("");
      setWasenderCountryCode("55");
      setWasenderSessionName(instance.name || "");
      return;
    }
    
    // Proceed with connection
    await executeConnect(instance);
  };

  const executeConnect = async (instance: WhatsAppInstance, phoneNumber?: string, sessionName?: string) => {
    setIsGeneratingQR(instance.id);
    setQrRefreshCount(prev => ({ ...prev, [instance.id]: 0 })); // Reset refresh count
    
    try {
      const needsSession = !instance.wasender_session_id || !instance.wasender_api_key;

      if (needsSession) {
        if (!phoneNumber) {
          toast({ 
            title: "Telefone obrigatório", 
            description: "Por favor, informe o número de telefone para criar a sessão",
            variant: "destructive",
          });
          setIsGeneratingQR(null);
          return;
        }

        toast({ 
          title: "Criando sessão WhatsApp...", 
          description: "Aguarde enquanto configuramos sua instância automaticamente",
        });

        const { data: createData, error: createError } = await supabase.functions.invoke("wasenderapi-instance-manager", {
          body: { 
            action: "create_wasender_session", 
            instanceId: instance.id, 
            phoneNumber,
            sessionName: sessionName || instance.name,
          },
        });

        if (createError) throw createError;

        if (!createData?.success) {
          toast({
            title: "Erro ao criar sessão",
            description: createData?.message || "Não foi possível criar a sessão automaticamente",
            variant: "destructive",
          });
          setIsGeneratingQR(null);
          return;
        }

        // If QR code was returned with the create response, we're done
        if (createData?.qrCode) {
          toast({ title: "QR Code gerado!", description: "Escaneie com seu WhatsApp" });
          refetch();
          setIsGeneratingQR(null);
          return;
        }

        toast({ title: "Sessão criada!", description: "Obtendo QR Code..." });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Connect session to get QR code
      const { data: connectData, error: connectError } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "connect", instanceId: instance.id },
      });

      if (connectError) throw connectError;

      if (connectData?.qrCode) {
        toast({ title: "QR Code gerado!", description: "Escaneie com seu WhatsApp" });
      } else if (connectData?.needsQr) {
        // Try refresh_qr
        const { data: qrData } = await supabase.functions.invoke("wasenderapi-instance-manager", {
          body: { action: "refresh_qr", instanceId: instance.id },
        });
        
        if (qrData?.qrCode) {
          toast({ title: "QR Code gerado!", description: "Escaneie com seu WhatsApp" });
        }
      } else if (connectData?.isConnected) {
        toast({ title: "Já conectado!", description: `Número: ${connectData.phoneNumber}` });
      }

      refetch();
    } catch (error: any) {
      console.error("Error generating QR code:", error);
      toast({
        title: "Erro ao gerar QR Code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(null);
    }
  };

  const handleManualQRRefresh = async (instance: WhatsAppInstance) => {
    setIsGeneratingQR(instance.id);
    setQrRefreshCount(prev => ({ ...prev, [instance.id]: 0 })); // Reset count on manual refresh
    
    try {
      const { data, error } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "refresh_qr", instanceId: instance.id },
      });

      if (error) throw error;

      if (data?.qrCode) {
        toast({ title: "QR Code atualizado!", description: "Escaneie com seu WhatsApp" });
      } else {
        toast({ 
          title: "Não foi possível atualizar", 
          description: "Tente novamente em alguns segundos",
          variant: "destructive",
        });
      }

      refetch();
    } catch (error: any) {
      console.error("Error refreshing QR:", error);
      toast({
        title: "Erro ao atualizar QR Code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(null);
    }
  };

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    setIsGeneratingQR(instance.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "disconnect", instanceId: instance.id },
      });

      if (error) throw error;

      toast({ 
        title: "WhatsApp desconectado", 
        description: "Clique em 'Reconectar' para gerar novo QR Code",
      });
      refetch();
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Erro ao desconectar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(null);
    }
  };

  const handleCheckConnection = async (instance: WhatsAppInstance) => {
    setIsCheckingConnection(instance.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "status", instanceId: instance.id },
      });

      if (error) throw error;

      setLastStatusCheck(prev => ({ ...prev, [instance.id]: new Date() }));

      if (data?.isConnected) {
        toast({ title: "WhatsApp conectado!", description: `Número: ${data.phoneNumber}` });
      } else {
        toast({ title: "Não conectado", description: data?.status ? STATUS_LABELS[data.status as InstanceStatus] || data.status : "Escaneie o QR Code para conectar" });
      }

      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao verificar conexão",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingConnection(null);
    }
  };

  const handleChangePhoneNumber = async (instance: WhatsAppInstance, newPhone: string) => {
    setIsChangingPhone(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("wasenderapi-instance-manager", {
        body: { action: "change_phone_number", instanceId: instance.id, phoneNumber: newPhone },
      });

      if (error) throw error;

      toast({ 
        title: "Número atualizado!", 
        description: "Escaneie o QR Code com o novo telefone",
      });

      setChangePhoneInstance(null);
      setWasenderPhoneNumber("");
      setWasenderCountryCode("55");
      refetch();
    } catch (error: any) {
      console.error("Error changing phone:", error);
      toast({
        title: "Erro ao trocar número",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPhone(false);
    }
  };

  const getStatusBadge = (instance: WhatsAppInstance) => {
    const internalStatus = mapStatusToInternal(instance.status, instance.is_connected);
    
    switch (internalStatus) {
      case "connected":
        return <Badge className="bg-green-500">{STATUS_LABELS.connected}</Badge>;
      case "waiting_qr":
        return <Badge variant="secondary">{STATUS_LABELS.waiting_qr}</Badge>;
      case "logged_out":
        return <Badge variant="destructive">{STATUS_LABELS.logged_out}</Badge>;
      case "error":
        return <Badge variant="destructive">{STATUS_LABELS.error}</Badge>;
      case "disconnected":
      default:
        return <Badge className="bg-yellow-500 text-yellow-900">{STATUS_LABELS.disconnected}</Badge>;
    }
  };

  const getLastCheckTime = (instanceId: string) => {
    const lastCheck = lastStatusCheck[instanceId];
    if (!lastCheck) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - lastCheck.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) return `${diffSeconds}s atrás`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    return `${diffMinutes}min atrás`;
  };

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

          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            Contratar WhatsApp
            <Badge variant="secondary" className="ml-1 text-xs bg-green-800 text-white">
              {formatPrice(PROVIDER_PRICES.wasenderapi)}/mês
            </Badge>
          </Button>
        </div>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-600" />
                Contratar WhatsApp
              </DialogTitle>
              <DialogDescription>
                Cada instância permite conectar um número de WhatsApp
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="instance-name">Nome da Instância *</Label>
                <Input
                  id="instance-name"
                  placeholder="Ex: Atendimento Principal"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                />
              </div>

              {/* Pricing */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <span className={appliedCoupon ? "line-through text-muted-foreground" : "font-semibold"}>
                    {formatPrice(currentPrice)}
                  </span>
                </div>

                {appliedCoupon && (
                  <>
                    <div className="flex justify-between items-center text-green-600">
                      <span className="flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        Desconto ({appliedCoupon.code}):
                      </span>
                      <span>-{formatPrice(appliedCoupon.discount_value_cents)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-lg text-green-600">
                        {formatPrice(finalPrice)}/mês
                      </span>
                    </div>
                  </>
                )}

                {freeInstancesAvailable > 0 && (
                  <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    🎁 Você tem {freeInstancesAvailable} instância(s) gratuita(s) disponível(is)!
                  </div>
                )}
              </div>

              {/* Coupon */}
              <div className="space-y-2">
                <Label htmlFor="coupon">Cupom de Desconto</Label>
                <div className="flex gap-2">
                  <Input
                    id="coupon"
                    placeholder="Digite o cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={!!appliedCoupon}
                  />
                  {appliedCoupon ? (
                    <Button variant="outline" size="icon" onClick={handleRemoveCoupon}>
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={handleValidateCoupon}
                      disabled={!couponCode.trim() || isValidatingCoupon}
                    >
                      {isValidatingCoupon ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                {appliedCoupon && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Cupom aplicado!
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreateInstance}
                disabled={!newInstanceName.trim() || createInstance.isPending}
              >
                {createInstance.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {freeInstancesAvailable > 0 || finalPrice === 0 ? "Criar Grátis" : "Ir para Pagamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
              <h2 className="text-xl font-semibold mb-2">Nenhuma instância contratada</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Contrate uma instância do WhatsApp para começar a atender seus clientes diretamente pelo CRM.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Contratar Primeira Instância
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances?.map((instance) => {
              const internalStatus = mapStatusToInternal(instance.status, instance.is_connected);
              const qrExhausted = (qrRefreshCount[instance.id] || 0) >= 3;
              const lastCheck = getLastCheckTime(instance.id);
              
              return (
                <Card key={instance.id} className="relative overflow-hidden">
                  <CardHeader className="pb-3 pt-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{instance.name}</CardTitle>
                        {getStatusBadge(instance)}
                      </div>
                      
                      {/* Phone Number Display */}
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Número conectado:</span>
                        </div>
                        {instance.phone_number ? (
                          <p className="text-base font-semibold font-mono">
                            {instance.phone_number}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Nenhum número conectado ainda
                          </p>
                        )}
                      </div>
                      
                      {/* Last status check */}
                      {lastCheck && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Última verificação: {lastCheck}
                        </div>
                      )}
                      
                      <Badge variant="outline" className="text-xs">
                        {formatPrice(instance.monthly_price_cents || getProviderPrice())}/mês
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* QR Code Area - Show when not connected */}
                    {internalStatus !== "connected" && (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        {instance.qr_code_base64 ? (
                          <div className="space-y-3">
                            <div className="bg-white p-3 rounded-lg inline-block mx-auto">
                              <QRCodeSVG 
                                value={instance.qr_code_base64} 
                                size={192}
                                level="M"
                                includeMargin={false}
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Escaneie o QR Code com o WhatsApp
                            </p>
                            
                            {qrExhausted ? (
                              <div className="space-y-2">
                                <p className="text-xs text-amber-600">
                                  QR expirou. Clique para atualizar.
                                </p>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleManualQRRefresh(instance)}
                                  disabled={isGeneratingQR === instance.id}
                                >
                                  {isGeneratingQR === instance.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  Atualizar QR Code
                                </Button>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Atualização automática em {35 - ((qrRefreshCount[instance.id] || 0) * 35 % 35)}s
                              </p>
                            )}
                            
                            <div className="flex gap-2 justify-center flex-wrap">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleManualQRRefresh(instance)}
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
                                onClick={() => handleCheckConnection(instance)}
                                disabled={isCheckingConnection === instance.id}
                              >
                                {isCheckingConnection === instance.id ? (
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
                              {instance.wasender_session_id 
                                ? "Reconecte para gerar novo QR Code" 
                                : "Clique para gerar o QR Code"}
                            </p>
                            <div className="flex gap-2 justify-center flex-wrap">
                              {instance.wasender_session_id ? (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => executeConnect(instance)}
                                  disabled={isGeneratingQR === instance.id}
                                >
                                  {isGeneratingQR === instance.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  Reconectar
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleGenerateQRCode(instance)}
                                  disabled={isGeneratingQR === instance.id}
                                >
                                  {isGeneratingQR === instance.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  Gerar QR Code
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
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
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setChangePhoneInstance(instance);
                              setWasenderPhoneNumber("");
                              setWasenderCountryCode("55");
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Trocar Número
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
                    </div>

                    {instance.is_connected && (
                      <Button 
                        className="w-full gap-2" 
                        variant="default"
                        onClick={() => setSelectedInstance(instance)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Abrir Conversas
                      </Button>
                    )}
                  </CardContent>

                  {/* Price badge */}
                  <div className="absolute top-2 right-2">
                    {instance.payment_source === "admin_grant" ? (
                      <Badge variant="secondary" className="text-xs">Cortesia</Badge>
                    ) : instance.discount_applied_cents && instance.discount_applied_cents > 0 ? (
                      <Badge className="bg-green-500 text-xs">
                        {formatPrice(instance.monthly_price_cents - instance.discount_applied_cents)}/mês
                      </Badge>
                    ) : null}
                  </div>
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
                  <p className="font-medium">Contratar Nova Instância</p>
                  <p className="text-sm">{formatPrice(PROVIDER_PRICES.wasenderapi)}/mês</p>
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

        {/* WasenderAPI Phone Number Dialog */}
        <Dialog open={!!phoneDialogInstance} onOpenChange={(open) => !open && setPhoneDialogInstance(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-600" />
                Configurar Sessão WhatsApp
              </DialogTitle>
              <DialogDescription>
                Informe os dados para criar a sessão do WhatsApp. 
                Após criar, você escaneará o QR Code para conectar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Sessão *</Label>
                <Input
                  placeholder="Ex: Atendimento Principal"
                  value={wasenderSessionName}
                  onChange={(e) => setWasenderSessionName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nome para identificar esta sessão (visível apenas para você)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Número do WhatsApp *</Label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded-md px-3 bg-muted/50">
                    <span className="text-lg">+</span>
                    <Input
                      className="w-14 border-0 p-0 bg-transparent focus-visible:ring-0"
                      placeholder="55"
                      value={wasenderCountryCode}
                      onChange={(e) => setWasenderCountryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                  <Input
                    className="flex-1"
                    placeholder="11999999999"
                    value={wasenderPhoneNumber}
                    onChange={(e) => setWasenderPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Exemplo para Brasil: +55 11 99999-9999 (digite sem espaços ou traços)
                </p>
              </div>

              {wasenderCountryCode && wasenderPhoneNumber && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Número formatado: </span>
                    <span className="font-mono font-medium">+{wasenderCountryCode}{wasenderPhoneNumber}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setPhoneDialogInstance(null)}
              >
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  if (!wasenderSessionName.trim()) {
                    toast({ 
                      title: "Nome obrigatório", 
                      description: "Preencha o nome da sessão",
                      variant: "destructive" 
                    });
                    return;
                  }
                  if (!wasenderCountryCode || !wasenderPhoneNumber) {
                    toast({ 
                      title: "Telefone obrigatório", 
                      description: "Preencha o código do país e o número de telefone",
                      variant: "destructive" 
                    });
                    return;
                  }
                  
                  const fullPhone = `+${wasenderCountryCode}${wasenderPhoneNumber}`;
                  const sessionNameToUse = wasenderSessionName.trim();
                  setPhoneDialogInstance(null);
                  
                  if (phoneDialogInstance) {
                    await executeConnect(phoneDialogInstance, fullPhone, sessionNameToUse);
                  }
                }}
                disabled={!wasenderSessionName.trim() || !wasenderCountryCode || !wasenderPhoneNumber}
              >
                Criar Sessão e Gerar QR Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Phone Number Dialog */}
        <Dialog open={!!changePhoneInstance} onOpenChange={(open) => !open && setChangePhoneInstance(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-600" />
                Trocar Número de Telefone
              </DialogTitle>
              <DialogDescription>
                Para trocar o número, a sessão atual será desconectada e você precisará escanear um novo QR Code com o novo telefone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {changePhoneInstance?.phone_number && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Número atual:</p>
                  <p className="font-mono font-semibold">{changePhoneInstance.phone_number}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Novo Número do WhatsApp *</Label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1 border rounded-md px-3 bg-muted/50">
                    <span className="text-lg">+</span>
                    <Input
                      className="w-14 border-0 p-0 bg-transparent focus-visible:ring-0"
                      placeholder="55"
                      value={wasenderCountryCode}
                      onChange={(e) => setWasenderCountryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                  <Input
                    className="flex-1"
                    placeholder="11999999999"
                    value={wasenderPhoneNumber}
                    onChange={(e) => setWasenderPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>

              {wasenderCountryCode && wasenderPhoneNumber && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Novo número: </span>
                    <span className="font-mono font-medium">+{wasenderCountryCode}{wasenderPhoneNumber}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setChangePhoneInstance(null)}
                disabled={isChangingPhone}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  if (!wasenderCountryCode || !wasenderPhoneNumber) {
                    toast({ 
                      title: "Telefone obrigatório", 
                      description: "Preencha o código do país e o número de telefone",
                      variant: "destructive" 
                    });
                    return;
                  }
                  
                  if (changePhoneInstance) {
                    const fullPhone = `+${wasenderCountryCode}${wasenderPhoneNumber}`;
                    handleChangePhoneNumber(changePhoneInstance, fullPhone);
                  }
                }}
                disabled={!wasenderCountryCode || !wasenderPhoneNumber || isChangingPhone}
              >
                {isChangingPhone ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Trocar e Gerar QR Code
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
