import { useState } from "react";
import { Check, Zap, Crown, Rocket, Loader2, Star, Phone, ArrowRight, MessageCircle, Sparkles, Shield, Clock, Mic, Image, Send, Bot, ChevronRight, Play, Users, Target, Calendar, Filter, BarChart3, TrendingUp } from "lucide-react";
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
  "Grátis": <Star className="h-6 w-6" />,
  Start: <Zap className="h-6 w-6" />,
  Pro: <Crown className="h-6 w-6" />,
  Ultra: <Rocket className="h-6 w-6" />,
};

const planColors: Record<string, string> = {
  "Grátis": "from-green-500 to-emerald-500",
  Start: "from-blue-500 to-cyan-500",
  Pro: "from-purple-500 to-pink-500",
  Ultra: "from-amber-500 to-orange-500",
};

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("subscription") === "success") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (user && plans && !autoCheckoutTriggered && !plansLoading) {
      const urlParams = new URLSearchParams(window.location.search);
      const planId = urlParams.get("plan");
      
      if (planId) {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
          setAutoCheckoutTriggered(true);
          window.history.replaceState({}, '', '/planos');
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
        plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.name,
        status: "checkout_started",
      });

      setShowLeadModal(false);

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Morphews" className="h-8 w-8 rounded" />
            <span className="font-bold text-xl">Morphews</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#como-funciona" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Como Funciona
            </a>
            <a href="#precos" className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Preços
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

      {/* Hero Section - WhatsApp AI Assistant Focus */}
      <section className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-emerald-500/10" />
        <div className="absolute top-10 left-10 w-96 h-96 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text */}
            <div className="text-center lg:text-left">
              <Badge className="mb-6 px-4 py-2 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
                <Bot className="h-3 w-3 mr-2" />
                Sua Secretária Comercial com IA
              </Badge>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Gerencie seus leads pelo{" "}
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                  WhatsApp
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-xl">
                Converse com sua secretária por <strong>áudio</strong>, <strong>mensagem</strong> ou até <strong>print screen</strong>. 
                Ela atualiza seu CRM automaticamente enquanto você foca no que importa: <strong>vender</strong>.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <a href="#precos">
                  <Button size="lg" className="text-lg px-8 gap-2 bg-green-600 hover:bg-green-700">
                    Quero Minha Secretária <ArrowRight className="h-5 w-5" />
                  </Button>
                </a>
                <a href="#como-funciona">
                  <Button size="lg" variant="outline" className="text-lg px-8 gap-2">
                    <Play className="h-5 w-5" /> Ver Como Funciona
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-green-500" />
                  Fale por áudio
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  Envie mensagens
                </div>
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4 text-green-500" />
                  Mande prints
                </div>
              </div>
            </div>

            {/* Right - WhatsApp Mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />
              
              {/* Phone Frame */}
              <div className="relative mx-auto max-w-[320px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                <div className="bg-[#111b21] rounded-[2.5rem] overflow-hidden">
                  {/* WhatsApp Header */}
                  <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">Secretária Morphews</div>
                      <div className="text-green-400 text-xs">online</div>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="h-[400px] bg-[#0b141a] p-3 space-y-3 overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+CjxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgZmlsbD0iIzBiMTQxYSIvPgo8Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiIGZpbGw9IiMxYzI2MmQiIG9wYWNpdHk9IjAuMyIvPgo8L3N2Zz4=')]">
                    {/* User message */}
                    <div className="flex justify-end">
                      <div className="bg-[#005c4b] text-white px-3 py-2 rounded-lg rounded-tr-none max-w-[80%] text-sm">
                        Acabei de falar com a Dra. Ana, cirurgiã plástica, @draana no insta, 50k seguidores. Muito interessada, marcamos call pra amanhã!
                      </div>
                    </div>

                    {/* Bot response */}
                    <div className="flex justify-start">
                      <div className="bg-[#202c33] text-white px-3 py-2 rounded-lg rounded-tl-none max-w-[85%] text-sm space-y-2">
                        <p>✅ <strong>Lead cadastrado!</strong></p>
                        <p className="text-gray-300">
                          📋 Dra. Ana<br />
                          📍 Reunião Agendada<br />
                          ⭐ 4 estrelas (50k seguidores)<br />
                          📸 @draana
                        </p>
                        <p className="text-green-400 text-xs">🔗 Clique para ver no CRM</p>
                      </div>
                    </div>

                    {/* Another user message */}
                    <div className="flex justify-end">
                      <div className="bg-[#005c4b] text-white px-3 py-2 rounded-lg rounded-tr-none max-w-[80%] text-sm">
                        Coloca ela como 5 estrelas
                      </div>
                    </div>

                    {/* Bot confirmation */}
                    <div className="flex justify-start">
                      <div className="bg-[#202c33] text-white px-3 py-2 rounded-lg rounded-tl-none max-w-[80%] text-sm">
                        ✅ Atualizado! Dra. Ana agora tem ⭐⭐⭐⭐⭐
                      </div>
                    </div>
                  </div>

                  {/* Input area */}
                  <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2 text-gray-400 text-sm">
                      Digite uma mensagem...
                    </div>
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                      <Mic className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -left-4 top-20 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 animate-bounce" style={{ animationDuration: "3s" }}>
                <div className="flex items-center gap-2 text-sm">
                  <Mic className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Áudio de 15s</span>
                </div>
              </div>

              <div className="absolute -right-4 bottom-32 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 animate-bounce" style={{ animationDuration: "4s", animationDelay: "1s" }}>
                <div className="flex items-center gap-2 text-sm">
                  <Image className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Print do Instagram</span>
                </div>
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
              <div className="text-3xl md:text-4xl font-bold text-green-600">10x</div>
              <div className="text-muted-foreground">Mais rápido</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-600">0</div>
              <div className="text-muted-foreground">Leads esquecidos</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-600">24/7</div>
              <div className="text-muted-foreground">Sempre disponível</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-green-600">100%</div>
              <div className="text-muted-foreground">Organizado</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="como-funciona" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Como Funciona</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simples assim: fale, ela faz
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Sua secretária entende linguagem natural. Fale do jeito que você quiser, ela interpreta e atualiza seu CRM.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Voice */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-green-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <Mic className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Envie Áudio</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">
                  "Acabei de sair de uma reunião com o Dr. Pedro, ele quer fechar o pacote premium"
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-green-600 font-medium">→ Lead atualizado automaticamente</p>
                </div>
              </CardContent>
            </Card>

            {/* Text */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <MessageCircle className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Envie Mensagem</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">
                  "Busca a Dra. Maria" ou "Lista todos os leads 5 estrelas"
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-blue-600 font-medium">→ Informações na hora</p>
                </div>
              </CardContent>
            </Card>

            {/* Screenshot */}
            <Card className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-500/50">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Image className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">Envie Print</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">
                  Mande um print do perfil do Instagram e ela extrai todos os dados
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-purple-600 font-medium">→ Lead criado com dados completos</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Dashboard + CRM Features */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Dashboard Completo</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tudo sincronizado no seu painel
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Cada interação no WhatsApp aparece instantaneamente no seu CRM. Interface web completa para quando você precisar de mais controle.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Funnel Visualization */}
            <div className="bg-card rounded-2xl border shadow-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-center">Funil de Vendas Visual</h3>
              
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  Não classificado (3)
                </div>
              </div>

              <div className="flex flex-col items-center gap-1">
                {[
                  { label: "Prospectando", count: 45, color: "bg-orange-300", width: "100%" },
                  { label: "Contatado", count: 38, color: "bg-orange-500", width: "90%" },
                  { label: "Convencendo", count: 28, color: "bg-yellow-400", width: "80%" },
                  { label: "Reunião Agendada", count: 18, color: "bg-blue-400", width: "70%" },
                  { label: "Positivo", count: 12, color: "bg-green-400", width: "60%" },
                  { label: "Aguardando Pgto", count: 8, color: "bg-green-500", width: "50%" },
                  { label: "SUCESSO! 🎉", count: 5, color: "bg-amber-400", width: "40%" },
                ].map((stage, index) => (
                  <div
                    key={stage.label}
                    style={{ width: stage.width }}
                    className={`${stage.color} py-2 px-3 transition-all duration-300 hover:scale-[1.02] ${
                      index === 0 ? "rounded-t-xl" : ""
                    } ${index === 6 ? "rounded-b-xl" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-800 truncate pr-2">
                        {stage.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/40 text-gray-800 shrink-0">
                        {stage.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-100 text-red-700 text-sm font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Sem interesse (2)
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-card rounded-xl border">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Classificação por Estrelas</h3>
                  <p className="text-muted-foreground text-sm">
                    Priorize leads de 1 a 5 estrelas. Leads 5⭐ são influenciadores, 1⭐ são iniciantes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-card rounded-xl border">
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Filter className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Filtros Inteligentes</h3>
                  <p className="text-muted-foreground text-sm">
                    Filtre por responsável, estrelas, etapa do funil, data de reunião e muito mais.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-card rounded-xl border">
                <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Equipe Colaborativa</h3>
                  <p className="text-muted-foreground text-sm">
                    Atribua leads para membros do time. Cada um vê seu próprio funil e métricas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-card rounded-xl border">
                <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <Calendar className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Próximas Reuniões</h3>
                  <p className="text-muted-foreground text-sm">
                    Veja todas as calls agendadas. Link da reunião e link da gravação organizados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Benefícios</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que você <span className="text-green-600">precisa</span> disso
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-background border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  Economize Tempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Cadastre leads em segundos pelo WhatsApp. Sem abrir sistemas, sem planilhas, sem perder tempo.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-background border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Zero Leads Perdidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Acabou de conversar com um prospect? Registre na hora. Nunca mais esqueça um lead importante.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-background border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Visão Completa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Funil visual, métricas de time, próximas reuniões. Tudo em um dashboard intuitivo.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-background border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  Aumente Conversões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Com leads organizados e priorizados, você foca nos que realmente vão fechar.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/20 dark:to-background border-pink-200 dark:border-pink-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-pink-600" />
                  IA de Verdade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Não é chatbot de menu. É IA que entende contexto, extrai dados e aprende com você.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-900/20 dark:to-background border-cyan-200 dark:border-cyan-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyan-600" />
                  Dados Seguros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Seus leads são seus. Criptografia de ponta, backups automáticos, privacidade total.
                </p>
              </CardContent>
            </Card>
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
              Teste sua secretária por 7 dias. Se não mudar sua vida, devolvemos seu dinheiro.
            </p>
            <p className="text-muted-foreground">
              Sem perguntas, sem burocracia. Simples assim.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 bg-gradient-to-b from-background via-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-500/10 text-green-600 border-green-500/20">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha seu plano e comece <span className="text-green-600">agora</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Sua secretária comercial está esperando. Todos os planos incluem acesso ao WhatsApp + Dashboard completo.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans?.map((plan) => {
              const isPro = plan.name === "Pro";
              const isFree = plan.name === "Grátis";
              const isCurrent = isCurrentPlan(plan.id);

              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                    isPro ? "border-green-500 shadow-lg lg:scale-105" : ""
                  } ${isFree ? "border-emerald-500/50 bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-900/10" : ""}`}
                >
                  {isPro && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-sm font-medium rounded-bl-lg">
                      Mais Popular
                    </div>
                  )}
                  {isFree && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white px-3 py-1 text-sm font-medium rounded-bl-lg">
                      Teste Grátis
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
                      {plan.name === "Grátis" && "Para testar o sistema"}
                      {plan.name === "Start" && "Para começar a organizar"}
                      {plan.name === "Pro" && "Para equipes em crescimento"}
                      {plan.name === "Ultra" && "Máxima performance"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="text-center">
                    <div className="mb-6">
                      {isFree ? (
                        <span className="text-4xl font-bold text-emerald-600">Grátis</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold">{formatPrice(plan.price_cents)}</span>
                          <span className="text-muted-foreground">/mês</span>
                        </>
                      )}
                    </div>

                    <ul className="space-y-3 text-left">
                      <li className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span className="font-medium text-green-600">Secretária via WhatsApp</span>
                      </li>
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
                        <span>{plan.max_users} usuário{plan.max_users > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <span>Dashboard completo</span>
                      </li>
                      {!isFree && (
                        <li className="flex items-center gap-3">
                          <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <Check className="h-3 w-3 text-green-600" />
                          </div>
                          <span>Suporte prioritário</span>
                        </li>
                      )}
                    </ul>

                    {!isFree && (
                      <p className="text-sm text-muted-foreground mt-4">
                        +{formatPrice(plan.extra_user_price_cents)}/usuário extra
                      </p>
                    )}
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${isPro ? "bg-green-600 hover:bg-green-700" : ""} ${isFree ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                      variant={isPro || isFree ? "default" : "outline"}
                      size="lg"
                      onClick={() => handleSelectPlan(plan.id, plan.name)}
                      disabled={isCurrent || createCheckout.isPending}
                    >
                      {createCheckout.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {isCurrent ? "Plano Atual" : isFree ? "Começar Grátis" : "Quero Esse!"}
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
                <h3 className="font-semibold mb-2">Como funciona a secretária no WhatsApp?</h3>
                <p className="text-muted-foreground">
                  Você adiciona o número dela no seu WhatsApp e pode enviar áudios, textos ou prints. Ela interpreta e atualiza seu CRM automaticamente.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Preciso instalar alguma coisa?</h3>
                <p className="text-muted-foreground">
                  Não! A secretária funciona direto no WhatsApp que você já usa. O dashboard é web, acesse de qualquer lugar.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Posso trocar de plano depois?</h3>
                <p className="text-muted-foreground">
                  Sim! Upgrade ou downgrade a qualquer momento. A diferença é calculada proporcionalmente.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="font-semibold mb-2">Meus dados ficam seguros?</h3>
                <p className="text-muted-foreground">
                  Absolutamente. Criptografia de ponta, servidores seguros. Seus dados são somente seus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Sua secretária está esperando
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Enquanto você lê isso, seus concorrentes estão perdendo leads. Não seja um deles.
          </p>
          <a href="#precos">
            <Button size="lg" variant="secondary" className="text-lg px-8 bg-white text-green-600 hover:bg-gray-100">
              Quero Minha Secretária <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Morphews. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Lead Capture Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quase lá! 🎉</DialogTitle>
            <DialogDescription>
              Preencha seus dados para ativar sua secretária com o plano <strong>{selectedPlan?.name}</strong>
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
            <Button onClick={handleLeadSubmit} disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-700">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Ativar Secretária
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
