import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { 
  Check, Zap, Crown, Rocket, Loader2, Star, Phone, ArrowRight, MessageCircle, 
  Sparkles, Shield, Clock, Bot, ChevronRight, Users, 
  Target, BarChart3, CheckCircle2, 
  Brain, Webhook, Cpu, 
  Menu, X,
  Volume2, Eye, AudioLines, Network, Route,
  Wrench, ClipboardCheck, Calendar, Heart,
  Building2, ShoppingCart, Send, Image,
  AlertTriangle, TrendingDown, UserX, XCircle, DollarSign,
  Headphones, RefreshCw, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import atomicLogo from "@/assets/logo-atomic-sales.png";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSubscriptionPlans, useCreateCheckout } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 bg-clip-text text-transparent", className)}>
    {children}
  </span>
);

const BigIdea = ({ className = "" }: { className?: string }) => (
  <p className={cn("text-lg md:text-xl font-semibold text-muted-foreground italic", className)}>
    Você não precisa de mais tráfego. <span className="text-foreground">Precisa de uma estrutura de vendas automática.</span>
  </p>
);

export default function SalesLanding() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const createCheckout = useCreateCheckout();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ 
    id: string; name: string; 
    payment_provider?: "stripe" | "atomicpay" | null;
    atomicpay_monthly_url?: string | null;
    atomicpay_annual_url?: string | null;
  } | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", whatsapp: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  const handleSelectPlan = (planId: string, planName: string, plan?: any) => {
    if (user) {
      if (plan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual ? plan.atomicpay_annual_url : plan.atomicpay_monthly_url;
        if (checkoutUrl) { window.location.href = checkoutUrl; return; }
      }
      createCheckout.mutate({ planId, mode: 'new' });
    } else {
      setSelectedPlan({ id: planId, name: planName, ...plan });
      setShowLeadModal(true);
    }
  };

  const handleLeadSubmit = async () => {
    if (!leadForm.name.trim() || !leadForm.whatsapp.trim() || !leadForm.email.trim()) {
      toast({ title: "Preencha todos os campos", description: "Nome, WhatsApp e E-mail são necessários.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await supabase.from("interested_leads").insert({
        name: leadForm.name.trim(), whatsapp: leadForm.whatsapp.trim(), email: leadForm.email.trim(),
        plan_id: selectedPlan?.id, plan_name: selectedPlan?.name, status: "checkout_started",
      });
      setShowLeadModal(false);
      if (selectedPlan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual ? selectedPlan.atomicpay_annual_url : selectedPlan.atomicpay_monthly_url;
        if (checkoutUrl) {
          const url = new URL(checkoutUrl);
          url.searchParams.set("customer_name", leadForm.name.trim());
          url.searchParams.set("customer_email", leadForm.email.trim());
          url.searchParams.set("customer_phone", leadForm.whatsapp.trim());
          window.location.href = url.toString(); return;
        }
      }
      const { data, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId: selectedPlan?.id, customerEmail: leadForm.email.trim(), customerName: leadForm.name.trim(),
          customerWhatsapp: leadForm.whatsapp.trim(),
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/`,
          billingCycle: isAnnual ? 'annual' : 'monthly',
        },
      });
      if (checkoutError) throw checkoutError;
      if (data?.error) throw new Error(data.error);
      if (data?.success) {
        toast({ title: "Conta criada com sucesso! 🎉", description: "Verifique seu e-mail para obter as credenciais de acesso." });
        navigate(`/signup-success?email=${encodeURIComponent(leadForm.email.trim())}`); return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({ title: "Erro ao processar", description: error.message || "Tente novamente.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const formatPrice = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const getAnnualPrice = (monthlyCents: number) => Math.round(monthlyCents * 0.60);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const whatsappConsultorLink = `https://wa.me/555130760116?text=${encodeURIComponent("Vim do site https://atomic.ia.br e quero saber mais sobre automação WhatsApp")}`;

  const getPlanFeatures = (planName: string) => {
    const name = planName.toLowerCase();
    if (name === "grátis" || name === "starter" || name === "start") {
      return ["1 usuário", "100 leads", "1 instância WhatsApp", "Multi atendimento WhatsApp", "Chat centralizado"];
    }
    if (name === "growth") {
      return ["3 usuários", "1.000 leads", "1 instância WhatsApp", "2 Robôs de IA no WhatsApp", "Follow-up automático programado", "Cadências de mensagens", "Integração via Webhook"];
    }
    if (name === "pro") {
      return ["10 usuários", "10.000 leads", "3 instâncias WhatsApp", "Robôs WhatsApp ilimitados", "Times de robôs (Maestro + Especialistas)", "Follow-up automático programado", "Cadências de mensagens pré-programadas", "Robôs com áudio e visão", "Integração via Webhook", "CRM com funil integrado"];
    }
    return [`${planName}`, "Multi atendimento WhatsApp", "Robôs IA"];
  };

  if (plansLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-green-500/5">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center md:absolute md:left-1/2 md:-translate-x-1/2">
              <img src={atomicLogo} alt="Atomic Sales" className="h-8 md:h-9" />
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection("problema")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">O Problema</button>
              <button onClick={() => scrollToSection("solucao")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Solução</button>
              <button onClick={() => scrollToSection("time-ia")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Time de IA</button>
              <button onClick={() => scrollToSection("precos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Preços</button>
            </nav>
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Button asChild><Link to="/">Acessar Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
                  <Button onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                    Começar Agora
                  </Button>
                </>
              )}
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden bg-background border-b p-4">
            <nav className="flex flex-col gap-4">
              <button onClick={() => scrollToSection("problema")} className="text-left py-2">O Problema</button>
              <button onClick={() => scrollToSection("solucao")} className="text-left py-2">Solução</button>
              <button onClick={() => scrollToSection("time-ia")} className="text-left py-2">Time de IA</button>
              <button onClick={() => scrollToSection("precos")} className="text-left py-2">Preços</button>
              {!user && (
                <>
                  <Link to="/login" className="py-2">Entrar</Link>
                  <Button onClick={() => scrollToSection("precos")} className="w-full">Começar Agora</Button>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </header>

      {/* ===== 1. HERO ===== */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm border-green-500/50">
                <Bot className="h-4 w-4 mr-2 text-green-500" />
                Estrutura de vendas automática com IA
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]"
            >
              Você não precisa de<br />mais tráfego.
              <br />
              <GradientText>Precisa de uma estrutura de vendas automática.</GradientText>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-4"
            >
              Crie robôs de IA que atendem clientes, fazem follow-up e conduzem vendas no WhatsApp 24h por dia.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
              className="text-base text-muted-foreground max-w-2xl mx-auto mb-10"
            >
              Sem depender de equipe. Sem deixar leads morrerem.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button size="lg" onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-10 py-7 text-lg">
                Criar meu robô de vendas <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection("solucao")} className="px-8 py-7 text-lg border-green-500/50 text-green-600 hover:bg-green-50">
                Ver como funciona <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ===== 2. O PROBLEMA ===== */}
      <section id="problema" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                A maioria das pessoas tenta resolver vendas<br />
                <GradientText>com tráfego</GradientText>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Mas o problema raramente é tráfego.<br />
                <span className="text-foreground font-semibold">O problema é o que acontece depois que o lead chega.</span>
              </p>
            </motion.div>

            {/* Visual flow */}
            <div className="max-w-lg mx-auto space-y-4">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} 
                className="flex items-center gap-4 p-5 bg-green-500/10 border border-green-500/30 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg">Lead chega</p>
                  <p className="text-sm text-muted-foreground">Você responde</p>
                </div>
              </motion.div>

              <div className="text-center text-muted-foreground text-sm font-medium py-1">Depois disso...</div>

              {[
                { icon: MessageCircle, text: "A conversa se perde", color: "text-orange-500" },
                { icon: TrendingDown, text: "O cliente esfria", color: "text-red-400" },
                { icon: UserX, text: "Ninguém faz follow-up", color: "text-red-500" },
                { icon: XCircle, text: "A venda morre", color: "text-red-600" },
              ].map(({ icon: Icon, text, color }, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl">
                  <Icon className={cn("h-6 w-6 shrink-0", color)} />
                  <p className="font-medium">{text}</p>
                </motion.div>
              ))}

              <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-center pt-6">
                <p className="text-xl font-bold text-destructive">
                  Você paga pelo lead…<br />e deixa ele desaparecer.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3. A VIRADA ===== */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                Vendas não são sobre tráfego.<br />
                <GradientText>São sobre estrutura.</GradientText>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
                Empresas que vendem todos os dias têm algo em comum: <span className="text-foreground font-semibold">uma estrutura comercial funcionando o tempo inteiro.</span>
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {[
                { icon: Zap, text: "Respondendo rápido" },
                { icon: MessageCircle, text: "Acompanhando conversas" },
                { icon: RefreshCw, text: "Retomando clientes" },
              ].map(({ icon: Icon, text }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-green-500/5 border border-green-500/20">
                  <Icon className="h-8 w-8 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold">{text}</p>
                </motion.div>
              ))}
            </div>

            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              className="mt-8 text-lg text-muted-foreground italic">
              Mesmo quando ninguém está online.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ===== 4. A SOLUÇÃO ===== */}
      <section id="solucao" className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                <Sparkles className="h-3 w-3 mr-2" /> A Solução
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
                AtomicSales cria sua<br /><GradientText>estrutura de vendas automática</GradientText>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Robôs de IA que trabalham no seu WhatsApp:
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Headphones, title: "Atendem clientes", desc: "Resposta instantânea para cada mensagem que chega.", color: "from-green-500 to-emerald-600" },
                { icon: ClipboardCheck, title: "Qualificam leads", desc: "Identificam quem está pronto para comprar.", color: "from-blue-500 to-cyan-600" },
                { icon: ShoppingCart, title: "Apresentam ofertas", desc: "Conduzem a conversa até o fechamento da venda.", color: "from-purple-500 to-pink-600" },
                { icon: Calendar, title: "Fazem follow-up", desc: "Retomam conversas automaticamente nos dias certos.", color: "from-orange-500 to-red-600" },
                { icon: RefreshCw, title: "Retomam conversas perdidas", desc: "Clientes que sumiram voltam a responder.", color: "from-teal-500 to-cyan-600" },
                { icon: Clock, title: "24 horas por dia", desc: "Funcionando mesmo quando ninguém está online.", color: "from-indigo-500 to-blue-600" },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <Card className="h-full group hover:border-green-500/50 transition-all hover:shadow-xl">
                    <CardHeader>
                      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2", color)}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">{title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">{desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <BigIdea />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5. TIME DE IA ===== */}
      <section id="time-ia" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
              <Badge variant="outline" className="mb-4 border-blue-500/50 text-blue-600 bg-blue-50">
                <Network className="h-3 w-3 mr-2" /> Seu novo time
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
                Seu novo time de vendas
              </h2>
              <p className="text-xl text-muted-foreground">
                Sem contratar ninguém.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { role: "Recepção", desc: "Identifica o que o cliente quer", icon: Users, color: "bg-green-500" },
                { role: "Qualificador", desc: "Entende se o lead está pronto para comprar", icon: Target, color: "bg-blue-500" },
                { role: "Vendedor", desc: "Conduz a conversa para a venda", icon: ShoppingCart, color: "bg-purple-500" },
                { role: "Follow-up", desc: "Retoma conversas automaticamente", icon: Calendar, color: "bg-orange-500" },
                { role: "Suporte", desc: "Resolve dúvidas e problemas", icon: Wrench, color: "bg-cyan-500" },
              ].map(({ role, desc, icon: Icon, color }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                  <Card className="h-full hover:border-green-500/50 transition-all hover:shadow-lg">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", color)}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold">{role}</h3>
                      </div>
                      <p className="text-muted-foreground text-sm">{desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 6. INTELIGÊNCIA ===== */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Badge variant="outline" className="mb-4">
                <Brain className="h-3 w-3 mr-2" /> Inteligência Real
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
                Eles <GradientText>não parecem robôs</GradientText>
              </h2>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10">
              {[
                { icon: AudioLines, text: "Escutam áudios" },
                { icon: Image, text: "Analisam imagens" },
                { icon: Volume2, text: "Respondem por voz" },
                { icon: Send, text: "Entendem documentos" },
                { icon: Brain, text: "Linguagem natural" },
                { icon: MessageCircle, text: "Conversas reais" },
              ].map(({ icon: Icon, text }, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-card border hover:border-green-500/50 transition-all hover:shadow-lg">
                  <Icon className="h-8 w-8 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-sm">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 7. ESCALA ===== */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
                Enquanto um humano atende uma conversa…<br />
                <GradientText>A IA pode atender dezenas.</GradientText>
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto">
              {[
                { icon: Phone, text: "Múltiplos números WhatsApp" },
                { icon: Layers, text: "Atendimento simultâneo" },
                { icon: BarChart3, text: "Conversas organizadas" },
                { icon: Users, text: "Transferência para humano" },
                { icon: Sparkles, text: "Automações inteligentes" },
              ].map(({ icon: Icon, text }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3 p-4 bg-card border rounded-xl hover:border-green-500/50 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-green-600" />
                  </div>
                  <span className="font-medium text-sm text-left">{text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 8. RECUPERAÇÃO DE VENDAS ===== */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Badge variant="outline" className="mb-4 border-orange-500/50 text-orange-600 bg-orange-50">
                <DollarSign className="h-3 w-3 mr-2" /> Recuperação de vendas
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
                Quanto custa um <GradientText className="from-orange-500 via-red-500 to-pink-500">lead esquecido?</GradientText>
              </h2>
              <p className="text-xl text-muted-foreground mb-4">
                A maioria das vendas acontece <span className="text-foreground font-semibold">depois do primeiro contato.</span>
              </p>
              <p className="text-xl text-muted-foreground mb-8">
                Mas quase ninguém faz follow-up direito.
              </p>
              <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/30 inline-block">
                <p className="text-lg font-bold text-green-600">
                  Com IA, isso acontece automaticamente. ✨
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== 9. POSICIONAMENTO ===== */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                Pare de tentar vender só com tráfego.<br />
                <GradientText>Construa uma estrutura de vendas automática.</GradientText>
              </h2>
              <BigIdea className="mt-8" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== 10. DEPOIMENTOS ===== */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Resultados reais</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold">
              O que nossos clientes <GradientText>conquistaram</GradientText>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: "Mariana Costa", role: "Clínica de Estética", quote: "Recuperamos vendas que estavam completamente perdidas. O robô retoma conversas que a equipe nunca faria follow-up.", avatar: "MC" },
              { name: "Amanda Pimentel", role: "InfoProdutora", quote: "Leads que antes demoravam horas pra receber resposta agora são atendidos em segundos. As vendas dobraram.", avatar: "AP" },
              { name: "Carlos Eduardo", role: "E-commerce", quote: "Escalamos o atendimento sem contratar mais ninguém. A IA atende dezenas de conversas ao mesmo tempo.", avatar: "CE" },
            ].map((t, i) => (
              <Card key={i} className="border-0 bg-gradient-to-br from-card to-muted/50">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => <Star key={j} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
                  </div>
                  <p className="text-lg mb-6 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">{t.avatar}</div>
                    <div><p className="font-semibold">{t.name}</p><p className="text-sm text-muted-foreground">{t.role}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 11. CTA FINAL ===== */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
                Crie sua <GradientText>estrutura de vendas automática</GradientText>
              </h2>
              <p className="text-lg text-muted-foreground mb-10">
                Configure seu robô e conecte seu WhatsApp.
              </p>
              <Button size="lg" onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-12 py-7 text-lg">
                Começar agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="precos" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-extrabold mb-4">
              Sua estrutura de vendas <GradientText>automática</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Quanto custa um lead esquecido? Uma venda perdida por falta de follow-up?
              O Atomic Sales custa menos que um café por dia.
            </p>

            <div className="inline-flex items-center gap-4 bg-card border rounded-full px-6 py-3">
              <span className={cn("text-sm font-medium", !isAnnual && "text-green-600")}>Mensal</span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span className={cn("text-sm font-medium flex items-center gap-2", isAnnual && "text-green-600")}>
                Anual <Badge className="bg-green-500 text-white text-xs">40% OFF</Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans?.map((plan, index) => {
              const isPro = plan.name.toLowerCase() === "pro";
              const gradients = ["from-gray-500 to-gray-600", "from-blue-500 to-cyan-500", "from-green-500 to-emerald-500", "from-amber-500 to-orange-500"];
              const displayPrice = isAnnual && plan.price_cents > 0 ? getAnnualPrice(plan.price_cents) : plan.price_cents;
              const features = getPlanFeatures(plan.name);
              
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                  <Card className={cn("relative h-full flex flex-col", isPro && "border-green-500 shadow-xl shadow-green-500/10")}>
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                          <Crown className="h-3 w-3 mr-1" /> MAIS POPULAR
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <div className={cn("w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4", gradients[index % gradients.length])}>
                        {index === 0 && <Star className="h-7 w-7 text-white" />}
                        {index === 1 && <Zap className="h-7 w-7 text-white" />}
                        {index === 2 && <Crown className="h-7 w-7 text-white" />}
                        {index === 3 && <Rocket className="h-7 w-7 text-white" />}
                      </div>
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="mt-4">
                        {isAnnual && plan.price_cents > 0 && (
                          <div className="text-sm text-muted-foreground line-through mb-1">{formatPrice(plan.price_cents)}/mês</div>
                        )}
                        <span className="text-4xl font-bold">{formatPrice(displayPrice)}</span>
                        <span className="text-muted-foreground">/mês</span>
                        {isAnnual && plan.price_cents > 0 && (
                          <p className="text-xs text-green-600 mt-1">Economia de {formatPrice((plan.price_cents - displayPrice) * 12)}/ano</p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-3">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className={cn("w-full", isPro ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" : "")}
                        variant={isPro ? "default" : "outline"}
                        onClick={() => handleSelectPlan(plan.id, plan.name, plan)}
                        disabled={createCheckout.isPending}
                      >
                        {createCheckout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : plan.price_cents === 0 ? "Começar Grátis" : "Escolher Plano"}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Enterprise */}
          <div className="max-w-2xl mx-auto mt-12">
            <Card className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-2 border-dashed border-green-500/30">
              <CardContent className="py-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
                <h3 className="text-xl font-bold mb-2">Precisa de mais?</h3>
                <p className="text-muted-foreground mb-4">Planos Enterprise com instâncias e usuários ilimitados.</p>
                <Button variant="outline" asChild className="border-green-500 text-green-600 hover:bg-green-50">
                  <a href={whatsappConsultorLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> Falar com Consultor
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Link to="/completo" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              Ver todas as funcionalidades da plataforma →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <img src="/favicon.jpg" alt="Atomic Sales" className="h-5 w-5 rounded" />
              </div>
              <span className="font-bold">Atomic Sales</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Atomic Sales. Todos os direitos reservados.
            </p>
            <div className="flex gap-4">
              <a href={whatsappConsultorLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Lead Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Quase lá! 🎉</DialogTitle>
            <DialogDescription className="text-center">
              Preencha seus dados para continuar com o plano <strong>{selectedPlan?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" placeholder="Seu nome" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" placeholder="(00) 00000-0000" value={leadForm.whatsapp} onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleLeadSubmit} disabled={isSubmitting} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
            {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>) : (<>Continuar para o Checkout<ArrowRight className="ml-2 h-4 w-4" /></>)}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
