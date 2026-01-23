import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingCart, Clock, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Cart {
  id: string;
  session_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_cents: number;
  status: 'active' | 'abandoned' | 'converted' | 'expired';
  created_at: string;
  updated_at: string;
  abandoned_at: string | null;
  recovery_whatsapp_sent_at: string | null;
  storefront?: { name: string } | null;
  landing_page?: { name: string } | null;
  lead?: { name: string } | null;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function getStatusConfig(status: Cart['status']) {
  switch (status) {
    case 'active':
      return { label: 'Ativo', variant: 'default' as const, icon: Clock };
    case 'abandoned':
      return { label: 'Abandonado', variant: 'destructive' as const, icon: XCircle };
    case 'converted':
      return { label: 'Convertido', variant: 'secondary' as const, icon: CheckCircle };
    case 'expired':
      return { label: 'Expirado', variant: 'outline' as const, icon: XCircle };
    default:
      return { label: status, variant: 'outline' as const, icon: Clock };
  }
}

export function CartsManager() {
  const { data: carts, isLoading } = useQuery({
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

  const abandonedCarts = carts?.filter((c) => c.status === 'abandoned') || [];
  const activeCarts = carts?.filter((c) => c.status === 'active') || [];
  const convertedCarts = carts?.filter((c) => c.status === 'converted') || [];

  const totalAbandoned = abandonedCarts.reduce((acc, c) => acc + c.total_cents, 0);
  const totalConverted = convertedCarts.reduce((acc, c) => acc + c.total_cents, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Carrinhos Ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCarts.length}</div>
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
            <CardDescription>Convertidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{convertedCarts.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totalConverted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Conversão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {carts && carts.length > 0
                ? ((convertedCarts.length / carts.length) * 100).toFixed(1)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abandoned Carts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrinhos Abandonados
          </CardTitle>
          <CardDescription>
            Carrinhos que podem ser recuperados via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {abandonedCarts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum carrinho abandonado no momento 🎉
            </p>
          ) : (
            <div className="space-y-4">
              {abandonedCarts.slice(0, 10).map((cart) => {
                const statusConfig = getStatusConfig(cart.status);
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
                        {formatDistanceToNow(new Date(cart.abandoned_at || cart.updated_at), {
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
                      {cart.customer_phone && !cart.recovery_whatsapp_sent_at && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
