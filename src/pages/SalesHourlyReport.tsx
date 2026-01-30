import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmartLayout } from '@/components/layout/SmartLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Clock, 
  CalendarIcon, 
  TrendingUp, 
  Bike, 
  Package,
  ArrowLeft,
  Loader2,
  Sun,
  Moon,
  Calendar as CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSales } from '@/hooks/useSales';
import { useSalesHourlyReport } from '@/hooks/useSalesHourlyReport';
import { cn } from '@/lib/utils';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Color coding for day of week
const DAY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800',     // Domingo
  1: 'bg-blue-100 text-blue-800',    // Segunda
  2: 'bg-green-100 text-green-800',  // Terça
  3: 'bg-yellow-100 text-yellow-800',// Quarta
  4: 'bg-purple-100 text-purple-800',// Quinta
  5: 'bg-orange-100 text-orange-800',// Sexta
  6: 'bg-pink-100 text-pink-800',    // Sábado
};

export default function SalesHourlyReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(today));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(today));

  const { data: allSales, isLoading } = useSales();

  // Filter sales by date range
  const filteredSales = (allSales || []).filter(sale => {
    if (!sale.created_at) return false;
    const saleDate = new Date(sale.created_at);
    return saleDate >= startDate && saleDate <= endDate;
  });

  const report = useSalesHourlyReport(filteredSales, startDate, endDate);

  // Group daily summary by day of week for week analysis
  const byDayOfWeek = report.dailySummary.reduce((acc, day) => {
    if (!acc[day.dayOfWeekIndex]) {
      acc[day.dayOfWeekIndex] = { count: 0, total: 0, dayName: day.dayOfWeek };
    }
    acc[day.dayOfWeekIndex].count += day.salesCount;
    acc[day.dayOfWeekIndex].total += day.totalCents;
    return acc;
  }, {} as Record<number, { count: number; total: number; dayName: string }>);

  return (
    <SmartLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/relatorios/vendas">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" />
                Análise de Horários de Vendas
              </h1>
              <p className="text-muted-foreground">
                Identifique padrões de horários e dias com maior volume
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Período:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
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
                <span className="text-muted-foreground">até</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStartDate(startOfMonth(today));
                    setEndDate(endOfMonth(today));
                  }}
                >
                  Este mês
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const lastMonth = subMonths(today, 1);
                    setStartDate(startOfMonth(lastMonth));
                    setEndDate(endOfMonth(lastMonth));
                  }}
                >
                  Mês anterior
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-16 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Total de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{report.totals.totalSales}</div>
                  <p className="text-sm text-muted-foreground">{formatCurrency(report.totals.totalCents)}</p>
                </CardContent>
              </Card>

              {report.peakHour && (
                <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Horário de Pico
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{report.peakHour.label}</div>
                    <p className="text-sm text-muted-foreground">{report.peakHour.count} vendas</p>
                  </CardContent>
                </Card>
              )}

              {report.bestDay && (
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Melhor Dia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{report.bestDay.date}</div>
                    <p className="text-sm text-muted-foreground">{report.bestDay.dayOfWeek} - {report.bestDay.count} vendas</p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bike className="w-4 h-4" />
                    Entregas Motoboy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{report.totals.totalMotoboyDeliveries}</div>
                  <p className="text-sm text-muted-foreground">no período</p>
                </CardContent>
              </Card>
            </div>

            {/* Week Day Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Resumo por Dia da Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                    const dayData = byDayOfWeek[dayIndex];
                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "p-3 rounded-lg text-center",
                          DAY_COLORS[dayIndex]
                        )}
                      >
                        <div className="font-medium text-sm">{dayData?.dayName || ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayIndex]}</div>
                        <div className="text-2xl font-bold">{dayData?.count || 0}</div>
                        <div className="text-xs opacity-80">{formatCurrency(dayData?.total || 0)}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Hourly Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Vendas por Faixa de Horário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.hourlySlots.map(slot => {
                    const maxCount = Math.max(...report.hourlySlots.map(s => s.salesCount), 1);
                    const percentage = (slot.salesCount / maxCount) * 100;
                    
                    return (
                      <div key={slot.start} className="flex items-center gap-4">
                        <div className="w-32 text-sm font-medium text-right">
                          {slot.label}
                        </div>
                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max(percentage, slot.salesCount > 0 ? 8 : 0)}%` }}
                          >
                            {slot.salesCount > 0 && (
                              <span className="text-xs font-medium text-white">{slot.salesCount}</span>
                            )}
                          </div>
                        </div>
                        <div className="w-28 text-right text-sm">
                          {formatCurrency(slot.totalCents)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Daily Breakdown Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Vendas Dia a Dia
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[120px]">Data</TableHead>
                        <TableHead className="w-[100px]">Dia da Semana</TableHead>
                        <TableHead className="text-right w-[100px]">Vendas</TableHead>
                        <TableHead className="text-right w-[120px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.dailySummary.map(day => (
                        <TableRow 
                          key={day.date}
                          className={day.salesCount === 0 ? 'opacity-50' : ''}
                        >
                          <TableCell className="font-medium">{day.dateFormatted}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", DAY_COLORS[day.dayOfWeekIndex])}
                            >
                              {day.dayOfWeek}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {day.salesCount}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">
                            {formatCurrency(day.totalCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Motoboy Deliveries */}
            {report.motoboyDeliveries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bike className="w-5 h-5" />
                    Entregas Motoboy por Dia e Horário
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Data</TableHead>
                          <TableHead className="w-[100px]">Dia</TableHead>
                          <TableHead className="text-right w-[80px]">Total</TableHead>
                          <TableHead>Distribuição por Horário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.motoboyDeliveries.map(delivery => (
                          <TableRow key={delivery.date}>
                            <TableCell className="font-medium">{delivery.dateFormatted}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {delivery.dayOfWeek}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {delivery.deliveries}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {Object.entries(delivery.byHour)
                                  .sort(([a], [b]) => Number(a) - Number(b))
                                  .map(([hour, count]) => (
                                    <Badge 
                                      key={hour} 
                                      variant="secondary"
                                      className="text-xs bg-blue-100 text-blue-800"
                                    >
                                      {String(hour).padStart(2, '0')}h: {count}
                                    </Badge>
                                  ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </SmartLayout>
  );
}
