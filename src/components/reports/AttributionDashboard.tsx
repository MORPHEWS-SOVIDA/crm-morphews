import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Loader2, Download } from 'lucide-react';
import { 
  useAttributionSummary, 
  useTopCampaigns, 
  useSourceBreakdown,
  useRecentAttributedSales 
} from '@/hooks/useAttributionReport';
import { AttributionFiltersComponent, AttributionFilters } from './AttributionFilters';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function AttributionDashboard() {
  const [filters, setFilters] = useState<AttributionFilters>({});
  
  const dateRange = filters.startDate && filters.endDate 
    ? { start: filters.startDate.toISOString(), end: filters.endDate.toISOString() }
    : undefined;
  
  const { data: attributionData, isLoading: loadingAttribution } = useAttributionSummary(dateRange);
  const { data: topCampaigns, isLoading: loadingCampaigns } = useTopCampaigns(10);
  const { data: sourceBreakdown, isLoading: loadingBreakdown } = useSourceBreakdown();
  const { data: recentSales, isLoading: loadingSales } = useRecentAttributedSales(15);

  // Extract unique values for filters
  const sources = [...new Set(attributionData?.map(d => d.source).filter(Boolean) || [])];
  const mediums = [...new Set(attributionData?.map(d => d.medium).filter(Boolean) || [])];
  const campaigns = [...new Set(attributionData?.map(d => d.campaign).filter(Boolean) || [])];

  const totalRevenue = attributionData?.reduce((sum, item) => sum + item.total_revenue_cents, 0) || 0;
  const totalLeads = attributionData?.reduce((sum, item) => sum + item.leads_count, 0) || 0;
  const totalSales = attributionData?.reduce((sum, item) => sum + item.sales_count, 0) || 0;
  const avgConversion = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;

  const pieData = sourceBreakdown?.map((item, index) => ({
    name: item.source,
    value: item.revenue_cents,
    color: COLORS[index % COLORS.length],
  })) || [];

  const barData = topCampaigns?.map((item) => ({
    name: item.campaign.length > 15 ? item.campaign.slice(0, 15) + '...' : item.campaign,
    vendas: item.sales,
    receita: item.revenue_cents / 100,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Dashboard de Atribuição</h2>
            <p className="text-muted-foreground">
              Visualize o ROI por campanha e origem de tráfego
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
        
        {/* Filters */}
        <AttributionFiltersComponent 
          filters={filters}
          onFiltersChange={setFilters}
          sources={sources}
          mediums={mediums}
          campaigns={campaigns}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Receita Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Leads Rastreados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLeads.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendas Atribuídas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {totalSales.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Conversão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgConversion.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="sales">Vendas Recentes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart - Receita por Origem */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Receita por Origem</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBreakdown ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Nenhum dado de atribuição ainda
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart - Top Campanhas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Campanhas por Receita</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingCampaigns ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData.slice(0, 5)} layout="vertical">
                      <XAxis type="number" tickFormatter={(v) => `R$ ${v}`} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                      <Bar dataKey="receita" fill="#8b5cf6" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Nenhuma campanha rastreada ainda
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Atribuição */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Detalhamento por Origem</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAttribution ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead>Mídia</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributionData?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Adicione parâmetros UTM às suas URLs para começar a rastrear
                        </TableCell>
                      </TableRow>
                    ) : (
                      attributionData?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">{item.source}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.medium || '-'}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {item.campaign || '-'}
                          </TableCell>
                          <TableCell className="text-right">{item.leads_count}</TableCell>
                          <TableCell className="text-right font-medium">{item.sales_count}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(item.total_revenue_cents)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={item.conversion_rate >= 10 ? 'default' : 'secondary'}>
                              {item.conversion_rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas as Campanhas</CardTitle>
              <CardDescription>
                Performance detalhada de cada campanha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Mídia</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCampaigns?.map((campaign, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{campaign.campaign}</TableCell>
                      <TableCell>{campaign.utm_source || '-'}</TableCell>
                      <TableCell>{campaign.utm_medium || '-'}</TableCell>
                      <TableCell className="text-right">{campaign.sales}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(campaign.revenue_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(campaign.avg_ticket_cents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas Recentes com Atribuição</CardTitle>
              <CardDescription>
                Últimas vendas e suas origens de tráfego
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSales ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Tracking ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales?.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-mono text-sm">
                          {sale.romaneio_number}
                        </TableCell>
                        <TableCell>{sale.leads?.name || '-'}</TableCell>
                        <TableCell className="text-green-600">
                          {formatCurrency(sale.total_cents)}
                        </TableCell>
                        <TableCell>
                          {sale.utm_source ? (
                            <Badge variant="outline">{sale.utm_source}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Direto</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {sale.utm_campaign || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {sale.fbclid ? (
                            <Badge variant="secondary" className="text-xs">FB</Badge>
                          ) : sale.gclid ? (
                            <Badge variant="secondary" className="text-xs">Google</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}