import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Calendar,
  Pill,
  DollarSign,
  TrendingUp,
  Clock,
  Truck,
  Package,
  RotateCcw,
  XCircle,
  FileText,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSellerDashboard, SaleSummary } from '@/hooks/useSellerDashboard';
import { formatCurrency } from '@/hooks/useSales';
import { motoboyTrackingLabels } from '@/hooks/useMotoboyTracking';
import { carrierTrackingLabels } from '@/hooks/useCarrierTracking';
import { WhatsAppButton } from '@/components/WhatsAppButton';

function DateBadge({ date }: { date: string }) {
  const parsedDate = parseISO(date);
  
  if (isToday(parsedDate)) {
    return <Badge className="bg-red-500 text-white text-xs">Hoje</Badge>;
  }
  if (isTomorrow(parsedDate)) {
    return <Badge className="bg-orange-500 text-white text-xs">Amanhã</Badge>;
  }
  return (
    <Badge variant="outline" className="text-xs">
      {format(parsedDate, 'dd/MM', { locale: ptBR })}
    </Badge>
  );
}

function SaleCard({ sale, type }: { sale: SaleSummary; type: 'motoboy' | 'carrier' | 'other' }) {
  const navigate = useNavigate();
  
  const getSubStatus = () => {
    if (type === 'motoboy' && sale.motoboy_tracking_status) {
      return motoboyTrackingLabels[sale.motoboy_tracking_status as keyof typeof motoboyTrackingLabels] || sale.motoboy_tracking_status;
    }
    if (type === 'carrier' && sale.carrier_tracking_status) {
      return carrierTrackingLabels[sale.carrier_tracking_status as keyof typeof carrierTrackingLabels] || sale.carrier_tracking_status;
    }
    return null;
  };
  
  const subStatus = getSubStatus();
  
  return (
    <div 
      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/vendas/${sale.id}`)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{sale.lead_name}</span>
          {sale.romaneio_number && (
            <Badge variant="outline" className="text-xs">#{sale.romaneio_number}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {formatCurrency(sale.total_cents)}
          </span>
          {subStatus && (
            <Badge variant="secondary" className="text-xs">
              {subStatus}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

function SalesSection({ 
  title, 
  icon: Icon, 
  sales, 
  type,
  emptyMessage,
  variant = 'default'
}: { 
  title: string; 
  icon: React.ElementType;
  sales: SaleSummary[];
  type: 'motoboy' | 'carrier' | 'other';
  emptyMessage: string;
  variant?: 'default' | 'warning' | 'danger';
}) {
  const bgClass = variant === 'warning' 
    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
    : variant === 'danger'
    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
    : '';
  
  const iconColor = variant === 'warning' 
    ? 'text-amber-600'
    : variant === 'danger'
    ? 'text-red-600'
    : 'text-muted-foreground';

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h4 className="font-medium text-sm">{title}</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          {sales.length}
        </Badge>
      </div>
      {sales.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sales.slice(0, 10).map(sale => (
            <SaleCard key={sale.id} sale={sale} type={type} />
          ))}
          {sales.length > 10 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{sales.length - 10} vendas...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SellerDashboard() {
  const navigate = useNavigate();
  const [treatmentDays, setTreatmentDays] = useState(5);
  const { data, isLoading, error } = useSellerDashboard(treatmentDays);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">Erro ao carregar dados do dashboard</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Commission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Commissions */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Clock className="w-4 h-4" />
              Comissões Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {formatCurrency(data.commissions.pending)}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {data.commissions.pendingCount} vendas pagas aguardando entrega
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Taxa: {data.commissions.commissionPercentage}%
            </p>
          </CardContent>
        </Card>

        {/* Commissions to Receive */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-800 dark:text-green-200">
              <TrendingUp className="w-4 h-4" />
              Comissões a Receber (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(data.commissions.toReceiveThisMonth)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {data.commissions.toReceiveCount} vendas entregues e pagas
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Follow-ups & Scheduled Messages */}
        <div className="space-y-4">
          {/* Pending Follow-ups */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                Retornos Agendados
                <Badge variant="secondary" className="ml-auto text-xs">
                  {data.pendingFollowups.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.pendingFollowups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum retorno agendado
                </p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {data.pendingFollowups.map(followup => (
                      <div 
                        key={followup.id}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/leads/${followup.lead_id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{followup.lead_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <DateBadge date={followup.scheduled_at} />
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(followup.scheduled_at), 'HH:mm')}
                            </span>
                          </div>
                      </div>
                      <WhatsAppButton 
                        phone={followup.lead_whatsapp} 
                        variant="icon"
                      />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Messages */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-500" />
                Mensagens Agendadas
                <Badge variant="secondary" className="ml-auto text-xs">
                  {data.scheduledMessages.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.scheduledMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma mensagem agendada
                </p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {data.scheduledMessages.map(msg => (
                      <div 
                        key={msg.id}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/leads/${msg.lead_id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{msg.lead_name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {msg.final_message}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <DateBadge date={msg.scheduled_at} />
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(msg.scheduled_at), 'HH:mm')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Column - Treatments Ending */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Pill className="w-4 h-4 text-purple-500" />
                Tratamentos Terminando
                <Badge variant="secondary" className="text-xs">
                  {data.treatmentsEnding.length}
                </Badge>
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-xs text-muted-foreground">Próximos</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={treatmentDays}
                onChange={(e) => setTreatmentDays(Number(e.target.value) || 5)}
                className="w-16 h-7 text-xs"
              />
              <Label className="text-xs text-muted-foreground">dias</Label>
            </div>
          </CardHeader>
          <CardContent>
            {data.treatmentsEnding.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum tratamento terminando nos próximos {treatmentDays} dias
              </p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {data.treatmentsEnding.map((treatment, idx) => (
                    <div 
                      key={`${treatment.lead_id}-${treatment.product_name}-${idx}`}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                        treatment.days_remaining <= 2 
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 hover:bg-red-100' 
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => navigate(`/leads/${treatment.lead_id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{treatment.lead_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {treatment.product_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {treatment.days_remaining <= 2 ? (
                            <Badge className="bg-red-500 text-white text-xs">
                              {treatment.days_remaining === 1 ? 'Amanhã' : `${treatment.days_remaining} dias`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {treatment.days_remaining} dias
                            </Badge>
                          )}
                        </div>
                      </div>
                      <WhatsAppButton 
                        phone={treatment.lead_whatsapp} 
                        variant="icon"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Pending Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Vendas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px]">
              <div className="space-y-4 pr-2">
                <SalesSection
                  title="Rascunho"
                  icon={FileText}
                  sales={data.pendingSales.draft}
                  type="other"
                  emptyMessage="Sem rascunhos"
                />
                
                <SalesSection
                  title="Separadas"
                  icon={Package}
                  sales={data.pendingSales.separated}
                  type="other"
                  emptyMessage="Sem vendas separadas"
                />
                
                <SalesSection
                  title="Motoboy"
                  icon={Truck}
                  sales={data.pendingSales.motoboyDispatched}
                  type="motoboy"
                  emptyMessage="Sem entregas por motoboy"
                />
                
                <SalesSection
                  title="Correio"
                  icon={Package}
                  sales={data.pendingSales.carrierDispatched}
                  type="carrier"
                  emptyMessage="Sem entregas por correio"
                />
                
                {data.pendingSales.returned.length > 0 && (
                  <SalesSection
                    title="Voltou"
                    icon={RotateCcw}
                    sales={data.pendingSales.returned}
                    type="other"
                    emptyMessage=""
                    variant="warning"
                  />
                )}
                
                {data.pendingSales.cancelled.length > 0 && (
                  <SalesSection
                    title="Canceladas"
                    icon={XCircle}
                    sales={data.pendingSales.cancelled}
                    type="other"
                    emptyMessage=""
                    variant="danger"
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
