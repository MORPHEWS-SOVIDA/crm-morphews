import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Package, 
  ShoppingCart, 
  Clock,
  MessageCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  price_cents: number;
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

export function CartDetailDialog({ open, onOpenChange, cart, onSendRecoveryWhatsApp }: CartDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('customer');

  if (!cart) return null;

  const statusConfig = STATUS_CONFIG[cart.status] || STATUS_CONFIG.open;
  const items = Array.isArray(cart.items) ? cart.items : [];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Detalhes do Carrinho
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-mono text-xs">{cart.id.slice(0, 8)}</span>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            <span className="text-xs">
              {format(new Date(cart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="customer" className="gap-1">
              <User className="h-4 w-4" />
              Cliente
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-1">
              <Package className="h-4 w-4" />
              Itens ({items.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1">
              <Clock className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Customer Tab */}
          <TabsContent value="customer" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Informações do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.customer_name ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{cart.customer_name}</span>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(cart.customer_name!, 'Nome')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nome não informado
                  </p>
                )}

                {cart.customer_email ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{cart.customer_email}</span>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(cart.customer_email!, 'E-mail')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail não informado
                  </p>
                )}

                {cart.customer_phone ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{formatPhone(cart.customer_phone)}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(cart.customer_phone!, 'Telefone')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-green-600 hover:text-green-700"
                        onClick={openWhatsApp}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone não informado
                  </p>
                )}

                {cart.customer_cpf && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">CPF:</span>
                      <span>{cart.customer_cpf}</span>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(cart.customer_cpf!, 'CPF')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {(cart.shipping_cep || cart.shipping_address) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {cart.shipping_address && <p>{cart.shipping_address}</p>}
                  {(cart.shipping_city || cart.shipping_state) && (
                    <p>{cart.shipping_city} - {cart.shipping_state}</p>
                  )}
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
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={openWhatsApp}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Abrir WhatsApp
                  </Button>
                  {!cart.recovery_whatsapp_sent_at && onSendRecoveryWhatsApp && (
                    <Button 
                      variant="default" 
                      className="gap-2"
                      onClick={() => onSendRecoveryWhatsApp(cart.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Enviar Mensagem de Recuperação
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
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.product_name || `Produto ${item.product_id.slice(0, 8)}`}</p>
                          <p className="text-sm text-muted-foreground">
                            Qtd: {item.quantity} x {formatCurrency(item.price_cents)}
                          </p>
                        </div>
                        <div className="text-right font-semibold">
                          {formatCurrency(item.price_cents * item.quantity)}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-4 border-t">
                      <span>Total do Carrinho</span>
                      <span className="text-lg">{formatCurrency(cart.total_cents)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum item no carrinho
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">Carrinho criado</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(cart.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Origem: {cart.storefront?.name || cart.landing_page?.name || 'Desconhecida'}
                      </p>
                    </div>
                  </div>

                  {cart.abandoned_at && (
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 mt-2 rounded-full bg-destructive" />
                      <div>
                        <p className="font-medium">Marcado como abandonado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(cart.abandoned_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}

                  {cart.recovery_whatsapp_sent_at && (
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 mt-2 rounded-full bg-green-500" />
                      <div>
                        <p className="font-medium">WhatsApp de recuperação enviado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(cart.recovery_whatsapp_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}

                  {cart.recovery_email_sent_at && (
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 mt-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="font-medium">E-mail de recuperação enviado</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(cart.recovery_email_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 mt-2 rounded-full bg-muted" />
                    <div>
                      <p className="font-medium">Última atualização</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(cart.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
