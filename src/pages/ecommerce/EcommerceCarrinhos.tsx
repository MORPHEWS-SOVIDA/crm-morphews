import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle, 
  MessageCircle, 
  Settings, 
  AlertCircle,
  CreditCard,
  Eye
} from 'lucide-react';

interface Cart {
  id: string;
  session_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_cents: number;
  status: 'open' | 'abandoned' | 'payment_initiated' | 'paid' | 'converted' | 'expired' | 'active';
  created_at: string;
  updated_at: string;
  abandoned_at: string | null;
  recovery_whatsapp_sent_at: string | null;
  storefront?: { name: string } | null;
  landing_page?: { name: string } | null;
  lead?: { name: string } | null;
  items: any;
}

interface AutomationConfig {
  id: string;
  organization_id: string;
  lead_creation_trigger: string;
  lead_funnel_stage_id: string | null;
  lead_default_assignment: string;
  lead_assigned_user_id: string | null;
  cart_abandonment_minutes: number;
  enable_whatsapp_recovery: boolean;
  whatsapp_recovery_delay_minutes: number;
  enable_email_recovery: boolean;
  email_recovery_delay_minutes: number;
  notify_team_on_cart: boolean;
  notify_team_on_payment: boolean;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const STATUS_CONFIG = {
  open: { label: 'Aberto', variant: 'default' as const, icon: Eye, color: 'text-blue-600' },
  active: { label: 'Aberto', variant: 'default' as const, icon: Eye, color: 'text-blue-600' },
  abandoned: { label: 'Abandonado', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
  payment_initiated: { label: 'Gerou Pagamento', variant: 'secondary' as const, icon: CreditCard, color: 'text-yellow-600' },
  paid: { label: 'Pago', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
  converted: { label: 'Convertido', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
  expired: { label: 'Expirado', variant: 'outline' as const, icon: Clock, color: 'text-muted-foreground' },
};

const LEAD_CREATION_OPTIONS = [
  { value: 'name_phone', label: 'Nome + WhatsApp' },
  { value: 'full_address', label: 'Endereço completo' },
  { value: 'payment_attempt', label: 'Tentativa de pagamento' },
  { value: 'payment_approved', label: 'Pagamento aprovado' },
];

export default function EcommerceCarrinhos() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);

  const { data: carts, isLoading: cartsLoading } = useQuery({
    queryKey: ['ecommerce-carts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_carts')
        .select(`
          *,
          storefront:tenant_storefronts(name),
          landing_page:landing_pages(name),
          lead:leads(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as unknown as Cart[];
    },
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['ecommerce-automation-config', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_automation_config')
        .select('*')
        .eq('organization_id', organizationId!)
        .maybeSingle();
      
      if (error) throw error;
      return data as AutomationConfig | null;
    },
  });

  const { data: funnelStages } = useQuery({
    queryKey: ['funnel-stages', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_funnel_stages')
        .select('id, name, position')
        .eq('organization_id', organizationId!)
        .order('position');
      
      if (error) throw error;
      return data;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (newConfig: Partial<AutomationConfig>) => {
      if (config?.id) {
        const { error } = await supabase
          .from('ecommerce_automation_config')
          .update(newConfig)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ecommerce_automation_config')
          .insert({
            organization_id: organizationId!,
            ...newConfig,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-automation-config'] });
      toast.success('Configurações salvas com sucesso');
      setConfigOpen(false);
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const [configForm, setConfigForm] = useState<Partial<AutomationConfig>>({});

  const handleOpenConfig = () => {
    setConfigForm({
      lead_creation_trigger: config?.lead_creation_trigger || 'name_phone',
      lead_funnel_stage_id: config?.lead_funnel_stage_id || null,
      cart_abandonment_minutes: config?.cart_abandonment_minutes || 5,
      enable_whatsapp_recovery: config?.enable_whatsapp_recovery ?? true,
      whatsapp_recovery_delay_minutes: config?.whatsapp_recovery_delay_minutes || 30,
      enable_email_recovery: config?.enable_email_recovery ?? true,
      email_recovery_delay_minutes: config?.email_recovery_delay_minutes || 60,
      notify_team_on_cart: config?.notify_team_on_cart ?? false,
      notify_team_on_payment: config?.notify_team_on_payment ?? true,
    });
    setConfigOpen(true);
  };

  // Group carts by status
  const openCarts = carts?.filter((c) => c.status === 'open' || c.status === 'active') || [];
  const abandonedCarts = carts?.filter((c) => c.status === 'abandoned') || [];
  const paymentCarts = carts?.filter((c) => c.status === 'payment_initiated') || [];
  const paidCarts = carts?.filter((c) => c.status === 'paid' || c.status === 'converted') || [];

  const totalAbandoned = abandonedCarts.reduce((acc, c) => acc + c.total_cents, 0);
  const totalConverted = paidCarts.reduce((acc, c) => acc + c.total_cents, 0);

  if (cartsLoading) {
    return (
      <EcommerceLayout title="Carrinhos" description="Acompanhe e recupere carrinhos abandonados">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </EcommerceLayout>
    );
  }

  return (
    <EcommerceLayout title="Carrinhos" description="Acompanhe e recupere carrinhos abandonados">
      <div className="space-y-6">
        {/* Header with Config Button */}
        <div className="flex justify-end">
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" onClick={handleOpenConfig}>
                <Settings className="h-4 w-4" />
                Configurações de Automação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Configurações de Automação</DialogTitle>
                <DialogDescription>
                  Configure quando criar leads e como recuperar carrinhos abandonados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                {/* Lead Creation */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Criação de Lead no CRM</Label>
                  <div className="space-y-2">
                    <Label>Criar lead automaticamente quando:</Label>
                    <Select
                      value={configForm.lead_creation_trigger}
                      onValueChange={(v) => setConfigForm({ ...configForm, lead_creation_trigger: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_CREATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Etapa inicial do funil:</Label>
                    <Select
                      value={configForm.lead_funnel_stage_id || 'default'}
                      onValueChange={(v) => setConfigForm({ ...configForm, lead_funnel_stage_id: v === 'default' ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar etapa padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Usar etapa padrão do funil</SelectItem>
                        {funnelStages?.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cart Abandonment */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Carrinho Abandonado</Label>
                  <div className="flex items-center gap-3">
                    <Label>Considerar abandonado após:</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      className="w-20"
                      value={configForm.cart_abandonment_minutes || 5}
                      onChange={(e) => setConfigForm({ ...configForm, cart_abandonment_minutes: parseInt(e.target.value) || 5 })}
                    />
                    <span className="text-sm text-muted-foreground">minutos</span>
                  </div>
                </div>

                {/* Recovery */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Recuperação Automática</Label>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enviar WhatsApp</Label>
                      <p className="text-sm text-muted-foreground">Recuperar via WhatsApp automaticamente</p>
                    </div>
                    <Switch
                      checked={configForm.enable_whatsapp_recovery}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, enable_whatsapp_recovery: v })}
                    />
                  </div>
                  {configForm.enable_whatsapp_recovery && (
                    <div className="flex items-center gap-3 pl-4">
                      <Label>Após:</Label>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={configForm.whatsapp_recovery_delay_minutes || 30}
                        onChange={(e) => setConfigForm({ ...configForm, whatsapp_recovery_delay_minutes: parseInt(e.target.value) || 30 })}
                      />
                      <span className="text-sm text-muted-foreground">minutos do abandono</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enviar E-mail</Label>
                      <p className="text-sm text-muted-foreground">Recuperar via e-mail automaticamente</p>
                    </div>
                    <Switch
                      checked={configForm.enable_email_recovery}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, enable_email_recovery: v })}
                    />
                  </div>
                  {configForm.enable_email_recovery && (
                    <div className="flex items-center gap-3 pl-4">
                      <Label>Após:</Label>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={configForm.email_recovery_delay_minutes || 60}
                        onChange={(e) => setConfigForm({ ...configForm, email_recovery_delay_minutes: parseInt(e.target.value) || 60 })}
                      />
                      <span className="text-sm text-muted-foreground">minutos do abandono</span>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Notificações</Label>
                  <div className="flex items-center justify-between">
                    <Label>Notificar equipe quando carrinho é criado</Label>
                    <Switch
                      checked={configForm.notify_team_on_cart}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, notify_team_on_cart: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Notificar equipe quando pagamento é confirmado</Label>
                    <Switch
                      checked={configForm.notify_team_on_payment}
                      onCheckedChange={(v) => setConfigForm({ ...configForm, notify_team_on_payment: v })}
                    />
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => saveConfig.mutate(configForm)}
                  disabled={saveConfig.isPending}
                >
                  {saveConfig.isPending ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Carrinhos Abertos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{openCarts.length}</div>
              <p className="text-xs text-muted-foreground">Clientes online agora</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Abandonados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{abandonedCarts.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalAbandoned)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Gerou Pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{paymentCarts.length}</div>
              <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pagos / Convertidos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paidCarts.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalConverted)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Carts by Status */}
        <Tabs defaultValue="abandoned">
          <TabsList>
            <TabsTrigger value="open" className="gap-2">
              <Eye className="h-4 w-4" />
              Abertos ({openCarts.length})
            </TabsTrigger>
            <TabsTrigger value="abandoned" className="gap-2">
              <XCircle className="h-4 w-4" />
              Abandonados ({abandonedCarts.length})
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Geraram Pagamento ({paymentCarts.length})
            </TabsTrigger>
            <TabsTrigger value="paid" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Pagos ({paidCarts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4">
            <CartList carts={openCarts} emptyMessage="Nenhum cliente com carrinho aberto agora" />
          </TabsContent>

          <TabsContent value="abandoned" className="mt-4">
            <CartList carts={abandonedCarts} emptyMessage="Nenhum carrinho abandonado no momento 🎉" showRecovery />
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <CartList carts={paymentCarts} emptyMessage="Nenhum carrinho aguardando pagamento" />
          </TabsContent>

          <TabsContent value="paid" className="mt-4">
            <CartList carts={paidCarts} emptyMessage="Nenhum carrinho pago ainda" />
          </TabsContent>
        </Tabs>
      </div>
    </EcommerceLayout>
  );
}

function CartList({ carts, emptyMessage, showRecovery = false }: { carts: Cart[]; emptyMessage: string; showRecovery?: boolean }) {
  if (carts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {carts.map((cart) => {
            const statusConfig = STATUS_CONFIG[cart.status] || STATUS_CONFIG.open;
            const StatusIcon = statusConfig.icon;
            
            return (
              <div
                key={cart.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {cart.customer_name || cart.lead?.name || 'Visitante'}
                    </span>
                    <Badge variant={statusConfig.variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {cart.customer_email || cart.customer_phone || 'Sem contato'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {cart.storefront?.name || cart.landing_page?.name || 'Origem desconhecida'}
                    {' • '}
                    {formatDistanceToNow(new Date(cart.updated_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(cart.total_cents)}</div>
                    {cart.recovery_whatsapp_sent_at && (
                      <div className="text-xs text-muted-foreground">
                        WhatsApp enviado
                      </div>
                    )}
                  </div>
                  {showRecovery && cart.customer_phone && !cart.recovery_whatsapp_sent_at && (
                    <Button size="sm" variant="outline" className="gap-1">
                      <MessageCircle className="h-4 w-4" />
                      Recuperar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
