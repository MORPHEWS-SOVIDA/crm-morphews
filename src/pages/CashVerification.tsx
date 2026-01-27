import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Banknote,
  FileText, 
  Loader2,
  Receipt,
  History,
  Eye,
  ArrowLeft,
  CheckCircle,
  Lock,
  Truck,
  Store,
  Search,
  Calendar,
  User,
  ExternalLink,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTenantMembers } from '@/hooks/multi-tenant';
import {
  useCashPaymentSales,
  useConfirmCashPayment,
  formatCents,
  type CashSaleWithConfirmations,
} from '@/hooks/useCashPaymentConfirmations';

// Emails com permissão de confirmação
const AUXILIAR_EMAILS = ['auxiliar.sovida@gmail.com'];
const ADMIN_EMAILS = ['thiago@sonatura.com.br'];

type DateFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days';
type DeliveryTypeFilter = 'all' | 'motoboy' | 'pickup';
type StatusFilter = 'pending' | 'verified' | 'all';

export default function CashVerificationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: members } = useTenantMembers();

  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterVerifiedBy, setFilterVerifiedBy] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const { data: sales = [], isLoading } = useCashPaymentSales({
    pendingOnly: false,
  });
  const confirmMutation = useConfirmCashPayment();

  const userEmail = user?.email?.toLowerCase();
  const canConfirmAuxiliar = userEmail ? AUXILIAR_EMAILS.includes(userEmail) : false;
  const canConfirmAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;

  const hasConfirmation = (sale: CashSaleWithConfirmations, type: string) => {
    return sale.confirmations.some(c => c.confirmation_type === type);
  };

  // Filter sales
  const filteredSales = useMemo(() => {
    if (!sales) return [];

    return sales.filter(sale => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        sale.lead?.name?.toLowerCase().includes(searchLower) ||
        sale.romaneio_number?.toString().includes(searchLower);

      const matchesUser = filterUser === 'all' || 
        sale.delivery_confirmed_by === filterUser;

      const matchesVerifiedBy = filterVerifiedBy === 'all' || 
        sale.confirmations.some(c => 
          c.confirmation_type === 'final_verification' && c.confirmed_by === filterVerifiedBy
        );

      let matchesDate = true;
      if (dateFilter !== 'all' && sale.delivered_at) {
        const deliveryDate = parseISO(sale.delivered_at);
        const today = new Date();
        
        switch (dateFilter) {
          case 'today':
            matchesDate = isWithinInterval(deliveryDate, {
              start: startOfDay(today),
              end: endOfDay(today),
            });
            break;
          case 'yesterday':
            const yesterday = subDays(today, 1);
            matchesDate = isWithinInterval(deliveryDate, {
              start: startOfDay(yesterday),
              end: endOfDay(yesterday),
            });
            break;
          case 'last7days':
            matchesDate = isWithinInterval(deliveryDate, {
              start: startOfDay(subDays(today, 7)),
              end: endOfDay(today),
            });
            break;
          case 'last30days':
            matchesDate = isWithinInterval(deliveryDate, {
              start: startOfDay(subDays(today, 30)),
              end: endOfDay(today),
            });
            break;
        }
      }

      let matchesDeliveryType = true;
      if (deliveryTypeFilter !== 'all') {
        matchesDeliveryType = sale.delivery_type === deliveryTypeFilter;
      }

      let matchesStatus = true;
      const isVerified = hasConfirmation(sale, 'final_verification');
      if (statusFilter === 'pending') {
        matchesStatus = !isVerified;
      } else if (statusFilter === 'verified') {
        matchesStatus = isVerified;
      }

      return matchesSearch && matchesUser && matchesVerifiedBy && matchesDate && matchesDeliveryType && matchesStatus;
    });
  }, [sales, searchTerm, filterUser, filterVerifiedBy, dateFilter, deliveryTypeFilter, statusFilter]);

  // Sales pending (not yet fully confirmed)
  const pendingSales = useMemo(() => {
    return filteredSales.filter(s => !hasConfirmation(s, 'final_verification'));
  }, [filteredSales]);

  // Stats
  const stats = useMemo(() => {
    const all = sales || [];
    const pending = all.filter(s => !hasConfirmation(s, 'final_verification'));
    const verified = all.filter(s => hasConfirmation(s, 'final_verification'));
    
    return {
      total: all.length,
      pending: pending.length,
      verified: verified.length,
      pendingAmount: pending.reduce((sum, s) => sum + (s.total_cents || 0), 0),
      verifiedAmount: verified.reduce((sum, s) => sum + (s.total_cents || 0), 0),
      filteredAmount: filteredSales.reduce((sum, s) => sum + (s.total_cents || 0), 0),
    };
  }, [sales, filteredSales]);

  // Totals for selected
  const selectedTotals = useMemo(() => {
    const selectedList = pendingSales.filter(s => selectedSales.has(s.id));
    return {
      count: selectedList.length,
      amount: selectedList.reduce((sum, s) => sum + (s.total_cents || 0), 0),
    };
  }, [pendingSales, selectedSales]);

  const toggleSale = (saleId: string) => {
    setSelectedSales(prev => {
      const newSet = new Set(prev);
      if (newSet.has(saleId)) {
        newSet.delete(saleId);
      } else {
        newSet.add(saleId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedSales(new Set(pendingSales.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSales(new Set());
  };

  const handleBatchConfirm = async (type: 'receipt' | 'handover' | 'final_verification') => {
    if (selectedSales.size === 0) {
      toast.error('Selecione pelo menos uma venda');
      return;
    }

    // Check permissions
    if (type === 'final_verification' && !canConfirmAdmin) {
      toast.error('Você não tem permissão para confirmação final');
      return;
    }

    if ((type === 'receipt' || type === 'handover') && !canConfirmAuxiliar && !canConfirmAdmin) {
      toast.error('Você não tem permissão para esta confirmação');
      return;
    }

    const salesList = pendingSales.filter(s => selectedSales.has(s.id));
    
    try {
      for (const sale of salesList) {
        await confirmMutation.mutateAsync({
          saleId: sale.id,
          confirmationType: type,
          amountCents: sale.total_cents,
        });
      }
      
      const typeLabels = {
        receipt: 'Recebimento',
        handover: 'Repasse',
        final_verification: 'Conferência Final',
      };
      
      toast.success(`${typeLabels[type]} confirmado para ${salesList.length} vendas!`);
      setSelectedSales(new Set());
    } catch (error) {
      toast.error('Erro ao confirmar');
      console.error(error);
    }
  };

  const getDeliveryTypeBadge = (type: string | null) => {
    switch (type) {
      case 'motoboy':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700"><Truck className="w-3 h-3 mr-1" />Motoboy</Badge>;
      case 'pickup':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700"><Store className="w-3 h-3 mr-1" />Balcão</Badge>;
      default:
        return null;
    }
  };

  const getConfirmationBadge = (type: string) => {
    switch (type) {
      case 'receipt':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Recebido</Badge>;
      case 'handover':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Repassado</Badge>;
      case 'final_verification':
        return <Badge className="bg-green-600 text-white">✓ Conferido</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Banknote className="w-6 h-6 text-green-600" />
              Conferência de Dinheiro
            </h1>
            <p className="text-muted-foreground">Gerencie pagamentos em dinheiro e confirme recebimentos</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-sm font-medium text-orange-600">{formatCents(stats.pendingAmount)}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'verified' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter('verified')}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Conferidos</p>
              <p className="text-sm font-medium text-green-600">{formatCents(stats.verifiedAmount)}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{formatCents(stats.filteredAmount)}</p>
              <p className="text-xs text-muted-foreground">Filtrado ({filteredSales.length})</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <FileText className="w-4 h-4" />
              Conferência ({pendingSales.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico ({stats.verified})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-6">
            {/* Filters */}
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[180px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente ou romaneio..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Calendar className="w-4 h-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas datas</SelectItem>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="yesterday">Ontem</SelectItem>
                    <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                    <SelectItem value="last30days">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={deliveryTypeFilter} onValueChange={(v) => setDeliveryTypeFilter(v as DeliveryTypeFilter)}>
                  <SelectTrigger className="w-[130px] h-9">
                    <Truck className="w-4 h-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos tipos</SelectItem>
                    <SelectItem value="motoboy">🏍️ Motoboy</SelectItem>
                    <SelectItem value="pickup">🏪 Balcão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="w-[200px] h-9">
                    <User className="w-4 h-4 mr-1" />
                    <SelectValue placeholder="Quem marcou pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Quem marcou (todos)</SelectItem>
                    {(members || []).map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profile?.first_name} {member.profile?.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterUser('all');
                    setFilterVerifiedBy('all');
                    setDateFilter('all');
                    setDeliveryTypeFilter('all');
                    setStatusFilter('pending');
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingSales.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Banknote className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhuma venda pendente de conferência</p>
                  <p className="text-sm">Todas as vendas em dinheiro foram conferidas</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Selection controls */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {pendingSales.length} venda(s) pendente(s) • {selectedSales.size} selecionada(s)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Selecionar Todas
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Limpar
                    </Button>
                  </div>
                </div>

                {/* Sales list */}
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                      {pendingSales.map(sale => (
                        <div
                          key={sale.id}
                          className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                            selectedSales.has(sale.id) 
                              ? 'bg-green-50 dark:bg-green-950/30'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleSale(sale.id)}
                        >
                          <Checkbox checked={selectedSales.has(sale.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">#{sale.romaneio_number}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="truncate">{sale.lead?.name || 'Cliente'}</span>
                              {getDeliveryTypeBadge(sale.delivery_type)}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/vendas/${sale.id}`, '_blank');
                                }}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              {sale.delivered_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              )}
                              {sale.motoboy_profile && (
                                <span className="text-xs">
                                  Motoboy: {sale.motoboy_profile.first_name}
                                </span>
                              )}
                            </div>
                            {/* Confirmation Flow */}
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {sale.delivery_confirmer && (
                                <Badge variant="outline" className="text-xs bg-gray-50">
                                  💵 {sale.delivery_confirmer.first_name}
                                </Badge>
                              )}
                              
                              {sale.confirmations.map((conf) => (
                                <React.Fragment key={conf.id}>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  <div className="flex items-center gap-1">
                                    {getConfirmationBadge(conf.confirmation_type)}
                                    <span className="text-xs text-muted-foreground">
                                      {conf.confirmer?.first_name}
                                    </span>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          <div className="text-right font-semibold text-lg">
                            {formatCents(sale.total_cents || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Action buttons */}
                {selectedSales.size > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="text-center">
                            <Receipt className="w-6 h-6 mx-auto mb-2 text-green-600" />
                            <p className="text-xl font-bold text-green-700">{formatCents(selectedTotals.amount)}</p>
                            <p className="text-xs text-green-600">{selectedTotals.count} venda(s) selecionada(s)</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {/* Confirmar Recebimento - Auxiliar */}
                            {canConfirmAuxiliar || canConfirmAdmin ? (
                              <Button 
                                variant="outline"
                                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => handleBatchConfirm('receipt')}
                                disabled={confirmMutation.isPending}
                              >
                                {confirmMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Confirmar Recebido
                              </Button>
                            ) : (
                              <Button variant="outline" disabled className="opacity-50">
                                <Lock className="w-4 h-4 mr-2" />
                                Confirmar Recebido
                              </Button>
                            )}

                            {/* Confirmar Repasse - Auxiliar */}
                            {canConfirmAuxiliar || canConfirmAdmin ? (
                              <Button 
                                variant="outline"
                                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                                onClick={() => handleBatchConfirm('handover')}
                                disabled={confirmMutation.isPending}
                              >
                                {confirmMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Confirmar Repasse
                              </Button>
                            ) : (
                              <Button variant="outline" disabled className="opacity-50">
                                <Lock className="w-4 h-4 mr-2" />
                                Confirmar Repasse
                              </Button>
                            )}

                            {/* Conferência Final - Admin */}
                            {canConfirmAdmin ? (
                              <Button 
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleBatchConfirm('final_verification')}
                                disabled={confirmMutation.isPending}
                              >
                                {confirmMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Conferência Final
                              </Button>
                            ) : (
                              <Button variant="outline" disabled className="opacity-50">
                                <Lock className="w-4 h-4 mr-2" />
                                Conferência Final
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {/* Filters for history */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Select value={filterVerifiedBy} onValueChange={setFilterVerifiedBy}>
                <SelectTrigger className="w-[200px] h-9">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Quem conferiu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Conferido por (todos)</SelectItem>
                  {(members || []).map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profile?.first_name} {member.profile?.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSales.filter(s => hasConfirmation(s, 'final_verification')).length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhuma conferência realizada ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredSales
                  .filter(s => hasConfirmation(s, 'final_verification'))
                  .map(sale => (
                    <Card key={sale.id} className="border-green-300 bg-green-50/50 dark:bg-green-950/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold">#{sale.romaneio_number || '-'}</span>
                              <span className="truncate">{sale.lead?.name}</span>
                              {getDeliveryTypeBadge(sale.delivery_type)}
                              <Badge className="bg-green-600 text-white">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Conferido
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="font-semibold text-foreground">
                                {formatCents(sale.total_cents)}
                              </span>
                              {sale.delivered_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              )}
                            </div>

                            {/* Full confirmation flow */}
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {sale.delivery_confirmer && (
                                <Badge variant="outline" className="text-xs bg-gray-50">
                                  💵 {sale.delivery_confirmer.first_name}
                                </Badge>
                              )}
                              
                              {sale.confirmations.map((conf) => (
                                <React.Fragment key={conf.id}>
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  <div className="flex items-center gap-1">
                                    {getConfirmationBadge(conf.confirmation_type)}
                                    <span className="text-xs text-muted-foreground">
                                      {conf.confirmer?.first_name}
                                    </span>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
