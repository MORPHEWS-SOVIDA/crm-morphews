import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [totalWithInterest, setTotalWithInterest] = useState<number>(0);

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

    if (!cardData) {
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
          paymentMethod: 'credit_card',
          cardData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        toast.success('Pagamento aprovado! Sua conta foi criada.');
        navigate('/login?signup=success');
      } else {
        throw new Error('Pagamento não aprovado');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || 'Erro ao processar checkout');
    } finally {
      setIsSubmitting(false);
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
                <span className="text-primary">{formatCurrency(totalWithInterest || totalFirstPayment)}</span>
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

              {/* Payment Method - Credit Card Only for Subscriptions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <Label className="text-base font-medium">Pagamento via Cartão de Crédito</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Assinaturas são cobradas automaticamente via cartão de crédito.
                </p>
              </div>

              {/* Credit Card Form */}
              <CreditCardForm
                onCardDataChange={setCardData}
                totalCents={totalFirstPayment}
                onTotalWithInterestChange={handleTotalWithInterestChange}
              />

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting || !cardData}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar {formatCurrency(totalWithInterest || totalFirstPayment)}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Implementer Info */}
        <p className="text-center text-xs text-muted-foreground">
          Implementação por {linkData.implementer.organization.name}
        </p>
      </div>
    </div>
  );
}
