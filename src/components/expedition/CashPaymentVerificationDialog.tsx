import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Banknote,
  CheckCircle2,
  Clock,
  User,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Truck,
  Store,
  Calendar,
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCashPaymentSales,
  useConfirmCashPayment,
  formatCents,
  type CashSaleWithConfirmations,
} from '@/hooks/useCashPaymentConfirmations';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useMyPermissions } from '@/hooks/useUserPermissions';

interface CashPaymentVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'last30days';
type DeliveryTypeFilter = 'all' | 'motoboy' | 'pickup';
type StatusFilter = 'pending' | 'verified' | 'all';

export function CashPaymentVerificationDialog({
  open,
  onOpenChange,
}: CashPaymentVerificationDialogProps) {
  const { data: permissions } = useMyPermissions();
  const { data: members } = useTenantMembers();
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterVerifiedBy, setFilterVerifiedBy] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const { data: sales, isLoading } = useCashPaymentSales({
    pendingOnly: false, // We'll filter client-side for more flexibility
  });

  const confirmMutation = useConfirmCashPayment();

  const canConfirm = permissions?.cash_verification_confirm === true;

  const hasConfirmation = (sale: CashSaleWithConfirmations, type: string) => {
    return sale.confirmations.some(c => c.confirmation_type === type);
  };

  // Filter sales
  const filteredSales = useMemo(() => {
    if (!sales) return [];

    return sales.filter(sale => {
      // Text search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        sale.lead?.name?.toLowerCase().includes(searchLower) ||
        sale.romaneio_number?.toString().includes(searchLower);

      // User who marked as cash payment
      const matchesUser = filterUser === 'all' || 
        sale.delivery_confirmed_by === filterUser;

      // User who did final verification
      const matchesVerifiedBy = filterVerifiedBy === 'all' || 
        sale.confirmations.some(c => 
          c.confirmation_type === 'final_verification' && c.confirmed_by === filterVerifiedBy
        );

      // Date filter (based on delivered_at)
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

      // Delivery type filter
      let matchesDeliveryType = true;
      if (deliveryTypeFilter !== 'all') {
        matchesDeliveryType = sale.delivery_type === deliveryTypeFilter;
      }

      // Status filter (pending vs verified)
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

  const handleConfirm = async (sale: CashSaleWithConfirmations, type: 'receipt' | 'handover' | 'final_verification') => {
    await confirmMutation.mutateAsync({
      saleId: sale.id,
      confirmationType: type,
      amountCents: sale.total_cents,
    });
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

  const getNextAction = (sale: CashSaleWithConfirmations): { type: 'receipt' | 'handover' | 'final_verification'; label: string } | null => {
    if (!hasConfirmation(sale, 'receipt')) {
      return { type: 'receipt', label: 'Recebido' };
    }
    if (!hasConfirmation(sale, 'handover')) {
      return { type: 'handover', label: 'Repassado' };
    }
    if (!hasConfirmation(sale, 'final_verification')) {
      return { type: 'final_verification', label: '✓ Conferir' };
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            Conferência de Pagamentos em Dinheiro
          </DialogTitle>
        </DialogHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xs font-medium text-orange-600">{formatCents(stats.pendingAmount)}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'verified' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setStatusFilter('verified')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Conferidos</p>
              <p className="text-xs font-medium text-green-600">{formatCents(stats.verifiedAmount)}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{formatCents(stats.filteredAmount)}</p>
              <p className="text-xs text-muted-foreground">Filtrado ({filteredSales.length})</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Row 1 */}
        <div className="flex flex-wrap gap-2 border-b pb-3">
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

        {/* Filters Row 2 */}
        <div className="flex flex-wrap gap-2 border-b pb-3">
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

          <Select value={filterVerifiedBy} onValueChange={setFilterVerifiedBy}>
            <SelectTrigger className="w-[200px] h-9">
              <CheckCircle2 className="w-4 h-4 mr-1" />
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

        {/* Sales List */}
        <ScrollArea className="h-[350px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda em dinheiro encontrada
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSales.map((sale) => {
                const nextAction = getNextAction(sale);
                const isFullyVerified = !nextAction;

                return (
                  <Card 
                    key={sale.id} 
                    className={`${isFullyVerified ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20' : ''}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Sale Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">#{sale.romaneio_number || '-'}</span>
                            <span className="truncate">{sale.lead?.name}</span>
                            {getDeliveryTypeBadge(sale.delivery_type)}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1"
                              onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
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
                            
                            {sale.confirmations.map((conf, idx) => (
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

                        {/* Right: Action Button */}
                        <div className="flex-shrink-0">
                          {isFullyVerified ? (
                            <Badge className="bg-green-600 text-white">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              OK
                            </Badge>
                          ) : canConfirm && nextAction ? (
                            <Button
                              size="sm"
                              onClick={() => handleConfirm(sale, nextAction.type)}
                              disabled={confirmMutation.isPending}
                              className={
                                nextAction.type === 'final_verification' 
                                  ? 'bg-green-600 hover:bg-green-700' 
                                  : ''
                              }
                            >
                              {nextAction.label}
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-orange-600">
                              Aguardando
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
