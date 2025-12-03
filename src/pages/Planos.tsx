import { useState } from "react";
import { Check, Zap, Crown, Rocket, Users, Database, Loader2, Star, Filter, Phone, Mail, Target, TrendingUp, Calendar, ChevronRight, Play, ArrowRight, MessageCircle, BarChart3, Sparkles, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionPlans, useCreateCheckout, useCurrentSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const planIcons: Record<string, React.ReactNode> = {
  Start: <Zap className="h-6 w-6" />,
  Pro: <Crown className="h-6 w-6" />,
  Ultra: <Rocket className="h-6 w-6" />,
};

const planColors: Record<string, string> = {
  Start: "from-blue-500 to-cyan-500",
  Pro: "from-purple-500 to-pink-500",
  Ultra: "from-amber-500 to-orange-500",
};

const funnelStages = [
  { name: "Prospecção", color: "bg-orange-300", leads: 45 },
  { name: "Contato", color: "bg-orange-500", leads: 38 },
  { name: "Convencimento", color: "bg-yellow-400", leads: 28 },
  { name: "Reunião", color: "bg-blue-400", leads: 18 },
  { name: "Positivo", color: "bg-green-400", leads: 12 },
  { name: "Aguardando", color: "bg-green-500", leads: 8 },
  { name: "Sucesso", color: "bg-amber-400", leads: 5 },
];

export default function Planos() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: currentSubscription } = useCurrentSubscription();
  const createCheckout = useCreateCheckout();
  const navigate = useNavigate();
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string } | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", whatsapp: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoCheckoutTriggered, setAutoCheckoutTriggered] = useState(false);

  // Handle subscription success redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("subscription") === "success") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Auto-trigger checkout if user came from login with a plan selected
  useEffect(() => {
    if (user && plans && !autoCheckoutTriggered && !plansLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      const planId = urlParams.get("plan");
      
      if (planId) {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
          setAutoCheckoutTriggered(true);
          // Clear the URL params
          window.history.replaceState({}, '', '/planos');
          // Trigger checkout
          createCheckout.mutate(planId);
        }
      }
    }
  }, [user, plans, plansLoading, autoCheckoutTriggered, createCheckout]);

  const handleSelectPlan = (planId: string, planName: string) => {
    setSelectedPlan({ id: planId, name: planName });
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

    // Require email for checkout
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
      // Save interested lead
      const { error } = await supabase.from("interested_leads").insert({
        name: leadForm.name.trim(),
        whatsapp: leadForm.whatsapp.trim(),
        email: leadForm.email.trim(),
        plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.name,
        status: "checkout_started",
      });

      if (error) {
        console.error("Error saving lead:", error);
        // Continue to checkout even if lead save fails
      }

      setShowLeadModal(false);

      // Go directly to Stripe checkout without requiring login
      const { data, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId: selectedPlan?.id,
          customerEmail: leadForm.email.trim(),
          customerName: leadForm.name.trim(),
          customerWhatsapp: leadForm.whatsapp.trim(),
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/planos`,
        },
      });

      if (checkoutError) throw checkoutError;
      if (data?.error) throw new Error(data.error);
      
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

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.plan_id === planId && currentSubscription?.status === "active";
  };

  if (plansLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Morphews CRM" className="h-8 w-8 rounded" />
            <span className="font-bold text-xl">Morphews CRM</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#precos" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Preços
            </a>
            <a href="#funcionalidades" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Funcionalidades
            </a>
            {user ? (
              <Link to="/">
                <Button variant="outline">Acessar Sistema</Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button>Entrar</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-2">
              <Sparkles className="h-3 w-3 mr-2" />
              O CRM que vai transformar suas vendas
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Pare de perder leads e 
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"> comece a fechar mais vendas</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Organize seus leads, acompanhe o funil de vendas, qualifique com estrelas e nunca mais esqueça de fazer follow-up. Simples, intuitivo e poderoso.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a href="#precos">
                <Button size="lg" className="text-lg px-8 gap-2">
                  Começar Agora <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <a href="#funcionalidades">
                <Button size="lg" variant="outline" className="text-lg px-8 gap-2">
                  <Play className="h-5 w-5" /> Ver Funcionalidades
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Dados seguros
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Setup em 5 minutos
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-500" />
                Suporte por WhatsApp
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">500+</div>
              <div className="text-muted-foreground">Leads gerenciados</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">98%</div>
              <div className="text-muted-foreground">Satisfação</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">3x</div>
              <div className="text-muted-foreground">Mais conversões</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary">24/7</div>
              <div className="text-muted-foreground">Acesso ilimitado</div>
            </div>
          </div>
        </div>
      </section>

      {/* Funnel Feature */}
      <section id="funcionalidades" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Funil Visual</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Visualize todo seu pipeline de vendas
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Acompanhe cada lead em tempo real e saiba exatamente onde cada oportunidade está no seu processo de vendas.
            </p>
          </div>

          {/* Funnel Visualization - Real Funnel Shape */}
          <div className="max-w-lg mx-auto mb-16">
            <div className="bg-card rounded-2xl border shadow-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-center">Funil de Vendas</h3>
              
              {/* Cloud - "Não é a hora" */}
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Não é a hora (3)
                </div>
              </div>

              {/* Funnel Stages */}
              <div className="flex flex-col items-center gap-1">
                {[
                  { label: "Prospectando / Aguardando resposta", count: 45, color: "bg-orange-300", width: "100%" },
                  { label: "Cliente nos chamou", count: 38, color: "bg-orange-500", width: "90%" },
                  { label: "Convencendo a marcar call", count: 28, color: "bg-yellow-400", width: "80%" },
                  { label: "Call agendada", count: 18, color: "bg-blue-400", width: "70%" },
                  { label: "Call feita positiva", count: 12, color: "bg-green-400 border-2 border-purple-500", width: "60%" },
                  { label: "Aguardando pagamento", count: 8, color: "bg-green-500", width: "50%" },
                  { label: "PAGO - SUCESSO!", count: 5, color: "bg-amber-400", width: "40%" },
                ].map((stage, index) => (
                  <div
                    key={stage.label}
                    style={{ width: stage.width }}
                    className={`${stage.color} py-3 px-4 transition-all duration-300 hover:scale-[1.02] ${
                      index === 0 ? "rounded-t-xl" : ""
                    } ${index === 6 ? "rounded-b-xl" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs md:text-sm font-medium text-gray-800 truncate pr-2">
                        {stage.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/40 text-gray-800 shrink-0">
                        {stage.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trash - "Sem interesse" */}
              <div className="flex justify-end mt-4 -mr-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Sem interesse (2)
                </div>
              </div>

              <div className="mt-6 text-center text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4 inline mr-2" />
                Acompanhe a evolução dos seus leads em cada etapa
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Star Rating Feature */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Qualificação por Estrelas</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Priorize os leads mais valiosos
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Classifique seus leads de 1 a 5 estrelas baseado no potencial de conversão. Leads 5 estrelas são influenciadores com muitos seguidores. Leads 1 estrela são profissionais em formação.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  </div>
                  <span>Filtre leads por classificação com um clique</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  </div>
                  <span>Visualize rapidamente quem são os melhores leads</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  </div>
                  <span>Foque seu tempo onde realmente importa</span>
                </li>
              </ul>
            </div>
            <div className="bg-card rounded-2xl border shadow-xl p-6">
              <div className="space-y-4">
                {[
                  { name: "Dr. João Silva", stars: 5, followers: "150k", stage: "Reunião Agendada" },
                  { name: "Dra. Maria Santos", stars: 4, followers: "80k", stage: "Convencimento" },
                  { name: "Dr. Pedro Costa", stars: 3, followers: "25k", stage: "Contato Inicial" },
                ].map((lead, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-sm text-muted-foreground">{lead.followers} seguidores</div>
                    </div>
                    <div className="text-right">
                      <div className="flex gap-0.5 mb-1 justify-end">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star
                            key={j}
                            className={`h-4 w-4 ${j < lead.stars ? "text-amber-500 fill-amber-500" : "text-gray-300"}`}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">{lead.stage}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters Feature */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="bg-card rounded-2xl border shadow-xl p-6">
                <div className="grid grid-cols-2 gap-2 mb-6">
                  <Badge variant="secondary" className="gap-1 justify-center py-2">
                    <Filter className="h-3 w-3" /> Por Responsável
                  </Badge>
                  <Badge variant="secondary" className="gap-1 justify-center py-2">
                    <Star className="h-3 w-3" /> Por Estrelas
                  </Badge>
                  <Badge variant="secondary" className="gap-1 justify-center py-2">
                    <Target className="h-3 w-3" /> Por Etapa
                  </Badge>
                  <Badge variant="secondary" className="gap-1 justify-center py-2">
                    <Calendar className="h-3 w-3" /> Por Data
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="h-10 bg-muted/50 rounded animate-pulse" />
                  <div className="h-10 bg-muted/30 rounded animate-pulse" />
                  <div className="h-10 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Encontre qualquer lead em segundos
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <Badge variant="outline" className="mb-4">Filtros Inteligentes</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Encontre qualquer lead instantaneamente
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Filtre por responsável, por estrelas, por etapa do funil, por data de reunião e muito mais. Tenha controle total sobre seus dados.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Veja leads por vendedor responsável</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Filtre por classificação de estrelas</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Busque por qualquer campo do cadastro</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Complete Fields Feature */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Cadastro Completo</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Todas as informações em um só lugar
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Registre tudo sobre seu lead: dados pessoais, redes sociais, produtos de interesse, valores negociados e muito mais.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Nome completo</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Especialidade/Empresa</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> CPF/CNPJ</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> E-mail</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Contato & Redes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> WhatsApp (clicável)</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Instagram + seguidores</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> LinkedIn</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Site</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Negociação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Produtos negociados</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Valor negociado</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Valor pago</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Origem do lead</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  Reuniões
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Data e hora</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Link da reunião</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Link da gravação</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Grupo WhatsApp</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="h-5 w-5 text-primary" />
                  Qualificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Classificação 1-5 estrelas</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Etapa do funil</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Responsável pelo lead</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Data de criação</div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Notas gerais</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Produtos de interesse</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Histórico completo</div>
                <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Edição inline rápida</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Intuitive Feature */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Edição Inline</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Edite qualquer informação com um clique
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Nosso sistema foi projetado para ser o mais intuitivo possível. Clique em qualquer campo e edite na hora, sem precisar abrir formulários ou telas separadas.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Super Rápido</div>
                    <div className="text-sm text-muted-foreground">Atualize dados em menos de 2 segundos</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">WhatsApp Integrado</div>
                    <div className="text-sm text-muted-foreground">Clique no número e abra conversa direto</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Dashboard Completo</div>
                    <div className="text-sm text-muted-foreground">Todas as métricas importantes em um lugar</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-2xl border shadow-xl p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium group-hover:text-primary transition-colors">Dr. João Silva ✏️</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <span className="font-medium text-green-600 group-hover:underline">(11) 99999-9999</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-muted-foreground">Valor Negociado:</span>
                  <span className="font-medium group-hover:text-primary transition-colors">R$ 5.000,00 ✏️</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-2 border-primary border-dashed">
                  <span className="text-muted-foreground">Etapa:</span>
                  <select className="bg-transparent font-medium text-primary focus:outline-none">
                    <option>Reunião Agendada</option>
                  </select>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Clique para editar • Automático • Sem formulários
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Guarantee Section */}
      <section className="py-16 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 mb-6">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Garantia de 7 dias
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              Se você não gostar, pode pedir reembolso sem problema nenhum.
            </p>
            <p className="text-muted-foreground">
              Experimente o Morphews CRM por 7 dias. Se não estiver 100% satisfeito com a plataforma, 
              devolvemos seu dinheiro integralmente, sem perguntas.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 bg-gradient-to-b from-background via-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">Planos e Preços</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha o plano ideal para seu negócio
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Comece a organizar seus leads hoje. Todos os planos incluem suporte e atualizações.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans?.map((plan) => {
              const isPro = plan.name === "Pro";
              const isCurrent = isCurrentPlan(plan.id);

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                    isPro ? "border-primary shadow-lg md:scale-105" : "hover:scale-102"
                  }`}
                >
                  {isPro && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-sm font-medium rounded-bl-lg">
                      Mais Popular
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <div
                      className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${
                        planColors[plan.name] || "from-gray-500 to-gray-600"
                      } flex items-center justify-center text-white shadow-lg`}
                    >
                      {planIcons[plan.name] || <Zap className="h-6 w-6" />}
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      {plan.name === "Start" && "Para começar a organizar"}
                      {plan.name === "Pro" && "Para equipes em crescimento"}
                      {plan.name === "Ultra" && "Alta performance"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="text-center">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{formatPrice(plan.price_cents)}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>

                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span>
                          {plan.max_leads ? `${plan.max_leads} leads/mês` : "Leads ilimitados"}
                        </span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span>{plan.max_users} usuários inclusos</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span>Funil de vendas visual</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span>Suporte por WhatsApp</span>
                      </li>
                    </ul>

                    <p className="text-sm text-muted-foreground mt-4">
                      +{formatPrice(plan.extra_user_price_cents)}/usuário extra
                    </p>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${isPro ? "bg-primary hover:bg-primary/90" : ""}`}
                      variant={isPro ? "default" : "outline"}
                      size="lg"
                      onClick={() => handleSelectPlan(plan.id, plan.name)}
                      disabled={isCurrent || createCheckout.isPending}
                    >
                      {createCheckout.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isCurrent ? "Plano Atual" : "Quero Esse!"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold">Dúvidas Frequentes</h2>
            </div>
            <div className="grid gap-4">
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Posso trocar de plano depois?</h3>
                <p className="text-muted-foreground">
                  Sim! Você pode fazer upgrade ou downgrade a qualquer momento. A diferença será calculada proporcionalmente.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Como funciona o limite de leads?</h3>
                <p className="text-muted-foreground">
                  O limite é por mês. Ao final de cada período, o contador é zerado. Leads existentes permanecem no sistema.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Posso cancelar quando quiser?</h3>
                <p className="text-muted-foreground">
                  Sim, sem multas ou taxas. Você continua com acesso até o fim do período pago.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Meus dados ficam seguros?</h3>
                <p className="text-muted-foreground">
                  Absolutamente. Usamos criptografia de ponta e servidores seguros. Seus dados são apenas seus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para organizar suas vendas?
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Junte-se a centenas de profissionais que já transformaram seu processo de vendas com o Morphews CRM.
          </p>
          <a href="#precos">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Começar Agora <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Morphews CRM. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Lead Capture Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quase lá! 🎉</DialogTitle>
            <DialogDescription>
              Preencha seus dados para continuar com o plano <strong>{selectedPlan?.name}</strong>
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
                placeholder="(11) 99999-9999"
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
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowLeadModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleLeadSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
