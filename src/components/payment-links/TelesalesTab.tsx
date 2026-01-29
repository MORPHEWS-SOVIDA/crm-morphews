import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProcessPayment } from '@/hooks/usePaymentLinks';
import { useAuth } from '@/hooks/useAuth';

import { 
  CreditCard, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  User,
  Mail,
  FileText,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

export function TelesalesTab() {
  const { profile } = useAuth();
  const processMutation = useProcessPayment();
  
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [result, setResult] = useState<any>(null);
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [amountCents, setAmountCents] = useState<number>(0);
  const [installments, setInstallments] = useState(1);
  
  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerDocument('');
    setAmountCents(0);
    setInstallments(1);
    setCardNumber('');
    setCardHolder('');
    setCardExpiry('');
    setCardCvv('');
    setStep('form');
    setResult(null);
  };

  const handleSubmit = async () => {
    // Validate
    if (!customerName || !customerDocument || !amountCents) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
      toast.error('Preencha todos os dados do cartão');
      return;
    }

    setStep('processing');

    try {
      const response = await processMutation.mutateAsync({
        organizationId: profile?.organization_id || '',
        amount_cents: amountCents,
        payment_method: 'credit_card',
        installments,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          document: customerDocument,
        },
        card_data: {
          number: cardNumber.replace(/\s/g, ''),
          holder_name: cardHolder,
          expiration_date: cardExpiry,
          cvv: cardCvv,
        },
        origin_type: 'telesales',
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

  if (step === 'success') {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h3 className="text-xl font-bold text-green-600 mb-2">Pagamento Aprovado!</h3>
          <p className="text-muted-foreground mb-4">
            Cobrança de {formatCurrency(amountCents)} realizada com sucesso
          </p>
          {result?.card && (
            <div className="text-sm text-muted-foreground">
              <p>Cartão: {result.card.brand?.toUpperCase()} •••• {result.card.last_digits}</p>
              {result.card.installments > 1 && (
                <p>Parcelado em {result.card.installments}x</p>
              )}
            </div>
          )}
          <Button onClick={resetForm} className="mt-6">
            Nova Cobrança
          </Button>
        </CardContent>
      </Card>
    );
  }

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
            <Button variant="outline" onClick={resetForm}>
              Tentar Novamente
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
            Digite os dados do cliente e do cartão para realizar a cobrança
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Data */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Dados do Cliente</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div>
                <Label>CPF/CNPJ *</Label>
                <Input
                  value={customerDocument}
                  onChange={(e) => setCustomerDocument(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              
              <div>
                <Label>Telefone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              
              <div className="col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground">Valor</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor da Cobrança *</Label>
                <Input
                  type="number"
                  value={amountCents ? amountCents / 100 : ''}
                  onChange={(e) => setAmountCents(Math.round(parseFloat(e.target.value || '0') * 100))}
                  placeholder="0,00"
                  step="0.01"
                />
              </div>
              
              <div>
                <Label>Parcelas</Label>
                <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}x {n === 1 ? 'à vista' : `de ${formatCurrency(amountCents / n)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Card Data */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Dados do Cartão
            </h3>
            
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
              disabled={!amountCents || !customerName || !customerDocument}
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Cobrar {amountCents > 0 ? formatCurrency(amountCents) : ''}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
