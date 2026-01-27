import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCashPaymentSales,
  useConfirmCashPayment,
  confirmationTypeLabels,
  formatCents,
  type CashSaleWithConfirmations,
} from '@/hooks/useCashPaymentConfirmations';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';

interface CashPaymentVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashPaymentVerificationDialog({
  open,
  onOpenChange,
}: CashPaymentVerificationDialogProps) {
  const { user } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: members } = useTenantMembers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [showPendingOnly, setShowPendingOnly] = useState(true);

  const { data: sales, isLoading } = useCashPaymentSales({
    pendingOnly: showPendingOnly,
  });

  const confirmMutation = useConfirmCashPayment();

  const canConfirm = permissions?.cash_verification_confirm === true;

  // Filter sales
  const filteredSales = (sales || []).filter(sale => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      sale.lead?.name?.toLowerCase().includes(searchLower) ||
      sale.romaneio_number?.toString().includes(searchLower);

    const matchesUser = filterUser === 'all' || 
      sale.confirmations.some(c => c.confirmed_by === filterUser) ||
      sale.delivery_confirmed_by === filterUser;

    return matchesSearch && matchesUser;
  });

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

  const hasConfirmation = (sale: CashSaleWithConfirmations, type: string) => {
    return sale.confirmations.some(c => c.confirmation_type === type);
  };

  const getNextAction = (sale: CashSaleWithConfirmations): { type: 'receipt' | 'handover' | 'final_verification'; label: string } | null => {
    if (!hasConfirmation(sale, 'receipt')) {
      return { type: 'receipt', label: 'Confirmar Recebimento' };
    }
    if (!hasConfirmation(sale, 'handover')) {
      return { type: 'handover', label: 'Confirmar Repasse' };
    }
    if (!hasConfirmation(sale, 'final_verification')) {
      return { type: 'final_verification', label: 'Verificação Final' };
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            Conferência de Pagamentos em Dinheiro
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 border-b pb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou romaneio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-[200px]">
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {(members || []).map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profile?.first_name} {member.profile?.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showPendingOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPendingOnly(!showPendingOnly)}
            >
              {showPendingOnly ? 'Pendentes' : 'Todos'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {(sales || []).filter(s => !hasConfirmation(s, 'final_verification')).length}
              </p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {(sales || []).filter(s => hasConfirmation(s, 'final_verification')).length}
              </p>
              <p className="text-xs text-muted-foreground">Conferidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">
                {formatCents((sales || []).reduce((sum, s) => sum + (s.total_cents || 0), 0))}
              </p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Sales List */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda em dinheiro encontrada
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSales.map((sale) => {
                const nextAction = getNextAction(sale);
                const isFullyVerified = !nextAction;

                return (
                  <Card 
                    key={sale.id} 
                    className={`${isFullyVerified ? 'border-green-300 bg-green-50/50' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Sale Info */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">
                              #{sale.romaneio_number || '-'}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-medium">{sale.lead?.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-semibold text-lg text-foreground">
                              {formatCents(sale.total_cents)}
                            </span>
                            {sale.delivered_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
                              </span>
                            )}
                            {sale.motoboy_profile && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Motoboy: {sale.motoboy_profile.first_name}
                              </span>
                            )}
                          </div>

                          {/* Confirmation Flow */}
                          <div className="flex items-center gap-2 pt-2">
                            {sale.delivery_confirmer && (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-gray-50">
                                  <User className="w-3 h-3 mr-1" />
                                  Marcou pago: {sale.delivery_confirmer.first_name}
                                </Badge>
                              </div>
                            )}
                            
                            {sale.confirmations.map((conf, idx) => (
                              <React.Fragment key={conf.id}>
                                {idx > 0 || sale.delivery_confirmer ? (
                                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                ) : null}
                                <div className="flex items-center gap-1">
                                  {getConfirmationBadge(conf.confirmation_type)}
                                  <span className="text-xs text-muted-foreground">
                                    ({conf.confirmer?.first_name})
                                  </span>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          {isFullyVerified ? (
                            <Badge className="bg-green-600 text-white">
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Conferido
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
