import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { useProcessPayment } from '@/hooks/usePaymentLinks';
import { useAuth } from '@/hooks/useAuth';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface InlineTelesalesFormProps {
  amountCents: number;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;
  saleId?: string;
  leadId?: string;
  onSuccess?: (transactionId: string) => void;
  onCancel?: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InlineTelesalesForm({
  amountCents,
  customerName,
  customerDocument: initialDocument = '',
  customerPhone = '',
  customerEmail = '',
  saleId,
  leadId,
  onSuccess,
  onCancel,
  isOpen,
  onOpenChange,
}: InlineTelesalesFormProps) {
  const { profile, isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures } = useOrgFeatures();
  const processMutation = useProcessPayment();
  
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [result, setResult] = useState<any>(null);
  
  // Form state
  const [customerDoc, setCustomerDoc] = useState(initialDocument);
  const [installments, setInstallments] = useState(1);
  
  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Check permissions
  const canTelesales = isAdmin || permissions?.telesales_manage;
  const hasFeature = orgFeatures?.telesales !== false;

  const resetForm = () => {
    setCardNumber('');
    setCardHolder('');
    setCardExpiry('');
    setCardCvv('');
    setInstallments(1);
    setStep('form');
    setResult(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
    onCancel?.();
  };

  const handleSubmit = async () => {
    if (!customerDoc) {
      toast.error('CPF/CNPJ é obrigatório');
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
          document: customerDoc,
        },
        card_data: {
          number: cardNumber.replace(/\s/g, ''),
          holder_name: cardHolder,
          expiration_date: cardExpiry,
          cvv: cardCvv,
        },
        origin_type: 'receptive',
        sale_id: saleId,
        lead_id: leadId,
      });

      setResult(response);
      if (response.status === 'paid') {
        setStep('success');
        onSuccess?.(response.transaction_id);
      } else {
        setStep('error');
      }
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

  if (!canTelesales || !hasFeature) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Cobrança por Cartão - Televendas
          </DialogTitle>
          <DialogDescription>
            {formatCurrency(amountCents)} • {customerName}
          </DialogDescription>
        </DialogHeader>

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium">Processando pagamento...</h3>
            <p className="text-muted-foreground">Aguarde enquanto processamos a cobrança</p>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-green-600 mb-2">Pagamento Aprovado!</h3>
            <p className="text-muted-foreground mb-4">
              Cobrança de {formatCurrency(amountCents)} realizada com sucesso
            </p>
            {result?.card && (
              <div className="text-sm text-muted-foreground text-center">
                <p>Cartão: {result.card.brand?.toUpperCase()} •••• {result.card.last_digits}</p>
                {result.card.installments > 1 && (
                  <p>Parcelado em {result.card.installments}x</p>
                )}
              </div>
            )}
            <Button onClick={handleClose} className="mt-6">
              Concluir
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-red-600 mb-2">Pagamento Recusado</h3>
            <p className="text-muted-foreground text-center mb-4">
              {result?.error || 'Ocorreu um erro ao processar o pagamento'}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('form')}>
                Tentar Novamente
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-6">
            {/* Amount Display */}
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-sm text-muted-foreground">Valor a cobrar</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(amountCents)}</p>
              <p className="text-sm text-muted-foreground mt-1">{customerName}</p>
            </div>

            {/* Customer Document */}
            <div>
              <Label>CPF/CNPJ do Cliente *</Label>
              <Input
                value={customerDoc}
                onChange={(e) => setCustomerDoc(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            {/* Installments */}
            <div>
              <Label>Parcelas</Label>
              <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}x de {formatCurrency(Math.ceil(amountCents / n))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Card Data */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Dados do Cartão
              </Label>
              
              <div className="grid gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Número do Cartão *</Label>
                  <Input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                  />
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground">Nome no Cartão *</Label>
                  <Input
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    placeholder="NOME COMO NO CARTÃO"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Validade *</Label>
                    <Input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/AA"
                      maxLength={5}
                    />
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground">CVV *</Label>
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
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSubmit}
                disabled={!cardNumber || !cardHolder || !cardExpiry || !cardCvv || !customerDoc}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Cobrar {formatCurrency(amountCents)}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
