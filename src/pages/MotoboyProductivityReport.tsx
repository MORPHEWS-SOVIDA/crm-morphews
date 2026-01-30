import { useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SmartLayout } from '@/components/layout/SmartLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Bike, 
  CalendarIcon, 
  ArrowLeft,
  Loader2,
  Sun,
  Sunset,
  Moon,
  MapPin,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMotoboyProductivityReport } from '@/hooks/useMotoboyProductivityReport';
import { cn } from '@/lib/utils';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const DAY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  1: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  2: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  4: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  5: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  6: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
};

const DAY_INDEX_MAP: Record<string, number> = {
  'Domingo': 0,
  'Segunda': 1,
  'Terça': 2,
  'Quarta': 3,
  'Quinta': 4,
  'Sexta': 5,
  'Sábado': 6,
};

export default function MotoboyProductivityReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(today));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(today));
  const [totalCost, setTotalCost] = useState<number>(14000); // R$ 14.000
  const [activeTab, setActiveTab] = useState<string>('motoboys');

  const { data: report, isLoading } = useMotoboyProductivityReport(
    startDate, 
    endDate, 
    totalCost * 100 // convert to cents
  );

  return (
    <SmartLayout>
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/expedicao">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bike className="w-6 h-6 text-cyan-600" />
                Produtividade dos Motoboys
              </h1>
              <p className="text-muted-foreground">
                Análise de entregas por motoboy, região e turno
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-end gap-4">
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
              
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium whitespace-nowrap">Custo Total (R$):</Label>
                <Input
                  type="number"
                  value={totalCost}
                  onChange={(e) => setTotalCost(Number(e.target.value))}
                  className="w-32"
                  placeholder="14000"
                />
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
        ) : report ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bike className="w-4 h-4" />
                    Total de Entregas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{report.overallTotal}</div>
                  <p className="text-sm text-muted-foreground">no período</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Custo Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(report.totalCost)}</div>
                  <p className="text-sm text-muted-foreground">orçamento motoboys</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Custo por Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(report.averageCostPerDelivery)}</div>
                  <p className="text-sm text-muted-foreground">média no período</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Motoboys Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{report.motoboys.length}</div>
                  <p className="text-sm text-muted-foreground">com entregas</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="motoboys" className="gap-2">
                  <Bike className="w-4 h-4" />
                  Por Motoboy
                </TabsTrigger>
                <TabsTrigger value="regions" className="gap-2">
                  <MapPin className="w-4 h-4" />
                  Por Região
                </TabsTrigger>
                <TabsTrigger value="daily" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Resumo Diário
                </TabsTrigger>
              </TabsList>

              {/* Per Motoboy Tab */}
              <TabsContent value="motoboys" className="space-y-6">
                {report.motoboys.map((motoboy) => (
                  <Card key={motoboy.motoboyId}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                            <Bike className="w-5 h-5 text-cyan-600" />
                          </div>
                          <div>
                            <span>{motoboy.motoboyName}</span>
                            <p className="text-sm font-normal text-muted-foreground">
                              {motoboy.totalDeliveries} entregas no período
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-lg px-4">
                          {motoboy.totalDeliveries}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Por Região */}
                      {motoboy.regions.map((region) => (
                        <div key={region.regionId || 'sem-regiao'} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{region.regionName}</span>
                            <Badge variant="outline">{region.totalDeliveries} entregas</Badge>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[100px]">Data</TableHead>
                                  <TableHead className="w-[80px]">Dia</TableHead>
                                  <TableHead className="text-center w-[60px]">
                                    <Sun className="w-4 h-4 mx-auto text-yellow-500" />
                                  </TableHead>
                                  <TableHead className="text-center w-[60px]">
                                    <Sunset className="w-4 h-4 mx-auto text-orange-500" />
                                  </TableHead>
                                  <TableHead className="text-center w-[60px]">
                                    <CalendarIcon className="w-4 h-4 mx-auto text-cyan-500" />
                                  </TableHead>
                                  <TableHead className="text-right w-[70px]">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {region.deliveries.filter(d => d.deliveries > 0).map((day) => (
                                  <TableRow key={day.date}>
                                    <TableCell className="font-medium">{day.dateFormatted}</TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant="outline" 
                                        className={cn("text-xs", DAY_COLORS[DAY_INDEX_MAP[day.dayOfWeek] || 0])}
                                      >
                                        {day.dayOfWeek}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {day.morningDeliveries > 0 && (
                                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30">
                                          {day.morningDeliveries}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {day.afternoonDeliveries > 0 && (
                                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30">
                                          {day.afternoonDeliveries}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {day.fullDayDeliveries > 0 && (
                                        <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30">
                                          {day.fullDayDeliveries}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {day.deliveries}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ))}

                      {/* Total do Motoboy */}
                      <Separator />
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Total (Todas Regiões)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">Data</TableHead>
                                <TableHead className="w-[80px]">Dia</TableHead>
                                <TableHead className="text-center w-[60px]">Manhã</TableHead>
                                <TableHead className="text-center w-[60px]">Tarde</TableHead>
                                <TableHead className="text-center w-[60px]">Dia Todo</TableHead>
                                <TableHead className="text-right w-[70px]">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {motoboy.dailyTotals.filter(d => d.deliveries > 0).map((day) => (
                                <TableRow key={day.date}>
                                  <TableCell className="font-medium">{day.dateFormatted}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant="outline" 
                                      className={cn("text-xs", DAY_COLORS[DAY_INDEX_MAP[day.dayOfWeek] || 0])}
                                    >
                                      {day.dayOfWeek}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">{day.morningDeliveries || '-'}</TableCell>
                                  <TableCell className="text-center">{day.afternoonDeliveries || '-'}</TableCell>
                                  <TableCell className="text-center">{day.fullDayDeliveries || '-'}</TableCell>
                                  <TableCell className="text-right font-bold">{day.deliveries}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {report.motoboys.length === 0 && (
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      Nenhuma entrega de motoboy encontrada no período selecionado.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Per Region Tab */}
              <TabsContent value="regions" className="space-y-6">
                {report.regionSummaries.map((region) => (
                  <Card key={region.regionId || 'sem-regiao'}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-green-600" />
                          </div>
                          <span>{region.regionName}</span>
                        </div>
                        <Badge variant="secondary" className="text-lg px-4">
                          {region.totalDeliveries} entregas
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Data</TableHead>
                              <TableHead className="w-[80px]">Dia</TableHead>
                              <TableHead className="text-center">
                                <div className="flex flex-col items-center">
                                  <Sun className="w-4 h-4 text-yellow-500" />
                                  <span className="text-xs">Manhã</span>
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex flex-col items-center">
                                  <Sunset className="w-4 h-4 text-orange-500" />
                                  <span className="text-xs">Tarde</span>
                                </div>
                              </TableHead>
                              <TableHead className="text-center">
                                <div className="flex flex-col items-center">
                                  <CalendarIcon className="w-4 h-4 text-cyan-500" />
                                  <span className="text-xs">Dia Todo</span>
                                </div>
                              </TableHead>
                              <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {region.dailyData.map((day) => (
                              <TableRow key={day.date} className={day.total === 0 ? 'opacity-50' : ''}>
                                <TableCell className="font-medium">{day.dateFormatted}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-xs", DAY_COLORS[DAY_INDEX_MAP[day.dayOfWeek] || 0])}
                                  >
                                    {day.dayOfWeek}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">{day.morning || '-'}</TableCell>
                                <TableCell className="text-center">{day.afternoon || '-'}</TableCell>
                                <TableCell className="text-center">{day.fullDay || '-'}</TableCell>
                                <TableCell className="text-right font-semibold">{day.total}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {report.regionSummaries.length === 0 && (
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      Nenhuma entrega encontrada no período selecionado.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Daily Summary Tab */}
              <TabsContent value="daily">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      Resumo Diário com Custo por Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Data</TableHead>
                            <TableHead className="w-[80px]">Dia</TableHead>
                            <TableHead className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Sun className="w-4 h-4 text-yellow-500" />
                                <span className="text-xs">Manhã</span>
                              </div>
                            </TableHead>
                            <TableHead className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Sunset className="w-4 h-4 text-orange-500" />
                                <span className="text-xs">Tarde</span>
                              </div>
                            </TableHead>
                            <TableHead className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <CalendarIcon className="w-4 h-4 text-cyan-500" />
                                <span className="text-xs">Dia Todo</span>
                              </div>
                            </TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Custo/Entrega</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.dailyTotals.map((day) => (
                            <TableRow key={day.date} className={day.total === 0 ? 'opacity-50' : ''}>
                              <TableCell className="font-medium">{day.dateFormatted}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs", DAY_COLORS[DAY_INDEX_MAP[day.dayOfWeek] || 0])}
                                >
                                  {day.dayOfWeek}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">{day.morning || '-'}</TableCell>
                              <TableCell className="text-center">{day.afternoon || '-'}</TableCell>
                              <TableCell className="text-center">{day.fullDay || '-'}</TableCell>
                              <TableCell className="text-right font-semibold">{day.total}</TableCell>
                              <TableCell className="text-right text-green-600 dark:text-green-400">
                                {day.total > 0 ? formatCurrency(report.averageCostPerDelivery) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Total Row */}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2}>TOTAL</TableCell>
                            <TableCell className="text-center">
                              {report.dailyTotals.reduce((sum, d) => sum + d.morning, 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              {report.dailyTotals.reduce((sum, d) => sum + d.afternoon, 0)}
                            </TableCell>
                            <TableCell className="text-center">
                              {report.dailyTotals.reduce((sum, d) => sum + d.fullDay, 0)}
                            </TableCell>
                            <TableCell className="text-right">{report.overallTotal}</TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">
                              {formatCurrency(report.averageCostPerDelivery)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </SmartLayout>
  );
}
