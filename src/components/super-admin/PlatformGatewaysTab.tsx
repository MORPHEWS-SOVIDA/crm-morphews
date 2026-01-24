import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Plus, Pencil, Trash2, Shield, ArrowUpDown, Eye, EyeOff, CreditCard, Zap, Copy, CheckCheck, Info } from 'lucide-react';
import { toast } from 'sonner';

type GatewayType = 'pagarme' | 'appmax' | 'stripe' | 'asaas';

interface PlatformGatewayConfig {
  id: string;
  gateway_type: GatewayType;
  display_name: string;
  api_key_encrypted: string | null;
  api_secret_encrypted: string | null;
  webhook_secret_encrypted: string | null;
  is_primary: boolean;
  priority: number;
  is_active: boolean;
  is_sandbox: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface GatewayFallbackConfig {
  id: string;
  payment_method: 'pix' | 'credit_card' | 'boleto';
  primary_gateway: string;
  fallback_gateways: string[];
  fallback_enabled: boolean;
  max_fallback_attempts: number;
}

const GATEWAY_INFO: Record<GatewayType, { label: string; color: string; icon: string }> = {
  pagarme: { label: 'Pagar.me', color: 'bg-green-500', icon: '💳' },
  appmax: { label: 'Appmax', color: 'bg-blue-500', icon: '🛒' },
  stripe: { label: 'Stripe', color: 'bg-purple-500', icon: '⚡' },
  asaas: { label: 'Asaas', color: 'bg-orange-500', icon: '🏦' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  boleto: 'Boleto',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getWebhookUrl = (gatewayType: GatewayType): string => {
  const webhookEndpoints: Record<GatewayType, string> = {
    pagarme: `${SUPABASE_URL}/functions/v1/pagarme-webhook`,
    stripe: `${SUPABASE_URL}/functions/v1/stripe-webhook`,
    appmax: `${SUPABASE_URL}/functions/v1/appmax-webhook`,
    asaas: `${SUPABASE_URL}/functions/v1/asaas-webhook`,
  };
  return webhookEndpoints[gatewayType];
};

export function PlatformGatewaysTab() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PlatformGatewayConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [formData, setFormData] = useState({
    gateway_type: 'pagarme' as GatewayType,
    display_name: '',
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    is_primary: false,
    priority: 0,
    is_sandbox: false,
  });

  // Fetch gateways using service role (direct query for super admin)
  const { data: gateways, isLoading: gatewaysLoading } = useQuery({
    queryKey: ['platform-gateway-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_gateway_config')
        .select('*')
        .order('priority');
      
      if (error) throw error;
      return data as PlatformGatewayConfig[];
    },
  });

  // Fetch fallback config
  const { data: fallbackConfigs, isLoading: fallbackLoading } = useQuery({
    queryKey: ['gateway-fallback-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_fallback_config')
        .select('*');
      
      if (error) throw error;
      return data as GatewayFallbackConfig[];
    },
  });

  // Create/Update gateway
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        gateway_type: data.gateway_type,
        display_name: data.display_name,
        api_key_encrypted: data.api_key || null,
        api_secret_encrypted: data.api_secret || null,
        webhook_secret_encrypted: data.webhook_secret || null,
        is_primary: data.is_primary,
        priority: data.priority,
        is_sandbox: data.is_sandbox,
        is_active: true,
      };

      if (data.id) {
        const { error } = await supabase
          .from('platform_gateway_config')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_gateway_config')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-gateway-config'] });
      toast.success(editingGateway ? 'Gateway atualizado!' : 'Gateway adicionado!');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle gateway active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('platform_gateway_config')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-gateway-config'] });
    },
  });

  // Delete gateway
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('platform_gateway_config')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-gateway-config'] });
      toast.success('Gateway removido');
    },
  });

  // Update fallback config
  const updateFallbackMutation = useMutation({
    mutationFn: async (config: Partial<GatewayFallbackConfig> & { id: string }) => {
      const { id, ...data } = config;
      const { error } = await supabase
        .from('gateway_fallback_config')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-fallback-config'] });
      toast.success('Configuração de fallback atualizada!');
    },
  });

  const handleOpenCreate = () => {
    setEditingGateway(null);
    setFormData({
      gateway_type: 'pagarme',
      display_name: '',
      api_key: '',
      api_secret: '',
      webhook_secret: '',
      is_primary: false,
      priority: (gateways?.length || 0) + 1,
      is_sandbox: false,
    });
    setShowDialog(true);
  };

  const handleEdit = (gateway: PlatformGatewayConfig) => {
    setEditingGateway(gateway);
    setFormData({
      gateway_type: gateway.gateway_type,
      display_name: gateway.display_name,
      api_key: gateway.api_key_encrypted || '',
      api_secret: gateway.api_secret_encrypted || '',
      webhook_secret: gateway.webhook_secret_encrypted || '',
      is_primary: gateway.is_primary,
      priority: gateway.priority,
      is_sandbox: gateway.is_sandbox,
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingGateway(null);
    setShowApiKey(false);
  };

  const handleSubmit = () => {
    if (!formData.display_name) {
      toast.error('Nome é obrigatório');
      return;
    }
    saveMutation.mutate({
      ...formData,
      id: editingGateway?.id,
    });
  };

  if (gatewaysLoading || fallbackLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gateways Configurados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gateways de Pagamento
            </CardTitle>
            <CardDescription>
              Configure os provedores de pagamento da plataforma. A ordem define a prioridade para fallback.
            </CardDescription>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Gateway
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGateway ? 'Editar Gateway' : 'Novo Gateway'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Select
                    value={formData.gateway_type}
                    onValueChange={(v) => setFormData(prev => ({ 
                      ...prev, 
                      gateway_type: v as GatewayType,
                      display_name: GATEWAY_INFO[v as GatewayType].label,
                    }))}
                    disabled={!!editingGateway}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(GATEWAY_INFO).map(([key, info]) => (
                        <SelectItem key={key} value={key}>
                          {info.icon} {info.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nome de exibição</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Ex: Pagar.me Principal"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    API Key
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </Label>
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="sk_live_..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>API Secret (opcional)</Label>
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.api_secret}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_secret: e.target.value }))}
                  />
                </div>

                {/* URL do Webhook - para copiar e configurar no gateway */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    URL do Webhook
                    <Badge variant="outline" className="text-xs font-normal">
                      Copie e configure no {GATEWAY_INFO[formData.gateway_type].label}
                    </Badge>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={getWebhookUrl(formData.gateway_type)}
                      className="bg-muted text-xs font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(getWebhookUrl(formData.gateway_type));
                        setCopiedWebhook(true);
                        toast.success('URL do webhook copiada!');
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                    >
                      {copiedWebhook ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure esta URL na seção de Webhooks do painel do {GATEWAY_INFO[formData.gateway_type].label}
                  </p>
                </div>

                {/* Stripe já integrado - aviso especial */}
                {formData.gateway_type === 'stripe' && (
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-purple-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-purple-700 dark:text-purple-300">Stripe já está integrado!</p>
                        <p className="text-purple-600 dark:text-purple-400 text-xs mt-1">
                          As credenciais do Stripe já estão configuradas no sistema (STRIPE_SECRET_KEY).
                          Se quiser usar outro Stripe, preencha as chaves abaixo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Prioridade (menor = primeiro)</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_sandbox}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_sandbox: v }))}
                    />
                    <Label>Sandbox/Teste</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_primary}
                      onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_primary: v }))}
                    />
                    <Label>Gateway Primário</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {!gateways?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum gateway configurado.</p>
              <p className="text-sm">Configure pelo menos um gateway para processar pagamentos.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gateways.map((gateway, index) => (
                  <TableRow key={gateway.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {gateway.priority}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${GATEWAY_INFO[gateway.gateway_type].color}`} />
                        <span className="font-medium">{gateway.display_name}</span>
                        {gateway.is_primary && (
                          <Badge variant="secondary" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Primário
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {GATEWAY_INFO[gateway.gateway_type].label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {gateway.api_key_encrypted 
                          ? `${gateway.api_key_encrypted.slice(0, 8)}...` 
                          : 'Não configurado'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={gateway.is_active}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: gateway.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={gateway.is_sandbox ? 'outline' : 'default'}>
                        {gateway.is_sandbox ? 'Sandbox' : 'Produção'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(gateway)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(gateway.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fallback Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Configuração de Fallback
          </CardTitle>
          <CardDescription>
            Define qual gateway usar primeiro e quais são os backups em caso de falha.
            Recuperação automática como a Yampi (R$54M+ recuperados).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método</TableHead>
                <TableHead>Gateway Primário</TableHead>
                <TableHead>Fallbacks</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fallbackConfigs?.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">
                    {PAYMENT_METHOD_LABELS[config.payment_method]}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={config.primary_gateway}
                      onValueChange={(v) => updateFallbackMutation.mutate({
                        id: config.id,
                        primary_gateway: v,
                      })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gateways?.filter(g => g.is_active).map(g => (
                          <SelectItem key={g.gateway_type} value={g.gateway_type}>
                            {g.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {config.fallback_gateways.map((fb, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {i + 1}º {GATEWAY_INFO[fb as GatewayType]?.label || fb}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={config.max_fallback_attempts}
                      onChange={(e) => updateFallbackMutation.mutate({
                        id: config.id,
                        max_fallback_attempts: parseInt(e.target.value) || 2,
                      })}
                      className="w-16"
                      min={1}
                      max={5}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.fallback_enabled}
                      onCheckedChange={(v) => updateFallbackMutation.mutate({
                        id: config.id,
                        fallback_enabled: v,
                      })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
