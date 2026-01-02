import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Search,
  ShoppingCart,
  Eye,
  Truck,
  CreditCard,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Printer
} from 'lucide-react';
import { 
  useSales, 
  SaleStatus, 
  formatCurrency, 
  getStatusLabel, 
  getStatusColor 
} from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_TABS: { value: SaleStatus | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'Todas', icon: ShoppingCart },
  { value: 'draft', label: 'Rascunho', icon: Clock },
  { value: 'pending_expedition', label: 'Expedição', icon: Package },
  { value: 'dispatched', label: 'Despachado', icon: Truck },
  { value: 'delivered', label: 'Entregue', icon: CheckCircle },
  { value: 'payment_pending', label: 'Pgto Pendente', icon: CreditCard },
  { value: 'payment_confirmed', label: 'Confirmado', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelado', icon: XCircle },
];

export default function Sales() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SaleStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: sales = [], isLoading } = useSales(
    activeTab !== 'all' ? { status: activeTab } : undefined
  );

  const filteredSales = sales.filter(sale => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sale.lead?.name?.toLowerCase().includes(search) ||
      sale.lead?.whatsapp?.includes(search)
    );
  });

  const getStatusIcon = (status: SaleStatus) => {
    const tab = STATUS_TABS.find(t => t.value === status);
    if (tab) {
      const Icon = tab.icon;
      return <Icon className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Vendas</h1>
            <p className="text-muted-foreground">Gerencie suas vendas e romaneios</p>
          </div>
          <Button onClick={() => navigate('/vendas/nova')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Venda
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SaleStatus | 'all')}>
          <TabsList className="flex-wrap h-auto gap-1">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma venda encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'Tente outro termo de busca' : 'Crie sua primeira venda'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => navigate('/vendas/nova')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Venda
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredSales.map((sale) => (
                  <Card key={sale.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Client Avatar */}
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-primary" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                              #{sale.romaneio_number}
                            </span>
                            <h3 className="font-medium truncate">{sale.lead?.name || 'Cliente'}</h3>
                            <Badge className={getStatusColor(sale.status)}>
                              {getStatusIcon(sale.status)}
                              <span className="ml-1">{getStatusLabel(sale.status)}</span>
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{sale.lead?.whatsapp}</span>
                            <span>•</span>
                            <span>
                              {format(new Date(sale.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(sale.total_cents)}
                          </p>
                          {sale.discount_cents > 0 && (
                            <p className="text-xs text-green-600">
                              -{formatCurrency(sale.discount_cents)} desc.
                            </p>
                          )}
                        </div>

                        {/* Actions - Always visible */}
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/vendas/${sale.id}`)}
                            className="gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Ver</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/vendas/${sale.id}/romaneio`)}
                            className="gap-1"
                          >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">Imprimir</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
