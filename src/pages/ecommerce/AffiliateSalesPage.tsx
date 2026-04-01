import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Package, DollarSign, TrendingUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AffiliateSalesPage() {
  const { profile } = useAuth();

  // Get affiliate's virtual account
  const { data: virtualAccount, isLoading: loadingAccount } = useQuery({
    queryKey: ['affiliate-virtual-account', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;

      // Check profile's partner_virtual_account_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('partner_virtual_account_id')
        .eq('user_id', profile.user_id)
        .single();

      if (profileData?.partner_virtual_account_id) {
        const { data: account } = await supabase
          .from('virtual_accounts')
          .select('*')
          .eq('id', profileData.partner_virtual_account_id)
          .single();
        return account;
      }

      // Fallback: directly linked
      const { data: account } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      return account;
    },
    enabled: !!profile?.user_id,
  });

  // Get sales splits for affiliate
  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ['affiliate-sales-splits', virtualAccount?.id],
    queryFn: async () => {
      if (!virtualAccount?.id) return [];
      const { data, error } = await supabase
        .from('sale_splits')
        .select(`
          id,
          sale_id,
          gross_amount_cents,
          net_amount_cents,
          split_type,
          created_at,
          sale:sales(
            id, status, total_cents, created_at,
            lead:leads(name)
          )
        `)
        .eq('virtual_account_id', virtualAccount.id)
        .in('split_type', ['affiliate', 'coproducer', 'affiliate_manager'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!virtualAccount?.id,
  });

  const totalGross = sales?.reduce((sum, s) => sum + (s.gross_amount_cents || 0), 0) || 0;
  const totalNet = sales?.reduce((sum, s) => sum + (s.net_amount_cents || 0), 0) || 0;

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: 'Rascunho', variant: 'secondary' },
      pending_payment: { label: 'Aguardando', variant: 'outline' },
      paid: { label: 'Pago', variant: 'default' },
      payment_confirmed: { label: 'Confirmado', variant: 'default' },
      shipped: { label: 'Enviado', variant: 'default' },
      delivered: { label: 'Entregue', variant: 'default' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
    };
    const cfg = map[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  if (loadingAccount || loadingSales) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minhas Vendas</h1>
          <p className="text-muted-foreground">Vendas e comissões como afiliado</p>
        </div>

        {!virtualAccount ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Sua conta virtual ainda não foi configurada. Entre em contato com o administrador.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sales?.length || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valor Bruto</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sua Comissão</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(totalNet)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                {sales && sales.length > 0 ? (
                  <div className="space-y-3">
                    {sales.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{s.sale_id?.slice(0, 8)}</span>
                            {s.sale?.status && getStatusBadge(s.sale.status)}
                            <Badge variant="outline" className="text-xs">
                              {s.split_type === 'affiliate' ? 'Afiliado' : s.split_type === 'coproducer' ? 'Co-produtor' : s.split_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {s.sale?.lead?.name || 'Cliente'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            {formatCurrency(s.net_amount_cents)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="ml-2" onClick={() => window.open(`/ecommerce/vendas/${s.sale_id}`, '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma venda encontrada ainda.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
