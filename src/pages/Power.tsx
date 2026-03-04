import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { 
  Check, Zap, Crown, Rocket, Loader2, Star, Phone, ArrowRight, MessageCircle, 
  Sparkles, Shield, Clock, Mic, Image, Send, Bot, ChevronRight, Play, Users, 
  Target, Calendar, BarChart3, TrendingUp, CheckCircle2, Headphones, 
  FileText, Settings, Webhook, Bell, Brain, Kanban, ClipboardCheck, 
  UserCheck, MessageSquare, Volume2, Eye, Globe, Cpu, Layers, Lock,
  ChevronDown, Menu, X, Heart, Flame, Award, Gauge, MousePointer,
  Workflow, ListTodo, HeartHandshake, AlertCircle, HelpCircle, DollarSign,
  Timer, Repeat, AudioLines, ImageIcon, Share2, Link2, Package,
  Building2, GraduationCap, ShoppingCart, Wrench, TrendingDown, Percent,
  ThumbsUp, ThumbsDown, Smile, Frown, Meh
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
import teamImage from "@/assets/team-collaboration.webp";
import donnaAvatar from "@/assets/donna-avatar.png";

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

// Floating elements animation
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

// Gradient text component
const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent", className)}>
    {children}
  </span>
);

// Feature card with hover effects
const FeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  gradient,
  delay = 0 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  gradient: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
  >
    <Card className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 h-full">
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500", gradient)} />
      <CardHeader className="relative">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300", gradient)}>
          <Icon className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-xl group-hover:text-primary transition-colors">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  </motion.div>
);

// Testimonial card
const TestimonialCard = ({ name, role, company, quote, avatar }: { name: string; role: string; company: string; quote: string; avatar: string }) => (
  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card to-muted/50">
    <CardContent className="pt-6">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-lg mb-6 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold">
          {avatar}
        </div>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{role} • {company}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Robot personality preview
const RobotPersonalityCard = ({ age, style, icon: Icon }: { age: string; style: string; icon: React.ElementType }) => (
  <div className="bg-card/50 backdrop-blur border rounded-xl p-4 text-center hover:border-primary/50 transition-all cursor-pointer group">
    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
      <Icon className="h-6 w-6 text-primary" />
    </div>
    <p className="font-medium">{age}</p>
    <p className="text-xs text-muted-foreground">{style}</p>
  </div>
);

// Sales funnel visualization component
const SalesFunnel = () => {
  const stages = [
    { label: "Prospectando", count: 45, color: "bg-orange-500", width: "100%" },
    { label: "Contatado", count: 38, color: "bg-orange-400", width: "85%" },
    { label: "Convencendo", count: 28, color: "bg-yellow-500", width: "70%" },
    { label: "Reunião Agendada", count: 18, color: "bg-blue-500", width: "55%" },
    { label: "Positivo", count: 12, color: "bg-green-500", width: "40%" },
    { label: "Aguardando Pgto", count: 8, color: "bg-green-400", width: "30%" },
    { label: "SUCESSO! 🎉", count: 5, color: "bg-green-600", width: "20%" },
  ];

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-center mb-2">Funil de Vendas Visual</h3>
      <Badge variant="outline" className="mx-auto block w-fit mb-6 border-orange-300 text-orange-600 bg-orange-50">
        ↺ Não classificado (3)
      </Badge>
      <div className="space-y-3">
        {stages.map((stage, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3"
          >
            <div
              className={cn("h-10 rounded-lg flex items-center justify-between px-4 text-white font-medium text-sm", stage.color)}
              style={{ width: stage.width }}
            >
              <span>{stage.label}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded">{stage.count}</span>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Badge variant="outline" className="border-red-300 text-red-600 bg-red-50">
          🗑️ Sem interesse (2)
        </Badge>
      </div>
    </div>
  );
};

export default function Power() {
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
      // For logged users, check if AtomicPay
      if (plan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual 
          ? plan.atomicpay_annual_url 
          : plan.atomicpay_monthly_url;
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
          return;
        }
      }
      createCheckout.mutate({ planId, mode: 'new' });
    } else {
      setSelectedPlan({ id: planId, name: planName, ...plan });
      setShowLeadModal(true);
    }
  };

  const handleLeadSubmit = async () => {
    if (!leadForm.name.trim() || !leadForm.whatsapp.trim() || !leadForm.email.trim()) {
      toast({
        title: "Preencha todos os campos",
        description: "Nome, WhatsApp e E-mail são necessários para continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save lead data first
      await supabase.from("interested_leads").insert({
        name: leadForm.name.trim(),
        whatsapp: leadForm.whatsapp.trim(),
        email: leadForm.email.trim(),
        plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.name,
        status: "checkout_started",
      });

      setShowLeadModal(false);

      // Check if AtomicPay plan - redirect directly to their checkout
      if (selectedPlan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual 
          ? selectedPlan.atomicpay_annual_url 
          : selectedPlan.atomicpay_monthly_url;
        
        if (checkoutUrl) {
          // Add customer info as query params for AtomicPay
          const url = new URL(checkoutUrl);
          url.searchParams.set("customer_name", leadForm.name.trim());
          url.searchParams.set("customer_email", leadForm.email.trim());
          url.searchParams.set("customer_phone", leadForm.whatsapp.trim());
          window.location.href = url.toString();
          return;
        }
      }

      // For Stripe plans, use create-checkout function
      const { data, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId: selectedPlan?.id,
          customerEmail: leadForm.email.trim(),
          customerName: leadForm.name.trim(),
          customerWhatsapp: leadForm.whatsapp.trim(),
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/2026`,
          billingCycle: isAnnual ? 'annual' : 'monthly',
        },
      });

      if (checkoutError) throw checkoutError;
      if (data?.error) throw new Error(data.error);
      
      if (data?.success) {
        toast({
          title: "Conta criada com sucesso! 🎉",
          description: "Verifique seu e-mail para obter as credenciais de acesso.",
        });
        navigate(`/signup-success?email=${encodeURIComponent(leadForm.email.trim())}`);
        return;
      }
      
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

  const getAnnualPrice = (monthlyCents: number) => {
    const annualDiscount = 0.40; // 40% discount
    const discountedMonthly = monthlyCents * (1 - annualDiscount);
    return Math.round(discountedMonthly);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const whatsappConsultorLink = `https://wa.me/555130760116?text=${encodeURIComponent("Vim do site https://atomic.ia.br/2026 e queria tirar uma dúvida")}`;

  // Custom plan features for display
  const getPlanFeatures = (planName: string) => {
    const name = planName.toLowerCase();
    if (name === "grátis" || name === "starter" || name === "start") {
      return [
        "1 usuário",
        "100 leads",
        "1 instância WhatsApp",
        "SAC integrado",
        "Funil de vendas visual",
      ];
    }
    if (name === "growth") {
      return [
        "3 usuários",
        "1.000 leads",
        "1 instância WhatsApp",
        "Criação de 2 Robôs WhatsApp",
        "Sugestão de follow-up com IA",
        "Mensagens automáticas de follow-up",
        "Demandas & SAC",
        "Pós-venda completo",
      ];
    }
    if (name === "pro") {
      return [
        "10 usuários",
        "10.000 leads",
        "3 instâncias WhatsApp",
        "Robôs WhatsApp ilimitados",
        "Sugestão de follow-up com IA",
        "Mensagens automáticas de follow-up",
        "Vendas e expedição",
        "Demandas & SAC",
        "Pós-venda completo",
        "Integrações webhook",
      ];
    }
    return [
      `${planName} usuário(s)`,
      "Leads",
      "WhatsApp",
    ];
  };

  if (plansLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando experiência...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <img src="/favicon.jpg" alt="Atomic Sales" className="h-6 w-6 rounded" />
              </div>
              <span className="font-bold text-xl">Atomic Sales</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection("recursos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Recursos
              </button>
              <button onClick={() => scrollToSection("secretaria")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Secretária IA
              </button>
              <button onClick={() => scrollToSection("robos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Robôs IA
              </button>
              <button onClick={() => scrollToSection("integracoes")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Integrações
              </button>
              <button onClick={() => scrollToSection("precos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Button asChild>
                  <Link to="/">Acessar Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/login">Entrar</Link>
                  </Button>
                  <Button onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90">
                    Começar Agora
                  </Button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t bg-background"
          >
            <div className="container mx-auto px-4 py-4 space-y-3">
              <button onClick={() => scrollToSection("recursos")} className="block w-full text-left py-2 text-muted-foreground">
                Recursos
              </button>
              <button onClick={() => scrollToSection("secretaria")} className="block w-full text-left py-2 text-muted-foreground">
                Secretária IA
              </button>
              <button onClick={() => scrollToSection("robos")} className="block w-full text-left py-2 text-muted-foreground">
                Robôs IA
              </button>
              <button onClick={() => scrollToSection("integracoes")} className="block w-full text-left py-2 text-muted-foreground">
                Integrações
              </button>
              <button onClick={() => scrollToSection("precos")} className="block w-full text-left py-2 text-muted-foreground">
                Preços
              </button>
              <div className="pt-4 border-t space-y-2">
                {user ? (
                  <Button asChild className="w-full">
                    <Link to="/">Acessar Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" asChild className="w-full">
                      <Link to="/login">Entrar</Link>
                    </Button>
                    <Button onClick={() => scrollToSection("precos")} className="w-full bg-gradient-to-r from-primary to-purple-600">
                      Começar Agora
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm border-primary/50">
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
                CRM + IA + WhatsApp + Automações
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
            >
              O CRM que sua equipe
              <br />
              <GradientText>vai realmente usar</GradientText>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8"
            >
              Tudo integrado em um só lugar: gestão de leads, vendas, pós-venda, SAC, demandas, 
              robôs inteligentes e automações via WhatsApp. <strong className="text-foreground">O lead é o centro de tudo.</strong>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Button 
                size="lg" 
                onClick={() => scrollToSection("precos")}
                className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-lg h-14 px-8 shadow-xl shadow-primary/25"
              >
                Transformar Minha Gestão
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => scrollToSection("recursos")}
                className="text-lg h-14 px-8"
              >
                Ver Demonstração
                <Play className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            {/* Hero stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
            >
              {[
                { value: 10, suffix: "x", label: "Mais produtividade" },
                { value: 0, suffix: "", label: "Leads esquecidos" },
                { value: 24, suffix: "/7", label: "Robôs ativos" },
                { value: 100, suffix: "%", label: "Integrado" },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Floating elements */}
        <FloatingElement delay={0} className="absolute top-1/4 left-10 hidden lg:block">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
        </FloatingElement>
        <FloatingElement delay={1} className="absolute top-1/3 right-10 hidden lg:block">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-xl">
            <Bot className="h-7 w-7 text-white" />
          </div>
        </FloatingElement>
        <FloatingElement delay={2} className="absolute bottom-1/4 left-20 hidden lg:block">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-xl">
            <Brain className="h-6 w-6 text-white" />
          </div>
        </FloatingElement>
      </motion.section>

      {/* Trust badges */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Empresas que transformaram sua gestão de clientes
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {["Empresa A", "Empresa B", "Empresa C", "Empresa D", "Empresa E"].map((company, i) => (
              <div key={i} className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
                <Building2 className="h-5 w-5" />
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secretary AI Section - Dobra 2 */}
      <section id="secretaria" className="py-20 md:py-32 bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                  <Bot className="h-3 w-3 mr-2" />
                  Sua Secretária Comercial com IA
                </Badge>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Gerencie seus leads
                  <br />
                  pelo <span className="text-green-600">WhatsApp</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Converse com sua secretária por <strong>áudio</strong>, <strong>mensagem</strong> ou até <strong>print screen</strong>. 
                  Ela atualiza seu CRM automaticamente enquanto você foca no que importa: <strong>vender</strong>.
                </p>

                <div className="flex flex-wrap gap-4 mb-8">
                  <Button 
                    onClick={() => scrollToSection("precos")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Quero Minha Secretária
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => scrollToSection("robos")}>
                    <Play className="mr-2 h-4 w-4" />
                    Ver Como Funciona
                  </Button>
                </div>

                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-green-600" />
                    Fale por áudio
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    Envie mensagens
                  </div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-green-600" />
                    Mande prints
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* WhatsApp Mock */}
                <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl max-w-sm mx-auto">
                  <div className="bg-gray-800 rounded-[2rem] overflow-hidden">
                    {/* Header */}
                    <div className="bg-green-700 px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">Secretária Morphews</p>
                        <p className="text-green-200 text-xs">online</p>
                      </div>
                    </div>
                    
                    {/* Messages */}
                    <div className="bg-[#0b141a] p-4 space-y-3 min-h-[300px]">
                      {/* Audio badge */}
                      <div className="absolute -left-12 top-20 hidden lg:block">
                        <div className="bg-white rounded-full px-3 py-1.5 shadow-lg text-sm flex items-center gap-2">
                          <Mic className="h-4 w-4 text-primary" />
                          Áudio de 15s
                        </div>
                      </div>

                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="bg-green-700 text-white rounded-lg rounded-tr-none px-3 py-2 max-w-[80%] text-sm">
                          Acabei de falar com a Dra. Ana, cirurgiã plástica, @draana no insta, 50k seguidores. Muito interessada, marcamos call pra amanhã!
                        </div>
                      </div>

                      {/* Bot response */}
                      <div className="flex justify-start">
                        <div className="bg-gray-700 text-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] text-sm">
                          <p className="font-medium mb-1">✅ Lead cadastrado!</p>
                          <p className="text-gray-300 text-xs space-y-0.5">
                            👤 Dra. Ana<br/>
                            📍 Reunião Agendada<br/>
                            ⭐ 4 estrelas (50k seguidores)<br/>
                            📸 @draana<br/>
                            <span className="text-green-400">🔗 Clique para ver no CRM</span>
                          </p>
                        </div>
                      </div>

                      {/* Print badge */}
                      <div className="absolute -right-12 top-52 hidden lg:block">
                        <div className="bg-white rounded-full px-3 py-1.5 shadow-lg text-sm flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-primary" />
                          Print do Instagram
                        </div>
                      </div>

                      {/* User message 2 */}
                      <div className="flex justify-end">
                        <div className="bg-green-700 text-white rounded-lg rounded-tr-none px-3 py-2 max-w-[80%] text-sm">
                          Coloca ela como 5 estrelas
                        </div>
                      </div>

                      {/* Bot response 2 */}
                      <div className="flex justify-start">
                        <div className="bg-gray-700 text-white rounded-lg rounded-tl-none px-3 py-2 text-sm">
                          ✅ Atualizado! Dra. Ana agora
                        </div>
                      </div>

                      {/* Input */}
                      <div className="flex items-center gap-2 mt-4">
                        <div className="flex-1 bg-gray-700 rounded-full px-4 py-2 text-gray-400 text-sm">
                          Digite uma mensagem...
                        </div>
                        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
                          <Mic className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Sales Funnel Section - Dobra 3 */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4">
                  <TrendingDown className="h-3 w-3 mr-2 rotate-180" />
                  Funil de Vendas Visual
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Visualize todo seu <GradientText>pipeline</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Funil visual com etapas personalizáveis. Saiba exatamente onde cada lead está 
                  no processo de compra e nunca perca uma oportunidade.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: Layers, text: "Etapas customizáveis por tipo de venda" },
                    { icon: Star, text: "Qualificação por estrelas (1-5)" },
                    { icon: Users, text: "Atribuição de responsáveis" },
                    { icon: Clock, text: "Tempo em cada etapa" },
                    { icon: BarChart3, text: "Taxa de conversão por etapa" },
                    { icon: Bell, text: "Alertas de leads parados" },
                  ].map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <SalesFunnel />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem / Solution Section */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Problem */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 border-destructive/50 text-destructive">
                  <X className="h-3 w-3 mr-1" />
                  O problema
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Sua equipe perde tempo com processos manuais?
                </h2>
                <ul className="space-y-4">
                  {[
                    "Leads esquecidos em planilhas ou anotações",
                    "Vendedores sem follow-up sistemático",
                    "Pós-venda inexistente ou desorganizado",
                    "SAC via WhatsApp sem rastreabilidade",
                    "Demandas perdidas entre equipes",
                    "Zero visão do funil de vendas",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="h-3 w-3 text-destructive" />
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Solution */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 border-primary/50 text-primary">
                  <Check className="h-3 w-3 mr-1" />
                  A solução
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  <GradientText>Atomic Sales:</GradientText> tudo conectado ao lead
                </h2>
                <ul className="space-y-4">
                  {[
                    "CRM completo com funil visual e Kanban",
                    "Robôs IA que atendem, qualificam e vendem 24/7",
                    "Pós-venda com pesquisa de satisfação automática",
                    "SAC integrado: reclamações, dúvidas, financeiro",
                    "Gestão de demandas com SLA e responsáveis",
                    "Mensagens agendadas e follow-ups automáticos",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Features Section */}
      <section id="recursos" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Recursos Completos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Tudo que você precisa, <GradientText>integrado</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              O lead é o centro de tudo. Cada interação, venda, demanda e atendimento conectados.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            <FeatureCard
              icon={Target}
              title="CRM Visual"
              description="Funil de vendas com Kanban, estrelas de qualificação, responsáveis por lead e histórico completo de interações."
              gradient="bg-gradient-to-br from-blue-500/10 to-cyan-500/5"
              delay={0}
            />
            <FeatureCard
              icon={ListTodo}
              title="Gestão de Demandas"
              description="Kanban de tarefas com SLA, urgência, responsáveis, checklists, anexos e notificações automáticas."
              gradient="bg-gradient-to-br from-purple-500/10 to-pink-500/5"
              delay={0.1}
            />
            <FeatureCard
              icon={HeartHandshake}
              title="Pós-Venda Inteligente"
              description="Kanban de acompanhamento, pesquisa de satisfação automática e histórico de medicamentos contínuos."
              gradient="bg-gradient-to-br from-green-500/10 to-emerald-500/5"
              delay={0.2}
            />
            <FeatureCard
              icon={Headphones}
              title="SAC Completo"
              description="Reclamações, dúvidas, solicitações e financeiro. Tudo categorizado, priorizado e com SLA de resposta."
              gradient="bg-gradient-to-br from-orange-500/10 to-amber-500/5"
              delay={0.3}
            />
            <FeatureCard
              icon={MessageSquare}
              title="WhatsApp Multi-Atendente"
              description="Múltiplas instâncias, transferência de conversas, robôs por instância e histórico unificado."
              gradient="bg-gradient-to-br from-green-500/10 to-teal-500/5"
              delay={0.4}
            />
            <FeatureCard
              icon={Bell}
              title="Mensagens Automáticas"
              description="Agendamento de mensagens, follow-ups programados e lembretes para nunca esquecer um cliente."
              gradient="bg-gradient-to-br from-indigo-500/10 to-blue-500/5"
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Demandas Deep Dive */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4">
                  <Kanban className="h-3 w-3 mr-2" />
                  Gestão de Demandas
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Organize tarefas como nunca antes
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Sistema completo de gestão de demandas com Kanban visual, SLA configurável 
                  e rastreabilidade total. Tudo conectado ao lead.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: Kanban, text: "Múltiplos quadros Kanban personalizados" },
                    { icon: Timer, text: "SLA por urgência: baixa, média, alta, crítica" },
                    { icon: Users, text: "Atribuição de responsáveis e times" },
                    { icon: ClipboardCheck, text: "Checklists e subtarefas" },
                    { icon: FileText, text: "Anexos e comentários" },
                    { icon: Bell, text: "Notificações automáticas de prazo" },
                    { icon: Link2, text: "Vinculação automática com leads" },
                    { icon: BarChart3, text: "Dashboard de produtividade" },
                  ].map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src={teamImage} 
                    alt="Equipe colaborando" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <FloatingElement delay={0} className="absolute -top-4 -right-4">
                  <div className="bg-destructive text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
                    3 Atrasadas
                  </div>
                </FloatingElement>
                <FloatingElement delay={1} className="absolute -bottom-4 -left-4">
                  <div className="bg-primary text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
                    12 Em andamento
                  </div>
                </FloatingElement>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* SAC Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-2 lg:order-1 relative"
              >
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: AlertCircle, label: "Reclamação", color: "from-red-500 to-orange-500", count: 5 },
                    { icon: HelpCircle, label: "Dúvida", color: "from-blue-500 to-cyan-500", count: 12 },
                    { icon: FileText, label: "Solicitação", color: "from-purple-500 to-pink-500", count: 8 },
                    { icon: DollarSign, label: "Financeiro", color: "from-green-500 to-emerald-500", count: 3 },
                  ].map(({ icon: Icon, label, color, count }, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-card border rounded-2xl p-6 hover:shadow-xl transition-all"
                    >
                      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", color)}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-2xl font-bold text-primary">{count}</p>
                      <p className="text-xs text-muted-foreground">chamados abertos</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <Badge variant="outline" className="mb-4">
                  <Headphones className="h-3 w-3 mr-2" />
                  SAC Integrado
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Atendimento ao cliente profissional
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Centralize todas as interações de suporte. Cada chamado vinculado ao lead, 
                  com histórico completo e métricas de atendimento.
                </p>
                <ul className="space-y-3">
                  {[
                    "Categorias: Reclamação, Dúvida, Solicitação, Financeiro",
                    "Subcategorias personalizáveis",
                    "Priorização automática por tipo",
                    "SLA de resposta configurável",
                    "Histórico completo no perfil do lead",
                    "Métricas de satisfação",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Robots Section */}
      <section id="robos" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Bot className="h-3 w-3 mr-2" />
              Robôs Inteligentes
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Crie <GradientText>colaboradores virtuais</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Robôs com personalidade, sotaque regional, gírias e comportamento customizável.
              Eles entendem áudio, imagens e texto. Atendimento 24/7 sem custo de folha.
            </p>
          </div>

          {/* Robot personality options */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Age/Maturity */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">Qual a idade do robô?</CardTitle>
                  <CardDescription>Define o tom e formalidade</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <RobotPersonalityCard age="18-25 anos" style="Jovem, informal" icon={Zap} />
                    <RobotPersonalityCard age="26-35 anos" style="Profissional, acessível" icon={Users} />
                    <RobotPersonalityCard age="36-50 anos" style="Formal, objetivo" icon={Crown} />
                    <RobotPersonalityCard age="50+ anos" style="Muito formal" icon={GraduationCap} />
                  </div>
                </CardContent>
              </Card>

              {/* Service Type */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">O que ele vai fazer?</CardTitle>
                  <CardDescription>Tipo principal de atendimento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <RobotPersonalityCard age="💰 Vendas" style="Apresentar e fechar" icon={ShoppingCart} />
                    <RobotPersonalityCard age="🔧 Suporte" style="Resolver problemas" icon={Wrench} />
                    <RobotPersonalityCard age="📞 SAC" style="Atender solicitações" icon={Phone} />
                    <RobotPersonalityCard age="📋 Qualificação" style="Qualificar leads" icon={ClipboardCheck} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Response style */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-lg">Como seu robô responde?</CardTitle>
                <CardDescription>Define o tamanho das mensagens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-xl p-4 hover:border-primary/50 transition-all cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <span className="font-medium">Respostas Curtas</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Direto ao ponto, máximo 50 palavras</p>
                    <p className="text-xs mt-2 p-2 bg-muted rounded italic">"Oi! Tudo bem? Como posso ajudar?"</p>
                  </div>
                  <div className="border-2 border-primary rounded-xl p-4 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">Respostas Médias</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Equilibrado, 50-100 palavras</p>
                    <p className="text-xs mt-2 p-2 bg-muted rounded italic">"Olá! Seja bem-vindo! Estou aqui para ajudar..."</p>
                  </div>
                  <div className="border rounded-xl p-4 hover:border-primary/50 transition-all cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">Respostas Detalhadas</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Completo e explicativo</p>
                    <p className="text-xs mt-2 p-2 bg-muted rounded italic">"Olá! É um prazer recebê-lo! Meu nome é..."</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Robot capabilities */}
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Mic, title: "Escuta Áudio", description: "Transcreve e entende mensagens de voz" },
                { icon: ImageIcon, title: "Lê Imagens", description: "Interpreta prints e fotos enviadas" },
                { icon: Brain, title: "Aprende", description: "Melhora com base nas interações" },
              ].map(({ icon: Icon, title, description }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Voice AI Section - NEW */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-purple-50/50 to-background dark:from-purple-950/20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 border-purple-500/50 text-purple-600 bg-purple-50">
                  <AudioLines className="h-3 w-3 mr-2" />
                  NOVO: Robôs que Falam!
                </Badge>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Respostas por <span className="text-purple-600">Áudio</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Seus robôs agora podem responder com <strong>áudio nativo</strong> no WhatsApp! 
                  Vozes realistas em português brasileiro que parecem humanos de verdade.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: Mic, text: "Vozes realistas em PT-BR com ElevenLabs" },
                    { icon: Users, text: "Escolha entre várias personalidades de voz" },
                    { icon: Gauge, text: "Probabilidade configurável (parecer humano)" },
                    { icon: Settings, text: "Estilo de locução personalizável" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-purple-600" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => scrollToSection("precos")}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Quero Robôs que Falam
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Voice Response Mock */}
                <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl max-w-sm mx-auto">
                  <div className="bg-gray-800 rounded-[2rem] overflow-hidden">
                    <div className="bg-green-700 px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                        <Volume2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">Helena • Atendente IA</p>
                        <p className="text-green-200 text-xs">gravando áudio...</p>
                      </div>
                    </div>
                    
                    <div className="bg-[#0b141a] p-4 space-y-3 min-h-[280px]">
                      <div className="flex justify-end">
                        <div className="bg-green-700 text-white rounded-lg rounded-tr-none px-3 py-2 max-w-[80%] text-sm">
                          Quais são os preços?
                        </div>
                      </div>

                      <div className="flex justify-start">
                        <div className="bg-gray-700 text-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                              <Mic className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                {[...Array(12)].map((_, i) => (
                                  <div 
                                    key={i} 
                                    className="w-1 bg-green-500 rounded-full animate-pulse"
                                    style={{ 
                                      height: `${Math.random() * 16 + 8}px`,
                                      animationDelay: `${i * 0.1}s`
                                    }}
                                  />
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">0:15</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute -right-8 top-48 hidden lg:block">
                        <div className="bg-purple-600 text-white rounded-full px-3 py-1.5 shadow-lg text-sm flex items-center gap-2">
                          <Volume2 className="h-4 w-4" />
                          Resposta em Áudio!
                        </div>
                      </div>

                      <div className="flex justify-start">
                        <div className="bg-gray-700 text-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] text-xs text-gray-300">
                          <p className="italic">"Claro! Temos três planos disponíveis. O Start começa em R$ 67, o Growth em R$ 147 e o Pro em R$ 297. Qual te interessa mais?"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Model Selection Section - NEW */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-2 lg:order-1"
              >
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: "Gemini 3 Flash", provider: "Google", speed: "⚡⚡⚡", cost: "💰", color: "from-blue-500 to-cyan-500" },
                    { name: "GPT-5", provider: "OpenAI", speed: "⚡⚡", cost: "💰💰💰", color: "from-green-500 to-emerald-500" },
                    { name: "Gemini 2.5 Pro", provider: "Google", speed: "⚡⚡", cost: "💰💰", color: "from-purple-500 to-pink-500" },
                    { name: "GPT-5.2", provider: "OpenAI", speed: "⚡", cost: "💰💰💰", color: "from-orange-500 to-red-500" },
                  ].map(({ name, provider, speed, cost, color }, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className={cn(
                        "bg-card border rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer",
                        i === 0 && "border-primary ring-2 ring-primary/20"
                      )}
                    >
                      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3", color)}>
                        <Cpu className="h-5 w-5 text-white" />
                      </div>
                      <p className="font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{provider}</p>
                      <div className="flex justify-between text-xs">
                        <span>Velocidade: {speed}</span>
                        <span>Custo: {cost}</span>
                      </div>
                      {i === 0 && (
                        <Badge className="mt-2 text-xs">Recomendado</Badge>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <Badge variant="outline" className="mb-4">
                  <Cpu className="h-3 w-3 mr-2" />
                  Escolha sua IA
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Qual <GradientText>inteligência</GradientText> combina com você?
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Escolha entre os modelos mais avançados do mercado. Cada um tem suas características 
                  únicas de velocidade, custo e capacidade.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: Zap, text: "Gemini 3 Flash: Rápido e econômico (padrão)" },
                    { icon: Brain, text: "GPT-5: Raciocínio avançado e nuances" },
                    { icon: Eye, text: "Gemini Pro: Multimodal (imagens + texto)" },
                    { icon: Crown, text: "GPT-5.2: Última geração OpenAI" },
                  ].map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* NPS System Section - NEW */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                  <ThumbsUp className="h-3 w-3 mr-2" />
                  Pesquisa NPS Automática
                </Badge>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Saiba o que seus clientes <span className="text-green-600">pensam</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Pesquisa de satisfação <strong>automática</strong> após cada atendimento. 
                  Identifique detratores, passivos e promotores em tempo real.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: Bell, text: "Disparo automático ao encerrar conversa" },
                    { icon: BarChart3, text: "Dashboard com score NPS consolidado" },
                    { icon: Users, text: "Ranking de vendedores por satisfação" },
                    { icon: AlertCircle, text: "Alertas para notas baixas (≤6)" },
                    { icon: FileText, text: "Revisão de casos com anotações" },
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

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* NPS Dashboard Mock */}
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Dashboard NPS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* NPS Score */}
                    <div className="text-center p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl">
                      <div className="text-5xl font-bold text-green-600 mb-2">+72</div>
                      <div className="text-sm text-muted-foreground">Score NPS</div>
                    </div>

                    {/* Distribution */}
                    <div>
                      <p className="text-sm font-medium mb-3">Distribuição</p>
                      <div className="flex h-4 rounded-full overflow-hidden">
                        <div className="bg-green-500 flex-[62]" />
                        <div className="bg-yellow-500 flex-[28]" />
                        <div className="bg-red-500 flex-[10]" />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Smile className="h-3 w-3 text-green-500" /> 62% Promotores
                        </span>
                        <span className="flex items-center gap-1">
                          <Meh className="h-3 w-3 text-yellow-500" /> 28% Passivos
                        </span>
                        <span className="flex items-center gap-1">
                          <Frown className="h-3 w-3 text-red-500" /> 10% Detratores
                        </span>
                      </div>
                    </div>

                    {/* Alert */}
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <div className="text-sm">
                        <p className="font-medium text-red-700">3 avaliações pendentes</p>
                        <p className="text-red-600/80 text-xs">Notas ≤6 para revisar</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Meet Donna Section - NEW */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative flex justify-center"
              >
                <div className="relative">
                  <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-primary/20 shadow-2xl">
                    <img 
                      src={donnaAvatar} 
                      alt="Donna - Assistente Virtual Atomic Sales" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <FloatingElement delay={0} className="absolute -top-4 -right-4">
                    <div className="bg-primary text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      Online 24/7
                    </div>
                  </FloatingElement>
                  <FloatingElement delay={1} className="absolute -bottom-4 -left-4">
                    <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Suporte Instantâneo
                    </div>
                  </FloatingElement>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4">
                  <Heart className="h-3 w-3 mr-2" />
                  Conheça a Donna
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Sua assistente virtual <GradientText>sempre presente</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  A <strong>Donna</strong> é nossa assistente IA integrada ao CRM. 
                  Ela ajuda sua equipe com dúvidas, sugestões e dicas em tempo real, 
                  direto dentro do sistema.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: HelpCircle, text: "Tira dúvidas sobre o sistema instantaneamente" },
                    { icon: Brain, text: "Sugere ações baseadas no contexto" },
                    { icon: GraduationCap, text: "Ensina sua equipe a usar o CRM" },
                    { icon: Clock, text: "Disponível 24 horas, 7 dias por semana" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={() => scrollToSection("precos")}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  Quero Conhecer a Donna
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Intelligence Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4">
                  <Brain className="h-3 w-3 mr-2" />
                  Inteligência Artificial
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  IA que trabalha por você
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Transcrição de ligações, análise de qualidade, sugestões de follow-up 
                  e insights automáticos. Tudo para aumentar suas conversões.
                </p>
                <div className="space-y-6">
                  {[
                    { 
                      icon: Mic, 
                      title: "Transcrição de Ligações",
                      description: "Converte áudio em texto automaticamente com pontuação de qualidade"
                    },
                    { 
                      icon: Target, 
                      title: "Sugestões de Follow-up",
                      description: "IA analisa histórico e sugere próximos passos para cada lead"
                    },
                    { 
                      icon: Award, 
                      title: "Scoring de Atendimento",
                      description: "Nota automática para cada ligação baseada em critérios definidos"
                    },
                    { 
                      icon: UserCheck, 
                      title: "Leads Sem Contato",
                      description: "Painel mostra leads esquecidos. Primeiro vendedor que clicar, assume"
                    },
                  ].map(({ icon: Icon, title, description }, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{title}</h3>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <Card className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Sugestão de IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                        <p className="font-medium mb-2">📞 Ligar para Maria Silva</p>
                        <p className="text-sm text-muted-foreground">
                          Último contato há 5 dias. Demonstrou interesse no Pacote Premium.
                          Melhor horário: 14h-16h.
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <p className="font-medium mb-2">💬 Enviar mensagem para João</p>
                        <p className="text-sm text-muted-foreground">
                          Aniversário em 2 dias. Sugestão: parabenizar e oferecer desconto especial.
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-xl">
                        <p className="font-medium mb-2">⭐ Qualificar lead Carlos</p>
                        <p className="text-sm text-muted-foreground">
                          Alto engajamento nas últimas mensagens. Potencial de 4 estrelas.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integracoes" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Webhook className="h-3 w-3 mr-2" />
              Integrações
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Conecte <GradientText>tudo</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Webhooks poderosos para receber e enviar dados. Integre com qualquer sistema.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Users, title: "Criar/Atualizar Leads", description: "Receba leads de qualquer fonte automaticamente" },
                { icon: ShoppingCart, title: "Criar Vendas", description: "Sincronize vendas de e-commerce ou ERP" },
                { icon: Package, title: "Expedição", description: "Integre com transportadoras e motoboys" },
                { icon: AlertCircle, title: "Chamados SAC", description: "Abra tickets de sistemas externos" },
                { icon: MessageCircle, title: "Mensagens WhatsApp", description: "Envie mensagens automáticas por evento" },
                { icon: Share2, title: "Notificações", description: "Dispare alertas para sua equipe" },
              ].map(({ icon: Icon, title, description }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="h-full hover:border-primary/50 transition-colors group">
                    <CardContent className="pt-6">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                        <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="font-semibold mb-2">{title}</h3>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12"
            >
              <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Workflow className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-xl font-bold mb-2">API Webhook Completa</h3>
                      <p className="text-muted-foreground">
                        Documentação completa para desenvolvedores. Crie integrações customizadas 
                        em minutos. Suporte a autenticação, retry automático e logs detalhados.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Empresas que <GradientText>transformaram</GradientText> sua gestão
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <TestimonialCard
              name="Ricardo Silva"
              role="CEO"
              company="Franquia Claro MG"
              quote="O robô atende 80% dos leads automaticamente. Nossa equipe foca só nos casos complexos. Vendas aumentaram 40%."
              avatar="RS"
            />
            <TestimonialCard
              name="Ana Paula"
              role="InfoProdutora"
              company=""
              quote="Nunca mais esquecemos um follow-up. O sistema lembra tudo. Recuperamos clientes que estavam perdidos."
              avatar="AP"
            />
            <TestimonialCard
              name="Carlos Eduardo"
              role="Ecom de Nutraceuticos"
              company=""
              quote="Integração perfeita com nosso ERP. Vendas entram automaticamente, expedição é notificada. Zero retrabalho."
              avatar="CE"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Investimento que <GradientText>se paga</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Quanto custa um lead esquecido? Uma venda perdida por falta de follow-up?
              O Atomic Sales custa menos que um café por dia.
            </p>

            {/* Annual/Monthly Toggle */}
            <div className="inline-flex items-center gap-4 bg-card border rounded-full px-6 py-3">
              <span className={cn("text-sm font-medium", !isAnnual && "text-primary")}>Mensal</span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
              />
              <span className={cn("text-sm font-medium flex items-center gap-2", isAnnual && "text-primary")}>
                Anual
                <Badge className="bg-green-500 text-white text-xs">
                  40% OFF
                </Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans?.map((plan, index) => {
              const isPro = plan.name.toLowerCase() === "pro";
              const isGrowth = plan.name.toLowerCase() === "growth";
              const gradients = [
                "from-gray-500 to-gray-600",
                "from-blue-500 to-cyan-500",
                "from-purple-500 to-pink-500",
                "from-amber-500 to-orange-500",
              ];

              const displayPrice = isAnnual && plan.price_cents > 0 
                ? getAnnualPrice(plan.price_cents)
                : plan.price_cents;

              const features = getPlanFeatures(plan.name);
              
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={cn(
                    "relative h-full flex flex-col",
                    isPro && "border-primary shadow-xl shadow-primary/10"
                  )}>
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          <Crown className="h-3 w-3 mr-1" />
                          VOCÊ MERECE O MELHOR
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <div className={cn(
                        "w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4",
                        gradients[index % gradients.length]
                      )}>
                        {index === 0 && <Star className="h-7 w-7 text-white" />}
                        {index === 1 && <Zap className="h-7 w-7 text-white" />}
                        {index === 2 && <Crown className="h-7 w-7 text-white" />}
                        {index === 3 && <Rocket className="h-7 w-7 text-white" />}
                      </div>
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="mt-4">
                        {isAnnual && plan.price_cents > 0 && (
                          <div className="text-sm text-muted-foreground line-through mb-1">
                            {formatPrice(plan.price_cents)}/mês
                          </div>
                        )}
                        <span className="text-4xl font-bold">{formatPrice(displayPrice)}</span>
                        <span className="text-muted-foreground">/mês</span>
                        {isAnnual && plan.price_cents > 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            Economia de {formatPrice((plan.price_cents - displayPrice) * 12)}/ano
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-3">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className={cn(
                          "w-full",
                          isPro && "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                        )}
                        variant={isPro ? "default" : "outline"}
                        onClick={() => handleSelectPlan(plan.id, plan.name, plan)}
                      >
                        Contratar Agora
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Money back guarantee */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto mt-12 text-center"
          >
            <div className="inline-flex items-center gap-3 bg-card border rounded-full px-6 py-3">
              <Shield className="h-6 w-6 text-primary" />
              <span>
                <strong>Garantia de 7 dias.</strong> Não gostou? Devolvemos seu dinheiro. Sem perguntas.
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Pronto para transformar sua
                <br />
                <GradientText>gestão de clientes?</GradientText>
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Junte-se a centenas de empresas que já automatizaram seu atendimento, 
                aumentaram vendas e nunca mais esqueceram um cliente.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => scrollToSection("precos")}
                  className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-lg h-14 px-8 shadow-xl shadow-primary/25"
                >
                  Começar Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg h-14 px-8"
                  asChild
                >
                  <a href={whatsappConsultorLink} target="_blank" rel="noopener noreferrer">
                    <Phone className="mr-2 h-5 w-5" />
                    Falar com Consultor
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/favicon.jpg" alt="Atomic Sales" className="h-8 w-8 rounded" />
              <span className="font-bold text-xl">Atomic Sales</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/termos" className="hover:text-foreground transition-colors">
                Termos de Uso
              </Link>
              <Link to="/privacidade" className="hover:text-foreground transition-colors">
                Privacidade
              </Link>
              <a href="mailto:contato@atomic.ia.br" className="hover:text-foreground transition-colors">
                Contato
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Atomic Sales. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Lead Capture Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              Quase lá! 🚀
            </DialogTitle>
            <DialogDescription className="text-center">
              Preencha seus dados para ativar o plano <strong>{selectedPlan?.name}</strong>
              {isAnnual && selectedPlan && (
                <span className="block mt-1 text-green-600 font-medium">
                  com 40% de desconto no plano anual
                </span>
              )}
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
            </div>
          </div>

          <Button 
            onClick={handleLeadSubmit} 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Continuar para Pagamento
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Seus dados estão seguros. Não enviamos spam.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
