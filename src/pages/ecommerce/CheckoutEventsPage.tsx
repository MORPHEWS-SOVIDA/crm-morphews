import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ShoppingCart, AlertTriangle, CheckCircle, XCircle, Clock,
  Search, RefreshCw, Eye, Activity, TrendingUp, TrendingDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  cart_loaded: { label: 'Carrinho Carregado', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: ShoppingCart },
  form_filled: { label: 'Formulário Preenchido', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock },
  checkout_started: { label: 'Checkout Iniciado', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: Activity },
  payment_started: { label: 'Pagamento Iniciado', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: Clock },
  payment_success: { label: 'Pagamento Aprovado', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle },
  payment_failed: { label: 'Pagamento Recusado', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
  payment_error: { label: 'Erro Técnico', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
  abandoned: { label: 'Abandonado', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

export default function CheckoutEventsPage() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['checkout-events', orgId, filterType],
    queryFn: async () => {
      let query = supabase
        .from('checkout_events')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterType !== 'all') {
        query = query.eq('event_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Stats
  const stats = {
    total: events?.length || 0,
    cart_loaded: events?.filter(e => e.event_type === 'cart_loaded').length || 0,
    checkout_started: events?.filter(e => e.event_type === 'checkout_started').length || 0,
    payment_success: events?.filter(e => e.event_type === 'payment_success').length || 0,
    payment_failed: events?.filter(e => e.event_type === 'payment_failed').length || 0,
    payment_error: events?.filter(e => e.event_type === 'payment_error').length || 0,
  };

  const conversionRate = stats.cart_loaded > 0
    ? ((stats.payment_success / stats.cart_loaded) * 100).toFixed(1)
    : '0.0';

  const dropoffRate = stats.checkout_started > 0
    ? (((stats.checkout_started - stats.payment_success) / stats.checkout_started) * 100).toFixed(1)
    : '0.0';

  // Filter by search
  const filteredEvents = events?.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.customer_name?.toLowerCase().includes(s) ||
      e.customer_email?.toLowerCase().includes(s) ||
      e.customer_phone?.includes(s) ||
      e.error_message?.toLowerCase().includes(s) ||
      e.source_url?.toLowerCase().includes(s)
    );
  }) || [];

  return (
    <EcommerceLayout title="Histórico de Checkouts" description="Acompanhe cada etapa do funil e diagnostique problemas">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Carrinhos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.cart_loaded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Checkouts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.checkout_started}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Aprovados</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.payment_success}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Recusados</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.payment_failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Conversão</span>
            </div>
            <p className="text-2xl font-bold mt-1">{conversionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Desistência</span>
            </div>
            <p className="text-2xl font-bold mt-1">{dropoffRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone ou erro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            <SelectItem value="cart_loaded">Carrinho Carregado</SelectItem>
            <SelectItem value="checkout_started">Checkout Iniciado</SelectItem>
            <SelectItem value="payment_success">Pagamento Aprovado</SelectItem>
            <SelectItem value="payment_failed">Pagamento Recusado</SelectItem>
            <SelectItem value="payment_error">Erro Técnico</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Events Table */}
      <Card>
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Carregando eventos...
                  </TableCell>
                </TableRow>
              ) : filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum evento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => {
                  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.cart_loaded;
                  const Icon = config.icon;
                  return (
                    <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEvent(event)}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(event.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.customer_name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{event.customer_email}</div>
                        <div>{event.customer_phone}</div>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {event.error_message || '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && (
                <>
                  {(() => {
                    const config = EVENT_CONFIG[selectedEvent.event_type] || EVENT_CONFIG.cart_loaded;
                    const Icon = config.icon;
                    return (
                      <Badge variant="outline" className={config.color}>
                        <Icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-sm text-muted-foreground">
                    {selectedEvent && format(new Date(selectedEvent.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div>
                <h4 className="text-sm font-medium mb-2">Cliente</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Nome:</span> {selectedEvent.customer_name || '—'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedEvent.customer_email || '—'}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {selectedEvent.customer_phone || '—'}</div>
                </div>
              </div>

              <Separator />

              {/* Source */}
              <div>
                <h4 className="text-sm font-medium mb-2">Origem</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Tipo:</span> {selectedEvent.source_type || '—'}</div>
                  {selectedEvent.source_url && (
                    <div className="break-all">
                      <span className="text-muted-foreground">URL:</span>{' '}
                      <span className="text-xs font-mono">{selectedEvent.source_url}</span>
                    </div>
                  )}
                  <div><span className="text-muted-foreground">User Agent:</span> <span className="text-xs">{selectedEvent.user_agent || '—'}</span></div>
                </div>
              </div>

              {/* Error */}
              {selectedEvent.error_message && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-destructive">Erro</h4>
                    <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">{selectedEvent.error_message}</p>
                  </div>
                </>
              )}

              {/* Event Data */}
              {selectedEvent.event_data && Object.keys(selectedEvent.event_data).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Dados do Evento</h4>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48">
                      {JSON.stringify(selectedEvent.event_data, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {/* IDs */}
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Event ID: {selectedEvent.id}</div>
                {selectedEvent.cart_id && <div>Cart ID: {selectedEvent.cart_id}</div>}
                {selectedEvent.session_id && <div>Session: {selectedEvent.session_id}</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </EcommerceLayout>
  );
}