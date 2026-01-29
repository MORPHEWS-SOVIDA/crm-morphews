import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CreditCard, 
  QrCode, 
  FileText, 
  Lock, 
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Copy,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface PaymentLink {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  slug: string;
  amount_cents: number | null;
  allow_custom_amount: boolean;
  min_amount_cents: number;
  max_amount_cents: number | null;
  pix_enabled: boolean;
  boleto_enabled: boolean;
  card_enabled: boolean;
  max_installments: number | null;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  // Client-specific fields
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  lead_id: string | null;
  // Address fields (for better card approval)
  customer_cep: string | null;
  customer_street: string | null;
  customer_street_number: string | null;
  customer_neighborhood: string | null;
  customer_city: string | null;
  customer_state: string | null;
  customer_complement: string | null;
}

interface TenantFees {
  pix_fee_percentage: number;
  card_fee_percentage: number;
  boleto_fee_percentage: number;
  installment_fees: Record<string, number> | null;
  installment_fee_passed_to_buyer: boolean;
  max_installments: number;
}

export default function PaymentLinkCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  // Form state
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'credit_card'>('pix');
  const [installments, setInstallments] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  
  // Address (optional for multi-use links)
  const [showAddress, setShowAddress] = useState(false);
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  
  // Card data
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  
  // Payment state
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url?: string } | null>(null);
  const [boletoData, setBoletoData] = useState<{ barcode: string; pdf_url?: string } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch payment link
  const { data: paymentLink, isLoading, error } = useQuery({
    queryKey: ['public-payment-link', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      return data as PaymentLink;
    },
    enabled: !!slug,
  });

  // Fetch tenant fees
  const { data: tenantFees } = useQuery({
    queryKey: ['tenant-fees', paymentLink?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_payment_fees')
        .select('*')
        .eq('organization_id', paymentLink!.organization_id)
        .single();
      
      if (!data) {
        // Return defaults
        return {
          pix_fee_percentage: 0.99,
          pix_fee_fixed_cents: 100,
          card_fee_percentage: 4.99,
          card_fee_fixed_cents: 100, // R$1,00 fixed fee for anti-fraud + processing
          boleto_fee_percentage: 0.5,
          boleto_fee_fixed_cents: 400,
          installment_fees: { "2": 2.69, "3": 2.69, "4": 2.69, "5": 2.69, "6": 2.69, "7": 2.69, "8": 2.69, "9": 2.69, "10": 2.69, "11": 2.69, "12": 2.69 },
          installment_fee_passed_to_buyer: true,
          max_installments: 12,
        };
      }
      return data as unknown as TenantFees;
    },
    enabled: !!paymentLink?.organization_id,
  });

  // Set initial amount
  useEffect(() => {
    if (paymentLink?.amount_cents) {
      setAmount(paymentLink.amount_cents);
    }
  }, [paymentLink]);

  // Pre-fill customer data if it's a client-specific link
  useEffect(() => {
    if (paymentLink) {
      // Basic customer data
      if (paymentLink.customer_name) setCustomerName(paymentLink.customer_name);
      if (paymentLink.customer_email) setCustomerEmail(paymentLink.customer_email);
      if (paymentLink.customer_phone) setCustomerPhone(formatPhone(paymentLink.customer_phone));
      if (paymentLink.customer_document) setCustomerDocument(formatDocument(paymentLink.customer_document));
      
      // Address data (important for card approval on high-ticket sales)
      if (paymentLink.customer_cep) {
        setCep(paymentLink.customer_cep);
        setShowAddress(true); // Show address section if we have address data
      }
      if (paymentLink.customer_street) setStreet(paymentLink.customer_street);
      if (paymentLink.customer_street_number) setStreetNumber(paymentLink.customer_street_number);
      if (paymentLink.customer_neighborhood) setNeighborhood(paymentLink.customer_neighborhood);
      if (paymentLink.customer_city) setCity(paymentLink.customer_city);
      if (paymentLink.customer_state) setState(paymentLink.customer_state);
    }
  }, [paymentLink]);

  // Set default payment method based on availability
  useEffect(() => {
    if (paymentLink) {
      if (paymentLink.pix_enabled) setPaymentMethod('pix');
      else if (paymentLink.card_enabled) setPaymentMethod('credit_card');
      else if (paymentLink.boleto_enabled) setPaymentMethod('boleto');
    }
  }, [paymentLink]);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatCardExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length >= 2) {
      return numbers.substring(0, 2) + '/' + numbers.substring(2, 4);
    }
    return numbers;
  };

  // Calculate installment values
  const getInstallmentOptions = () => {
    if (!tenantFees) return [];
    
    const maxInst = Math.min(
      paymentLink?.max_installments || 12,
      tenantFees.max_installments || 12
    );
    
    const options = [];
    for (let i = 1; i <= maxInst; i++) {
      let value = amount;
      if (i > 1 && tenantFees.installment_fee_passed_to_buyer && tenantFees.installment_fees) {
        const monthlyRate = (tenantFees.installment_fees[i.toString()] || 2.69) / 100;
        // Compound interest for buyer
        value = Math.round(amount * Math.pow(1 + monthlyRate, i - 1));
      }
      options.push({
        installments: i,
        value,
        perInstallment: Math.round(value / i),
        hasInterest: i > 1 && tenantFees.installment_fee_passed_to_buyer,
      });
    }
    return options;
  };

  const handleSubmit = async () => {
    // Validation
    if (!customerName || !customerEmail || !customerPhone || !customerDocument) {
      toast.error('Preencha todos os dados do cliente');
      return;
    }

    if (!amount || amount < (paymentLink?.min_amount_cents || 100)) {
      toast.error('Valor inválido');
      return;
    }

    if (paymentMethod === 'credit_card') {
      if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
        toast.error('Preencha todos os dados do cartão');
        return;
      }
    }

    setIsProcessing(true);
    
    try {
      const selectedInstallment = getInstallmentOptions().find(o => o.installments === installments);
      const finalAmount = paymentMethod === 'credit_card' && selectedInstallment?.hasInterest 
        ? selectedInstallment.value 
        : amount;

      const payload: Record<string, unknown> = {
        paymentLinkId: paymentLink?.id,
        organizationId: paymentLink?.organization_id,
        amount_cents: finalAmount,
        payment_method: paymentMethod,
        installments: paymentMethod === 'credit_card' ? installments : 1,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone.replace(/\D/g, ''),
          document: customerDocument.replace(/\D/g, ''),
        },
        origin_type: 'payment_link',
      };

      if (paymentMethod === 'credit_card') {
        const [expMonth, expYear] = cardExpiry.split('/');
        payload.card_data = {
          number: cardNumber.replace(/\s/g, ''),
          holder_name: cardHolder,
          expiration_date: `${expMonth}/${expYear}`,
          cvv: cardCvv,
        };
      }

      const { data, error } = await supabase.functions.invoke('process-payment-link', {
        body: payload,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (paymentMethod === 'pix' && data.pix) {
        setPixData(data.pix);
      } else if (paymentMethod === 'boleto' && data.boleto) {
        setBoletoData(data.boleto);
      } else if (paymentMethod === 'credit_card' && data.status === 'paid') {
        setPaymentSuccess(true);
        toast.success('Pagamento aprovado!');
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error or not found
  if (error || !paymentLink) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link não encontrado</h2>
            <p className="text-muted-foreground">
              Este link de pagamento não existe ou está desativado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check expiration
  if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link expirado</h2>
            <p className="text-muted-foreground">
              Este link de pagamento expirou em {format(new Date(paymentLink.expires_at), "dd/MM/yyyy", { locale: ptBR })}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check max uses
  if (paymentLink.max_uses && paymentLink.use_count >= paymentLink.max_uses) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Limite atingido</h2>
            <p className="text-muted-foreground">
              Este link de pagamento atingiu o limite máximo de usos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Pagamento Aprovado!</h2>
            <p className="text-muted-foreground mb-4">
              Obrigado pela sua compra. Você receberá um e-mail de confirmação em breve.
            </p>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Valor pago</p>
              <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // PIX generated
  if (pixData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Pague com PIX</CardTitle>
            <CardDescription>{paymentLink.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={pixData.qr_code} size={200} level="H" />
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-3xl font-bold">{formatCurrency(amount)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Escaneie o QR Code ou copie o código abaixo
              </p>
            </div>

            <div className="space-y-2">
              <Label>Código PIX Copia e Cola</Label>
              <div className="flex gap-2">
                <Input 
                  value={pixData.qr_code} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(pixData.qr_code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              O pagamento será confirmado automaticamente após a transferência.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Boleto generated
  if (boletoData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Boleto Gerado</CardTitle>
            <CardDescription>{paymentLink.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{formatCurrency(amount)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vencimento: {format(addDays(new Date(), 3), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Código de Barras</Label>
              <div className="flex gap-2">
                <Input 
                  value={boletoData.barcode} 
                  readOnly 
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(boletoData.barcode)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {boletoData.pdf_url && (
              <Button 
                className="w-full" 
                onClick={() => window.open(boletoData.pdf_url, '_blank')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Baixar Boleto PDF
              </Button>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
              Pagamentos em boleto podem levar até 3 dias úteis para serem compensados.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main checkout form
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">{paymentLink.title}</CardTitle>
            {paymentLink.description && (
              <CardDescription>{paymentLink.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {paymentLink.amount_cents ? (
              <div className="text-center py-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{formatCurrency(paymentLink.amount_cents)}</p>
              </div>
            ) : paymentLink.allow_custom_amount ? (
              <div className="space-y-2">
                <Label>Valor a pagar</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    min={(paymentLink.min_amount_cents || 100) / 100}
                    max={paymentLink.max_amount_cents ? paymentLink.max_amount_cents / 100 : undefined}
                    step="0.01"
                    value={amount ? amount / 100 : ''}
                    onChange={(e) => setAmount(Math.round(parseFloat(e.target.value) * 100) || 0)}
                    className="pl-10"
                    placeholder="0,00"
                  />
                </div>
                {paymentLink.min_amount_cents && (
                  <p className="text-xs text-muted-foreground">
                    Mínimo: {formatCurrency(paymentLink.min_amount_cents)}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seus Dados</CardTitle>
            {paymentLink.customer_name && (
              <p className="text-xs text-muted-foreground">
                Dados já preenchidos pelo vendedor
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome Completo</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Seu nome"
                  readOnly={!!paymentLink.customer_name}
                  className={paymentLink.customer_name ? 'bg-muted' : ''}
                />
              </div>
              <div className="col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  readOnly={!!paymentLink.customer_email}
                  className={paymentLink.customer_email ? 'bg-muted' : ''}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  readOnly={!!paymentLink.customer_phone}
                  className={paymentLink.customer_phone ? 'bg-muted' : ''}
                />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input
                  value={customerDocument}
                  onChange={(e) => setCustomerDocument(formatDocument(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={18}
                  readOnly={!!paymentLink.customer_document}
                  className={paymentLink.customer_document ? 'bg-muted' : ''}
                />
              </div>
            </div>

            {/* Optional Address Section (for multi-use links only) */}
            {!paymentLink.lead_id && (
              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddress(!showAddress)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{showAddress ? '▼' : '▶'}</span>
                  <span>Adicionar endereço (opcional)</span>
                </button>
                
                {showAddress && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="col-span-2 sm:col-span-1">
                      <Label>CEP</Label>
                      <Input
                        value={cep}
                        onChange={(e) => setCep(e.target.value.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2'))}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Rua</Label>
                      <Input
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Nome da rua"
                      />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input
                        value={streetNumber}
                        onChange={(e) => setStreetNumber(e.target.value)}
                        placeholder="123"
                      />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Centro"
                      />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                      />
                    </div>
                    <div>
                      <Label>Estado</Label>
                      <Input
                        value={state}
                        onChange={(e) => setState(e.target.value.toUpperCase())}
                        placeholder="SP"
                        maxLength={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
              {paymentLink.pix_enabled && (
                <div 
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                    paymentMethod === 'pix' ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                  onClick={() => setPaymentMethod('pix')}
                >
                  <RadioGroupItem value="pix" id="pix" />
                  <QrCode className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <Label htmlFor="pix" className="cursor-pointer font-medium">PIX</Label>
                    <p className="text-xs text-muted-foreground">Aprovação instantânea</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">Rápido</Badge>
                </div>
              )}
              
              {paymentLink.card_enabled && (
                <div 
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                    paymentMethod === 'credit_card' ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                  onClick={() => setPaymentMethod('credit_card')}
                >
                  <RadioGroupItem value="credit_card" id="card" />
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <Label htmlFor="card" className="cursor-pointer font-medium">Cartão de Crédito</Label>
                    <p className="text-xs text-muted-foreground">
                      Até {paymentLink.max_installments || 12}x
                    </p>
                  </div>
                </div>
              )}
              
              {paymentLink.boleto_enabled && (
                <div 
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                    paymentMethod === 'boleto' ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                  onClick={() => setPaymentMethod('boleto')}
                >
                  <RadioGroupItem value="boleto" id="boleto" />
                  <FileText className="h-5 w-5 text-gray-600" />
                  <div className="flex-1">
                    <Label htmlFor="boleto" className="cursor-pointer font-medium">Boleto Bancário</Label>
                    <p className="text-xs text-muted-foreground">Vencimento em 3 dias</p>
                  </div>
                </div>
              )}
            </RadioGroup>

            {/* Card form */}
            {paymentMethod === 'credit_card' && (
              <div className="space-y-4 pt-4 border-t">
                {/* Installments */}
                <div>
                  <Label>Parcelas</Label>
                  <Select value={installments.toString()} onValueChange={(v) => setInstallments(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getInstallmentOptions().map((opt) => (
                        <SelectItem key={opt.installments} value={opt.installments.toString()}>
                          {opt.installments}x de {formatCurrency(opt.perInstallment)}
                          {opt.hasInterest && ' (com juros)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Número do Cartão</Label>
                  <Input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                  />
                </div>

                <div>
                  <Label>Nome no Cartão</Label>
                  <Input
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    placeholder="NOME IMPRESSO NO CARTÃO"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Validade</Label>
                    <Input
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
                      placeholder="MM/AA"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <Label>CVV</Label>
                    <Input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                      placeholder="000"
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <Button 
          className="w-full h-12 text-lg" 
          onClick={handleSubmit}
          disabled={isProcessing || !amount}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Lock className="h-5 w-5 mr-2" />
              Pagar {formatCurrency(
                paymentMethod === 'credit_card' && installments > 1
                  ? (getInstallmentOptions().find(o => o.installments === installments)?.value || amount)
                  : amount
              )}
            </>
          )}
        </Button>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>Pagamento seguro processado por Pagar.me</span>
        </div>
      </div>
    </div>
  );
}
