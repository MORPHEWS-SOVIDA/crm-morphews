import { useState } from "react";
import { Check, Loader2, ArrowRight, Bot, Sparkles, Shield, MessageCircle, Mic, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionPlanById } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function DirectCheckout() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  const isAnnualParam = searchParams.get("annual") === "true";
  
  const { data: plan, isLoading: planLoading, error: planError } = useSubscriptionPlanById(planId);
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", whatsapp: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnnual, setIsAnnual] = useState(isAnnualParam);

  const handleSelectPlan = () => {
    // For AtomicPay plans, redirect directly to checkout URL
    if (plan?.payment_provider === "atomicpay") {
      const checkoutUrl = isAnnual 
        ? plan.atomicpay_annual_url 
        : plan.atomicpay_monthly_url;
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
    }
    
    // For Stripe plans, show lead modal
    setShowLeadModal(true);
  };

  const handleLeadSubmit = async () => {
    if (!leadForm.name.trim() || !leadForm.whatsapp.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome e WhatsApp são necessários para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!leadForm.email.trim()) {
      toast({
        title: "E-mail é obrigatório",
        description: "Informe seu e-mail para receber as credenciais de acesso.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await supabase.from("interested_leads").insert({
        name: leadForm.name.trim(),
        whatsapp: leadForm.whatsapp.trim(),
        email: leadForm.email.trim(),
        plan_id: plan?.id,
        plan_name: plan?.name,
        status: "checkout_started",
      });

      setShowLeadModal(false);

      const { data, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId: plan?.id,
          customerEmail: leadForm.email.trim(),
          customerName: leadForm.name.trim(),
          customerWhatsapp: leadForm.whatsapp.trim(),
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/checkout?plan=${planId}`,
        },
      });

      if (checkoutError) throw checkoutError;
      if (data?.error) throw new Error(data.error);
      
      // For free plan, redirect to success page
      if (data?.success) {
        toast({
          title: "Conta criada com sucesso! 🎉",
          description: "Verifique seu e-mail para obter as credenciais de acesso.",
        });
        navigate(`/signup-success?email=${encodeURIComponent(leadForm.email.trim())}`);
        return;
      }
      
      // For paid plans, redirect to Stripe
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  if (planLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!planId || planError || !plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Plano não encontrado</h1>
          <p className="text-muted-foreground">O link de contratação pode estar incorreto ou expirado.</p>
          <Link to="/planos">
            <Button>Ver todos os planos</Button>
          </Link>
        </div>
      </div>
    );
  }

  const features = [
    { icon: MessageCircle, text: "Atendimento por WhatsApp" },
    { icon: Mic, text: "Comandos por áudio" },
    { icon: Image, text: "Cadastro por print" },
    { icon: Bot, text: "Secretária IA 24/7" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Morphews" className="h-8 w-8 rounded" />
            <span className="font-bold text-xl">Morphews</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          {/* Heading */}
          <div className="text-center mb-10">
            <Badge className="mb-4 px-4 py-2 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-2" />
              Oferta Exclusiva
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Plano {plan.name}
            </h1>
            <p className="text-muted-foreground text-lg">
              Comece agora e transforme seu atendimento comercial
            </p>
          </div>

          {/* Plan Card */}
          <Card className="relative overflow-hidden border-2 border-primary/50 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            
            <CardHeader className="relative text-center pb-4">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              
              {/* Billing toggle */}
              {plan.annual_price_cents && plan.price_cents > 0 && (
                <div className="flex items-center justify-center gap-3 mt-4 p-2 bg-muted/50 rounded-lg">
                  <button
                    onClick={() => setIsAnnual(false)}
                    className={`px-4 py-2 rounded-md transition-all ${!isAnnual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setIsAnnual(true)}
                    className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${isAnnual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    Anual
                    <Badge variant="secondary" className="bg-green-500/20 text-green-600 text-xs">40% OFF</Badge>
                  </button>
                </div>
              )}
              
              <div className="mt-6">
                <span className="text-5xl font-bold text-primary">
                  {plan.price_cents === 0 
                    ? "Grátis" 
                    : isAnnual && plan.annual_price_cents
                      ? formatPrice(Math.round(plan.annual_price_cents / 12))
                      : formatPrice(plan.price_cents)}
                </span>
                {plan.price_cents > 0 && (
                  <span className="text-muted-foreground">/mês</span>
                )}
                {isAnnual && plan.annual_price_cents && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Cobrado {formatPrice(plan.annual_price_cents)}/ano
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="relative space-y-6">
              {/* Limits */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{plan.max_users}</div>
                  <div className="text-xs text-muted-foreground">Usuários</div>
                </div>
                <div className="text-center border-x">
                  <div className="text-2xl font-bold text-primary">{plan.max_leads ?? "∞"}</div>
                  <div className="text-xs text-muted-foreground">Leads/mês</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{plan.monthly_energy ?? "∞"}</div>
                  <div className="text-xs text-muted-foreground">Energia IA</div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-6 pt-4 border-t text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-green-500" />
                  Pagamento seguro
                </div>
                <div className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-green-500" />
                  Cancele quando quiser
                </div>
              </div>
            </CardContent>

            <CardFooter className="relative">
              <Button 
                onClick={handleSelectPlan} 
                className="w-full h-14 text-lg gap-2"
                size="lg"
              >
                Quero Este Plano <ArrowRight className="h-5 w-5" />
              </Button>
            </CardFooter>
          </Card>

          {/* Back link */}
          <div className="text-center mt-8">
            <Link to="/planos" className="text-muted-foreground hover:text-foreground transition-colors">
              ← Ver todos os planos disponíveis
            </Link>
          </div>
        </div>
      </main>

      {/* Lead Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Vamos começar!
            </DialogTitle>
            <DialogDescription>
              Preencha seus dados para contratar o plano <strong>{plan.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={leadForm.whatsapp}
                onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Você receberá suas credenciais de acesso neste e-mail
              </p>
            </div>
          </div>

          <Button 
            onClick={handleLeadSubmit} 
            className="w-full gap-2" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                {plan.price_cents === 0 ? "Criar Minha Conta Grátis" : "Ir para Pagamento"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
