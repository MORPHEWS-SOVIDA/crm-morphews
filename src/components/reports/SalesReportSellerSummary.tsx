import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users } from 'lucide-react';
import { Sale } from '@/hooks/useSales';

interface SellerSummary {
  sellerId: string | null;
  sellerName: string;
  salesCount: number;
  totalCents: number;
  avgTicket: number;
}

interface SalesReportSellerSummaryProps {
  sales: Sale[];
  formatCurrency: (cents: number) => string;
}

export function SalesReportSellerSummary({ sales, formatCurrency }: SalesReportSellerSummaryProps) {
  // Only count non-cancelled sales for seller summary
  const validSales = useMemo(() => sales.filter(s => s.status !== 'cancelled'), [sales]);

  const sellerSummaries = useMemo(() => {
    const summaryMap = new Map<string, SellerSummary>();

    validSales.forEach((sale) => {
      const sellerId = sale.seller_user_id || sale.created_by;
      const sellerName = sale.seller_profile 
        ? `${sale.seller_profile.first_name} ${sale.seller_profile.last_name}`.trim()
        : 'Sem vendedor';

      const existing = summaryMap.get(sellerId);
      if (existing) {
        existing.salesCount += 1;
        existing.totalCents += sale.total_cents || 0;
        existing.avgTicket = existing.totalCents / existing.salesCount;
      } else {
        summaryMap.set(sellerId, {
          sellerId,
          sellerName,
          salesCount: 1,
          totalCents: sale.total_cents || 0,
          avgTicket: sale.total_cents || 0,
        });
      }
    });

    // Sort by total value descending
    return Array.from(summaryMap.values()).sort((a, b) => b.totalCents - a.totalCents);
  }, [validSales]);

  // Calculate totals
  const totals = useMemo(() => ({
    salesCount: sellerSummaries.reduce((sum, s) => sum + s.salesCount, 0),
    totalCents: sellerSummaries.reduce((sum, s) => sum + s.totalCents, 0),
  }), [sellerSummaries]);

  if (sellerSummaries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Resumo por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Vendas em R$</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellerSummaries.map((seller, index) => (
                <TableRow key={seller.sellerId || 'no-seller'}>
                  <TableCell className="text-center font-medium text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{seller.sellerName}</TableCell>
                  <TableCell className="text-center">{seller.salesCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(seller.avgTicket)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(seller.totalCents)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/30 font-bold">
                <TableCell></TableCell>
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-center">{totals.salesCount}</TableCell>
                <TableCell className="text-right">
                  {totals.salesCount > 0 ? formatCurrency(totals.totalCents / totals.salesCount) : '-'}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(totals.totalCents)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
