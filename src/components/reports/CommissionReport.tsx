import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  DollarSign,
  Users,
  FileText,
  TrendingUp,
  Printer,
  ChevronDown,
  ChevronRight,
  Loader2,
  Calendar,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useSales } from '@/hooks/useSales';
import { useUsers } from '@/hooks/useUsers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface CommissionReportProps {
  onClose: () => void;
}

interface SaleWithItems {
  id: string;
  created_at: string;
  delivered_at: string | null;
  total_cents: number;
  status: string;
  payment_status: string;
  seller_user_id: string;
  seller_commission_cents: number | null;
  lead: { name: string } | null;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    total_cents: number;
    commission_cents: number | null;
    commission_percentage: number | null;
  }[];
}

interface SellerCommissionData {
  userId: string;
  name: string;
  totalSales: number;
  totalSalesValue: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
  sales: SaleWithItems[];
}

export function CommissionReport({ onClose }: CommissionReportProps) {
  const { tenantId } = useTenant();
  const [reportType, setReportType] = useState<'synthetic' | 'analytical'>('synthetic');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());

  const { data: users = [] } = useUsers();

  // Fetch sales with items for the selected month
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['commission-report', tenantId, selectedMonth],
    queryFn: async () => {
      if (!tenantId) return [];

      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = startOfMonth(new Date(year, month - 1));
      const endDate = endOfMonth(new Date(year, month - 1));

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          delivered_at,
          total_cents,
          status,
          payment_status,
          seller_user_id,
          seller_commission_cents,
          leads!inner (name),
          sale_items (
            id,
            product_name,
            quantity,
            total_cents,
            commission_cents,
            commission_percentage
          )
        `)
        .eq('organization_id', tenantId)
        .neq('status', 'cancelled')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((sale: any) => ({
        ...sale,
        lead: sale.leads,
        items: sale.sale_items || [],
      })) as SaleWithItems[];
    },
    enabled: !!tenantId,
  });

  // Get default commission percentages for sellers
  const { data: memberCommissions } = useQuery({
    queryKey: ['member-commissions', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};

      const { data } = await supabase
        .from('organization_members')
        .select('user_id, commission_percentage')
        .eq('organization_id', tenantId);

      const map: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        map[m.user_id] = Number(m.commission_percentage) || 0;
      });
      return map;
    },
    enabled: !!tenantId,
  });

  // Process data by seller
  const sellerData = useMemo(() => {
    if (!salesData) return [];

    const sellersMap = new Map<string, SellerCommissionData>();

    salesData.forEach((sale) => {
      if (!sale.seller_user_id) return;

      const seller = users.find((u) => u.id === sale.seller_user_id);
      const sellerName = seller
        ? `${seller.first_name} ${seller.last_name}`
        : 'Vendedor Desconhecido';

      if (!sellersMap.has(sale.seller_user_id)) {
        sellersMap.set(sale.seller_user_id, {
          userId: sale.seller_user_id,
          name: sellerName,
          totalSales: 0,
          totalSalesValue: 0,
          totalCommission: 0,
          pendingCommission: 0,
          paidCommission: 0,
          sales: [],
        });
      }

      const sellerInfo = sellersMap.get(sale.seller_user_id)!;
      sellerInfo.totalSales++;
      sellerInfo.totalSalesValue += sale.total_cents;
      sellerInfo.sales.push(sale);

      // Calculate commission from items
      let saleCommission = 0;
      if (sale.items && sale.items.length > 0) {
        saleCommission = sale.items.reduce(
          (sum, item) => sum + (item.commission_cents || 0),
          0
        );
      }

      // Fallback to seller's default commission percentage
      if (saleCommission === 0) {
        const defaultPercentage = memberCommissions?.[sale.seller_user_id] || 0;
        saleCommission = Math.round(sale.total_cents * (defaultPercentage / 100));
      }

      sellerInfo.totalCommission += saleCommission;

      // Separate pending vs paid
      const isDelivered = sale.status === 'delivered';
      const isPaid =
        sale.payment_status === 'paid_now' ||
        sale.payment_status === 'paid_in_delivery';

      if (isDelivered && isPaid) {
        sellerInfo.paidCommission += saleCommission;
      } else {
        sellerInfo.pendingCommission += saleCommission;
      }
    });

    let result = Array.from(sellersMap.values()).sort(
      (a, b) => b.totalCommission - a.totalCommission
    );

    if (selectedSeller !== 'all') {
      result = result.filter((s) => s.userId === selectedSeller);
    }

    return result;
  }, [salesData, users, memberCommissions, selectedSeller]);

  // Totals
  const totals = useMemo(() => {
    return sellerData.reduce(
      (acc, seller) => ({
        totalSales: acc.totalSales + seller.totalSales,
        totalValue: acc.totalValue + seller.totalSalesValue,
        totalCommission: acc.totalCommission + seller.totalCommission,
        pendingCommission: acc.pendingCommission + seller.pendingCommission,
        paidCommission: acc.paidCommission + seller.paidCommission,
      }),
      {
        totalSales: 0,
        totalValue: 0,
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
      }
    );
  }, [sellerData]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string, paymentStatus: string) => {
    const isDelivered = status === 'delivered';
    const isPaid = paymentStatus === 'paid_now' || paymentStatus === 'paid_in_delivery';

    if (isDelivered && isPaid) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          Pago
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
        Pendente
      </Badge>
    );
  };

  const toggleSeller = (userId: string) => {
    setExpandedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSale = (saleId: string) => {
    setExpandedSales((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) {
        next.delete(saleId);
      } else {
        next.add(saleId);
      }
      return next;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, "MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Relatório de Comissões</h1>
            <p className="text-muted-foreground">
              Acompanhe as comissões dos vendedores
            </p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Relatório de Comissões</h1>
        <p className="text-sm text-muted-foreground">
          {monthOptions.find((m) => m.value === selectedMonth)?.label}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 print:hidden">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedSeller} onValueChange={setSelectedSeller}>
          <SelectTrigger className="w-[200px]">
            <Users className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Vendedores</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs
          value={reportType}
          onValueChange={(v) => setReportType(v as 'synthetic' | 'analytical')}
        >
          <TabsList>
            <TabsTrigger value="synthetic">Sintético</TabsTrigger>
            <TabsTrigger value="analytical">Analítico</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5 print:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Total Vendido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totals.totalValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comissões Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.totalCommission)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Pagar (Pagas+Entregues)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totals.paidCommission)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totals.pendingCommission)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : sellerData.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Nenhuma venda encontrada</h3>
          <p className="text-muted-foreground">
            Não há vendas para o período selecionado.
          </p>
        </Card>
      ) : reportType === 'synthetic' ? (
        /* Synthetic Report - Summary by Seller */
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Valor Vendido</TableHead>
                <TableHead className="text-right">Comissão Total</TableHead>
                <TableHead className="text-right">A Pagar</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellerData.map((seller) => (
                <TableRow key={seller.userId}>
                  <TableCell className="font-medium">{seller.name}</TableCell>
                  <TableCell className="text-center">{seller.totalSales}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(seller.totalSalesValue)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(seller.totalCommission)}
                  </TableCell>
                  <TableCell className="text-right text-blue-600">
                    {formatCurrency(seller.paidCommission)}
                  </TableCell>
                  <TableCell className="text-right text-amber-600">
                    {formatCurrency(seller.pendingCommission)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-center">{totals.totalSales}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.totalValue)}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {formatCurrency(totals.totalCommission)}
                </TableCell>
                <TableCell className="text-right text-blue-600">
                  {formatCurrency(totals.paidCommission)}
                </TableCell>
                <TableCell className="text-right text-amber-600">
                  {formatCurrency(totals.pendingCommission)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Analytical Report - Detailed by Sale and Product */
        <div className="space-y-4">
          {sellerData.map((seller) => (
            <Card key={seller.userId}>
              <Collapsible
                open={expandedSellers.has(seller.userId)}
                onOpenChange={() => toggleSeller(seller.userId)}
              >
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex flex-row items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      {expandedSellers.has(seller.userId) ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                      <div className="text-left">
                        <h3 className="font-semibold">{seller.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {seller.totalSales} vendas • {formatCurrency(seller.totalSalesValue)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        {formatCurrency(seller.totalCommission)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A pagar: {formatCurrency(seller.paidCommission)}
                      </p>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {seller.sales.map((sale) => {
                        const saleCommission = sale.items.reduce(
                          (sum, item) => sum + (item.commission_cents || 0),
                          0
                        ) || Math.round(
                          sale.total_cents *
                            ((memberCommissions?.[sale.seller_user_id] || 0) / 100)
                        );

                        return (
                          <Collapsible
                            key={sale.id}
                            open={expandedSales.has(sale.id)}
                            onOpenChange={() => toggleSale(sale.id)}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                <div className="flex items-center gap-3">
                                  {expandedSales.has(sale.id) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  <div className="text-left">
                                    <span className="font-medium">
                                      {sale.lead?.name || 'Cliente'}
                                    </span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                      {format(parseISO(sale.created_at), 'dd/MM/yyyy')}
                                    </span>
                                  </div>
                                  {getStatusBadge(sale.status, sale.payment_status)}
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">
                                    {formatCurrency(sale.total_cents)}
                                  </span>
                                  <span className="text-sm text-green-600 ml-4">
                                    Comissão: {formatCurrency(saleCommission)}
                                  </span>
                                </div>
                              </div>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <div className="ml-8 mt-2 space-y-1">
                                {sale.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between p-2 rounded bg-background border text-sm"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Package className="w-4 h-4 text-muted-foreground" />
                                      <span>
                                        {item.quantity}x {item.product_name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span>{formatCurrency(item.total_cents)}</span>
                                      <span className="text-green-600 min-w-[100px] text-right">
                                        {item.commission_cents
                                          ? formatCurrency(item.commission_cents)
                                          : item.commission_percentage
                                          ? `${item.commission_percentage}%`
                                          : '-'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}

          {/* Totals Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">TOTAL GERAL</span>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Vendas</p>
                    <p className="font-bold">{totals.totalSales}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Valor Vendido</p>
                    <p className="font-bold text-primary">
                      {formatCurrency(totals.totalValue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">A Pagar</p>
                    <p className="font-bold text-green-600">
                      {formatCurrency(totals.paidCommission)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
