import { useState } from 'react';
import { Plus, CreditCard, Trash2, Check, X, Eye, EyeOff, Star, Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  usePaymentGateways,
  useCreatePaymentGateway,
  useUpdatePaymentGateway,
  useTogglePaymentGateway,
  useDeletePaymentGateway,
  GATEWAY_LABELS,
  type GatewayType,
  type PaymentGateway,
} from '@/hooks/ecommerce';

const GATEWAY_ICONS: Record<GatewayType, string> = {
  stripe: '💳',
  pagarme: '🟢',
  appmax: '🔵',
  asaas: '🟡',
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

export function PaymentGatewaysManager() {
  const { data: gateways, isLoading } = usePaymentGateways();
  const createGateway = useCreatePaymentGateway();
  const updateGateway = useUpdatePaymentGateway();
  const toggleGateway = useTogglePaymentGateway();
  const deleteGateway = useDeletePaymentGateway();

  const [formOpen, setFormOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [formData, setFormData] = useState({
    gateway_type: 'pagarme' as GatewayType,
    name: '',
    api_key: '',
    api_secret: '',
    webhook_secret: '',
    is_sandbox: false,
    is_default: false,
  });

  const handleCreate = () => {
    setEditingGateway(null);
    setFormData({
      gateway_type: 'pagarme',
      name: '',
      api_key: '',
      api_secret: '',
      webhook_secret: '',
      is_sandbox: false,
      is_default: false,
    });
    setFormOpen(true);
  };

  const handleEdit = (gateway: PaymentGateway) => {
    setEditingGateway(gateway);
    setFormData({
      gateway_type: gateway.gateway_type,
      name: gateway.name,
      api_key: '', // Don't show existing key
      api_secret: '',
      webhook_secret: gateway.webhook_secret || '',
      is_sandbox: gateway.is_sandbox,
      is_default: gateway.is_default,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (editingGateway) {
      updateGateway.mutate(
        {
          id: editingGateway.id,
          name: formData.name,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined,
          webhook_secret: formData.webhook_secret || undefined,
          is_sandbox: formData.is_sandbox,
          is_default: formData.is_default,
        },
        { onSuccess: () => setFormOpen(false) }
      );
    } else {
      createGateway.mutate(formData, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const handleToggle = (gateway: PaymentGateway) => {
    toggleGateway.mutate({
      id: gateway.id,
      is_active: !gateway.is_active,
    });
  };

  const handleSetDefault = (gateway: PaymentGateway) => {
    if (!gateway.is_default) {
      updateGateway.mutate({
        id: gateway.id,
        is_default: true,
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteGateway.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gateways de Pagamento</h3>
          <p className="text-sm text-muted-foreground">
            Configure suas integrações com Pagarme, Appmax e outros
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Gateway
        </Button>
      </div>

      {gateways?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum gateway configurado</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Configure um gateway de pagamento para aceitar pagamentos online.
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Gateway
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gateways?.map((gateway) => (
            <Card key={gateway.id} className={!gateway.is_active ? 'opacity-60' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">
                    {GATEWAY_ICONS[gateway.gateway_type]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{gateway.name}</span>
                      <Badge variant="outline">
                        {GATEWAY_LABELS[gateway.gateway_type]}
                      </Badge>
                      {gateway.is_sandbox && (
                        <Badge variant="secondary">Sandbox</Badge>
                      )}
                      {gateway.is_default && (
                        <Badge className="bg-yellow-500">
                          <Star className="h-3 w-3 mr-1" />
                          Padrão
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      API Key: ****{gateway.api_key_encrypted?.slice(-4) || '****'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(gateway)}
                    disabled={gateway.is_default}
                  >
                    <Star className={`h-4 w-4 ${gateway.is_default ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(gateway)}
                  >
                    {gateway.is_active ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(gateway)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(gateway.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGateway ? 'Editar Gateway' : 'Novo Gateway'}
            </DialogTitle>
            <DialogDescription>
              Configure as credenciais do gateway de pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingGateway && (
              <div className="space-y-2">
                <Label>Gateway</Label>
                <Select
                  value={formData.gateway_type}
                  onValueChange={(v) => setFormData((p) => ({ ...p, gateway_type: v as GatewayType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GATEWAY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {GATEWAY_ICONS[key as GatewayType]} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Nome (identificação interna)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Pagarme Principal"
              />
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(e) => setFormData((p) => ({ ...p, api_key: e.target.value }))}
                  placeholder={editingGateway ? '(deixe em branco para manter)' : 'ak_live_...'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {(formData.gateway_type === 'appmax' || formData.gateway_type === 'asaas') && (
              <div className="space-y-2">
                <Label>API Secret</Label>
                <Input
                  type="password"
                  value={formData.api_secret}
                  onChange={(e) => setFormData((p) => ({ ...p, api_secret: e.target.value }))}
                  placeholder="(opcional)"
                />
              </div>
            )}

            {/* Webhook URL - para copiar e configurar no gateway */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                URL do Webhook
                <Badge variant="outline" className="text-xs">Copie e configure no {GATEWAY_LABELS[formData.gateway_type]}</Badge>
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
                    toast.success('URL copiada!');
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                >
                  {copiedWebhook ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure esta URL na seção de Webhooks do painel do {GATEWAY_LABELS[formData.gateway_type]}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_sandbox}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_sandbox: checked }))}
                />
                <Label>Modo Sandbox (testes)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_default: checked }))}
                />
                <Label>Gateway padrão</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || (!editingGateway && !formData.api_key)}
            >
              {editingGateway ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover gateway?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
