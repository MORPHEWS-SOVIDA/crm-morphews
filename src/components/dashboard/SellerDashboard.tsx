import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  Loader2,
  Phone,
  Sparkles,
  ShoppingBag,
  UserPlus,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addMonths, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSellerDashboard, SaleSummary } from '@/hooks/useSellerDashboard';
import { useUncontactedLeads, useClaimLead } from '@/hooks/useUncontactedLeads';
import { useLeadIntelligence, LeadSuggestion } from '@/hooks/useLeadIntelligence';
import { formatCurrency } from '@/hooks/useSales';
import { motoboyTrackingLabels } from '@/hooks/useMotoboyTracking';
import { carrierTrackingLabels } from '@/hooks/useCarrierTracking';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { toast } from '@/hooks/use-toast';
import { SellerSalesList } from './SellerSalesList';
import { SuggestionDetailModal } from './SuggestionDetailModal';
import slothRaceImage from '@/assets/sloth-race.png';

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

function getDaysAgo(dateString: string): number {
  const date = parseISO(dateString);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function DaysAgoBadge({ days }: { days: number }) {
  if (days <= 1) return null;
  
  const isUrgent = days >= 7;
  const isWarning = days >= 3;
  
  return (
    <Badge 
      variant={isUrgent ? "destructive" : isWarning ? "outline" : "secondary"}
      className={`text-xs ${isWarning && !isUrgent ? 'border-amber-400 text-amber-600' : ''}`}
    >
      <Clock className="w-3 h-3 mr-1" />
      {days}d
    </Badge>
  );
}

function SaleCard({ sale, type }: { sale: SaleSummary; type: 'motoboy' | 'carrier' | 'other' }) {
  const daysAgo = getDaysAgo(sale.created_at);
  
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
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatCurrency(sale.total_cents)}
          </span>
          {subStatus && (
            <Badge variant="secondary" className="text-xs">
              {subStatus}
            </Badge>
          )}
          <DaysAgoBadge days={daysAgo} />
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

  // Calculate total value
  const totalCents = sales.reduce((sum, sale) => sum + (sale.total_cents || 0), 0);

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h4 className="font-medium text-sm">{title}</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          {sales.length}
        </Badge>
      </div>
      {sales.length > 0 && (
        <p className="text-xs text-muted-foreground mb-3 pl-6">
          Total: <span className="font-medium text-foreground">{formatCurrency(totalCents)}</span>
        </p>
      )}
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

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function SellerDashboard() {
  const navigate = useNavigate();
  const [treatmentDaysInput, setTreatmentDaysInput] = useState('5');
  const [commissionMonth, setCommissionMonth] = useState(new Date());
  const [claimingLeadId, setClaimingLeadId] = useState<string | null>(null);
  
  // Modal states for AI suggestions
  const [selectedSuggestion, setSelectedSuggestion] = useState<LeadSuggestion | null>(null);
  const [suggestionModalType, setSuggestionModalType] = useState<'followup' | 'products'>('followup');
  
  // Debounce the treatment days to avoid excessive re-renders
  const debouncedTreatmentDays = useDebounce(parseInt(treatmentDaysInput) || 5, 500);
  
  const { data, isLoading, error } = useSellerDashboard({
    treatmentDays: debouncedTreatmentDays,
    commissionMonth,
  });
  
  const { data: uncontactedLeads = [], isLoading: loadingUncontacted } = useUncontactedLeads();
  const claimLead = useClaimLead();
  
  const {
    followupSuggestions,
    productSuggestions,
    isLoading: loadingIntelligence,
    generateFollowupSuggestions,
    generateProductSuggestions,
    dismissFollowupSuggestion,
    dismissProductSuggestion,
  } = useLeadIntelligence();

  const handleOpenSuggestion = (suggestion: LeadSuggestion, type: 'followup' | 'products') => {
    setSelectedSuggestion(suggestion);
    setSuggestionModalType(type);
  };

  const handleCloseSuggestionModal = () => {
    setSelectedSuggestion(null);
  };

  const handleSuggestionFeedback = (leadId: string, isUseful: boolean) => {
    // TODO: Persist feedback to database for ML improvements
    console.log('Feedback:', { leadId, isUseful });
  };

  const handleDismissSuggestion = (leadId: string) => {
    if (suggestionModalType === 'followup') {
      dismissFollowupSuggestion(leadId);
    } else {
      dismissProductSuggestion(leadId);
    }
  };

  // State for sloth race modal (someone else claimed)
  const [showSlothModal, setShowSlothModal] = useState(false);

  const handleClaimLead = async (leadId: string) => {
    setClaimingLeadId(leadId);
    try {
      const result = await claimLead.mutateAsync(leadId);
      
      if (result.success) {
        // Success! Navigate to Add Receptivo with the lead
        toast({
          title: 'Lead assumido!',
          description: 'Você agora é responsável por este cliente.',
        });
        navigate(`/add-receptivo?lead_id=${leadId}`);
      } else if (result.alreadyClaimed) {
        // Someone else was faster - show sloth modal
        setShowSlothModal(true);
      }
    } catch (error: any) {
      // Error is handled in the hook
    } finally {
      setClaimingLeadId(null);
    }
  };

  const handleCloseSlothModal = () => {
    setShowSlothModal(false);
    // Refresh the list to remove the claimed lead
    window.location.reload();
  };

  const handlePreviousMonth = () => {
    setCommissionMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(commissionMonth, 1);
    const now = new Date();
    // Don't allow future months beyond current
    if (nextMonth <= now) {
      setCommissionMonth(nextMonth);
    }
  };

  const isCurrentMonth = format(commissionMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
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
      {/* TOP 4 OPPORTUNITY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Clientes sem Contato - Big Red Button */}
        <Card className="relative overflow-hidden border-2 border-red-300 dark:border-red-700 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-300">
              <Phone className="w-4 h-4" />
              Clientes sem Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingUncontacted ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-red-500" />
              </div>
            ) : uncontactedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum lead aguardando
              </p>
            ) : (
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {uncontactedLeads.slice(0, 5).map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between gap-2 p-2 bg-white/80 dark:bg-gray-900/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(parseISO(lead.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
                        onClick={() => handleClaimLead(lead.id)}
                        disabled={claimingLeadId === lead.id}
                      >
                        {claimingLeadId === lead.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-1" />
                            Assumir
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {uncontactedLeads.length > 0 && (
              <Badge className="bg-red-600 text-white text-lg px-4 py-1 w-full justify-center">
                {uncontactedLeads.length} aguardando
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* 2. Sugestões de Follow-up com IA */}
        <Card className="relative overflow-hidden border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Sparkles className="w-4 h-4" />
              Sugestões de Follow-up
              {followupSuggestions.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {followupSuggestions.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {followupSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  IA analisa seus leads e sugere quem contatar
                </p>
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={generateFollowupSuggestions}
                  disabled={loadingIntelligence}
                >
                  {loadingIntelligence ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Gerar Sugestões
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <ScrollArea className="h-28">
                  <div className="space-y-2">
                    {followupSuggestions.slice(0, 3).map((suggestion) => (
                      <div 
                        key={suggestion.lead_id}
                        className="p-2 bg-white/80 dark:bg-gray-900/50 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        onClick={() => handleOpenSuggestion(suggestion, 'followup')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{suggestion.lead_name}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              suggestion.priority === 'high' ? 'text-red-600 border-red-300' :
                              suggestion.priority === 'medium' ? 'text-amber-600 border-amber-300' :
                              'text-gray-600 border-gray-300'
                            }
                          >
                            {suggestion.priority === 'high' ? 'Alta' : suggestion.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button 
                  size="sm"
                  variant="outline"
                  className="w-full border-blue-300 text-blue-700"
                  onClick={generateFollowupSuggestions}
                  disabled={loadingIntelligence}
                >
                  {loadingIntelligence ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Mais Sugestões
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Recomendação de Produtos com IA */}
        <Card className="relative overflow-hidden border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <ShoppingBag className="w-4 h-4" />
              Recomendação de Produtos
              {productSuggestions.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {productSuggestions.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-2">
                  <ShoppingBag className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  IA recomenda produtos para cada cliente
                </p>
                <Button 
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={generateProductSuggestions}
                  disabled={loadingIntelligence}
                >
                  {loadingIntelligence ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Recomendar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <ScrollArea className="h-28">
                  <div className="space-y-2">
                    {productSuggestions.slice(0, 3).map((suggestion) => (
                      <div 
                        key={suggestion.lead_id}
                        className="p-2 bg-white/80 dark:bg-gray-900/50 rounded-lg cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                        onClick={() => handleOpenSuggestion(suggestion, 'products')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{suggestion.lead_name}</span>
                        </div>
                        {suggestion.recommended_products && suggestion.recommended_products.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {suggestion.recommended_products.slice(0, 2).map((product, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {product}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{suggestion.reason}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button 
                  size="sm"
                  variant="outline"
                  className="w-full border-purple-300 text-purple-700"
                  onClick={generateProductSuggestions}
                  disabled={loadingIntelligence}
                >
                  {loadingIntelligence ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Mais Recomendações
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Follow-ups a Fazer */}
        <Card className="relative overflow-hidden border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Calendar className="w-4 h-4" />
              Follow-ups a Fazer
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
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {data.pendingFollowups.slice(0, 5).map(followup => (
                    <div 
                      key={followup.id}
                      className="flex items-center justify-between p-2 bg-white/80 dark:bg-gray-900/50 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 cursor-pointer"
                      onClick={() => navigate(`/leads/${followup.lead_id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{followup.lead_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
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
            {data.pendingFollowups.length > 5 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-2 text-amber-700"
                onClick={() => navigate('/leads')}
              >
                Ver todos ({data.pendingFollowups.length})
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

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
              Gerada de <span className="font-semibold">{data.commissions.pendingCount} vendas</span> TOTAIS {formatCurrency(data.commissions.pendingSalesTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Mês: {format(commissionMonth, 'MMMM yyyy', { locale: ptBR })}
              <span className="ml-2">(Taxa padrão: {data.commissions.defaultCommissionPercentage}%)</span>
            </p>
          </CardContent>
        </Card>

        {/* Commissions to Receive */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-800 dark:text-green-200">
                <TrendingUp className="w-4 h-4" />
                Comissões a Receber (Mês)
              </CardTitle>
              {/* Month Navigation */}
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
              Gerada de <span className="font-semibold">{data.commissions.toReceiveCount} vendas</span> Pagas e Entregues TOTAL {formatCurrency(data.commissions.toReceiveSalesTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(commissionMonth, 'MMMM yyyy', { locale: ptBR })}
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
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Próximos</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={treatmentDaysInput}
                onChange={(e) => setTreatmentDaysInput(e.target.value)}
                className="w-16 h-7 text-xs"
              />
              <Label className="text-xs text-muted-foreground">dias</Label>
            </div>
          </CardHeader>
          <CardContent>
            {data.treatmentsEnding.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum tratamento terminando nos próximos {debouncedTreatmentDays} dias
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
                  title="Transportadora"
                  icon={Package}
                  sales={data.pendingSales.carrierDispatched}
                  type="carrier"
                  emptyMessage="Sem entregas por transportadora"
                />
                
                <SalesSection
                  title="Retirada no Balcão"
                  icon={Package}
                  sales={data.pendingSales.pickupPending}
                  type="other"
                  emptyMessage="Sem retiradas pendentes"
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

      {/* SELLER SALES LIST - Full Table View */}
      <SellerSalesList />

      <Dialog open={showSlothModal} onOpenChange={handleCloseSlothModal}>
        <DialogContent 
          className="max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none"
          onClick={handleCloseSlothModal}
        >
          <div className="relative cursor-pointer">
            <img 
              src={slothRaceImage} 
              alt="Seja mais rápido da próxima vez!" 
              className="w-full h-auto rounded-xl shadow-2xl"
            />
            <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm font-medium bg-black/30 py-2 backdrop-blur-sm">
              Clique em qualquer lugar para voltar
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suggestion Detail Modal */}
      <SuggestionDetailModal
        suggestion={selectedSuggestion}
        open={!!selectedSuggestion}
        onClose={handleCloseSuggestionModal}
        type={suggestionModalType}
      />
    </div>
  );
}
