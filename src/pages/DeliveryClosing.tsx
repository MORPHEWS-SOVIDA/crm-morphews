import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  CheckCircle,
  Bike,
  Truck,
  Lock,
  Banknote,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/hooks/useSales';
import { useAuth } from '@/hooks/useAuth';
import { calculateCategoryTotals, getCategoryConfig } from '@/lib/paymentCategories';
import { PaymentCategoryTotals, PaymentCategoryBadges } from '@/components/expedition/PaymentCategoryTotals';
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
  formatPaymentMethod,
  closingTypeConfig,
  canUserConfirm,
  type ClosingType,
  type DeliveryClosing as DeliveryClosingType,
} from '@/hooks/useDeliveryClosings';

const iconMap = {
  Store: Store,
  Bike: Bike,
  Truck: Truck,
};

interface DeliveryClosingPageProps {
  closingType: ClosingType;
}

export default function DeliveryClosingPage({ closingType }: DeliveryClosingPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const config = closingTypeConfig[closingType];
  const IconComponent = iconMap[config.icon as keyof typeof iconMap] || Store;
  
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [viewingClosingId, setViewingClosingId] = useState<string | null>(null);
  const [cashConfirmDialogOpen, setCashConfirmDialogOpen] = useState(false);
  const [pendingCashClosingId, setPendingCashClosingId] = useState<string | null>(null);
  const [pendingCashAmount, setPendingCashAmount] = useState(0);

  const { data: availableSales = [], isLoading: loadingSales } = useAvailableClosingSales(closingType);
  const { data: closings = [], isLoading: loadingClosings } = useDeliveryClosings(closingType);
  const { data: closingSales = [] } = useDeliveryClosingSales(viewingClosingId || undefined);
  const createClosing = useCreateDeliveryClosing();
  const confirmClosing = useConfirmDeliveryClosing();

  const userEmail = user?.email?.toLowerCase();
  const canConfirmAuxiliar = canUserConfirm(userEmail, closingType, 'auxiliar');
  const canConfirmAdmin = canUserConfirm(userEmail, closingType, 'admin');

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
        closingType,
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
    // Check permission
    if (type === 'auxiliar' && !canConfirmAuxiliar) {
      toast.error('Você não tem permissão para confirmar como auxiliar');
      return;
    }
    if (type === 'admin' && !canConfirmAdmin) {
      toast.error('Você não tem permissão para confirmar como admin');
      return;
    }

    try {
      await confirmClosing.mutateAsync({ closingId, closingType, type });
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
        closingType, 
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

  const colorClasses = {
    purple: {
      gradient: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200',
      text: 'text-purple-600',
      title: 'text-purple-700',
      button: 'bg-purple-600 hover:bg-purple-700',
      selected: 'bg-purple-50 dark:bg-purple-950/30',
      ring: 'ring-purple-500',
    },
    orange: {
      gradient: 'from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200',
      text: 'text-orange-600',
      title: 'text-orange-700',
      button: 'bg-orange-600 hover:bg-orange-700',
      selected: 'bg-orange-50 dark:bg-orange-950/30',
      ring: 'ring-orange-500',
    },
    blue: {
      gradient: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200',
      text: 'text-blue-600',
      title: 'text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700',
      selected: 'bg-blue-50 dark:bg-blue-950/30',
      ring: 'ring-blue-500',
    },
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses] || colorClasses.purple;

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
              <IconComponent className={`w-6 h-6 ${colors.text}`} />
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
                  <IconComponent className="w-16 h-16 mx-auto mb-4 opacity-30" />
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

                {/* Sales list */}
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
                          showTracking={closingType === 'carrier'}
                          showProofLink={closingType === 'motoboy' || closingType === 'carrier'}
                          showEditPayment={closingType === 'motoboy' || closingType === 'carrier'}
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
                          <IconComponent className="w-5 h-5" />
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
                          {viewingClosingId === closing.id ? 'Ocultar Vendas' : 'Ver Vendas'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(closing)}>
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimir
                        </Button>
                        
                        {/* Confirm Auxiliar Button */}
                        {closing.status === 'pending' && (
                          canConfirmAuxiliar ? (
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => handleConfirm(closing.id, 'auxiliar')}
                              disabled={confirmClosing.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar (Auxiliar)
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="opacity-50">
                              <Lock className="w-4 h-4 mr-1" />
                              Confirmar (Auxiliar)
                            </Button>
                          )
                        )}
                        
                        {/* Admin Buttons - Two separate confirmations */}
                        {closing.status === 'confirmed_auxiliar' && canConfirmAdmin && (
                          <>
                            {/* Confirm Report Button */}
                            <Button 
                              size="sm"
                              variant="outline"
                              className="border-blue-400 text-blue-700 hover:bg-blue-50"
                              onClick={() => handleConfirm(closing.id, 'admin')}
                              disabled={confirmClosing.isPending || closing.total_cash_cents > 0}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmar Relatório
                            </Button>

                            {/* Confirm Cash Button - Only if there's cash */}
                            {closing.total_cash_cents > 0 && (
                              <Button 
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleOpenCashConfirm(closing)}
                                disabled={confirmClosing.isPending}
                              >
                                <Banknote className="w-4 h-4 mr-1" />
                                Conferir Dinheiro ({formatCurrency(closing.total_cash_cents)})
                              </Button>
                            )}
                          </>
                        )}

                        {/* Admin locked button when not authorized */}
                        {closing.status === 'confirmed_auxiliar' && !canConfirmAdmin && (
                          <Button variant="outline" size="sm" disabled className="opacity-50">
                            <Lock className="w-4 h-4 mr-1" />
                            Aguardando Admin
                          </Button>
                        )}
                      </div>

                      {/* Sales detail */}
                      {viewingClosingId === closing.id && closingSales.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <h4 className="font-medium mb-2 text-sm">Vendas incluídas:</h4>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {closingSales.map(sale => (
                              <div key={sale.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs">#{sale.sale_number}</span>
                                  <span className="truncate max-w-[200px]">{sale.lead_name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {formatPaymentMethod(sale.payment_method)}
                                  </Badge>
                                </div>
                                <span className="font-medium">{formatCurrency(sale.total_cents || 0)}</span>
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

        {/* Cash Confirmation Dialog */}
        <Dialog open={cashConfirmDialogOpen} onOpenChange={setCashConfirmDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                Confirmar Recebimento em Dinheiro
              </DialogTitle>
              <DialogDescription>
                Você está confirmando que recebeu o valor em dinheiro deste fechamento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <p className="text-sm text-green-700 mb-2">Valor total em dinheiro</p>
                <p className="text-4xl font-bold text-green-700">
                  {formatCurrency(pendingCashAmount)}
                </p>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Ao confirmar, você atesta que conferiu e recebeu este valor em espécie.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCashConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirmCash}
                disabled={confirmClosing.isPending}
              >
                {confirmClosing.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Banknote className="w-4 h-4 mr-2" />
                Confirmar Recebimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Wrapper components for each route
export function MotoboyClosingPage() {
  return <DeliveryClosingPage closingType="motoboy" />;
}

export function CarrierClosingPage() {
  return <DeliveryClosingPage closingType="carrier" />;
}
