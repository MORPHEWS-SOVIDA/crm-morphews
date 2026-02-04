import { Card, CardContent } from '@/components/ui/card';
import { Package, Truck, RotateCcw, CheckCircle2, XCircle, DollarSign } from 'lucide-react';
import { Sale } from '@/hooks/useSales';

interface SalesReportSummaryCardsProps {
  sales: Sale[];
  formatCurrency: (cents: number) => string;
}

export function SalesReportSummaryCards({ sales, formatCurrency }: SalesReportSummaryCardsProps) {
  // Calculate metrics based on status
  const notCancelled = sales.filter(s => s.status !== 'cancelled');
  const cancelled = sales.filter(s => s.status === 'cancelled');
  const dispatched = sales.filter(s => s.status === 'dispatched');
  const returned = sales.filter(s => s.status === 'returned');
  const finalized = sales.filter(s => s.status === 'finalized');

  // Total values
  const vendaTotalCents = notCancelled.reduce((sum, s) => sum + (s.total_cents || 0), 0);
  const canceladoCents = cancelled.reduce((sum, s) => sum + (s.total_cents || 0), 0);
  const despachadoCents = dispatched.reduce((sum, s) => sum + (s.total_cents || 0), 0);
  const voltouCents = returned.reduce((sum, s) => sum + (s.total_cents || 0), 0);
  const finalizadoCents = finalized.reduce((sum, s) => sum + (s.total_cents || 0), 0);

  const cards = [
    {
      title: 'VENDA TOTAL',
      subtitle: 'Base: Data de criação',
      value: formatCurrency(vendaTotalCents),
      subValue: cancelled.length > 0 ? `Cancelado: ${formatCurrency(canceladoCents)}` : null,
      icon: Package,
      bgColor: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      valueColor: 'text-blue-900',
      subValueColor: 'text-red-500',
    },
    {
      title: 'DESPACHADO',
      subtitle: 'Ainda não entregue',
      value: formatCurrency(despachadoCents),
      count: dispatched.length,
      icon: Truck,
      bgColor: 'bg-cyan-50 border-cyan-200',
      textColor: 'text-cyan-800',
      valueColor: 'text-cyan-900',
    },
    {
      title: 'VOLTOU',
      subtitle: 'Reagendar',
      value: formatCurrency(voltouCents),
      count: returned.length,
      icon: RotateCcw,
      bgColor: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-800',
      valueColor: 'text-orange-900',
    },
    {
      title: 'FINALIZADAS',
      subtitle: 'Confirmadas pelo Admin',
      value: formatCurrency(finalizadoCents),
      count: finalized.length,
      icon: CheckCircle2,
      bgColor: 'bg-green-50 border-green-200',
      textColor: 'text-green-800',
      valueColor: 'text-green-900',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={`border ${card.bgColor}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className={`text-xs font-bold uppercase tracking-wide ${card.textColor}`}>
                  {card.title}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{card.subtitle}</p>
                <p className={`text-xl font-bold mt-2 ${card.valueColor}`}>{card.value}</p>
                {card.count !== undefined && (
                  <p className="text-xs text-muted-foreground">{card.count} vendas</p>
                )}
                {card.subValue && (
                  <p className={`text-xs mt-1 ${card.subValueColor}`}>{card.subValue}</p>
                )}
              </div>
              <card.icon className={`h-5 w-5 ${card.textColor} opacity-50`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
