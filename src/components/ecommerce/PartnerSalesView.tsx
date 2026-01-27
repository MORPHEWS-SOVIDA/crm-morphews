import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, Package, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PartnerSale {
  id: string;
  sale_id: string;
  gross_amount_cents: number;
  net_amount_cents: number;
  split_type: string;
  created_at: string;
  sale: {
    id: string;
    status: string;
    total_cents: number;
    created_at: string;
    lead: {
      name: string;
    } | null;
  } | null;
}

export function PartnerSalesView() {
  const { profile } = useAuth();

  // First get the partner's virtual account
  const { data: virtualAccount, isLoading: loadingAccount } = useQuery({
    queryKey: ['partner-virtual-account', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;

      // Check if user has a partner virtual account linked via profile
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

      // Fallback: check virtual_accounts directly linked to user
      const { data: account } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      return account;
    },
    enabled: !!profile?.user_id,
  });

  // Get sales splits for this partner's virtual account
  const { data: partnerSales, isLoading: loadingSales } = useQuery({
    queryKey: ['partner-sales', virtualAccount?.id],
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
            id,
            status,
            total_cents,
            created_at,
            lead:leads(name)
          )
        `)
        .eq('virtual_account_id', virtualAccount.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as PartnerSale[];
    },
    enabled: !!virtualAccount?.id,
  });

  // Calculate totals
  const totalGross = partnerSales?.reduce((sum, s) => sum + (s.gross_amount_cents || 0), 0) || 0;
  const totalNet = partnerSales?.reduce((sum, s) => sum + (s.net_amount_cents || 0), 0) || 0;
  const totalSales = partnerSales?.length || 0;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: 'Rascunho', variant: 'secondary' },
      pending_payment: { label: 'Aguardando Pgto', variant: 'outline' },
      paid: { label: 'Pago', variant: 'default' },
      shipped: { label: 'Enviado', variant: 'default' },
      delivered: { label: 'Entregue', variant: 'default' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
    };
    const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loadingAccount || loadingSales) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!virtualAccount) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Sua conta virtual ainda não foi configurada. Entre em contato com o administrador.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">
              vendas com sua participação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
            <p className="text-xs text-muted-foreground">
              total bruto das vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalNet)}</div>
            <p className="text-xs text-muted-foreground">
              seu recebível total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Minhas Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {partnerSales && partnerSales.length > 0 ? (
            <div className="space-y-3">
              {partnerSales.map((ps) => (
                <div
                  key={ps.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        #{ps.sale_id.slice(0, 8)}
                      </span>
                      {ps.sale?.status && getStatusBadge(ps.sale.status)}
                      <Badge variant="outline" className="text-xs">
                        {ps.split_type === 'factory' ? 'Fábrica' : 
                         ps.split_type === 'industry' ? 'Indústria' :
                         ps.split_type === 'affiliate' ? 'Afiliado' : ps.split_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ps.sale?.lead?.name || 'Cliente não identificado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ps.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Bruto: {formatCurrency(ps.gross_amount_cents)}
                    </p>
                    <p className="font-medium text-green-600">
                      Líquido: {formatCurrency(ps.net_amount_cents)}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-4"
                    onClick={() => window.open(`/vendas/${ps.sale_id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma venda encontrada ainda.</p>
              <p className="text-sm">Suas vendas aparecerão aqui quando houver pedidos com seus produtos.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
