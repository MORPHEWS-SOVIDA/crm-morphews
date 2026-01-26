import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Wallet, ShoppingBag, Link2, ArrowUpRight, 
  Copy, LogOut, User, Clock, Check, X,
  TrendingUp, DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  useMyPartnerAssociations,
  partnerTypeLabels,
  partnerTypeColors,
  formatCommission,
} from '@/hooks/ecommerce/usePartners';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function PartnerPortal() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: associations, isLoading } = useMyPartnerAssociations();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  // Calculate totals
  const totalBalance = associations?.reduce(
    (sum, a) => sum + (a.virtual_account?.balance_cents || 0),
    0
  ) || 0;
  
  const totalPending = associations?.reduce(
    (sum, a) => sum + (a.virtual_account?.pending_balance_cents || 0),
    0
  ) || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!associations?.length) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Nenhuma parceria encontrada</h2>
            <p className="text-muted-foreground mb-4">
              Você ainda não está associado a nenhuma organização como parceiro.
            </p>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Portal do Parceiro</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-white/20">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-green-100">Saldo Disponível</p>
                  <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="secondary" size="sm" disabled>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Solicitar Saque
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendente</p>
                  <p className="text-3xl font-bold">{formatCurrency(totalPending)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Valor em período de carência (geralmente 14-30 dias)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Partnerships */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Parcerias</CardTitle>
            <CardDescription>
              Organizações em que você é parceiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {associations.map((association) => (
                <div
                  key={association.id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {association.organization?.name || 'Organização'}
                      </span>
                      <Badge className={partnerTypeColors[association.partner_type]}>
                        {partnerTypeLabels[association.partner_type]}
                      </Badge>
                      {!association.is_active && (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </div>
                    <Badge variant="outline">
                      {formatCommission(association.commission_type, association.commission_value)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Saldo</p>
                      <p className="font-medium">
                        {formatCurrency(association.virtual_account?.balance_cents || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pendente</p>
                      <p className="font-medium text-amber-600">
                        {formatCurrency(association.virtual_account?.pending_balance_cents || 0)}
                      </p>
                    </div>
                    {association.product && (
                      <div>
                        <p className="text-muted-foreground">Produto</p>
                        <p className="font-medium">{association.product.name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Desde</p>
                      <p className="font-medium">
                        {format(new Date(association.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {/* Affiliate Link */}
                  {association.partner_type === 'affiliate' && association.affiliate_code && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Seu link de afiliado:</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          ?ref={association.affiliate_code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(association.affiliate_code!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Liability Warning */}
                  {(association.responsible_for_refunds || association.responsible_for_chargebacks) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Responsável por{' '}
                      {association.responsible_for_refunds && association.responsible_for_chargebacks
                        ? 'estornos e chargebacks'
                        : association.responsible_for_refunds
                        ? 'estornos'
                        : 'chargebacks'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TODO: Add sales history, withdrawal history, etc. */}
      </main>
    </div>
  );
}
