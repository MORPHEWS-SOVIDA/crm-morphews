import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, CheckCircle, Banknote, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { CreditCardForm, CreditCardData } from '@/components/storefront/checkout/CreditCardForm';

interface CheckoutLink {
  id: string;
  plan_id: string;
  implementation_fee_cents: number;
  slug: string;
  description: string | null;
  implementer: {
    referral_code: string;
    organization: {
      name: string;
    };
  };
  plan: {
    id: string;
    name: string;
    price_cents: number;
    max_users: number;
    max_leads: number | null;
    monthly_energy: number | null;
    included_whatsapp_instances: number;
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

export default function ImplementerCheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [linkData, setLinkData] = useState<CheckoutLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    document: '', // CPF/CNPJ
  });
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [totalWithInterest, setTotalWithInterest] = useState<number>(0);
  
  // PIX payment state
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url: string; order_id: string } | null>(null);
  const [isPollingPix, setIsPollingPix] = useState(false);

  useEffect(() => {
    async function fetchCheckoutLink() {
      if (!slug) {
        setError('Link inválido');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('implementer_checkout_links')
          .select(`
            id,
            plan_id,
            implementation_fee_cents,
            slug,
            description,
            implementer:implementers!implementer_id(
              referral_code,
              organization:organizations!organization_id(name)
            ),
            plan:subscription_plans!plan_id(
              id,
              name,
              price_cents,
              max_users,
              max_leads,
              monthly_energy,
              included_whatsapp_instances
            )
          `)
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (fetchError || !data) {
          setError('Link não encontrado ou inativo');
          setIsLoading(false);
          return;
        }

        // Update uses count
        await supabase
          .from('implementer_checkout_links')
          .update({ uses_count: (data as any).uses_count + 1 })
          .eq('id', data.id);

        setLinkData(data as unknown as CheckoutLink);
        const total = (data as any).plan.price_cents + (data as any).implementation_fee_cents;
        setTotalWithInterest(total);
      } catch (err) {
        console.error('Error fetching checkout link:', err);
        setError('Erro ao carregar checkout');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCheckoutLink();
  }, [slug]);

  // Format CPF/CNPJ
  const formatDocument = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      // CPF: 000.000.000-00
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0001-00
      return cleaned
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const handleTotalWithInterestChange = (total: number) => {
    setTotalWithInterest(total);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkData) return;
    if (!formData.name || !formData.email || !formData.document) {
      toast.error('Preencha nome, email e CPF/CNPJ');
      return;
    }

    if (paymentMethod === 'credit_card' && !cardData) {
      toast.error('Preencha os dados do cartão');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('implementer-checkout', {
        body: {
          checkoutLinkId: linkData.id,
          customerName: formData.name,
          customerEmail: formData.email,
          customerWhatsapp: formData.whatsapp,
          customerDocument: formData.document.replace(/\D/g, ''),
          paymentMethod,
          cardData: paymentMethod === 'credit_card' ? cardData : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (paymentMethod === 'pix' && data?.pix) {
        // Show PIX QR Code and start polling
        setPixData({
          qr_code: data.pix.qr_code,
          qr_code_url: data.pix.qr_code_url,
          order_id: data.order_id,
        });
        setIsPollingPix(true);
        toast.success('PIX gerado! Escaneie o QR Code para pagar.');
      } else if (paymentMethod === 'boleto' && data?.boleto) {
        // Open boleto URL
        window.open(data.boleto.url, '_blank');
        toast.success('Boleto gerado! Acesse o link para pagamento.');
        navigate('/login?signup=pending');
      } else if (data?.success) {
        // Card payment approved or instant activation
        toast.success('Pagamento aprovado! Sua conta foi criada.');
        navigate('/login?signup=success');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Erro ao processar checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Poll for PIX payment confirmation
  useEffect(() => {
    if (!isPollingPix || !pixData?.order_id) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('ecommerce-sale-status', {
          body: { orderId: pixData.order_id },
        });

        if (data?.status === 'paid' || data?.status === 'active') {
          setIsPollingPix(false);
          toast.success('Pagamento confirmado! Sua conta foi criada.');
          navigate('/login?signup=success');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPollingPix, pixData, navigate]);

  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      toast.success('Código PIX copiado!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Link Inválido</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'Este link de checkout não existe ou está inativo.'}
            </p>
            <Button onClick={() => navigate('/planos')}>
              Ver Planos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalFirstPayment = linkData.plan.price_cents + linkData.implementation_fee_cents;
  const displayTotal = paymentMethod === 'credit_card' ? totalWithInterest : totalFirstPayment;

  // PIX Payment Screen
  if (pixData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-muted/50 py-8 px-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Morphews CRM</h1>
            <p className="text-muted-foreground">Pagamento via PIX</p>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5" />
                Escaneie o QR Code
              </CardTitle>
              <CardDescription>
                Use o app do seu banco para pagar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pixData.qr_code_url && (
                <div className="flex justify-center">
                  <img 
                    src={pixData.qr_code_url} 
                    alt="QR Code PIX" 
                    className="w-64 h-64 border rounded-lg"
                  />
                </div>
              )}
              
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(totalFirstPayment)}
                </p>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={copyPixCode}
              >
                Copiar Código PIX
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando pagamento...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-muted/50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Morphews CRM</h1>
          <p className="text-muted-foreground">Checkout com Implementação</p>
        </div>

        {/* Plan Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Plano {linkData.plan.name}</span>
              <span className="text-primary">{formatCurrency(linkData.plan.price_cents)}/mês</span>
            </CardTitle>
            {linkData.description && (
              <CardDescription>{linkData.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{linkData.plan.max_users} usuários</span>
              </div>
              {linkData.plan.max_leads && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{linkData.plan.max_leads} leads/mês</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{linkData.plan.included_whatsapp_instances} WhatsApp</span>
              </div>
              {linkData.plan.monthly_energy && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{linkData.plan.monthly_energy} energia IA</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Pricing Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mensalidade</span>
                <span>{formatCurrency(linkData.plan.price_cents)}</span>
              </div>
              {linkData.implementation_fee_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Taxa de Implementação</span>
                  <span>{formatCurrency(linkData.implementation_fee_cents)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Hoje</span>
                <span className="text-primary">{formatCurrency(displayTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Após o primeiro mês, será cobrado {formatCurrency(linkData.plan.price_cents)}/mês
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Seus Dados</CardTitle>
            <CardDescription>
              Preencha seus dados para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">CPF/CNPJ *</Label>
                <Input
                  id="document"
                  placeholder="000.000.000-00"
                  value={formData.document}
                  onChange={(e) => setFormData(prev => ({ ...prev, document: formatDocument(e.target.value) }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="(11) 99999-9999"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                />
              </div>

              <Separator />

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Forma de Pagamento (1ª Cobrança)</Label>
                </div>
                <RadioGroup 
                  value={paymentMethod} 
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  className="grid grid-cols-3 gap-2"
                >
                  <Label
                    htmlFor="credit_card"
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === 'credit_card' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <RadioGroupItem value="credit_card" id="credit_card" className="sr-only" />
                    <CreditCard className="h-5 w-5" />
                    <span className="text-xs font-medium">Cartão</span>
                  </Label>
                  
                  <Label
                    htmlFor="pix"
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === 'pix' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <RadioGroupItem value="pix" id="pix" className="sr-only" />
                    <QrCode className="h-5 w-5" />
                    <span className="text-xs font-medium">PIX</span>
                  </Label>
                  
                  <Label
                    htmlFor="boleto"
                    className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === 'boleto' 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <RadioGroupItem value="boleto" id="boleto" className="sr-only" />
                    <Banknote className="h-5 w-5" />
                    <span className="text-xs font-medium">Boleto</span>
                  </Label>
                </RadioGroup>

                {/* Subscription notice for PIX/Boleto */}
                {paymentMethod !== 'credit_card' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Importante:</strong> A cobrança recorrente (mensalidade) será feita via cartão de crédito.
                      Você poderá cadastrar o cartão após a confirmação do pagamento via {paymentMethod === 'pix' ? 'PIX' : 'Boleto'}.
                    </p>
                  </div>
                )}
              </div>

              {/* Credit Card Form - for first payment */}
              {paymentMethod === 'credit_card' && (
                <CreditCardForm
                  onCardDataChange={setCardData}
                  totalCents={totalFirstPayment}
                  onTotalWithInterestChange={handleTotalWithInterestChange}
                />
              )}

              {/* PIX Info */}
              {paymentMethod === 'pix' && (
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p>Você será redirecionado para a página de pagamento PIX com QR Code.</p>
                </div>
              )}

              {/* Boleto Info */}
              {paymentMethod === 'boleto' && (
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p>O boleto será gerado e você poderá pagar em qualquer banco. Vencimento em 3 dias úteis.</p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting || (paymentMethod === 'credit_card' && !cardData)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    {paymentMethod === 'credit_card' && <CreditCard className="h-4 w-4 mr-2" />}
                    {paymentMethod === 'pix' && <QrCode className="h-4 w-4 mr-2" />}
                    {paymentMethod === 'boleto' && <Banknote className="h-4 w-4 mr-2" />}
                    {paymentMethod === 'credit_card' ? 'Pagar' : 'Gerar'} {formatCurrency(displayTotal)}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Ao continuar, você concorda com nossos termos de uso
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Implementer Badge */}
        <p className="text-center text-xs text-muted-foreground">
          Implementação por parceiro certificado Morphews
        </p>
      </div>
    </div>
  );
}
