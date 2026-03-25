import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  User, Mail, Phone, MapPin, Package, ShoppingCart, Clock,
  MessageCircle, Copy, ExternalLink, Globe, Smartphone, AlertTriangle,
  CreditCard, Tag, MousePointerClick
} from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  product_id: string;
  product_name?: string;
  name?: string;
  image_url?: string;
  quantity: number;
  price_cents?: number;
  unit_price_cents?: number;
  total_price_cents?: number;
  kit_size?: number;
}

interface CartDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: {
    id: string;
    session_id: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_cpf?: string | null;
    total_cents: number;
    status: string;
    created_at: string;
    updated_at: string;
    abandoned_at: string | null;
    recovery_whatsapp_sent_at: string | null;
    recovery_email_sent_at?: string | null;
    checkout_started_at?: string | null;
    payment_attempted_at?: string | null;
    payment_method?: string | null;
    last_error?: string | null;
    last_error_at?: string | null;
    source_type?: string | null;
    source_url?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    device_info?: any;
    shipping_cep?: string | null;
    shipping_address?: string | null;
    shipping_city?: string | null;
    shipping_state?: string | null;
    storefront?: { name: string } | null;
    landing_page?: { name: string } | null;
    lead?: { name: string } | null;
    items: CartItem[] | null;
  } | null;
  onSendRecoveryWhatsApp?: (cartId: string) => void;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberto', variant: 'default' },
  active: { label: 'Aberto', variant: 'default' },
  abandoned: { label: 'Abandonado', variant: 'destructive' },
  payment_initiated: { label: 'Gerou Pagamento', variant: 'secondary' },
  paid: { label: 'Pago', variant: 'default' },
  converted: { label: 'Convertido', variant: 'default' },
  expired: { label: 'Expirado', variant: 'outline' },
};

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  cart_loaded: { label: 'Carrinho carregado', color: 'bg-blue-500', icon: '🛒' },
  form_filled: { label: 'Formulário preenchido', color: 'bg-indigo-500', icon: '📝' },
  checkout_started: { label: 'Checkout iniciado', color: 'bg-yellow-500', icon: '🚀' },
  payment_started: { label: 'Pagamento iniciado', color: 'bg-orange-500', icon: '💳' },
  payment_success: { label: 'Pagamento aprovado', color: 'bg-green-500', icon: '✅' },
  payment_failed: { label: 'Pagamento recusado', color: 'bg-red-500', icon: '❌' },
  payment_error: { label: 'Erro no pagamento', color: 'bg-red-700', icon: '⚠️' },
  abandoned: { label: 'Abandonado', color: 'bg-gray-500', icon: '🚪' },
};

export function CartDetailDialog({ open, onOpenChange, cart, onSendRecoveryWhatsApp }: CartDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('customer');

  // Fetch checkout events for this cart
  const { data: checkoutEvents } = useQuery({
    queryKey: ['cart-checkout-events', cart?.id, cart?.session_id],
    enabled: open && !!cart,
    queryFn: async () => {
      if (!cart) return [];
      
      // Try by cart_id first, then by session_id
      let query = supabase
        .from('checkout_events')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (cart.id) {
        query = query.eq('cart_id', cart.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // If no events by cart_id, try session_id
      if ((!data || data.length === 0) && cart.session_id) {
        const { data: sessionData } = await supabase
          .from('checkout_events')
          .select('*')
          .eq('session_id', cart.session_id)
          .order('created_at', { ascending: true });
        return sessionData || [];
      }
      
      return data || [];
    },
  });

  if (!cart) return null;

  const statusConfig = STATUS_CONFIG[cart.status] || STATUS_CONFIG.open;
  const items = Array.isArray(cart.items) ? cart.items : [];
  const hasUtms = cart.utm_source || cart.utm_medium || cart.utm_campaign;
  const hasDeviceInfo = cart.device_info && typeof cart.device_info === 'object';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const openWhatsApp = () => {
    if (cart.customer_phone) {
      const cleaned = cart.customer_phone.replace(/\D/g, '');
      window.open(`https://wa.me/55${cleaned}`, '_blank');
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return null;
    const map: Record<string, string> = {
      credit_card: 'Cartão de Crédito', pix: 'PIX', boleto: 'Boleto', debit_card: 'Cartão de Débito',
    };
    return map[method] || method;
  };

  const getSourceTypeLabel = (type: string | null) => {
    if (!type) return null;
    const map: Record<string, string> = {
      storefront: 'Loja Virtual', standalone_checkout: 'Checkout Avulso', landing_page: 'Landing Page',
    };
    return map[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Detalhes do Carrinho
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">{cart.id.slice(0, 8)}</span>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {cart.payment_method && (
              <Badge variant="outline" className="text-xs">{getPaymentMethodLabel(cart.payment_method)}</Badge>
            )}
            <span className="text-xs">
              {format(new Date(cart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Error Banner */}
        {cart.last_error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Último erro</p>
              <p className="text-xs text-destructive/80">{cart.last_error}</p>
              {cart.last_error_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(cart.last_error_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="customer" className="gap-1 text-xs">
              <User className="h-4 w-4" />
              Cliente
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-1 text-xs">
              <Package className="h-4 w-4" />
              Itens ({items.length})
            </TabsTrigger>
            <TabsTrigger value="tracking" className="gap-1 text-xs">
              <Globe className="h-4 w-4" />
              Origem
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1 text-xs">
              <Clock className="h-4 w-4" />
              Eventos ({checkoutEvents?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Customer Tab */}
          <TabsContent value="customer" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Informações do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={<User className="h-4 w-4" />} label="Nome" value={cart.customer_name} onCopy={copyToClipboard} />
                <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={cart.customer_email} onCopy={copyToClipboard} />
                {cart.customer_phone ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{formatPhone(cart.customer_phone)}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyToClipboard(cart.customer_phone!, 'Telefone')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={openWhatsApp}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm flex items-center gap-2"><Phone className="h-4 w-4" /> Telefone não informado</p>
                )}
                {cart.customer_cpf && <InfoRow icon={<span className="text-xs">CPF</span>} label="CPF" value={cart.customer_cpf} onCopy={copyToClipboard} />}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {(cart.shipping_cep || cart.shipping_address) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Endereço de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {cart.shipping_address && <p>{cart.shipping_address}</p>}
                  {(cart.shipping_city || cart.shipping_state) && <p>{cart.shipping_city} - {cart.shipping_state}</p>}
                  {cart.shipping_cep && <p>CEP: {cart.shipping_cep}</p>}
                </CardContent>
              </Card>
            )}

            {/* Recovery Actions */}
            {cart.status === 'abandoned' && cart.customer_phone && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ações de Recuperação</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={openWhatsApp}>
                    <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                  </Button>
                  {!cart.recovery_whatsapp_sent_at && onSendRecoveryWhatsApp && (
                    <Button variant="default" className="gap-2" onClick={() => onSendRecoveryWhatsApp(cart.id)}>
                      <MessageCircle className="h-4 w-4" /> Enviar Mensagem de Recuperação
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {items.length > 0 ? (
                  <div className="space-y-4">
                    {items.map((item, index) => {
                      const displayName = item.product_name || item.name || `Produto ${item.product_id?.slice(0, 8) || '?'}`;
                      const unitPrice = item.price_cents || item.unit_price_cents || 0;
                      const totalPrice = item.total_price_cents || (unitPrice * (item.quantity || 1));
                      const kitSize = item.kit_size || 1;
                      const displayQty = kitSize > 1 ? `${kitSize} un` : `${item.quantity || 1}`;
                      
                      return (
                        <div key={index} className="flex items-center gap-3 p-4 border rounded-lg">
                          {item.image_url && (
                            <img src={item.image_url} alt={displayName} className="w-12 h-12 rounded object-cover" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{displayName}</p>
                            <p className="text-sm text-muted-foreground">{displayQty} x {formatCurrency(unitPrice)}</p>
                          </div>
                          <div className="text-right font-semibold">{formatCurrency(totalPrice)}</div>
                        </div>
                      );
                    })}
                    <div className="flex justify-between font-bold pt-4 border-t">
                      <span>Total do Carrinho</span>
                      <span className="text-lg">{formatCurrency(cart.total_cents)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhum item no carrinho</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking/Attribution Tab */}
          <TabsContent value="tracking" className="space-y-4 mt-4">
            {/* Source */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground text-xs">Tipo</span>
                    <p className="font-medium">{getSourceTypeLabel(cart.source_type) || cart.storefront?.name || cart.landing_page?.name || 'Não identificado'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Loja/Landing</span>
                    <p className="font-medium">{cart.storefront?.name || cart.landing_page?.name || '—'}</p>
                  </div>
                </div>
                {cart.source_url && (
                  <div>
                    <span className="text-muted-foreground text-xs">URL de origem</span>
                    <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded mt-1">{cart.source_url}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* UTMs */}
            {hasUtms && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" /> UTMs / Atribuição
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {cart.utm_source && <UtmRow label="source" value={cart.utm_source} />}
                    {cart.utm_medium && <UtmRow label="medium" value={cart.utm_medium} />}
                    {cart.utm_campaign && <UtmRow label="campaign" value={cart.utm_campaign} />}
                    {cart.utm_term && <UtmRow label="term" value={cart.utm_term} />}
                    {cart.utm_content && <UtmRow label="content" value={cart.utm_content} />}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Device Info */}
            {hasDeviceInfo && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> Dispositivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(cart.device_info, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Payment Info */}
            {(cart.payment_method || cart.checkout_started_at || cart.payment_attempted_at) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {cart.payment_method && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método</span>
                      <span className="font-medium">{getPaymentMethodLabel(cart.payment_method)}</span>
                    </div>
                  )}
                  {cart.checkout_started_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Checkout iniciado</span>
                      <span>{format(new Date(cart.checkout_started_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                  {cart.payment_attempted_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pagamento tentado</span>
                      <span>{format(new Date(cart.payment_attempted_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!hasUtms && !hasDeviceInfo && !cart.source_url && !cart.payment_method && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhum dado de rastreamento disponível para este carrinho
              </p>
            )}
          </TabsContent>

          {/* Events Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Cart creation */}
                  <TimelineItem
                    color="bg-primary"
                    title="Carrinho criado"
                    subtitle={cart.storefront?.name || cart.landing_page?.name || 'Origem desconhecida'}
                    date={cart.created_at}
                  />

                  {/* Checkout events from DB */}
                  {checkoutEvents?.map((event: any, idx: number) => {
                    const config = EVENT_CONFIG[event.event_type] || { label: event.event_type, color: 'bg-muted', icon: '📌' };
                    const eventData = event.event_data && typeof event.event_data === 'object' ? event.event_data : null;
                    
                    return (
                      <TimelineItem
                        key={idx}
                        color={config.color}
                        title={`${config.icon} ${config.label}`}
                        subtitle={
                          <>
                            {event.customer_name && !cart.customer_name && (
                              <span className="text-foreground font-medium">{event.customer_name} </span>
                            )}
                            {event.error_message && (
                              <span className="text-destructive">{event.error_message}</span>
                            )}
                            {eventData?.payment_method && (
                              <span>Método: {getPaymentMethodLabel(eventData.payment_method as string)}</span>
                            )}
                            {eventData?.items_count && (
                              <span>{eventData.items_count} itens</span>
                            )}
                          </>
                        }
                        date={event.created_at}
                        extra={event.user_agent ? (
                          <p className="text-xs text-muted-foreground truncate max-w-sm" title={event.user_agent}>
                            🌐 {event.user_agent.slice(0, 60)}...
                          </p>
                        ) : null}
                      />
                    );
                  })}

                  {/* Abandoned */}
                  {cart.abandoned_at && (
                    <TimelineItem color="bg-destructive" title="Marcado como abandonado" date={cart.abandoned_at} />
                  )}

                  {/* Recovery */}
                  {cart.recovery_whatsapp_sent_at && (
                    <TimelineItem color="bg-green-500" title="WhatsApp de recuperação enviado" date={cart.recovery_whatsapp_sent_at} />
                  )}
                  {cart.recovery_email_sent_at && (
                    <TimelineItem color="bg-blue-500" title="E-mail de recuperação enviado" date={cart.recovery_email_sent_at} />
                  )}

                  {/* Last update */}
                  <TimelineItem color="bg-muted-foreground/30" title="Última atualização" date={cart.updated_at} />

                  {(!checkoutEvents || checkoutEvents.length === 0) && !cart.abandoned_at && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum evento de checkout registrado
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Helper components
function InfoRow({ icon, label, value, onCopy }: { icon: React.ReactNode; label: string; value: string | null | undefined; onCopy: (text: string, label: string) => void }) {
  if (!value) {
    return (
      <p className="text-muted-foreground text-sm flex items-center gap-2">
        {icon} {label} não informado
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium">{value}</span>
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onCopy(value, label)}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function UtmRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">utm_{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function TimelineItem({ color, title, subtitle, date, extra }: { 
  color: string; title: string; subtitle?: React.ReactNode; date: string; extra?: React.ReactNode 
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`h-2.5 w-2.5 mt-1.5 rounded-full shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="font-medium text-sm">{title}</p>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        <p className="text-xs text-muted-foreground">
          {format(new Date(date), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          <span className="ml-1">({formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })})</span>
        </p>
        {extra}
      </div>
    </div>
  );
}
