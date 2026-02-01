import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Wallet, Users, Link2, ArrowUpRight, 
  Copy, LogOut, TrendingUp, Plus, ExternalLink,
  CheckCircle, Clock, XCircle, Trash2, Settings,
  Sparkles
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  useMyImplementer,
  useImplementerSales,
  useImplementerCommissions,
  useImplementerLinks,
  useDeleteImplementerLink,
} from '@/hooks/useImplementer';
import { CreateCheckoutLinkDialog } from '@/components/implementer/CreateCheckoutLinkDialog';
import { WhiteLabelConfigPanel } from '@/components/implementer/WhiteLabelConfigPanel';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const commissionTypeLabels: Record<string, string> = {
  implementation_fee: 'Taxa de Implementação',
  first_month: '1ª Mensalidade (40%)',
  recurring: 'Recorrente (10%)',
};

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: 'Ativo', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  churned: { label: 'Churned', variant: 'secondary' },
  pending: { label: 'Pendente', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
};

export default function ImplementerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: implementer, isLoading: isLoadingImplementer } = useMyImplementer();
  const { data: sales, isLoading: isLoadingSales } = useImplementerSales(implementer?.id);
  const { data: commissions, isLoading: isLoadingCommissions } = useImplementerCommissions(implementer?.id);
  const { data: links, isLoading: isLoadingLinks } = useImplementerLinks(implementer?.id);
  const deleteLink = useDeleteImplementerLink();
  
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/implementador/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleCopyReferralLink = () => {
    if (!implementer) return;
    const url = `${window.location.origin}/planos?ref=${implementer.referral_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de indicação copiado!');
  };

  // Calculate stats
  const totalEarnings = implementer?.total_earnings_cents || 0;
  const totalClients = sales?.filter(s => s.status === 'active').length || 0;
  const pendingCommissions = commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.net_amount_cents, 0) || 0;
  const paidCommissions = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.net_amount_cents, 0) || 0;

  if (isLoadingImplementer) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!implementer) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">
              Você não possui acesso ao painel de implementadores.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/')}>
                Ir para Home
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🚀 Painel do Implementador
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {implementer?.is_white_label && (
              <Button variant="default" size="sm" onClick={() => navigate('/white-admin')} className="bg-purple-600 hover:bg-purple-700">
                <Sparkles className="h-4 w-4 mr-2" />
                White Admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <Settings className="h-4 w-4 mr-2" />
              Sistema
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-white/20">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-green-100">Total Ganhos</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalEarnings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                  <p className="text-2xl font-bold">{totalClients}</p>
                </div>
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
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-2xl font-bold">{formatCurrency(pendingCommissions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Já Recebido</p>
                  <p className="text-2xl font-bold">{formatCurrency(paidCommissions)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Seu Link de Indicação
            </CardTitle>
            <CardDescription>
              Compartilhe este link para ganhar 40% na primeira mensalidade + 10% recorrente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="text-sm flex-1 truncate">
                {window.location.origin}/planos?ref={implementer.referral_code}
              </code>
              <Button size="sm" variant="secondary" onClick={handleCopyReferralLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Código: <strong>{implementer.referral_code}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="links" className="space-y-4">
          <TabsList>
            <TabsTrigger value="links">
              Links de Checkout ({links?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="clients">
              Clientes ({sales?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="commissions">
              Comissões ({commissions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="whitelabel" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              White Label
            </TabsTrigger>
          </TabsList>

          {/* Checkout Links Tab */}
          <TabsContent value="links">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Links de Checkout com Implementação</CardTitle>
                  <CardDescription>
                    Crie links personalizados com taxa de implementação
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateLinkOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Link
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingLinks ? (
                  <Skeleton className="h-32 w-full" />
                ) : links?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum link criado ainda</p>
                    <p className="text-sm">Crie um link para começar a vender com implementação</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Taxa Implementação</TableHead>
                        <TableHead>Total 1ª Cobrança</TableHead>
                        <TableHead>Usos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {links?.map((link) => {
                        const planPrice = link.subscription_plans?.price_cents || 0;
                        const total = planPrice + link.implementation_fee_cents;
                        return (
                          <TableRow key={link.id}>
                            <TableCell className="font-medium">
                              {link.subscription_plans?.name}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(planPrice)}/mês
                              </span>
                            </TableCell>
                            <TableCell>{formatCurrency(link.implementation_fee_cents)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(total)}</TableCell>
                            <TableCell>{link.uses_count}</TableCell>
                            <TableCell>
                              <Badge variant={link.is_active ? "default" : "secondary"}>
                                {link.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyLink(link.slug)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`/implementador/${link.slug}`, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteLink.mutate(link.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <CardTitle>Seus Clientes</CardTitle>
                <CardDescription>
                  Clientes que você trouxe para a plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingSales ? (
                  <Skeleton className="h-32 w-full" />
                ) : sales?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum cliente ainda</p>
                    <p className="text-sm">Compartilhe seus links para começar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Implementação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Desde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales?.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sale.client_organization?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {sale.client_organization?.owner_email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sale.subscription_plans?.name}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(sale.subscription_plans?.price_cents || 0)}/mês
                            </span>
                          </TableCell>
                          <TableCell>
                            {sale.implementation_fee_cents > 0 
                              ? formatCurrency(sale.implementation_fee_cents)
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadge[sale.status]?.variant || "outline"}>
                              {statusBadge[sale.status]?.label || sale.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Comissões</CardTitle>
                <CardDescription>
                  Todas as suas comissões geradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCommissions ? (
                  <Skeleton className="h-32 w-full" />
                ) : commissions?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma comissão ainda</p>
                    <p className="text-sm">Traga clientes para começar a ganhar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor Bruto</TableHead>
                        <TableHead>Taxa Plataforma</TableHead>
                        <TableHead>Valor Líquido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions?.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell>
                            {commissionTypeLabels[commission.commission_type] || commission.commission_type}
                            {commission.period_month && commission.period_month > 1 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (Mês {commission.period_month})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(commission.gross_amount_cents)}</TableCell>
                          <TableCell className="text-destructive">
                            {commission.platform_fee_cents > 0 
                              ? `-${formatCurrency(commission.platform_fee_cents)}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(commission.net_amount_cents)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadge[commission.status]?.variant || "outline"}>
                              {statusBadge[commission.status]?.label || commission.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* White Label Tab */}
          <TabsContent value="whitelabel">
            <WhiteLabelConfigPanel implementer={implementer} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Link Dialog */}
      {implementer && (
        <CreateCheckoutLinkDialog
          open={isCreateLinkOpen}
          onOpenChange={setIsCreateLinkOpen}
          implementerId={implementer.id}
        />
      )}
    </div>
  );
}
