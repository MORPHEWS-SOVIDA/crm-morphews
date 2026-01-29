import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useProcessPayment } from '@/hooks/usePaymentLinks';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LeadSearchSelect } from '@/components/sales/LeadSearchSelect';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  CreditCard, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  User,
  ShoppingBag,
  DollarSign,
  ExternalLink,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  cpf_cnpj?: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  cep: string | null;
}

interface Sale {
  id: string;
  total_cents: number;
  payment_status: string;
  created_at: string;
  status: string;
  products?: { name: string }[];
}

export function TelesalesTab() {
  const { profile } = useAuth();
  const processMutation = useProcessPayment();
  
  const [step, setStep] = useState<'select-lead' | 'select-sale' | 'payment' | 'processing' | 'success' | 'error'>('select-lead');
  const [result, setResult] = useState<any>(null);
  
  // Lead selection
  const [leadId, setLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Sale selection
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // Payment
  const [installments, setInstallments] = useState(1);
  
  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Fetch unpaid sales for the selected lead
  const { data: unpaidSales, isLoading: loadingSales } = useQuery({
    queryKey: ['unpaid-sales', leadId, profile?.organization_id],
    queryFn: async () => {
      if (!leadId || !profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          total_cents,
          payment_status,
          created_at,
          status,
          sale_items (
            product_name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('lead_id', leadId)
        .in('payment_status', ['pending', 'not_paid'])
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((sale: any) => ({
        id: sale.id,
        total_cents: sale.total_cents,
        payment_status: sale.payment_status,
        created_at: sale.created_at,
        status: sale.status,
        products: sale.sale_items?.map((item: any) => ({ name: item.product_name })) || []
      })) as Sale[];
    },
    enabled: !!leadId && !!profile?.organization_id,
  });

  // Fetch tenant payment fees for installment calculation
  const { data: tenantFees } = useQuery({
    queryKey: ['tenant-fees-telesales-tab', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data } = await supabase
        .from('tenant_payment_fees')
        .select('max_installments, installment_fees, installment_fee_passed_to_buyer')
        .eq('organization_id', profile.organization_id)
        .single();
      
      if (!data) {
        return {
          max_installments: 12,
          installment_fees: { "2": 5.26, "3": 7.06, "4": 8.87, "5": 10.7, "6": 12.56, "7": 14.43, "8": 16.32, "9": 18.24, "10": 20.17, "11": 22.12, "12": 24.09 },
          installment_fee_passed_to_buyer: true,
        };
      }
      return data;
    },
    enabled: !!profile?.organization_id,
  });

  // Calculate installment options with interest
  const installmentOptions = useMemo(() => {
    const amountCents = selectedSale?.total_cents || 0;
    const maxInst = tenantFees?.max_installments || 12;
    const fees = tenantFees?.installment_fees as Record<string, number> | null;
    const passToCustomer = tenantFees?.installment_fee_passed_to_buyer !== false;
    
    const options = [];
    for (let i = 1; i <= maxInst; i++) {
      let totalValue = amountCents;
      let hasInterest = false;
      
      if (i > 1 && passToCustomer && fees) {
        const feePercent = fees[i.toString()] || 2.69;
        totalValue = Math.round(amountCents * (1 + feePercent / 100));
        hasInterest = true;
      }
      
      options.push({
        installments: i,
        totalValue,
        perInstallment: Math.ceil(totalValue / i),
        hasInterest,
      interestAmount: totalValue - amountCents,
    });
  }
  return options;
}, [selectedSale?.total_cents, tenantFees]);

  const handleLeadChange = (id: string | null, lead: Lead | null) => {
    setLeadId(id);
    setSelectedLead(lead);
    setSelectedSaleId(null);
    setSelectedSale(null);
    
    if (id && lead) {
      setStep('select-sale');
    } else {
      setStep('select-lead');
    }
  };

  const handleSelectSale = (sale: Sale) => {
    setSelectedSaleId(sale.id);
    setSelectedSale(sale);
    setInstallments(1);
    setStep('payment');
  };

  const resetForm = () => {
    setLeadId(null);
    setSelectedLead(null);
    setSelectedSaleId(null);
    setSelectedSale(null);
    setInstallments(1);
    setCardNumber('');
    setCardHolder('');
    setCardExpiry('');
    setCardCvv('');
    setStep('select-lead');
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!selectedLead || !selectedSale) {
      toast.error('Selecione um cliente e uma venda');
      return;
    }

    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
      toast.error('Preencha todos os dados do cartão');
      return;
    }

    setStep('processing');

    try {
      const selectedInstallmentOption = installmentOptions.find(o => o.installments === installments);
      const finalAmountCents = selectedInstallmentOption?.totalValue || selectedSale.total_cents;
      const baseAmountCents = selectedSale.total_cents;
      const interestAmountCents = finalAmountCents - baseAmountCents;

      const response = await processMutation.mutateAsync({
        organizationId: profile?.organization_id || '',
        amount_cents: finalAmountCents,
        base_amount_cents: baseAmountCents,
        interest_amount_cents: interestAmountCents,
        payment_method: 'credit_card',
        installments,
        customer: {
          name: selectedLead.name,
          email: selectedLead.email || '',
          phone: selectedLead.whatsapp,
          document: selectedLead.cpf_cnpj || '',
        },
        card_data: {
          number: cardNumber.replace(/\s/g, ''),
          holder_name: cardHolder,
          expiration_date: cardExpiry,
          cvv: cardCvv,
        },
        origin_type: 'telesales',
        sale_id: selectedSale.id,
        lead_id: selectedLead.id,
      });

      setResult(response);
      setStep(response.status === 'paid' ? 'success' : 'error');
    } catch (error: any) {
      setResult({ error: error.message });
      setStep('error');
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{4})(?=\d)/g, '$1 ')
      .trim()
      .slice(0, 19);
  };

  const formatExpiry = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .slice(0, 5);
  };

  // Processing state
  if (step === 'processing') {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-medium">Processando pagamento...</h3>
          <p className="text-muted-foreground">Aguarde enquanto processamos a cobrança</p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h3 className="text-xl font-bold text-green-600 mb-2">Pagamento Aprovado!</h3>
          <p className="text-muted-foreground mb-4">
            Cobrança de {formatCurrency(selectedSale?.total_cents || 0)} realizada com sucesso
          </p>
          
          <div className="text-center space-y-2 mb-4">
            {result?.card && (
              <p className="text-sm text-muted-foreground">
                Cartão: {result.card.brand?.toUpperCase()} •••• {result.card.last_digits}
                {installments > 1 && ` em ${installments}x`}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Cliente: {selectedLead?.name}
            </p>
            {result?.transaction_id && (
              <a 
                href={`/vendas/${selectedSale?.id}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver venda vinculada
              </a>
            )}
          </div>
          
          <Button onClick={resetForm} className="mt-4">
            Nova Cobrança
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-red-600 mb-2">Pagamento Recusado</h3>
          <p className="text-muted-foreground text-center mb-4">
            {result?.error || 'Ocorreu um erro ao processar o pagamento'}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('payment')}>
              Tentar Novamente
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Cobrança por Televendas
          </CardTitle>
          <CardDescription>
            Selecione o cliente, escolha a venda pendente e realize a cobrança no cartão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Select Lead */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === 'select-lead' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </div>
              <h3 className="font-medium">Selecionar Cliente</h3>
              {selectedLead && step !== 'select-lead' && (
                <Badge variant="outline" className="ml-2">
                  <User className="h-3 w-3 mr-1" />
                  {selectedLead.name}
                </Badge>
              )}
            </div>
            
            <LeadSearchSelect
              value={leadId}
              onChange={handleLeadChange}
              placeholder="Buscar cliente por nome ou telefone..."
            />
            
            {selectedLead && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="font-medium">{selectedLead.name}</div>
                <div className="text-muted-foreground">
                  {selectedLead.whatsapp}
                  {selectedLead.email && ` • ${selectedLead.email}`}
                </div>
                {selectedLead.cpf_cnpj && (
                  <div className="text-muted-foreground">CPF/CNPJ: {selectedLead.cpf_cnpj}</div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Select Sale */}
          {leadId && (step === 'select-sale' || step === 'payment') && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === 'select-sale' ? 'bg-primary text-primary-foreground' : 
                    selectedSale ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    2
                  </div>
                  <h3 className="font-medium">Selecionar Venda Pendente</h3>
                  {selectedSale && step === 'payment' && (
                    <Badge variant="outline" className="ml-2">
                      <Receipt className="h-3 w-3 mr-1" />
                      {formatCurrency(selectedSale.total_cents)}
                    </Badge>
                  )}
                </div>
                
                {loadingSales ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : unpaidSales && unpaidSales.length > 0 ? (
                  <div className="space-y-2">
                    {unpaidSales.map((sale) => (
                      <div
                        key={sale.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedSaleId === sale.id 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:border-primary/50 hover:bg-muted/50'
                        }`}
                        onClick={() => handleSelectSale(sale)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {formatCurrency(sale.total_cents)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={sale.payment_status === 'pending' ? 'destructive' : 'secondary'}
                              className="mb-1"
                            >
                              {sale.payment_status === 'pending' ? 'Pendente' : 'Parcial'}
                            </Badge>
                            {sale.products && sale.products.length > 0 && (
                              <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                                {sale.products.map(p => p.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma venda pendente de pagamento</p>
                    <p className="text-sm">Este cliente não possui vendas aguardando pagamento</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 3: Payment */}
          {step === 'payment' && selectedSale && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground">
                    3
                  </div>
                  <h3 className="font-medium">Dados do Pagamento</h3>
                </div>
                
                {/* Amount summary */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Valor da venda:</span>
                    <span className="font-bold text-lg">{formatCurrency(selectedSale.total_cents)}</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Label className="text-sm">Parcelas:</Label>
                    <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                      <SelectTrigger className="w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {installmentOptions.map((opt) => (
                          <SelectItem key={opt.installments} value={opt.installments.toString()}>
                            {opt.installments}x {opt.installments === 1 
                              ? 'à vista' 
                              : `de ${formatCurrency(opt.perInstallment)}${opt.hasInterest ? '' : ' sem juros'}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {installments > 1 && installmentOptions.find(o => o.installments === installments)?.hasInterest && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Total com juros: {formatCurrency(installmentOptions.find(o => o.installments === installments)?.totalValue || 0)}
                    </div>
                  )}
                </div>

                {/* Card Data */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Dados do Cartão
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Número do Cartão *</Label>
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>Nome no Cartão *</Label>
                      <Input
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                        placeholder="NOME COMO NO CARTÃO"
                      />
                    </div>
                    
                    <div>
                      <Label>Validade *</Label>
                      <Input
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/AA"
                        maxLength={5}
                      />
                    </div>
                    
                    <div>
                      <Label>CVV *</Label>
                      <Input
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="000"
                        maxLength={4}
                        type="password"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!cardNumber || !cardHolder || !cardExpiry || !cardCvv}
                  >
                    <DollarSign className="h-5 w-5 mr-2" />
                    Cobrar {formatCurrency(
                      installmentOptions.find(o => o.installments === installments)?.totalValue || selectedSale.total_cents
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
