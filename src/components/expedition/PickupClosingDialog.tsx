import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Store, 
  FileText, 
  CheckCircle, 
  Clock, 
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  History,
  Eye,
  Printer,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/hooks/useSales';
import {
  useAvailablePickupSales,
  usePickupClosings,
  usePickupClosingSales,
  useCreatePickupClosing,
  useConfirmPickupClosing,
  formatPaymentMethod,
  PickupClosing,
} from '@/hooks/usePickupClosings';

interface PickupClosingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PickupClosingDialog({ open, onOpenChange }: PickupClosingDialogProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [viewingClosingId, setViewingClosingId] = useState<string | null>(null);

  const { data: availableSales = [], isLoading: loadingSales } = useAvailablePickupSales();
  const { data: closings = [], isLoading: loadingClosings } = usePickupClosings();
  const { data: closingSales = [] } = usePickupClosingSales(viewingClosingId || undefined);
  const createClosing = useCreatePickupClosing();
  const confirmClosing = useConfirmPickupClosing();

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
    let total = 0;
    let card = 0;
    let pix = 0;
    let cash = 0;
    let other = 0;

    selectedSalesData.forEach(sale => {
      const amount = sale.total_cents || 0;
      total += amount;

      const method = (sale.payment_method || '').toLowerCase();
      if (method.includes('cartao') || method.includes('cartão') || method.includes('card') || method.includes('credito') || method.includes('débito') || method.includes('debito')) {
        card += amount;
      } else if (method.includes('pix')) {
        pix += amount;
      } else if (method.includes('dinheiro') || method.includes('cash') || method.includes('especie')) {
        cash += amount;
      } else {
        other += amount;
      }
    });

    return { total, card, pix, cash, other };
  }, [selectedSalesData]);

  const handleCreateClosing = async () => {
    if (selectedSalesData.length === 0) {
      toast.error('Selecione pelo menos uma venda');
      return;
    }

    try {
      const closing = await createClosing.mutateAsync({
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
    try {
      await confirmClosing.mutateAsync({ closingId, type });
      toast.success(type === 'auxiliar' ? 'Confirmado pelo auxiliar!' : 'Confirmação final realizada!');
    } catch (error) {
      toast.error('Erro ao confirmar');
      console.error(error);
    }
  };

  const handlePrint = (closing: PickupClosing) => {
    // Open print page in new tab
    window.open(`/expedicao/fechamento/${closing.id}/imprimir`, '_blank', 'noopener');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-600" />
            Fechamento de Caixa Balcão
          </DialogTitle>
          <DialogDescription>
            Gere relatórios de fechamento para vendas retiradas no balcão
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new" className="gap-2">
              <FileText className="w-4 h-4" />
              Novo Fechamento
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Histórico ({closings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 flex flex-col overflow-hidden mt-4">
            {loadingSales ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma venda balcão disponível para fechamento</p>
                <p className="text-sm">Vendas precisam estar marcadas como entregues</p>
              </div>
            ) : (
              <>
                {/* Selection controls */}
                <div className="flex items-center justify-between mb-4">
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
                <ScrollArea className="flex-1 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {availableSales.map(sale => (
                      <div
                        key={sale.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSales.has(sale.id) 
                            ? 'bg-purple-50 border-purple-300 dark:bg-purple-950/30' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleSale(sale.id)}
                      >
                        <Checkbox checked={selectedSales.has(sale.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{sale.romaneio_number}</span>
                            <span className="text-muted-foreground">•</span>
                            <span className="truncate">{sale.lead?.name || 'Cliente'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{sale.delivered_at ? format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR }) : '-'}</span>
                            <Badge variant="secondary" className="text-xs">
                              {formatPaymentMethod(sale.payment_method)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right font-semibold">
                          {formatCurrency(sale.total_cents || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Totals summary */}
                {selectedSales.size > 0 && (
                  <div className="mt-4 space-y-3">
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200">
                        <CardContent className="p-3 text-center">
                          <Receipt className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                          <p className="text-lg font-bold text-purple-700">{formatCurrency(totals.total)}</p>
                          <p className="text-xs text-purple-600">Total Geral</p>
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200">
                        <CardContent className="p-3 text-center">
                          <CreditCard className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                          <p className="text-md font-semibold">{formatCurrency(totals.card)}</p>
                          <p className="text-xs text-muted-foreground">Cartão</p>
                        </CardContent>
                      </Card>
                      <Card className="border-green-200">
                        <CardContent className="p-3 text-center">
                          <Smartphone className="w-4 h-4 mx-auto mb-1 text-green-600" />
                          <p className="text-md font-semibold">{formatCurrency(totals.pix)}</p>
                          <p className="text-xs text-muted-foreground">PIX</p>
                        </CardContent>
                      </Card>
                      <Card className="border-yellow-200">
                        <CardContent className="p-3 text-center">
                          <Banknote className="w-4 h-4 mx-auto mb-1 text-yellow-600" />
                          <p className="text-md font-semibold">{formatCurrency(totals.cash)}</p>
                          <p className="text-xs text-muted-foreground">Dinheiro</p>
                        </CardContent>
                      </Card>
                      <Card className="border-gray-200">
                        <CardContent className="p-3 text-center">
                          <Receipt className="w-4 h-4 mx-auto mb-1 text-gray-600" />
                          <p className="text-md font-semibold">{formatCurrency(totals.other)}</p>
                          <p className="text-xs text-muted-foreground">Outros</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700" 
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
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-hidden mt-4">
            {loadingClosings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : closings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum fechamento realizado ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-4">
                  {closings.map(closing => (
                    <Card 
                      key={closing.id} 
                      className={`transition-all ${viewingClosingId === closing.id ? 'ring-2 ring-purple-500' : ''}`}
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Store className="w-4 h-4" />
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
                      <CardContent className="p-4 pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Vendas:</span>{' '}
                            <span className="font-medium">{closing.total_sales}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>{' '}
                            <span className="font-semibold text-purple-600">{formatCurrency(closing.total_amount_cents)}</span>
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
                        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
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
                            <Eye className="w-3 h-3 mr-1" />
                            {viewingClosingId === closing.id ? 'Ocultar' : 'Ver Vendas'}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePrint(closing)}
                          >
                            <Printer className="w-3 h-3 mr-1" />
                            Imprimir
                          </Button>
                          {closing.status === 'pending' && (
                            <Button 
                              size="sm"
                              variant="secondary"
                              onClick={() => handleConfirm(closing.id, 'auxiliar')}
                              disabled={confirmClosing.isPending}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Confirmar (Auxiliar)
                            </Button>
                          )}
                          {closing.status === 'confirmed_auxiliar' && (
                            <Button 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleConfirm(closing.id, 'admin')}
                              disabled={confirmClosing.isPending}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Conferência Final
                            </Button>
                          )}
                        </div>

                        {/* Sales details when expanded */}
                        {viewingClosingId === closing.id && closingSales.length > 0 && (
                          <div className="mt-4 border-t pt-4">
                            <p className="text-sm font-medium mb-2">Vendas incluídas:</p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {closingSales.map(sale => (
                                <div key={sale.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">#{sale.sale_number}</span>
                                    <span className="text-muted-foreground">{sale.lead_name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {formatPaymentMethod(sale.payment_method)}
                                    </Badge>
                                  </div>
                                  <span className="font-semibold">{formatCurrency(sale.total_cents || 0)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
