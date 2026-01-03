import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { SalesPodium } from '@/components/sales-dashboard/SalesPodium';
import { HorseRace } from '@/components/sales-dashboard/HorseRace';
import { FighterRanking } from '@/components/sales-dashboard/FighterRanking';
import { useSales, formatCurrency } from '@/hooks/useSales';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUp, DollarSign, Package, Truck, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { Loader2 } from 'lucide-react';

export default function SalesDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const { data: sales, isLoading: salesLoading } = useSales();
  const { data: users, isLoading: usersLoading } = useUsers();
  
  const isLoading = salesLoading || usersLoading;

  // Filter sales by date range
  const filteredSales = useMemo(() => {
    if (!sales || !dateRange?.from) return [];
    
    return sales.filter(sale => {
      const saleDate = parseISO(sale.created_at);
      const start = startOfDay(dateRange.from!);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
      return isWithinInterval(saleDate, { start, end });
    });
  }, [sales, dateRange]);

  // Today's sales for horse race
  const todaySales = useMemo(() => {
    if (!sales) return [];
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);
    
    return sales.filter(sale => {
      const saleDate = parseISO(sale.created_at);
      return isWithinInterval(saleDate, { start, end });
    });
  }, [sales]);

  // Aggregate seller stats for podium
  const sellerStats = useMemo(() => {
    if (!users) return [];
    
    const stats = new Map<string, {
      userId: string;
      name: string;
      avatarUrl: string | null;
      salesCount: number;
      totalCents: number;
    }>();
    
    // Initialize with all users
    users.forEach(user => {
      stats.set(user.user_id, {
        userId: user.user_id,
        name: `${user.first_name} ${user.last_name}`,
        avatarUrl: user.avatar_url,
        salesCount: 0,
        totalCents: 0,
      });
    });
    
    // Aggregate sales
    filteredSales.forEach(sale => {
      const sellerId = sale.seller_user_id || sale.created_by;
      if (sellerId && stats.has(sellerId)) {
        const current = stats.get(sellerId)!;
        stats.set(sellerId, {
          ...current,
          salesCount: current.salesCount + 1,
          totalCents: current.totalCents + sale.total_cents,
        });
      }
    });
    
    return Array.from(stats.values()).filter(s => s.salesCount > 0);
  }, [filteredSales, users]);

  // Horse race data - today's sales
  const horseRaceData = useMemo(() => {
    if (!users) return [];
    
    const data = new Map<string, {
      userId: string;
      name: string;
      avatarHorseUrl: string | null;
      avatarUrl: string | null;
      dailySales: number;
      draftSales: number;
      totalTodayCents: number;
    }>();
    
    users.forEach(user => {
      data.set(user.user_id, {
        userId: user.user_id,
        name: `${user.first_name} ${user.last_name}`,
        avatarHorseUrl: user.avatar_horse_url,
        avatarUrl: user.avatar_url,
        dailySales: 0,
        draftSales: 0,
        totalTodayCents: 0,
      });
    });
    
    todaySales.forEach(sale => {
      const sellerId = sale.seller_user_id || sale.created_by;
      if (sellerId && data.has(sellerId)) {
        const current = data.get(sellerId)!;
        const isDraft = sale.status === 'draft';
        data.set(sellerId, {
          ...current,
          dailySales: current.dailySales + (isDraft ? 0 : 1),
          draftSales: current.draftSales + (isDraft ? 1 : 0),
          totalTodayCents: current.totalTodayCents + sale.total_cents,
        });
      }
    });
    
    return Array.from(data.values());
  }, [todaySales, users]);

  // Fighter ranking data - delivered/paid sales
  const fighterData = useMemo(() => {
    if (!users) return [];
    
    const data = new Map<string, {
      userId: string;
      name: string;
      avatarFighterUrl: string | null;
      avatarUrl: string | null;
      deliveredCount: number;
      paidCount: number;
      totalPaidCents: number;
    }>();
    
    users.forEach(user => {
      data.set(user.user_id, {
        userId: user.user_id,
        name: `${user.first_name} ${user.last_name}`,
        avatarFighterUrl: user.avatar_fighter_url,
        avatarUrl: user.avatar_url,
        deliveredCount: 0,
        paidCount: 0,
        totalPaidCents: 0,
      });
    });
    
    filteredSales.forEach(sale => {
      const sellerId = sale.seller_user_id || sale.created_by;
      if (sellerId && data.has(sellerId)) {
        const current = data.get(sellerId)!;
        const isDelivered = sale.status === 'delivered' || sale.status === 'payment_confirmed';
        const isPaid = sale.status === 'payment_confirmed';
        
        data.set(sellerId, {
          ...current,
          deliveredCount: current.deliveredCount + (isDelivered ? 1 : 0),
          paidCount: current.paidCount + (isPaid ? 1 : 0),
          totalPaidCents: current.totalPaidCents + (isPaid ? sale.total_cents : 0),
        });
      }
    });
    
    return Array.from(data.values());
  }, [filteredSales, users]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + s.total_cents, 0);
    const confirmed = filteredSales.filter(s => s.status === 'payment_confirmed');
    const confirmedTotal = confirmed.reduce((sum, s) => sum + s.total_cents, 0);
    const delivered = filteredSales.filter(s => s.status === 'delivered' || s.status === 'payment_confirmed');
    const dispatched = filteredSales.filter(s => s.status === 'dispatched');
    
    return {
      totalSales: filteredSales.length,
      totalValue: total,
      confirmedCount: confirmed.length,
      confirmedValue: confirmedTotal,
      deliveredCount: delivered.length,
      dispatchedCount: dispatched.length,
    };
  }, [filteredSales]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard de Vendas</h1>
            <p className="text-muted-foreground">Acompanhe a performance da equipe em tempo real</p>
          </div>
          
          {/* Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal w-full sm:w-auto">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                      {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  )
                ) : (
                  <span>Selecione um período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Total Vendas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.totalSales}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(summaryStats.totalValue)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Confirmadas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.confirmedCount}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(summaryStats.confirmedValue)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Entregues</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.deliveredCount}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Despachadas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.dispatchedCount}</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-2 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Ticket Médio</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {summaryStats.totalSales > 0 
                  ? formatCurrency(summaryStats.totalValue / summaryStats.totalSales)
                  : 'R$ 0,00'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Horse Race - Daily Sales */}
        <HorseRace racers={horseRaceData} />

        {/* Fighter Ranking - Delivered/Paid */}
        <FighterRanking fighters={fighterData} />

        {/* Podiums */}
        <div className="grid lg:grid-cols-2 gap-6">
          <SalesPodium 
            sellers={sellerStats} 
            title="Pódium de Vendas (Quantidade)" 
            metric="count"
          />
          <SalesPodium 
            sellers={sellerStats} 
            title="Pódium de Vendas (Valor)" 
            metric="value"
          />
        </div>
      </div>
    </Layout>
  );
}
