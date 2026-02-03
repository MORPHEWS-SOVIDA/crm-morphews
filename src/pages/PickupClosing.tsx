import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { SaleSelectionCard } from '@/components/expedition/SaleSelectionCard';
import { 
  Store, 
  FileText, 
  Loader2,
  Receipt,
  History,
  Eye,
  Printer,
  ArrowLeft,
  Lock,
  Banknote,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/hooks/useSales';
import { calculateCategoryTotals } from '@/lib/paymentCategories';
import { PaymentCategoryTotals } from '@/components/expedition/PaymentCategoryTotals';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useAvailableClosingSales,
  useDeliveryClosings,
  useDeliveryClosingSales,
  useCreateDeliveryClosing,
  useConfirmDeliveryClosing,
  closingTypeConfig,
  canUserConfirmAdmin,
  type DeliveryClosing as DeliveryClosingType,
} from '@/hooks/useDeliveryClosings';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';

export default function PickupClosing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: permissions } = useMyPermissions();
  const config = closingTypeConfig['pickup'];
  
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [viewingClosingId, setViewingClosingId] = useState<string | null>(null);
  const [cashConfirmDialogOpen, setCashConfirmDialogOpen] = useState(false);
  const [pendingCashClosingId, setPendingCashClosingId] = useState<string | null>(null);
  const [pendingCashAmount, setPendingCashAmount] = useState(0);

  const { data: availableSales = [], isLoading: loadingSales } = useAvailableClosingSales('pickup');
  const { data: closings = [], isLoading: loadingClosings } = useDeliveryClosings('pickup');
  const { data: closingSales = [] } = useDeliveryClosingSales(viewingClosingId || undefined);
  const createClosing = useCreateDeliveryClosing();
  const confirmClosing = useConfirmDeliveryClosing();

  const userEmail = user?.email?.toLowerCase();
  const canConfirmAuxiliar = permissions?.reports_view === true;
  const canConfirmAdmin = canUserConfirmAdmin(userEmail, 'pickup');

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
    setSelectedSales(new Set(availableSales.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSales(new Set());
  };

  const selectedSalesData = useMemo(() => {
    return availableSales.filter(s => selectedSales.has(s.id));
  }, [availableSales, selectedSales]);

  const totals = useMemo(() => {
    return calculateCategoryTotals(selectedSalesData);
  }, [selectedSalesData]);

  const handleCreateClosing = async () => {
    if (selectedSalesData.length === 0) {
      toast.error('Selecione pelo menos uma venda');
      return;
    }

    try {
      const closing = await createClosing.mutateAsync({
        closingType: 'pickup',
        sales: selectedSalesData,
      });
      
      toast.success(`Fechamento #${closing.closing_number} criado com sucesso!`);
      setSelectedSales(new Set());
      setViewingClosingId(closing.id);
      setActiveTab('history');
    } catch (error) {
      toast.error('Erro ao criar fechamento');
      console.error(error);
    }
  };

  const handleConfirm = async (closingId: string, type: 'auxiliar' | 'admin') => {
    if (type === 'auxiliar' && !canConfirmAuxiliar) {
      toast.error('Você não tem permissão para confirmar como auxiliar');
      return;
    }
    if (type === 'admin' && !canConfirmAdmin) {
      toast.error('Você não tem permissão para confirmar como admin');
      return;
    }

    try {
      await confirmClosing.mutateAsync({ closingId, closingType: 'pickup', type });
      toast.success(type === 'auxiliar' ? 'Confirmado pelo auxiliar!' : 'Confirmação final realizada!');
    } catch (error) {
      toast.error('Erro ao confirmar');
      console.error(error);
    }
  };

  const handleOpenCashConfirm = (closing: DeliveryClosingType) => {
    setPendingCashClosingId(closing.id);
    setPendingCashAmount(closing.total_cash_cents);
    setCashConfirmDialogOpen(true);
  };

  const handleConfirmCash = async () => {
    if (!pendingCashClosingId) return;
    
    try {
      await confirmClosing.mutateAsync({ 
        closingId: pendingCashClosingId, 
        closingType: 'pickup', 
        type: 'admin' 
      });
      toast.success('Dinheiro conferido e fechamento confirmado!');
      setCashConfirmDialogOpen(false);
      setPendingCashClosingId(null);
    } catch (error) {
      toast.error('Erro ao confirmar');
      console.error(error);
    }
  };

  const handlePrint = (closing: DeliveryClosingType) => {
    window.open(config.printPath(closing.id), '_blank', 'noopener');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">⏳ Pendente</Badge>;
      case 'confirmed_auxiliar':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">✓ Auxiliar Confirmou</Badge>;
      case 'confirmed_final':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">✅ Confirmado</Badge>;
      default:
        return null;
    }
  };

  const colors = {
    gradient: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200',
    text: 'text-purple-600',
    title: 'text-purple-700',
    button: 'bg-purple-600 hover:bg-purple-700',
    selected: 'bg-purple-50 dark:bg-purple-950/30',
    ring: 'ring-purple-500',
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
              <Store className={`w-6 h-6 ${colors.text}`} />
              {config.title}
            </h1>
            <p className="text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <FileText className="w-4 h-4" />
              Novo Fechamento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico ({closings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-6">
            {loadingSales ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : availableSales.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Store className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">{config.emptyMessage}</p>
                  <p className="text-sm">Vendas precisam estar marcadas como entregues</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Selection controls */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {availableSales.length} venda(s) disponível(eis) • {selectedSales.size} selecionada(s)
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

                {/* Sales list using SaleSelectionCard */}
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {availableSales.map(sale => (
                        <SaleSelectionCard
                          key={sale.id}
                          sale={sale}
                          isSelected={selectedSales.has(sale.id)}
                          onToggle={() => toggleSale(sale.id)}
                          selectedBgClass={colors.selected}
                          showTracking={false}
                          showProofLink={true}
                          showEditPayment={true}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Totals summary */}
                {selectedSales.size > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <PaymentCategoryTotals 
                      total={totals.total}
                      byCategory={totals.byCategory}
                      colorConfig={{
                        gradient: colors.gradient,
                        text: colors.text,
                        title: colors.title,
                      }}
                    />

                    <Button 
                      className={`w-full ${colors.button}`}
                      size="lg"
                      onClick={handleCreateClosing}
                      disabled={createClosing.isPending}
                    >
                      {createClosing.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Gerar Fechamento ({selectedSales.size} vendas)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {loadingClosings ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : closings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhum fechamento realizado ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {closings.map(closing => (
                  <Card 
                    key={closing.id} 
                    className={`transition-all ${viewingClosingId === closing.id ? `ring-2 ${colors.ring}` : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Store className="w-5 h-5" />
                          Fechamento #{closing.closing_number}
                        </CardTitle>
                        {getStatusBadge(closing.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(closing.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {closing.creator_profile && (
                          <span> • por {closing.creator_profile.first_name} {closing.creator_profile.last_name}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Vendas:</span>{' '}
                          <span className="font-medium">{closing.total_sales}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{' '}
                          <span className={`font-semibold ${colors.text}`}>{formatCurrency(closing.total_amount_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">💳 Cartão:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_card_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">📱 PIX:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_pix_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">💵 Dinheiro:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_cash_cents)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">📄 Outros:</span>{' '}
                          <span className="font-medium">{formatCurrency(closing.total_other_cents)}</span>
                        </div>
                      </div>

                      {/* Confirmations status */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {closing.confirmed_at_auxiliar ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            ✓ Auxiliar: {closing.auxiliar_profile?.first_name} ({format(parseISO(closing.confirmed_at_auxiliar), "dd/MM HH:mm")})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600">
                            ⏳ Aguardando Auxiliar
                          </Badge>
                        )}
                        {closing.confirmed_at_admin ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            ✅ Admin: {closing.admin_profile?.first_name} ({format(parseISO(closing.confirmed_at_admin), "dd/MM HH:mm")})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">
                            ⏳ Aguardando Conferência Final
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setViewingClosingId(viewingClosingId === closing.id ? null : closing.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {viewingClosingId === closing.id ? 'Ocultar' : 'Ver Vendas'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(closing)}>
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimir
                        </Button>

                        {/* Auxiliar confirmation (requires reports_view permission) */}
                        {!closing.confirmed_at_auxiliar && canConfirmAuxiliar && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                            onClick={() => handleConfirm(closing.id, 'auxiliar')}
                            disabled={confirmClosing.isPending}
                          >
                            {confirmClosing.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Lock className="w-4 h-4 mr-1" />
                            )}
                            Confirmar (Auxiliar)
                          </Button>
                        )}

                        {/* Admin (cash) confirmation - only show after auxiliar confirmed */}
                        {closing.confirmed_at_auxiliar && !closing.confirmed_at_admin && canConfirmAdmin && (
                          <>
                            {closing.total_cash_cents > 0 ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                onClick={() => handleOpenCashConfirm(closing)}
                                disabled={confirmClosing.isPending}
                              >
                                <Banknote className="w-4 h-4 mr-1" />
                                Conferir Dinheiro ({formatCurrency(closing.total_cash_cents)})
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                                onClick={() => handleConfirm(closing.id, 'admin')}
                                disabled={confirmClosing.isPending}
                              >
                                {confirmClosing.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Lock className="w-4 h-4 mr-1" />
                                )}
                                Confirmar Final
                              </Button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Sales detail when viewing */}
                      {viewingClosingId === closing.id && closingSales.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-medium mb-2 text-sm">Vendas do Fechamento:</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {closingSales.map(cs => (
                              <div key={cs.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">#{cs.sale_number}</span>
                                  <span className="text-muted-foreground">{cs.lead_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {cs.payment_method || 'N/A'}
                                  </Badge>
                                  <span className="font-medium">{formatCurrency(cs.total_cents || 0)}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => window.open(`/vendas/${cs.sale_id}`, '_blank')}
                                    title="Ver venda"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Cash confirmation dialog */}
        <Dialog open={cashConfirmDialogOpen} onOpenChange={setCashConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                Confirmar Recebimento de Dinheiro
              </DialogTitle>
              <DialogDescription>
                Confirme que você recebeu o dinheiro em espécie deste fechamento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Valor em dinheiro a conferir:</p>
                <p className="text-4xl font-bold text-green-600">{formatCurrency(pendingCashAmount)}</p>
              </div>
              
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Ao confirmar, você atesta que recebeu este valor em dinheiro. 
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCashConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirmCash}
                disabled={confirmClosing.isPending}
              >
                {confirmClosing.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Banknote className="w-4 h-4 mr-2" />
                )}
                Confirmar Recebimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
