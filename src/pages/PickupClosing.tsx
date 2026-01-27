import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Store, 
  FileText, 
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  History,
  Eye,
  Printer,
  ArrowLeft,
  CheckCircle,
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
  PickupClosing as PickupClosingType,
} from '@/hooks/usePickupClosings';

export default function PickupClosing() {
  const navigate = useNavigate();
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

  const handlePrint = (closing: PickupClosingType) => {
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
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="w-6 h-6 text-purple-600" />
              Fechamento de Caixa Balcão
            </h1>
            <p className="text-muted-foreground">
              Gere relatórios de fechamento para vendas retiradas no balcão
            </p>
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
                  <p className="text-lg font-medium">Nenhuma venda balcão disponível</p>
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
                        <div
                          key={sale.id}
                          className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                            selectedSales.has(sale.id) 
                              ? 'bg-purple-50 dark:bg-purple-950/30' 
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
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span>{sale.delivered_at ? format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR }) : '-'}</span>
                              <Badge variant="secondary" className="text-xs">
                                {formatPaymentMethod(sale.payment_method)}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right font-semibold text-lg">
                            {formatCurrency(sale.total_cents || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Totals summary */}
                {selectedSales.size > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200">
                        <CardContent className="p-4 text-center">
                          <Receipt className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                          <p className="text-xl font-bold text-purple-700">{formatCurrency(totals.total)}</p>
                          <p className="text-xs text-purple-600">Total Geral</p>
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200">
                        <CardContent className="p-4 text-center">
                          <CreditCard className="w-5 h-5 mx-auto mb-2 text-blue-600" />
                          <p className="text-lg font-semibold">{formatCurrency(totals.card)}</p>
                          <p className="text-xs text-muted-foreground">Cartão</p>
                        </CardContent>
                      </Card>
                      <Card className="border-green-200">
                        <CardContent className="p-4 text-center">
                          <Smartphone className="w-5 h-5 mx-auto mb-2 text-green-600" />
                          <p className="text-lg font-semibold">{formatCurrency(totals.pix)}</p>
                          <p className="text-xs text-muted-foreground">PIX</p>
                        </CardContent>
                      </Card>
                      <Card className="border-yellow-200">
                        <CardContent className="p-4 text-center">
                          <Banknote className="w-5 h-5 mx-auto mb-2 text-yellow-600" />
                          <p className="text-lg font-semibold">{formatCurrency(totals.cash)}</p>
                          <p className="text-xs text-muted-foreground">Dinheiro</p>
                        </CardContent>
                      </Card>
                      <Card className="border-gray-200">
                        <CardContent className="p-4 text-center">
                          <Receipt className="w-5 h-5 mx-auto mb-2 text-gray-600" />
                          <p className="text-lg font-semibold">{formatCurrency(totals.other)}</p>
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
                    className={`transition-all ${viewingClosingId === closing.id ? 'ring-2 ring-purple-500' : ''}`}
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePrint(closing)}
                        >
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimir
                        </Button>
                        {closing.status === 'pending' && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleConfirm(closing.id, 'auxiliar')}
                            disabled={confirmClosing.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
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
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirmar Final
                          </Button>
                        )}
                      </div>

                      {/* Sales detail */}
                      {viewingClosingId === closing.id && closingSales.length > 0 && (
                        <div className="mt-4 border rounded-lg overflow-hidden">
                          <div className="bg-muted/50 px-4 py-2 text-sm font-medium">
                            Vendas incluídas neste fechamento
                          </div>
                          <div className="divide-y max-h-64 overflow-auto">
                            {closingSales.map(sale => (
                              <div key={sale.id} className="flex items-center justify-between px-4 py-2 text-sm">
                                <div>
                                  <span className="font-medium">#{sale.sale_number}</span>
                                  <span className="text-muted-foreground ml-2">{sale.lead_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className="text-xs">
                                    {formatPaymentMethod(sale.payment_method)}
                                  </Badge>
                                  <span className="font-medium">{formatCurrency(sale.total_cents || 0)}</span>
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
      </div>
    </Layout>
  );
}
