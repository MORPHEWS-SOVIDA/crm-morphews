import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileSpreadsheet, X, Printer, Eye, Check, AlertCircle, PackageCheck, UserCheck } from 'lucide-react';
import { Sale, formatCurrency } from '@/hooks/useSales';
import { useUsers } from '@/hooks/useUsers';
import { useSaleClosingStatus } from '@/hooks/useSaleClosingStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SalesDetailedReportProps {
  sales: Sale[];
  isLoading?: boolean;
  onClose: () => void;
}

// Payment status labels
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  not_paid: 'Não Pago',
  will_pay_before: 'Vai Pagar',
  paid_now: 'Pago',
};

// Delivery type labels
const DELIVERY_TYPE_LABELS: Record<string, string> = {
  pickup: 'Retirada Balcão',
  motoboy: 'Motoboy',
  carrier: 'Transportadora',
};

function escapeCSVField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function SalesDetailedReport({ sales, isLoading, onClose }: SalesDetailedReportProps) {
  const { data: users } = useUsers();
  
  // Get sale IDs for closing status lookup
  const saleIds = useMemo(() => sales.map(s => s.id), [sales]);
  const { data: closingStatus } = useSaleClosingStatus(saleIds);
  
  // Create user lookup map
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users?.forEach(u => {
      map[u.user_id] = `${u.first_name} ${u.last_name}`.trim();
    });
    return map;
  }, [users]);

  // Helper to get seller name
  const getSellerName = (sale: Sale) => {
    if (sale.seller_profile) {
      return `${sale.seller_profile.first_name} ${sale.seller_profile.last_name}`.trim();
    }
    if (sale.seller_user_id && userMap[sale.seller_user_id]) {
      return userMap[sale.seller_user_id];
    }
    return '—';
  };

  // Helper for boolean badges
  const getBooleanBadge = (value: boolean | string | null) => {
    if (value === true || value === 'paid_now' || value === 'delivered') {
      return <Badge className="bg-green-100 text-green-800">Sim</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground">Não</Badge>;
  };

  // Calculate commission percentage from cents
  const getCommissionInfo = (sale: Sale) => {
    const saleCast = sale as any;
    const cents = saleCast.seller_commission_cents || 0;
    const percentage = saleCast.seller_commission_percentage || 0;
    
    return {
      cents,
      percentage,
      formatted: cents > 0 ? formatCurrency(cents) : '—',
      percentageFormatted: percentage > 0 ? `${percentage.toFixed(2)}%` : '—',
    };
  };

  // Calculate totals
  const totals = useMemo(() => {
    return sales.reduce((acc, sale) => {
      const saleCast = sale as any;
      acc.totalValue += sale.total_cents;
      acc.totalShipping += sale.shipping_cost_cents;
      acc.totalCommission += saleCast.seller_commission_cents || 0;
      return acc;
    }, {
      totalValue: 0,
      totalShipping: 0,
      totalCommission: 0,
    });
  }, [sales]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Número da Venda',
      'Data da Venda',
      'Nome do Cliente',
      'WhatsApp do Cliente',
      'Status de Pago',
      'Data de Pago',
      'Forma de Pagamento',
      'Comprovante Anexado',
      'Status de Entregue',
      'Data de Entregue',
      'Vendedor',
      'Custo Frete',
      'Método de Entrega',
      'Valor Frete/Motoboy',
      'Comissão Vendedor (%)',
      'Comissão Vendedor (R$)',
      'Valor Total',
      'Foi Baixado?',
      'Confirmado Financeiro?',
      'Confirmado Thiago?',
    ];

    const rows = sales.map(sale => {
      const saleCast = sale as any;
      const commission = getCommissionInfo(sale);
      const paymentMethod = saleCast.payment_method_data?.name || saleCast.payment_method || '—';
      const status = closingStatus?.[sale.id];
      
      return [
        sale.romaneio_number || '—',
        format(parseISO(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        sale.lead?.name || '—',
        sale.lead?.whatsapp || '—',
        PAYMENT_STATUS_LABELS[sale.payment_status || 'not_paid'] || 'Não Pago',
        sale.payment_confirmed_at ? format(parseISO(sale.payment_confirmed_at), 'dd/MM/yyyy', { locale: ptBR }) : '—',
        paymentMethod,
        sale.payment_proof_url ? 'Sim' : 'Não',
        sale.status === 'delivered' ? 'Sim' : 'Não',
        sale.delivered_at ? format(parseISO(sale.delivered_at), 'dd/MM/yyyy', { locale: ptBR }) : '—',
        getSellerName(sale),
        (sale.shipping_cost_cents / 100).toFixed(2).replace('.', ','),
        DELIVERY_TYPE_LABELS[sale.delivery_type] || sale.delivery_type,
        (sale.shipping_cost_cents / 100).toFixed(2).replace('.', ','),
        commission.percentage.toFixed(2).replace('.', ','),
        (commission.cents / 100).toFixed(2).replace('.', ','),
        (sale.total_cents / 100).toFixed(2).replace('.', ','),
        status?.wasClosed ? 'Sim' : 'Não',
        status?.confirmedByFinanceiro ? 'Sim' : 'Não',
        status?.confirmedByThiago ? 'Sim' : 'Não',
      ].map(escapeCSVField);
    });

    // Build CSV with BOM for Excel compatibility
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(row => row.join(';')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_vendas_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();
  };

  // Print report
  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Relatório Detalhado de Vendas
          </h2>
          <p className="text-sm text-muted-foreground">
            {sales.length} vendas selecionadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Relatório Detalhado de Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
        <p className="text-sm">{sales.length} vendas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total em Vendas</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totals.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Frete</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.totalShipping)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Comissões</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalCommission)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px] print:h-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap">Nº Venda</TableHead>
                  <TableHead className="whitespace-nowrap">Data Venda</TableHead>
                  <TableHead className="whitespace-nowrap">Cliente</TableHead>
                  <TableHead className="whitespace-nowrap">WhatsApp</TableHead>
                  <TableHead className="whitespace-nowrap">Pago?</TableHead>
                  <TableHead className="whitespace-nowrap">Data Pago</TableHead>
                  <TableHead className="whitespace-nowrap">Forma Pgto</TableHead>
                  <TableHead className="whitespace-nowrap">Comprovante?</TableHead>
                  <TableHead className="whitespace-nowrap">Entregue?</TableHead>
                  <TableHead className="whitespace-nowrap">Data Entrega</TableHead>
                  <TableHead className="whitespace-nowrap">Vendedor</TableHead>
                  <TableHead className="whitespace-nowrap">Entrega</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Frete</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Comissão %</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Comissão R$</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Valor Total</TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center gap-1">
                            <PackageCheck className="h-4 w-4" />
                            Baixado?
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Passou pela baixa (Motoboy/Balcão/Transportadora)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center gap-1">
                            <UserCheck className="h-4 w-4" />
                            Financeiro?
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Confirmado por usuário com permissão Financeiro</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center gap-1">
                            <UserCheck className="h-4 w-4" />
                            Thiago?
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Confirmado por thiago@sonatura.com.br</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="print:hidden"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map(sale => {
                  const saleCast = sale as any;
                  const commission = getCommissionInfo(sale);
                  const isPaid = sale.payment_status === 'paid_now';
                  const isDelivered = sale.status === 'delivered';
                  const hasProof = !!sale.payment_proof_url;
                  const paymentMethod = saleCast.payment_method_data?.name || saleCast.payment_method || '—';
                  const status = closingStatus?.[sale.id];
                  
                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-sm">
                        #{sale.romaneio_number}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(parseISO(sale.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={sale.lead?.name}>
                        {sale.lead?.name || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sale.lead?.whatsapp || '—'}
                      </TableCell>
                      <TableCell>
                        {isPaid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.payment_confirmed_at
                          ? format(parseISO(sale.payment_confirmed_at), 'dd/MM/yy', { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[100px] truncate" title={paymentMethod}>
                        {paymentMethod}
                      </TableCell>
                      <TableCell>
                        {hasProof ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {isDelivered ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.delivered_at
                          ? format(parseISO(sale.delivered_at), 'dd/MM/yy', { locale: ptBR })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate" title={getSellerName(sale)}>
                        {getSellerName(sale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {DELIVERY_TYPE_LABELS[sale.delivery_type] || sale.delivery_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(sale.shipping_cost_cents)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {commission.percentageFormatted}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {commission.formatted}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(sale.total_cents)}
                      </TableCell>
                      <TableCell className="text-center">
                        {status?.wasClosed ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {status?.confirmedByFinanceiro ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {status?.confirmedByThiago ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
