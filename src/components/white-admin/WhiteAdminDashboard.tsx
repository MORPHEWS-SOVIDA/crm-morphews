import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyWhiteLabelConfig, useWhiteAdminStats, useWhiteLabelCustomers } from '@/hooks/useWhiteAdmin';
import { Building2, Users, Wallet, Package, TrendingUp, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function WhiteAdminDashboard() {
  const { data: wlData } = useMyWhiteLabelConfig();
  const configId = wlData?.white_label_configs?.id;
  const { data: stats, isLoading: statsLoading } = useWhiteAdminStats(configId);
  const { data: customers } = useWhiteLabelCustomers(configId);
  
  const brandName = wlData?.white_label_configs?.brand_name || 'Sua Marca';
  const primaryColor = wlData?.white_label_configs?.primary_color || '#8B5CF6';
  
  // Recent customers (last 5)
  const recentCustomers = customers?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          Bem-vindo ao {brandName}
        </h1>
        <p className="text-muted-foreground">
          Gerencie seus clientes, planos e configurações da sua franquia.
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeCustomers || 0} ativos
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalRevenueCents || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Recorrente estimada
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPlans || 0}</div>
            <p className="text-xs text-muted-foreground">
              Configurados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.pendingCommissionsCents || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              A receber
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions + Recent Customers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a 
              href="/white-admin/organizacoes" 
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Building2 className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="font-medium">Adicionar Cliente</p>
                <p className="text-sm text-muted-foreground">Cadastrar nova organização</p>
              </div>
            </a>
            
            <a 
              href="/white-admin/planos" 
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Package className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="font-medium">Criar Plano</p>
                <p className="text-sm text-muted-foreground">Definir preços e recursos</p>
              </div>
            </a>
            
            <a 
              href="/white-admin/branding" 
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Users className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="font-medium">Personalizar Marca</p>
                <p className="text-sm text-muted-foreground">Logo, cores e domínio</p>
              </div>
            </a>
          </CardContent>
        </Card>
        
        {/* Recent Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Clientes Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum cliente ainda</p>
                <p className="text-sm">Adicione seu primeiro cliente!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCustomers.map((customer) => (
                  <div 
                    key={customer.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {customer.organization?.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{customer.organization?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.plan?.name || 'Sem plano'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        customer.status === 'active' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {customer.status === 'active' ? 'Ativo' : customer.status}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(customer.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
