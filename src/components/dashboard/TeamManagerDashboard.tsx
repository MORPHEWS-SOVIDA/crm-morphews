import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MessageSquare,
  Calendar,
  Pill,
  Clock,
  TrendingUp,
  Truck,
  Package,
  RotateCcw,
  XCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
  Users,
  User,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTeamDashboard, TeamSaleSummary, TeamMemberSummary } from '@/hooks/useTeamDashboard';
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

function TeamSaleCard({ sale, type }: { sale: TeamSaleSummary; type: 'motoboy' | 'carrier' | 'other' }) {
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
      onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
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
          <Badge variant="secondary" className="text-xs">
            {sale.seller_name}
          </Badge>
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

function TeamSalesSection({ 
  title, 
  icon: Icon, 
  sales, 
  type,
  emptyMessage,
  variant = 'default'
}: { 
  title: string; 
  icon: React.ElementType;
  sales: TeamSaleSummary[];
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
            <TeamSaleCard key={sale.id} sale={sale} type={type} />
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

function MemberCard({ member, isSelected, onToggle }: { 
  member: TeamMemberSummary; 
  isSelected: boolean;
  onToggle: () => void;
}) {
  const initials = member.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-primary/10 border-primary' 
          : 'bg-card hover:bg-muted/50 border-border'
      }`}
      onClick={onToggle}
    >
      <Checkbox checked={isSelected} />
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{member.full_name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{member.pending_followups} follow-ups</span>
          <span>•</span>
          <span>{member.pending_sales} vendas</span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-green-600 font-medium">
          {formatCurrency(member.commission_to_receive)}
        </p>
        <p className="text-xs text-muted-foreground">a receber</p>
      </div>
    </div>
  );
}

export function TeamManagerDashboard() {
  const navigate = useNavigate();
  const [treatmentDaysInput, setTreatmentDaysInput] = useState('5');
  const [commissionMonth, setCommissionMonth] = useState(new Date());
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  const treatmentDays = parseInt(treatmentDaysInput) || 5;
  
  const { data, isLoading, error } = useTeamDashboard({
    treatmentDays,
    commissionMonth,
    selectedMemberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
  });

  // Auto-select all members on first load
  useMemo(() => {
    if (data?.members && selectedMemberIds.length === 0) {
      setSelectedMemberIds(data.members.map(m => m.user_id));
    }
  }, [data?.members]);

  const handlePreviousMonth = () => {
    setCommissionMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(commissionMonth, 1);
    const now = new Date();
    if (nextMonth <= now) {
      setCommissionMonth(nextMonth);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    if (data?.members) {
      setSelectedMemberIds(data.members.map(m => m.user_id));
    }
  };

  const clearSelection = () => {
    setSelectedMemberIds([]);
  };

  const isCurrentMonth = format(commissionMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64 w-full" />
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
      {/* TEAM MEMBER SELECTOR */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Membros da Equipe
              <Badge variant="secondary">{data.members.length}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Todos
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.members.map(member => (
              <MemberCard
                key={member.user_id}
                member={member}
                isSelected={selectedMemberIds.includes(member.user_id)}
                onToggle={() => toggleMember(member.user_id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* COMMISSION SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Clock className="w-4 h-4" />
              Comissões Pendentes (Equipe)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {formatCurrency(data.commissions.pending)}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Gerada de <span className="font-semibold">{data.commissions.pendingCount} vendas</span> - TOTAL {formatCurrency(data.commissions.pendingSalesTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Mês: {format(commissionMonth, 'MMMM yyyy', { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-800 dark:text-green-200">
                <TrendingUp className="w-4 h-4" />
                Comissões a Receber (Equipe)
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handlePreviousMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleNextMonth}
                  disabled={isCurrentMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatCurrency(data.commissions.toReceiveThisMonth)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              De <span className="font-semibold">{data.commissions.toReceiveCount} vendas</span> entregues e pagas
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total em vendas: {formatCurrency(data.commissions.toReceiveSalesTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Follow-ups Agendados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Follow-ups Agendados
              <Badge variant="secondary" className="ml-auto text-xs">
                {data.pendingFollowups.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.pendingFollowups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum follow-up pendente
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {data.pendingFollowups.slice(0, 20).map(followup => (
                    <div 
                      key={followup.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/leads/${followup.lead_id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{followup.lead_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <DateBadge date={followup.scheduled_at} />
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(followup.scheduled_at), 'HH:mm')}
                          </span>
                          <Badge variant="outline" className="text-xs ml-1">
                            {followup.seller_name}
                          </Badge>
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

        {/* Mensagens Agendadas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              Mensagens Agendadas
              <Badge variant="secondary" className="ml-auto text-xs">
                {data.scheduledMessages.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.scheduledMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma mensagem agendada
              </p>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {data.scheduledMessages.slice(0, 20).map(msg => (
                    <div 
                      key={msg.id}
                      className="p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/leads/${msg.lead_id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{msg.lead_name}</p>
                        <Badge variant="outline" className="text-xs">
                          {msg.seller_name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <DateBadge date={msg.scheduled_at} />
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(msg.scheduled_at), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {msg.final_message}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Tratamentos Terminando */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Pill className="w-4 h-4 text-red-500" />
              Tratamentos Terminando
              <Badge variant="secondary" className="ml-auto text-xs">
                {data.treatmentsEnding.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-xs text-muted-foreground">Próximos</Label>
              <Input
                type="number"
                value={treatmentDaysInput}
                onChange={(e) => setTreatmentDaysInput(e.target.value)}
                className="w-16 h-7 text-xs"
                min={1}
                max={30}
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </CardHeader>
          <CardContent>
            {data.treatmentsEnding.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum tratamento terminando
              </p>
            ) : (
              <ScrollArea className="h-52">
                <div className="space-y-2">
                  {data.treatmentsEnding.slice(0, 20).map((treatment, idx) => (
                    <div 
                      key={`${treatment.lead_id}-${treatment.product_name}-${idx}`}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/leads/${treatment.lead_id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{treatment.lead_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{treatment.product_name}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {treatment.seller_name}
                        </Badge>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge 
                          variant={treatment.days_remaining <= 2 ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {treatment.days_remaining}d
                        </Badge>
                        <WhatsAppButton 
                          phone={treatment.lead_whatsapp} 
                          variant="icon"
                          className="ml-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SALES BY STATUS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Vendas Pendentes da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <TeamSalesSection
              title="Rascunho"
              icon={FileText}
              sales={data.pendingSales.draft}
              type="other"
              emptyMessage="Nenhum rascunho"
            />
            <TeamSalesSection
              title="Separado"
              icon={Package}
              sales={data.pendingSales.separated}
              type="other"
              emptyMessage="Nenhum pedido separado"
            />
            <TeamSalesSection
              title="Motoboy"
              icon={Truck}
              sales={data.pendingSales.motoboyDispatched}
              type="motoboy"
              emptyMessage="Nenhum em motoboy"
            />
            <TeamSalesSection
              title="Transportadora"
              icon={Truck}
              sales={data.pendingSales.carrierDispatched}
              type="carrier"
              emptyMessage="Nenhum em transportadora"
            />
            <TeamSalesSection
              title="Retirada"
              icon={User}
              sales={data.pendingSales.pickupPending}
              type="other"
              emptyMessage="Nenhuma retirada"
            />
            <TeamSalesSection
              title="Devolvido"
              icon={RotateCcw}
              sales={data.pendingSales.returned}
              type="other"
              emptyMessage="Nenhum devolvido"
              variant="warning"
            />
            <TeamSalesSection
              title="Cancelado"
              icon={XCircle}
              sales={data.pendingSales.cancelled}
              type="other"
              emptyMessage="Nenhum cancelado"
              variant="danger"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
