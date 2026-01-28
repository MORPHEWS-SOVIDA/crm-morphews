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
  });

  useEffect(() => {
    async function fetchCheckoutLink() {
      if (!slug) {
        setError('Link inválido');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch the checkout link with plan and implementer data
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
      } catch (err) {
        console.error('Error fetching checkout link:', err);
        setError('Erro ao carregar checkout');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCheckoutLink();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkData) return;
    if (!formData.name || !formData.email) {
      toast.error('Preencha nome e email');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the edge function to create checkout with implementation fee
      const { data, error } = await supabase.functions.invoke('implementer-checkout', {
        body: {
          checkoutLinkId: linkData.id,
          customerName: formData.name,
          customerEmail: formData.email,
          customerWhatsapp: formData.whatsapp,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else if (data?.success) {
        // Free plan or instant activation
        toast.success('Conta criada com sucesso!');
        navigate('/login?signup=success');
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
                <span className="text-primary">{formatCurrency(totalFirstPayment)}</span>
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
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="(11) 99999-9999"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Continuar para Pagamento
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
