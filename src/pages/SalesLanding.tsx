import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { 
  Check, Zap, Crown, Rocket, Loader2, Star, Phone, ArrowRight, MessageCircle, 
  Sparkles, Shield, Clock, Mic, Bot, ChevronRight, Users, 
  Target, BarChart3, CheckCircle2, 
  Brain, Settings, Webhook, Globe, Cpu, Lock,
  ChevronDown, Menu, X, Gauge,
  Volume2, Eye, AudioLines, Network, Route,
  Wrench, ClipboardCheck, Calendar, Heart, Package,
  Building2, GraduationCap, ShoppingCart, Send, Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Animated counter component
const AnimatedCounter = ({ end, duration = 2, suffix = "" }: { end: number; duration?: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count.toLocaleString("pt-BR")}{suffix}</span>;
};

const FloatingElement = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <motion.div
    initial={{ y: 0 }}
    animate={{ y: [-10, 10, -10] }}
    transition={{ duration: 4, repeat: Infinity, delay, ease: "easeInOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 bg-clip-text text-transparent", className)}>
    {children}
  </span>
);

export default function SalesLanding() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const createCheckout = useCreateCheckout();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ 
    id: string; 
    name: string; 
    payment_provider?: "stripe" | "atomicpay" | null;
    atomicpay_monthly_url?: string | null;
    atomicpay_annual_url?: string | null;
  } | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", whatsapp: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
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
      return [
        "1 usuário",
        "100 leads",
        "1 instância WhatsApp",
        "Multi atendimento WhatsApp",
        "Chat centralizado",
      ];
    }
    if (name === "growth") {
      return [
        "3 usuários",
        "1.000 leads",
        "1 instância WhatsApp",
        "2 Robôs de IA no WhatsApp",
        "Follow-up automático programado",
        "Cadências de mensagens",
        "Integração via Webhook",
      ];
    }
    if (name === "pro") {
      return [
        "10 usuários",
        "10.000 leads",
        "3 instâncias WhatsApp",
        "Robôs WhatsApp ilimitados",
        "Times de robôs (Maestro + Especialistas)",
        "Follow-up automático programado",
        "Cadências de mensagens pré-programadas",
        "Robôs com áudio e visão",
        "Integração via Webhook",
        "CRM com funil integrado",
      ];
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
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <img src="/favicon.jpg" alt="Atomic Sales" className="h-6 w-6 rounded" />
              </div>
              <span className="font-bold text-xl">Atomic Sales</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection("robos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Robôs IA</button>
              <button onClick={() => scrollToSection("whatsapp")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">WhatsApp</button>
              <button onClick={() => scrollToSection("automacao")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Automação</button>
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
              <button onClick={() => scrollToSection("robos")} className="text-left py-2">Robôs IA</button>
              <button onClick={() => scrollToSection("whatsapp")} className="text-left py-2">WhatsApp</button>
              <button onClick={() => scrollToSection("automacao")} className="text-left py-2">Automação</button>
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

      {/* ===== HERO ===== */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm border-green-500/50">
                <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                Automação inteligente de WhatsApp
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
            >
              Atendimento WhatsApp
              <br />
              <GradientText>100% automatizado com IA</GradientText>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8"
            >
              Robôs de IA que atendem seus clientes no WhatsApp 24/7. Eles escutam áudios, leem imagens, 
              respondem por voz e parecem humanos. Integrado ao CRM com follow-up automático.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button size="lg" onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-8 py-6 text-lg">
                Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" asChild className="px-8 py-6 text-lg border-green-500/50 text-green-600 hover:bg-green-50">
                <a href={whatsappConsultorLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" /> Falar com Consultor
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ===== WHAT THE BOTS DO ===== */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                <Bot className="h-3 w-3 mr-2" /> O que os robôs fazem
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Muito mais do que um <GradientText>chatbot comum</GradientText>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Mic, title: "Escutam áudios", desc: "Transcrevem e entendem mensagens de voz dos clientes automaticamente.", color: "from-purple-500 to-pink-600" },
                { icon: Image, title: "Leem imagens", desc: "Analisam fotos, prints e documentos enviados pelo WhatsApp.", color: "from-blue-500 to-cyan-600" },
                { icon: Volume2, title: "Respondem por áudio", desc: "Gravam mensagens de voz humanizadas com probabilidade configurável.", color: "from-green-500 to-emerald-600" },
                { icon: Globe, title: "Sotaque regional", desc: "Usam linguagem nativa de diferentes estados do Brasil. Gírias e expressões reais.", color: "from-orange-500 to-red-600" },
                { icon: Brain, title: "Parecem humanos", desc: "Personalidade, idade e tom de voz configuráveis. Pouco parecem robôs.", color: "from-indigo-500 to-blue-600" },
                { icon: Send, title: "Leem documentos", desc: "Interpretam PDFs, contratos e documentos enviados pelo cliente.", color: "from-teal-500 to-cyan-600" },
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
          </div>
        </div>
      </section>

      {/* ===== ROBÔS IA - PERSONALIDADE ===== */}
      <section id="robos" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <Bot className="h-3 w-3 mr-2" /> Crie robôs com personalidade
              </Badge>
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Colaboradores virtuais <GradientText>que vendem por você</GradientText>
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Defina idade, personalidade, sotaque e tipo de atendimento. Cada robô é único e parecem pessoas reais.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Qual a idade do robô?</CardTitle>
                  <CardDescription>Define o tom e formalidade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { age: "18-25 anos", style: "Jovem, informal", icon: Zap },
                      { age: "26-35 anos", style: "Profissional, acessível", icon: Users },
                      { age: "36-50 anos", style: "Formal, objetivo", icon: Crown },
                      { age: "50+ anos", style: "Muito formal", icon: GraduationCap },
                    ].map(({ age, style, icon: Icon }, i) => (
                      <div key={i} className="bg-card/50 backdrop-blur border rounded-xl p-4 text-center hover:border-green-500/50 transition-all cursor-pointer group">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="font-medium">{age}</p>
                        <p className="text-xs text-muted-foreground">{style}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">O que ele vai fazer?</CardTitle>
                  <CardDescription>Tipo principal de atendimento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "💰 Vendas", sub: "Apresentar e fechar", icon: ShoppingCart },
                      { label: "🔧 Suporte", sub: "Resolver problemas", icon: Wrench },
                      { label: "📞 SAC", sub: "Atender solicitações", icon: Phone },
                      { label: "📋 Qualificação", sub: "Qualificar leads", icon: ClipboardCheck },
                    ].map(({ label, sub, icon: Icon }, i) => (
                      <div key={i} className="bg-card/50 backdrop-blur border rounded-xl p-4 text-center hover:border-green-500/50 transition-all cursor-pointer group">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Escolha de IA */}
            <Card className="max-w-3xl mx-auto">
              <CardHeader className="text-center">
                <Badge variant="outline" className="mx-auto mb-2 w-fit">
                  <Cpu className="h-3 w-3 mr-2" /> Escolha a IA
                </Badge>
                <CardTitle>Escolha o modelo de IA que combina com você</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { name: "GPT-5", provider: "OpenAI", color: "bg-emerald-500" },
                    { name: "Gemini 2.5", provider: "Google", color: "bg-blue-500" },
                    { name: "GPT-5 Mini", provider: "OpenAI", color: "bg-teal-500" },
                    { name: "Gemini Flash", provider: "Google", color: "bg-cyan-500" },
                  ].map((model, i) => (
                    <div key={i} className="text-center p-3 border rounded-xl hover:border-green-500/50 transition-all cursor-pointer">
                      <div className={cn("w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2", model.color)}>
                        <Cpu className="h-5 w-5 text-white" />
                      </div>
                      <p className="font-medium text-sm">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ===== TIMES DE ROBÔS ===== */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Badge variant="outline" className="mb-4 border-blue-500/50 text-blue-600 bg-blue-50">
                  <Network className="h-3 w-3 mr-2" /> Times de Robôs
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Vários robôs trabalhando <GradientText>em equipe</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Crie <strong>times de robôs</strong> onde cada um é especialista em algo.
                  Um "Maestro" recebe a conversa e roteia para o especialista certo.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: Route, text: "Robô Maestro como URA inteligente" },
                    { icon: Target, text: "Robôs especialistas por área" },
                    { icon: Settings, text: "Ativação por palavras-chave" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-blue-600" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Network className="h-5 w-5" /> Time: Atendimento Completo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-green-500/5 rounded-xl border border-green-500/20">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center"><Crown className="h-5 w-5 text-white" /></div>
                      <div><p className="font-medium">Maestro (Recepção)</p><p className="text-xs text-muted-foreground">Identifica intenção do cliente</p></div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center"><ShoppingCart className="h-5 w-5 text-white" /></div>
                      <div><p className="font-medium">Vendedor</p><p className="text-xs text-muted-foreground">Especialista em vendas</p></div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center"><Wrench className="h-5 w-5 text-white" /></div>
                      <div><p className="font-medium">Suporte</p><p className="text-xs text-muted-foreground">Resolve problemas técnicos</p></div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHATSAPP MULTI-INSTÂNCIA ===== */}
      <section id="whatsapp" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                  <Users className="h-3 w-3 mr-2" /> Multi atendimento WhatsApp
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  <GradientText>Múltiplas instâncias</GradientText> e equipes
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Conecte vários números de WhatsApp. Cada instância pode ter seu próprio robô, configurações e equipe. Tudo centralizado.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: Phone, text: "Múltiplos números conectados simultaneamente" },
                    { icon: Users, text: "Equipes diferentes por instância" },
                    { icon: Bot, text: "Robô específico para cada número" },
                    { icon: MessageCircle, text: "Transferência entre atendentes em tempo real" },
                    { icon: BarChart3, text: "Métricas de atendimento por instância" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-green-600" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" /> Central de WhatsApp
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {[
                      { name: "Vendas", number: "+55 11 9xxxx-1234", messages: 23 },
                      { name: "Suporte", number: "+55 11 9xxxx-5678", messages: 12 },
                      { name: "SAC", number: "+55 21 9xxxx-9012", messages: 8 },
                    ].map((instance, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{instance.name}</p>
                          <p className="text-xs text-muted-foreground">{instance.number}</p>
                        </div>
                        <Badge variant="outline" className="border-green-500 text-green-600">{instance.messages} novas</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== AUTOMAÇÃO: FOLLOW-UP + CADÊNCIAS + CRM ===== */}
      <section id="automacao" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Sparkles className="h-3 w-3 mr-2" /> Automação completa
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Follow-up, cadências e CRM <GradientText>integrados</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Programe cadências de mensagens, follow-ups automáticos e acompanhe tudo em um CRM visual com funil de vendas.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Clock, title: "Follow-up automático", desc: "Programa mensagens de acompanhamento que são enviadas automaticamente. Nunca mais esqueça um lead.", color: "from-orange-500 to-red-600" },
                { icon: Calendar, title: "Cadências programadas", desc: "Crie sequências de mensagens pré-programadas. Dia 1, dia 3, dia 7... tudo automático.", color: "from-purple-500 to-pink-600" },
                { icon: Target, title: "CRM com funil visual", desc: "Kanban de vendas integrado ao WhatsApp. Mova leads pelo funil e dispare automações.", color: "from-blue-500 to-cyan-600" },
              ].map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Card className="h-full hover:border-green-500/50 transition-all hover:shadow-xl">
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
          </div>
        </div>
      </section>

      {/* ===== INTEGRAÇÕES WEBHOOK ===== */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Webhook className="h-3 w-3 mr-2" /> Integrações
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Conecte com <GradientText>qualquer sistema</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12">
              Webhooks poderosos para integrar com seu ERP, plataforma de e-commerce, sistema financeiro ou qualquer outro software.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Users, label: "Criar Leads" },
                { icon: MessageCircle, label: "Enviar Mensagens" },
                { icon: ShoppingCart, label: "Sincronizar Vendas" },
                { icon: Webhook, label: "Eventos Custom" },
              ].map(({ icon: Icon, label }, i) => (
                <Card key={i} className="hover:border-green-500/50 transition-all">
                  <CardContent className="pt-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-muted flex items-center justify-center mb-3">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">
              O que nossos clientes <GradientText>dizem</GradientText>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { name: "Mariana Costa", role: "Clínica de Estética", quote: "Os robôs atendem minhas clientes 24h no WhatsApp. Agendam consultas, tiram dúvidas e parecem uma atendente real.", avatar: "MC" },
              { name: "Amanda Pimentel", role: "InfoProdutora", quote: "O follow-up automático recuperou clientes que estavam perdidos. Nunca mais esquecemos de fazer acompanhamento.", avatar: "AP" },
              { name: "Carlos Eduardo", role: "E-commerce", quote: "Integramos via webhook e agora todo pedido dispara mensagem automática no WhatsApp do cliente. Zero retrabalho.", avatar: "CE" },
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

      {/* ===== PRICING ===== */}
      <section id="precos" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Multi atendimento WhatsApp <GradientText>com IA</GradientText>
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

          {/* Link to full landing */}
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
