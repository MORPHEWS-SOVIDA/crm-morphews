import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, CreditCard, CheckCircle, AlertCircle, ChevronLeft, Shield, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCardForm, CreditCardData } from '@/components/storefront/checkout/CreditCardForm';
import { cn } from '@/lib/utils';
import { useSlugFromContext, usePlanSlugFromContext } from '@/components/CustomDomainRedirect';

interface WhiteLabelConfig {
  id: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  support_whatsapp: string | null;
  implementer_id: string;
}

interface WhiteLabelPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  setup_fee_cents: number;
  max_users: number;
  max_whatsapp_instances: number;
  max_energy_per_month: number;
  has_whatsapp: boolean;
  has_ai_bots: boolean;
  has_ecommerce: boolean;
  has_erp: boolean;
  has_nfe: boolean;
  has_tracking: boolean;
  white_label_config_id: string;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function WhiteLabelCheckoutPage() {
  const { slug: urlSlug, planSlug: urlPlanSlug } = useParams<{ slug: string; planSlug: string }>();
  const contextSlug = useSlugFromContext();
  const contextPlanSlug = usePlanSlugFromContext();
  const slug = contextSlug || urlSlug;
  const planSlug = contextPlanSlug || urlPlanSlug;
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState<WhiteLabelConfig | null>(null);
  const [plan, setPlan] = useState<WhiteLabelPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    document: '',
  });
  
  const [cardData, setCardData] = useState<CreditCardData | null>(null);
  const [totalWithInterest, setTotalWithInterest] = useState<number>(0);

  useEffect(() => {
    async function loadData() {
      if (!slug || !planSlug) {
        setError('Link inválido');
        setIsLoading(false);
        return;
      }

      try {
        // Load white label config by slug
        const { data: configData, error: configError } = await supabase
          .from('white_label_configs')
          .select('id, brand_name, logo_url, primary_color, support_whatsapp, implementer_id')
          .eq('sales_page_slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (configError || !configData) {
          setError('Página não encontrada');
          setIsLoading(false);
          return;
        }

        setConfig(configData);

        // Load plan by slug
        const { data: planData, error: planError } = await supabase
          .from('white_label_plans')
          .select('*')
          .eq('white_label_config_id', configData.id)
          .eq('slug', planSlug)
          .eq('is_active', true)
          .maybeSingle();

        if (planError || !planData) {
          setError('Plano não encontrado');
          setIsLoading(false);
          return;
        }

        setPlan(planData);
        setTotalWithInterest(planData.price_cents + planData.setup_fee_cents);
      } catch (err) {
        console.error('Error loading checkout data:', err);
        setError('Erro ao carregar checkout');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug, planSlug]);

  // Format CPF/CNPJ
  const formatDocument = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
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
    
    if (!plan || !config) return;
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
      const { data, error } = await supabase.functions.invoke('white-label-checkout', {
        body: {
          whiteLabelConfigId: config.id,
          planId: plan.id,
          customerName: formData.name,
          customerEmail: formData.email,
          customerWhatsapp: formData.whatsapp,
          customerDocument: formData.document.replace(/\D/g, ''),
          cardData,
          refCode: searchParams.get('ref') || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        toast.success('Pagamento aprovado! Sua conta foi criada.');
        // Redirect to white label login
        navigate(`/${slug}/login?signup=success`);
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

  if (error || !plan || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Erro</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'Este link de checkout não existe ou está inativo.'}
            </p>
            <Button onClick={() => navigate(`/${slug}`)}>
              Voltar para Planos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = config.primary_color || '#8B5CF6';
  const totalFirstPayment = plan.price_cents + plan.setup_fee_cents;

  const planFeatures = [
    `${plan.max_users} usuário${plan.max_users > 1 ? 's' : ''}`,
    `${plan.max_whatsapp_instances} instância${plan.max_whatsapp_instances > 1 ? 's' : ''} WhatsApp`,
    plan.has_ai_bots && `${plan.max_energy_per_month.toLocaleString()} energia IA`,
    plan.has_ecommerce && 'E-commerce',
    plan.has_erp && 'ERP completo',
    plan.has_nfe && 'Emissão de NF-e',
    plan.has_tracking && 'Tracking avançado',
  ].filter(Boolean) as string[];

  return (
    <>
      <Helmet>
        <title>Checkout - {plan.name} | {config.brand_name}</title>
        {config.logo_url && <link rel="icon" href={config.logo_url} />}
      </Helmet>

      <div 
        className="min-h-screen bg-gradient-to-b from-muted/30 to-muted/50 py-6 px-4"
        style={{ '--primary': primaryColor } as React.CSSProperties}
      >
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/${slug}`)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 text-center">
              {config.logo_url ? (
                <img 
                  src={config.logo_url} 
                  alt={config.brand_name} 
                  className="h-8 mx-auto" 
                />
              ) : (
                <h1 
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {config.brand_name}
                </h1>
              )}
            </div>
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Plan Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.description && (
                    <CardDescription>{plan.description}</CardDescription>
                  )}
                </div>
                <Badge 
                  className="text-lg px-3 py-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  {formatCurrency(plan.price_cents)}/mês
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {planFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Pricing Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Mensalidade</span>
                  <span>{formatCurrency(plan.price_cents)}</span>
                </div>
                {plan.setup_fee_cents > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa de Implementação</span>
                    <span>{formatCurrency(plan.setup_fee_cents)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total Hoje</span>
                  <span style={{ color: primaryColor }}>
                    {formatCurrency(totalWithInterest || totalFirstPayment)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Após o primeiro mês: {formatCurrency(plan.price_cents)}/mês
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Checkout Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" style={{ color: primaryColor }} />
                Seus Dados
              </CardTitle>
              <CardDescription>
                Preencha seus dados para finalizar a assinatura
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="document">CPF/CNPJ *</Label>
                    <Input
                      id="document"
                      placeholder="000.000.000-00"
                      value={formData.document}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        document: formatDocument(e.target.value) 
                      }))}
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
                </div>

                <Separator className="my-4" />

                {/* Payment Method */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" style={{ color: primaryColor }} />
                    <Label className="text-base font-medium">Cartão de Crédito</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Assinaturas são cobradas mensalmente via cartão de crédito.
                  </p>
                </div>

                <CreditCardForm
                  onCardDataChange={setCardData}
                  totalCents={totalFirstPayment}
                  onTotalWithInterestChange={handleTotalWithInterestChange}
                />

                <Button 
                  type="submit" 
                  className="w-full text-white" 
                  size="lg"
                  disabled={isSubmitting || !cardData}
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Assinar por {formatCurrency(totalWithInterest || totalFirstPayment)}
                    </>
                  )}
                </Button>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Pagamento 100% seguro
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Support */}
          {config.support_whatsapp && (
            <p className="text-center text-xs text-muted-foreground">
              Dúvidas?{' '}
              <a 
                href={`https://wa.me/${config.support_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: primaryColor }}
              >
                Fale conosco pelo WhatsApp
              </a>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
