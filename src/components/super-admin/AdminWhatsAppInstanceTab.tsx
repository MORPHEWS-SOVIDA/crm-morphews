import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Phone, 
  QrCode, 
  RefreshCw, 
  Save,
  MessageSquare,
  Settings,
  Wifi,
  WifiOff
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface AdminInstanceConfig {
  instance_name: string;
  api_url: string;
  api_key: string;
  phone_number: string | null;
  is_connected: boolean;
  updated_at: string;
}

export function AdminWhatsAppInstanceTab() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  
  const [formData, setFormData] = useState({
    instance_name: "",
    api_url: "",
    api_key: "",
    phone_number: "",
  });

  // Fetch current admin instance config using RPC
  const { data: config, isLoading } = useQuery({
    queryKey: ["admin-whatsapp-instance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_whatsapp_config");

      if (error) {
        console.log("No admin config found:", error.message);
        return null;
      }
      
      if (data) {
        return data as unknown as AdminInstanceConfig;
      }
      
      return null;
    },
  });

  // Initialize form when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        instance_name: config.instance_name || "",
        api_url: config.api_url || "",
        api_key: config.api_key || "",
        phone_number: config.phone_number || "",
      });
    }
  }, [config]);

  // Save config mutation using RPC
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: Partial<AdminInstanceConfig>) => {
      const configToSave = {
        ...newConfig,
        updated_at: new Date().toISOString(),
        is_connected: false,
      };

      const { error } = await supabase.rpc("save_admin_whatsapp_config", {
        p_config: configToSave,
      });

      if (error) throw error;
      return configToSave;
    },
    onSuccess: () => {
      toast({ title: "Configuração salva com sucesso!" });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-instance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check connection status
  const checkStatus = async () => {
    if (!formData.api_url || !formData.instance_name || !formData.api_key) {
      toast({
        title: "Configuração incompleta",
        description: "Preencha URL, nome da instância e token primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingStatus(true);
    try {
      const response = await fetch(
        `${formData.api_url}/instance/connectionState/${formData.instance_name}`,
        {
          headers: {
            apikey: formData.api_key,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao verificar status");
      }

      const data = await response.json();
      const isConnected = data.instance?.state === "open";

      // Update config with connection status
      const updatedConfig = {
        ...formData,
        is_connected: isConnected,
        updated_at: new Date().toISOString(),
      };

      await supabase.rpc("save_admin_whatsapp_config", {
        p_config: updatedConfig,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-instance"] });

      toast({
        title: isConnected ? "Instância conectada! ✅" : "Instância desconectada",
        description: isConnected 
          ? "A instância está pronta para enviar mensagens." 
          : "Escaneie o QR Code para conectar.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao verificar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Fetch QR Code
  const fetchQrCode = async () => {
    if (!formData.api_url || !formData.instance_name || !formData.api_key) {
      toast({
        title: "Configuração incompleta",
        description: "Preencha URL, nome da instância e token primeiro.",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingQr(true);
    setShowQr(true);
    setQrCode(null);

    try {
      const response = await fetch(
        `${formData.api_url}/instance/connect/${formData.instance_name}`,
        {
          headers: {
            apikey: formData.api_key,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar QR Code");
      }

      const data = await response.json();
      
      if (data.base64) {
        setQrCode(data.base64);
      } else if (data.code) {
        setQrCode(data.code);
      } else {
        toast({
          title: "Instância já conectada",
          description: "A instância já está conectada ao WhatsApp.",
        });
        setShowQr(false);
        checkStatus();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao buscar QR Code",
        description: error.message,
        variant: "destructive",
      });
      setShowQr(false);
    } finally {
      setIsFetchingQr(false);
    }
  };

  // Handle save
  const handleSave = () => {
    if (!formData.instance_name || !formData.api_url || !formData.api_key) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha URL, nome da instância e token.",
        variant: "destructive",
      });
      return;
    }

    saveConfigMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Instância WhatsApp Administrativa
          </CardTitle>
          <CardDescription>
            Configure a instância Evolution API usada para comunicação com clientes:
            envio de credenciais, notificações de demandas e atualizações de leads via WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-muted/30">
            <div className="flex flex-wrap items-center gap-3">
              {config?.is_connected ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Wifi className="h-5 w-5" />
                  <span className="font-medium">Conectada</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <WifiOff className="h-5 w-5" />
                  <span className="font-medium">Desconectada</span>
                </div>
              )}
              {config?.phone_number && (
                <Badge variant="secondary" className="gap-1">
                  <Phone className="h-3 w-3" />
                  {config.phone_number}
                </Badge>
              )}
              {config?.instance_name && (
                <Badge variant="outline">
                  {config.instance_name}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkStatus}
                disabled={isCheckingStatus}
              >
                {isCheckingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Verificar Status
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQrCode}
                disabled={isFetchingQr}
              >
                {isFetchingQr ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Ler QR Code
              </Button>
            </div>
          </div>

          {/* QR Code Display */}
          {showQr && (
            <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-white">
              {isFetchingQr ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                </div>
              ) : qrCode ? (
                <div className="flex flex-col items-center gap-4">
                  {qrCode.startsWith("data:image") ? (
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  ) : (
                    <QRCodeSVG value={qrCode} size={256} />
                  )}
                  <p className="text-sm text-muted-foreground">
                    Escaneie com o WhatsApp do número {formData.phone_number || "administrativo"}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setShowQr(false)}>
                    Fechar
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Aguardando QR Code...</p>
              )}
            </div>
          )}

          <Separator />

          {/* Configuration Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações da Instância
              </h3>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api_url">URL da Evolution API *</Label>
                <Input
                  id="api_url"
                  placeholder="https://api.evolution.com"
                  value={formData.api_url}
                  onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instance_name">Nome da Instância *</Label>
                <Input
                  id="instance_name"
                  placeholder="morphewsCRMcelALINE"
                  value={formData.instance_name}
                  onChange={(e) => setFormData({ ...formData, instance_name: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">Token/API Key *</Label>
                <Input
                  id="api_key"
                  type="password"
                  placeholder="F00479D4F545-433D-85A3-..."
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Número do WhatsApp</Label>
                <Input
                  id="phone_number"
                  placeholder="555130760100"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    if (config) {
                      setFormData({
                        instance_name: config.instance_name || "",
                        api_url: config.api_url || "",
                        api_key: config.api_key || "",
                        phone_number: config.phone_number || "",
                      });
                    }
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Usage Info */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              📱 Onde esta instância é usada:
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• <strong>Novos usuários:</strong> Envio de credenciais de acesso via WhatsApp</li>
              <li>• <strong>Atualizações de leads:</strong> Usuários podem atualizar leads respondendo mensagens</li>
              <li>• <strong>Notificações de demandas:</strong> Alertas sobre tarefas atribuídas</li>
              <li>• <strong>Comunicação geral:</strong> Mensagens do sistema para clientes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
