import { Users, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';
import { Lead } from '@/types/lead';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  leads: Lead[];
}

export function StatsCards({ leads }: StatsCardsProps) {
  const totalLeads = leads.length;
  const activeLeads = leads.filter(l => !['trash', 'cloud'].includes(l.stage)).length;
  const successLeads = leads.filter(l => l.stage === 'success').length;
  const totalRevenue = leads
    .filter(l => l.stage === 'success')
    .reduce((acc, l) => acc + (l.paidValue || 0), 0);
  
  const conversionRate = totalLeads > 0 ? ((successLeads / totalLeads) * 100).toFixed(1) : '0';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const stats = [
    {
      label: 'Total de Leads',
      value: totalLeads,
      icon: Users,
      color: 'from-primary to-accent',
      iconBg: 'bg-primary/10 text-primary',
    },
    {
      label: 'Leads Ativos',
      value: activeLeads,
      icon: TrendingUp,
      color: 'from-funnel-scheduled to-funnel-positive',
      iconBg: 'bg-funnel-scheduled/20 text-funnel-scheduled-foreground',
    },
    {
      label: 'Taxa de Conversão',
      value: `${conversionRate}%`,
      icon: CheckCircle,
      color: 'from-funnel-positive to-funnel-waiting-payment',
      iconBg: 'bg-funnel-waiting-payment/20 text-funnel-waiting-payment-foreground',
    },
    {
      label: 'Receita Total',
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: 'from-funnel-success to-star-filled',
      iconBg: 'bg-funnel-success/20 text-funnel-success-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
            <div className={cn('p-3 rounded-lg', stat.iconBg)}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
          <div className={cn('mt-3 h-1 rounded-full bg-gradient-to-r', stat.color)} />
        </div>
      ))}
    </div>
  );
}
