import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Settings, History } from 'lucide-react';
import { AttributionDashboard } from '@/components/reports/AttributionDashboard';
import { TrackingConfigManager } from '@/components/settings/TrackingConfigManager';
import { useConversionEvents } from '@/hooks/useTrackingConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function ConversionEventsLog() {
  const { data: events, isLoading } = useConversionEvents({ limit: 50 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Conversões Enviadas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum evento enviado ainda
                </TableCell>
              </TableRow>
            ) : (
              events?.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-sm">
                    {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.event_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={event.platform === 'meta' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {event.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        event.status === 'sent' 
                          ? 'default' 
                          : event.status === 'failed' 
                            ? 'destructive' 
                            : 'secondary'
                      }
                    >
                      {event.status === 'sent' ? 'Enviado' : event.status === 'failed' ? 'Falhou' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {event.error_message || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function Attribution() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Atribuição de Tráfego</h1>
          <p className="text-muted-foreground">
            Rastreie a origem de leads e vendas para otimizar seu ROI
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard ROI
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configurar Pixels
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <AttributionDashboard />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <TrackingConfigManager />
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <ConversionEventsLog />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}