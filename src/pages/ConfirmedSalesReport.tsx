import { useState } from 'react';
import { SmartLayout } from '@/components/layout/SmartLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
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
import { 
  FileCheck, 
  CalendarIcon, 
  Download, 
  ChevronDown, 
  ChevronRight,
  Users,
  CreditCard,
  TrendingUp,
  Package,
  Truck,
  Loader2,
  Store,
  Bike,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useConfirmedSalesReport, DateFilterType, ConfirmedSaleItem } from '@/hooks/useConfirmedSalesReport';
import { cn } from '@/lib/utils';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatPhone(phone: string | null): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

function getDeliveryIcon(type: string | null) {
  switch (type) {
    case 'pickup': return <Store className="w-4 h-4" />;
    case 'motoboy': return <Bike className="w-4 h-4" />;
    case 'carrier': return <Truck className="w-4 h-4" />;
    default: return <Package className="w-4 h-4" />;
  }
}

function getDeliveryLabel(type: string | null): string {
  switch (type) {
    case 'pickup': return 'Balcão';
    case 'motoboy': return 'Motoboy';
    case 'carrier': return 'Transportadora';
    default: return '-';
  }
}

export default function ConfirmedSalesReport() {
  const [dateType, setDateType] = useState<DateFilterType>('delivered_at');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showReport, setShowReport] = useState(false);
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());

  const filters = showReport ? { dateType, startDate, endDate } : null;
  const { data: report, isLoading } = useConfirmedSalesReport(filters);

  const toggleSeller = (sellerId: string) => {
    setExpandedSellers(prev => {
      const next = new Set(prev);
      if (next.has(sellerId)) {
        next.delete(sellerId);
      } else {
        next.add(sellerId);
      }
      return next;
    });
  };

  const handleGenerateReport = () => {
    setShowReport(true);
  };

  const handleExportCSV = () => {
    if (!report?.sales.length) return;

    const BOM = '\uFEFF';
    const headers = [
      'Romaneio',
      'Data Venda',
      'Data Entrega',
      'Tipo Entrega',
      'Custo Etiqueta',
      'Custo Produtos',
      'Forma Pagamento',
      'Cliente',
      'WhatsApp',
      'Vendedor',
      'Comissão %',
      'Comissão R$',
      'Total Venda',
    ];

    const rows = report.sales.map(sale => [
      sale.romaneio_number || '',
      sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
      sale.delivered_at ? format(new Date(sale.delivered_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
      getDeliveryLabel(sale.delivery_type),
      ((sale.shipping_cost_cents || 0) / 100).toFixed(2).replace('.', ','),
      (sale.product_cost_cents / 100).toFixed(2).replace('.', ','),
      sale.payment_method || '',
      sale.lead_name || '',
      sale.lead_whatsapp || '',
      sale.seller_name || '',
      `${sale.commission_percentage || 0}%`,
      (sale.commission_cents / 100).toFixed(2).replace('.', ','),
      ((sale.total_cents || 0) / 100).toFixed(2).replace('.', ','),
    ]);

    const csvContent = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-vendas-confirmadas-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SmartLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileCheck className="w-6 h-6 text-green-600" />
              Relatório de Vendas Confirmadas
            </h1>
            <p className="text-muted-foreground">
              Vendas aprovadas pelo CFO (thiago@sonatura.com.br)
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurar Relatório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date type selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Filtrar por:</Label>
              <RadioGroup
                value={dateType}
                onValueChange={(v) => setDateType(v as DateFilterType)}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivered_at" id="delivered" />
                  <Label htmlFor="delivered" className="cursor-pointer">Data de Entrega</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="created_at" id="created" />
                  <Label htmlFor="created" className="cursor-pointer">Data de Venda</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-2">
                <Label>De:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => d && setStartDate(d)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Até:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(d) => d && setEndDate(d)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end">
                <Button onClick={handleGenerateReport} className="bg-green-600 hover:bg-green-700">
                  <FileCheck className="w-4 h-4 mr-2" />
                  Gerar Relatório
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading && (
          <Card>
            <CardContent className="py-16 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Report Results */}
        {showReport && report && !isLoading && (
          <>
            {report.sales.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <FileCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhuma venda confirmada no período</p>
                  <p className="text-sm">Tente ajustar as datas do filtro</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Seller Summary */}
                  <Card className="col-span-1 md:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        Resumo por Vendedor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {report.sellerSummaries.map(seller => (
                          <div key={seller.seller_user_id || '_none'} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <span className="font-medium">{seller.seller_name}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">{seller.total_sales} vendas</span>
                              <span className="font-semibold text-green-600">{formatCurrency(seller.total_cents)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Summary */}
                  <Card className="col-span-1 md:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-purple-600" />
                        Resumo por Forma de Pagamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {report.paymentSummaries.map(payment => (
                          <div key={payment.payment_method} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <span className="font-medium">{payment.payment_method}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-muted-foreground">{payment.total_sales} vendas</span>
                              <span className="font-semibold text-green-600">{formatCurrency(payment.total_cents)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* General Totals */}
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-800 dark:text-green-200">TOTAL GERAL</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Vendas:</span>
                          <span className="ml-2 font-bold">{report.totals.total_sales}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Custo Produtos:</span>
                          <span className="ml-2 font-bold text-orange-600">{formatCurrency(report.totals.total_product_cost_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Custo Etiquetas:</span>
                          <span className="ml-2 font-bold text-blue-600">{formatCurrency(report.totals.total_shipping_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Comissões:</span>
                          <span className="ml-2 font-bold text-purple-600">{formatCurrency(report.totals.total_commission_cents)}</span>
                        </div>
                        <div className="text-lg">
                          <span className="text-muted-foreground">Total Vendas:</span>
                          <span className="ml-2 font-bold text-green-600">{formatCurrency(report.totals.total_cents)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>

                {/* General Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Todas as Vendas</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Romaneio</TableHead>
                            <TableHead className="w-[100px]">Data Venda</TableHead>
                            <TableHead className="w-[100px]">Data Entrega</TableHead>
                            <TableHead className="w-[100px]">Entrega</TableHead>
                            <TableHead className="w-[100px] text-right">Etiqueta</TableHead>
                            <TableHead className="w-[100px] text-right">Custo Prod.</TableHead>
                            <TableHead>Pagamento</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>WhatsApp</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="w-[80px] text-right">Comissão %</TableHead>
                            <TableHead className="w-[100px] text-right">Comissão R$</TableHead>
                            <TableHead className="w-[120px] text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.sales.map(sale => (
                            <TableRow key={sale.id}>
                              <TableCell className="font-medium">#{sale.romaneio_number}</TableCell>
                              <TableCell>
                                {sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yy', { locale: ptBR }) : '-'}
                              </TableCell>
                              <TableCell>
                                {sale.delivered_at ? format(new Date(sale.delivered_at), 'dd/MM/yy', { locale: ptBR }) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  {getDeliveryIcon(sale.delivery_type)}
                                  {getDeliveryLabel(sale.delivery_type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(sale.shipping_cost_cents || 0)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(sale.product_cost_cents)}</TableCell>
                              <TableCell>{sale.payment_method || '-'}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{sale.lead_name || '-'}</TableCell>
                              <TableCell className="text-sm">{formatPhone(sale.lead_whatsapp)}</TableCell>
                              <TableCell>{sale.seller_name || '-'}</TableCell>
                              <TableCell className="text-right">{sale.commission_percentage || 0}%</TableCell>
                              <TableCell className="text-right">{formatCurrency(sale.commission_cents)}</TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(sale.total_cents || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Per Seller Tables */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Detalhamento por Vendedor
                  </h2>
                  
                  {report.sellerSummaries.map(seller => (
                    <Collapsible
                      key={seller.seller_user_id || '_none'}
                      open={expandedSellers.has(seller.seller_user_id || '_none')}
                      onOpenChange={() => toggleSeller(seller.seller_user_id || '_none')}
                    >
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {expandedSellers.has(seller.seller_user_id || '_none') ? (
                                  <ChevronDown className="w-5 h-5" />
                                ) : (
                                  <ChevronRight className="w-5 h-5" />
                                )}
                                <CardTitle className="text-lg">{seller.seller_name}</CardTitle>
                                <Badge variant="secondary">{seller.total_sales} vendas</Badge>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <span>Custo: <strong className="text-orange-600">{formatCurrency(seller.total_product_cost_cents)}</strong></span>
                                <span>Comissão: <strong className="text-purple-600">{formatCurrency(seller.total_commission_cents)}</strong></span>
                                <span className="text-lg">Total: <strong className="text-green-600">{formatCurrency(seller.total_cents)}</strong></span>
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="p-0 border-t">
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Romaneio</TableHead>
                                    <TableHead>Data Venda</TableHead>
                                    <TableHead>Data Entrega</TableHead>
                                    <TableHead>Entrega</TableHead>
                                    <TableHead className="text-right">Etiqueta</TableHead>
                                    <TableHead className="text-right">Custo Prod.</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>WhatsApp</TableHead>
                                    <TableHead className="text-right">Comissão %</TableHead>
                                    <TableHead className="text-right">Comissão R$</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {seller.sales.map(sale => (
                                    <TableRow key={sale.id}>
                                      <TableCell className="font-medium">#{sale.romaneio_number}</TableCell>
                                      <TableCell>
                                        {sale.created_at ? format(new Date(sale.created_at), 'dd/MM/yy', { locale: ptBR }) : '-'}
                                      </TableCell>
                                      <TableCell>
                                        {sale.delivered_at ? format(new Date(sale.delivered_at), 'dd/MM/yy', { locale: ptBR }) : '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="gap-1">
                                          {getDeliveryIcon(sale.delivery_type)}
                                          {getDeliveryLabel(sale.delivery_type)}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">{formatCurrency(sale.shipping_cost_cents || 0)}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(sale.product_cost_cents)}</TableCell>
                                      <TableCell>{sale.payment_method || '-'}</TableCell>
                                      <TableCell className="max-w-[120px] truncate">{sale.lead_name || '-'}</TableCell>
                                      <TableCell className="text-sm">{formatPhone(sale.lead_whatsapp)}</TableCell>
                                      <TableCell className="text-right">{sale.commission_percentage || 0}%</TableCell>
                                      <TableCell className="text-right">{formatCurrency(sale.commission_cents)}</TableCell>
                                      <TableCell className="text-right font-semibold text-green-600">
                                        {formatCurrency(sale.total_cents || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {/* Seller Total Row */}
                                  <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={4}>SUBTOTAL {seller.seller_name}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(seller.total_shipping_cents)}</TableCell>
                                    <TableCell className="text-right text-orange-600">{formatCurrency(seller.total_product_cost_cents)}</TableCell>
                                    <TableCell colSpan={3}></TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-purple-600">{formatCurrency(seller.total_commission_cents)}</TableCell>
                                    <TableCell className="text-right text-green-600">{formatCurrency(seller.total_cents)}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </SmartLayout>
  );
}
