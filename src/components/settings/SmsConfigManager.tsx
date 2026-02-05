import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  CreditCard, 
  Settings2, 
  History, 
  Check, 
  X, 
  Clock,
  ExternalLink,
  Phone,
  Loader2,
  Save
} from 'lucide-react';
import { 
  useSmsPackages, 
  useSmsBalance, 
  useSmsPurchases, 
  useSmsUsage,
  useSmsProviderConfig, 
  useUpdateSmsProviderConfig,
} from '@/hooks/useSmsCredits';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function SmsConfigManager() {
  const [activeTab, setActiveTab] = useState('balance');
  const { profile } = useAuth();
  const isSuperAdmin = (profile as any)?.is_super_admin === true;
  
  // Number of tabs: 3 for tenants, 4 for super admin
  const tabCols = isSuperAdmin ? 'grid-cols-4' : 'grid-cols-3';
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Centro de SMS</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus créditos e envios de SMS
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid ${tabCols} w-full max-w-xl`}>
          <TabsTrigger value="balance" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Saldo
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Pacotes
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="config" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-6">
          <SmsBalanceTab />
        </TabsContent>

        <TabsContent value="packages" className="mt-6">
          <SmsPackagesTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="config" className="mt-6">
            <SmsProviderConfigTab />
          </TabsContent>
        )}

        <TabsContent value="history" className="mt-6">
          <SmsHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SmsBalanceTab() {
  const { data: balance, isLoading } = useSmsBalance();
  const { data: purchases } = useSmsPurchases();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Saldo Atual</CardDescription>
          <CardTitle className="text-3xl font-bold text-primary">
            {balance?.current_credits || 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">créditos SMS disponíveis</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Comprado</CardDescription>
          <CardTitle className="text-3xl font-bold">
            {balance?.total_purchased || 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">créditos adquiridos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Utilizado</CardDescription>
          <CardTitle className="text-3xl font-bold">
            {balance?.total_used || 0}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">mensagens enviadas</p>
        </CardContent>
      </Card>

      {purchases && purchases.length > 0 && (
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg">Últimas Compras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {purchases.slice(0, 5).map((purchase) => (
                <div key={purchase.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium">{purchase.credits_amount} créditos</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatDistanceToNow(new Date(purchase.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <span className="font-medium">{formatCurrency(purchase.price_cents)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SmsPackagesTab() {
  const { data: packages, isLoading } = useSmsPackages();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { tenantId } = useTenant();

  const handlePurchase = async (pkg: { id: string; sms_count: number; price_cents: number }) => {
    if (!tenantId) {
      toast.error('Organização não encontrada');
      return;
    }

    setPurchasingId(pkg.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('sms-checkout', {
        body: {
          packageId: pkg.id,
          organizationId: tenantId,
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar pagamento');
      setPurchasingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {packages?.map((pkg) => (
        <Card key={pkg.id} className="relative overflow-hidden">
          <CardHeader>
            <CardTitle>{pkg.name}</CardTitle>
            <CardDescription>
              {formatCurrency(pkg.price_per_sms_cents)} por SMS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold">
              {formatCurrency(pkg.price_cents)}
            </div>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ {pkg.sms_count.toLocaleString('pt-BR')} mensagens</li>
              <li>✓ Entrega imediata</li>
              <li>✓ Status de entrega</li>
            </ul>
            <Button 
              className="w-full" 
              onClick={() => handlePurchase(pkg)}
              disabled={purchasingId !== null}
            >
              {purchasingId === pkg.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Comprar Agora'
              )}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Mais SMS?</CardTitle>
          <CardDescription>
            Precisa de um volume maior?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Entre em contato com nossa equipe para pacotes personalizados com preços especiais.
          </p>
          <Button variant="outline" className="w-full gap-2">
            <Phone className="h-4 w-4" />
            Falar com Vendas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SmsProviderConfigTab() {
  const { data: config, isLoading } = useSmsProviderConfig();
  const updateConfig = useUpdateSmsProviderConfig();

  const [apiUser, setApiUser] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [isActive, setIsActive] = useState(false);

  // Initialize form when config loads
  useState(() => {
    if (config) {
      setApiUser(config.api_user || '');
      setApiPassword(config.api_password || '');
      setIsActive(config.is_active);
    }
  });

  const handleSave = () => {
    updateConfig.mutate({
      api_user: apiUser,
      api_password: apiPassword,
      is_active: isActive,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                FacilitaMóvel
                {config?.is_active ? (
                  <Badge variant="default">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Configure suas credenciais do FacilitaMóvel
              </CardDescription>
            </div>
            <a 
              href="https://www.facilitamovel.com.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              Acessar Painel <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_user">Usuário</Label>
            <Input
              id="api_user"
              placeholder="Seu usuário do FacilitaMóvel"
              value={apiUser || config?.api_user || ''}
              onChange={(e) => setApiUser(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_password">Senha</Label>
            <Input
              id="api_password"
              type="password"
              placeholder="Sua senha do FacilitaMóvel"
              value={apiPassword || config?.api_password || ''}
              onChange={(e) => setApiPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="is_active">Ativar envio de SMS</Label>
              <p className="text-sm text-muted-foreground">
                Habilita o envio de SMS pelo sistema
              </p>
            </div>
            <Switch
              id="is_active"
              checked={isActive || config?.is_active || false}
              onCheckedChange={(checked) => setIsActive(checked)}
            />
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">URLs de Webhook</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Configure essas URLs no painel do FacilitaMóvel (Menu Webhooks):
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <Label className="text-xs">URL de Status:</Label>
                <code className="block bg-muted p-2 rounded text-xs break-all">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facilita-sms-webhook?type=status&fone=#phone&idSMS=#smsId&statusEntregue=#status&chaveCliente=#externalkey&dataPostagem=#dataPostagem`}
                </code>
              </div>
              <div>
                <Label className="text-xs">URL de Respostas (MO):</Label>
                <code className="block bg-muted p-2 rounded text-xs break-all">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facilita-sms-webhook?type=response&fone=#phone&datahora=#datahora&mensagem=#msg&smsId=#smsId&externalKey=#externalKey`}
                </code>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSave} 
            className="w-full gap-2"
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Configuração
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SmsHistoryTab() {
  const { data: usage, isLoading } = useSmsUsage(50);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!usage || usage.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhum SMS enviado ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Últimos Envios</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {usage.map((sms) => (
              <div key={sms.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="mt-0.5">
                  {sms.status === 'delivered' ? (
                    <Check className="h-5 w-5 text-emerald-600" />
                  ) : sms.status === 'failed' ? (
                    <X className="h-5 w-5 text-destructive" />
                  ) : sms.status === 'sent' ? (
                    <Check className="h-5 w-5 text-primary" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{sms.phone}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(sms.sent_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{sms.message}</p>
                  {sms.error_message && (
                    <p className="text-xs text-destructive mt-1">{sms.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}