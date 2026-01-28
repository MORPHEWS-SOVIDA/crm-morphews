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
  ThumbsUp, ThumbsDown, Smile, Frown, Meh, Mail, Store, LayoutTemplate,
  RefreshCw, Puzzle, Receipt, Truck, Route, Network, Megaphone, Video
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

// Feature anchor items for the hero
const featureAnchors = [
  { id: "donna", label: "Atualização do CRM por conversa no WhatsApp com sua secretária DONNA", icon: MessageCircle },
  { id: "crm", label: "CRM com funil de vendas", icon: TrendingDown },
  { id: "erp", label: "ERP com NF-e e etiquetas automáticas", icon: Receipt },
  { id: "demandas", label: "Sistema de demandas", icon: ListTodo },
  { id: "sac", label: "Sistema de SAC", icon: Headphones },
  { id: "pos-venda", label: "Pós venda automático", icon: HeartHandshake },
  { id: "robos", label: "Crie seu time de robôs de IA", icon: Bot },
  { id: "audio", label: "Até mesmo que gravam áudios", icon: Mic },
  { id: "equipe", label: "E que trabalham em equipe", icon: Network },
  { id: "escolha-ia", label: "Escolha a IA que combina com você", icon: Cpu },
  { id: "nps", label: "Sistema de NPS no WhatsApp", icon: ThumbsUp },
  { id: "assistente", label: "Tudo com uma assistente virtual", icon: Heart },
  { id: "integracoes", label: "Conecte tudo", icon: Webhook },
  { id: "ecommerce", label: "E-commerce ou landing page feito por IA", icon: Store },
  { id: "quiz", label: "Quiz de qualificação integrado com CRM", icon: Puzzle },
  { id: "tracker", label: "Tracker Facebook, Google", icon: Target },
  { id: "email-marketing", label: "Email Marketing inteligente", icon: Mail },
  { id: "whatsapp-marketing", label: "WhatsApp Marketing", icon: Megaphone },
  { id: "whatsapp-multi", label: "WhatsApp multi agente e multi instância", icon: Users },
  { id: "tipos-robos", label: "Com dezenas de tipos de robôs", icon: Settings },
];

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
      await supabase.from("interested_leads").insert({
        name: leadForm.name.trim(),
        whatsapp: leadForm.whatsapp.trim(),
        email: leadForm.email.trim(),
        plan_id: selectedPlan?.id,
        plan_name: selectedPlan?.name,
        status: "checkout_started",
      });

      setShowLeadModal(false);

      if (selectedPlan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual 
          ? selectedPlan.atomicpay_annual_url 
          : selectedPlan.atomicpay_monthly_url;
        
        if (checkoutUrl) {
          const url = new URL(checkoutUrl);
          url.searchParams.set("customer_name", leadForm.name.trim());
          url.searchParams.set("customer_email", leadForm.email.trim());
          url.searchParams.set("customer_phone", leadForm.whatsapp.trim());
          window.location.href = url.toString();
          return;
        }
      }

      const { data, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          planId: selectedPlan?.id,
          customerEmail: leadForm.email.trim(),
          customerName: leadForm.name.trim(),
          customerWhatsapp: leadForm.whatsapp.trim(),
          successUrl: `${window.location.origin}/?subscription=success`,
          cancelUrl: `${window.location.origin}/sales`,
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
    const annualDiscount = 0.40;
    const discountedMonthly = monthlyCents * (1 - annualDiscount);
    return Math.round(discountedMonthly);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const whatsappConsultorLink = `https://wa.me/555130760116?text=${encodeURIComponent("Vim do site https://sales.morphews.com e quero saber mais")}`;

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
                <img src="/favicon.jpg" alt="Morphews" className="h-6 w-6 rounded" />
              </div>
              <span className="font-bold text-xl">Morphews</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection("robos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Robôs IA
              </button>
              <button onClick={() => scrollToSection("crm")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                CRM
              </button>
              <button onClick={() => scrollToSection("ecommerce")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                E-commerce
              </button>
              <button onClick={() => scrollToSection("whatsapp-multi")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                WhatsApp
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-background border-b p-4"
          >
            <nav className="flex flex-col gap-4">
              <button onClick={() => scrollToSection("robos")} className="text-left py-2">Robôs IA</button>
              <button onClick={() => scrollToSection("crm")} className="text-left py-2">CRM</button>
              <button onClick={() => scrollToSection("ecommerce")} className="text-left py-2">E-commerce</button>
              <button onClick={() => scrollToSection("whatsapp-multi")} className="text-left py-2">WhatsApp</button>
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
                <Bot className="h-4 w-4 mr-2 text-primary" />
                Robôs + IA + Automação Total
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight"
            >
              Robôs que vão fazer
              <br />
              <GradientText>sua empresa vender mais</GradientText>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-8"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-6">
                Tudo em um único lugar
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Você já pode ter visto sistemas que têm alguma dessas funções, a <span className="font-bold text-primary">MORPHEWS</span> tem tudo <span className="font-bold text-primary">INTEGRADO</span> em um só login e senha
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Feature Anchors List - Segunda Dobra */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 gap-3"
            >
              {featureAnchors.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => scrollToSection(item.id)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</span>
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="text-center text-lg font-bold mt-8 text-primary"
            >
              Tudo integrado.
            </motion.p>
          </div>
        </div>
      </section>

      {/* VSL Video Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Video className="h-3 w-3 mr-2" />
              Conheça o Morphews
            </Badge>
            <h2 className="text-2xl md:text-4xl font-bold mb-6">
              Entenda como o Morphews pode <GradientText>transformar seu negócio</GradientText>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              O Morphews é uma plataforma completa de automação comercial com inteligência artificial. 
              Unificamos CRM, E-commerce, WhatsApp, NF-e, etiquetas de envio e muito mais em um único sistema 
              que trabalha 24 horas por dia para você vender mais e gastar menos tempo com tarefas repetitivas.
            </p>
            
          </div>
        </div>
      </section>

      {/* DONNA Section */}
      <section id="donna" className="py-20 md:py-32 bg-muted/30">
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
                      alt="Donna - Assistente Virtual Morphews" 
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
                  <MessageCircle className="h-3 w-3 mr-2" />
                  Atualização do CRM por conversa no WhatsApp com sua secretária DONNA
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Sua secretária IA <GradientText>DONNA</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Atualize seu CRM por <strong>áudio no WhatsApp</strong>. Diga: "Donna, cadastra o João, 
                  telefone tal, ele quer o produto X". Pronto! Lead cadastrado, etapa do funil definida, 
                  tudo sem abrir o computador.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: Mic, text: "Cadastre leads por áudio enquanto dirige" },
                    { icon: MessageCircle, text: "Atualize etapas do funil por mensagem" },
                    { icon: Clock, text: "Agende follow-ups falando com a Donna" },
                    { icon: HelpCircle, text: "Tire dúvidas sobre o sistema instantaneamente" },
                    { icon: Brain, text: "Receba sugestões inteligentes de ações" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CRM Visual Section */}
      <section id="crm" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-4">
                <TrendingDown className="h-3 w-3 mr-2 rotate-180" />
                CRM Visual
              </Badge>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  CRM com funil de vendas
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Organize todos os seus leads com <strong>Kanban visual</strong>. Etapas customizáveis, 
                  qualificação por estrelas e rastreamento completo de cada oportunidade.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: Layers, text: "Etapas customizáveis por tipo de venda" },
                    { icon: Star, text: "Qualificação por estrelas (1-5)" },
                    { icon: Kanban, text: "Kanban visual arrastar e soltar" },
                    { icon: Users, text: "Atribuição de responsáveis" },
                    { icon: Clock, text: "Tempo em cada etapa" },
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

      {/* ERP Section */}
      <section id="erp" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-4 border-indigo-500/50 text-indigo-600 bg-indigo-50">
                <Receipt className="h-3 w-3 mr-2" />
                ERP com NF-e e etiquetas automáticas
              </Badge>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-2 lg:order-1"
              >
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white">
                    <CardTitle className="text-lg">Fluxo Automático de Venda</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-700">1. Venda Aprovada</span>
                      </div>
                      <p className="text-sm text-green-600">Pagamento confirmado no checkout</p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <Receipt className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-blue-700">2. NF-e Emitida</span>
                      </div>
                      <p className="text-sm text-blue-600">Automaticamente via integração fiscal</p>
                    </div>
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <Truck className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-purple-700">3. Etiqueta Gerada</span>
                      </div>
                      <p className="text-sm text-purple-600">Correios ou Melhor Envio automático</p>
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-700">4. Cliente Notificado</span>
                      </div>
                      <p className="text-sm text-green-600">WhatsApp + Email com rastreio</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="order-1 lg:order-2"
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  NF-e e etiquetas <GradientText>100% automáticas</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Venda aprovada? O sistema emite NF-e, gera etiqueta de envio e notifica 
                  o cliente por <strong>email e WhatsApp</strong>. Você não precisa fazer nada.
                </p>

                <div className="space-y-4">
                  {[
                    { icon: Receipt, text: "Emissão automática de NF-e" },
                    { icon: Truck, text: "Integração Correios e Melhor Envio" },
                    { icon: Mail, text: "Envio de NF-e e rastreio por email" },
                    { icon: MessageCircle, text: "Notificação por WhatsApp com rastreio" },
                    { icon: Package, text: "Status de expedição em tempo real" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-indigo-600" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Demandas Section */}
      <section id="demandas" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <ListTodo className="h-3 w-3 mr-2" />
              Sistema de demandas
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Gestão de demandas com <GradientText>Kanban</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Organize tarefas internas, atribuições de equipe, SLAs e acompanhamento 
              de entregas com um Kanban visual e intuitivo.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard
                icon={ListTodo}
                title="Kanban de Tarefas"
                description="Arraste e solte tarefas entre colunas. Visualize o andamento de cada demanda."
                gradient="bg-gradient-to-br from-purple-500 to-pink-600"
                delay={0}
              />
              <FeatureCard
                icon={Clock}
                title="SLA e Urgência"
                description="Defina prazos, prioridades e receba alertas de tarefas atrasadas."
                gradient="bg-gradient-to-br from-orange-500 to-red-600"
                delay={0.1}
              />
              <FeatureCard
                icon={Users}
                title="Atribuição"
                description="Delegue tarefas para membros da equipe com notificações automáticas."
                gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
                delay={0.2}
              />
            </div>
          </div>
        </div>
      </section>

      {/* SAC Section */}
      <section id="sac" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Headphones className="h-3 w-3 mr-2" />
              Sistema de SAC
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              SAC completo e <GradientText>categorizado</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Reclamações, dúvidas, solicitações e financeiro. Tudo categorizado, 
              priorizado e com SLA de resposta.
            </p>

            <div className="grid md:grid-cols-4 gap-4">
              {[
                { icon: AlertCircle, label: "Reclamações", color: "from-red-500 to-rose-600" },
                { icon: HelpCircle, label: "Dúvidas", color: "from-blue-500 to-cyan-600" },
                { icon: FileText, label: "Solicitações", color: "from-purple-500 to-pink-600" },
                { icon: DollarSign, label: "Financeiro", color: "from-green-500 to-emerald-600" },
              ].map(({ icon: Icon, label, color }, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="pt-6 text-center">
                    <div className={cn("w-12 h-12 mx-auto rounded-xl bg-gradient-to-br flex items-center justify-center mb-3", color)}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <p className="font-medium">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pós-Venda Section */}
      <section id="pos-venda" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
              <HeartHandshake className="h-3 w-3 mr-2" />
              Pós venda automático
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pós-venda que <GradientText>fideliza clientes</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Acompanhamento automatizado após a venda. Pesquisa de satisfação, 
              lembretes de recompra e suporte proativo.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard
                icon={HeartHandshake}
                title="Kanban de Acompanhamento"
                description="Visualize cada cliente na jornada pós-venda com etapas customizáveis."
                gradient="bg-gradient-to-br from-green-500 to-emerald-600"
                delay={0}
              />
              <FeatureCard
                icon={ThumbsUp}
                title="Pesquisa de Satisfação"
                description="Envio automático de NPS após a entrega. Identifique promotores e detratores."
                gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
                delay={0.1}
              />
              <FeatureCard
                icon={Repeat}
                title="Recompra Automática"
                description="Calcule quando o cliente vai precisar novamente e sugira a recompra."
                gradient="bg-gradient-to-br from-purple-500 to-pink-600"
                delay={0.2}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Robôs IA Section */}
      <section id="robos" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Bot className="h-3 w-3 mr-2" />
              Crie seu time de robôs de IA
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Crie <GradientText>colaboradores virtuais</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Robôs com personalidade, sotaque regional, gírias e comportamento customizável.
              Eles entendem áudio, imagens e texto. Atendimento 24/7 sem custo de folha.
            </p>
          </div>

          <div className="max-w-5xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-8">
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
          </div>
        </div>
      </section>

      {/* Robôs com Áudio Section */}
      <section id="audio" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 border-purple-500/50 text-purple-600 bg-purple-50">
                  <Mic className="h-3 w-3 mr-2" />
                  Até mesmo que gravam áudios
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Robôs que <GradientText>respondem por áudio</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Configure a probabilidade de resposta por áudio. Seu robô pode gravar 
                  mensagens de voz humanizadas, aumentando a conexão com o cliente.
                </p>

                <div className="space-y-4">
                  {[
                    { icon: Mic, text: "Transcrição automática de áudios do cliente" },
                    { icon: Volume2, text: "Resposta por áudio com voz humanizada" },
                    { icon: Gauge, text: "Probabilidade configurável (0-100%)" },
                    { icon: Sparkles, text: "Vozes masculinas e femininas" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-purple-600" />
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
                <Card className="overflow-hidden shadow-2xl bg-gray-900">
                  <div className="p-4 space-y-4">
                    <div className="flex justify-end">
                      <div className="bg-green-600 text-white rounded-lg rounded-tr-none px-3 py-2 max-w-[85%]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <Mic className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="h-4 flex items-center gap-1">
                              {[...Array(12)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className="w-1 bg-white/60 rounded-full"
                                  style={{ height: `${Math.random() * 12 + 4}px` }}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-white/70 mt-1">0:15</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <div className="bg-gray-700 text-white rounded-lg rounded-tl-none px-3 py-2 max-w-[85%]">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="h-4 flex items-center gap-1">
                              {[...Array(15)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className="w-1 bg-primary/60 rounded-full"
                                  style={{ height: `${Math.random() * 14 + 4}px` }}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">0:23</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 italic">Robô respondendo por áudio</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Times de Robôs Section */}
      <section id="equipe" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-4 border-blue-500/50 text-blue-600 bg-blue-50">
                <Network className="h-3 w-3 mr-2" />
                E que trabalham em equipe
              </Badge>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Vários robôs trabalhando <GradientText>em equipe</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Crie <strong>times de robôs</strong> onde cada um é especialista em algo. 
                  Um "Maestro" recebe a conversa e roteia para o especialista certo baseado em regras de negócio.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { icon: Route, text: "Robô Maestro como URA inteligente" },
                    { icon: Target, text: "Robôs especialistas por área (vendas, suporte, etc)" },
                    { icon: Workflow, text: "Regras de ativação por intenção do cliente" },
                    { icon: Repeat, text: "Troca dinâmica entre robôs na mesma conversa" },
                    { icon: Settings, text: "Ativação por palavras-chave customizáveis" },
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

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      Time: Atendimento Completo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Maestro (Recepção)</p>
                        <p className="text-xs text-muted-foreground">Robô inicial - identifica intenção</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <ShoppingCart className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Vendedor Virtual</p>
                        <p className="text-xs text-muted-foreground">Ativado por: "quero comprar", "preço"</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">Suporte Técnico</p>
                        <p className="text-xs text-muted-foreground">Ativado por: "problema", "não funciona"</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Escolha sua IA Section */}
      <section id="escolha-ia" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-4">
                <Cpu className="h-3 w-3 mr-2" />
                Escolha a IA que combina com você
              </Badge>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
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
              >
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

      {/* NPS Section */}
      <section id="nps" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
              <ThumbsUp className="h-3 w-3 mr-2" />
              Sistema de NPS no WhatsApp
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pesquisa de satisfação <GradientText>automática</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Após o encerramento de cada conversa, envie automaticamente uma pesquisa de satisfação 
              por WhatsApp. Identifique promotores, neutros e detratores.
            </p>

            <div className="flex justify-center gap-8">
              {[
                { icon: Smile, label: "Promotores", color: "text-green-500" },
                { icon: Meh, label: "Neutros", color: "text-yellow-500" },
                { icon: Frown, label: "Detratores", color: "text-red-500" },
              ].map(({ icon: Icon, label, color }, i) => (
                <div key={i} className="text-center">
                  <Icon className={cn("h-16 w-16 mx-auto mb-2", color)} />
                  <p className="font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Assistente Virtual Section */}
      <section id="assistente" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Heart className="h-3 w-3 mr-2" />
              Tudo com uma assistente virtual
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              A <GradientText>Donna</GradientText> está sempre presente
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Dentro do sistema, a Donna ajuda sua equipe com dúvidas, sugestões e dicas em tempo real.
              Aprenda a usar o CRM conversando com ela.
            </p>

            <div className="grid md:grid-cols-4 gap-4">
              {[
                { icon: HelpCircle, text: "Tira dúvidas sobre o sistema" },
                { icon: Brain, text: "Sugere ações baseadas no contexto" },
                { icon: GraduationCap, text: "Ensina sua equipe a usar o CRM" },
                { icon: Clock, text: "Disponível 24/7" },
              ].map(({ icon: Icon, text }, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="pt-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Integrações Section */}
      <section id="integracoes" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Webhook className="h-3 w-3 mr-2" />
              Conecte tudo
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Integrações via <GradientText>Webhook</GradientText>
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
          </div>
        </div>
      </section>

      {/* E-commerce Section */}
      <section id="ecommerce" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Store className="h-3 w-3 mr-2" />
              E-commerce ou landing page feito por IA
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Sites de alta conversão <GradientText>gerados por IA</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Crie landing pages e lojas virtuais automaticamente. Tudo integrado: 
              <strong> leads entram no CRM, vendas no ERP, emite NF-e e gera etiqueta</strong>. Zero retrabalho.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={LayoutTemplate}
              title="Landing Pages por IA"
              description="Páginas de alta conversão criadas em minutos. Copy, design e estrutura otimizados automaticamente."
              gradient="bg-gradient-to-br from-purple-500 to-pink-600"
              delay={0}
            />
            <FeatureCard
              icon={ShoppingCart}
              title="E-commerce Completo"
              description="Carrinho, checkout, pagamento integrado. Cada venda já entra no seu ERP automaticamente."
              gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
              delay={0.1}
            />
            <FeatureCard
              icon={Target}
              title="Leads Direto no CRM"
              description="Cada acesso, cadastro ou compra já aparece no seu funil. Histórico completo do cliente."
              gradient="bg-gradient-to-br from-pink-500 to-rose-600"
              delay={0.2}
            />
            <FeatureCard
              icon={Receipt}
              title="NF-e Automática"
              description="Venda aprovada = nota fiscal emitida. Sem precisar fazer nada manualmente."
              gradient="bg-gradient-to-br from-orange-500 to-red-600"
              delay={0.3}
            />
            <FeatureCard
              icon={Truck}
              title="Etiquetas de Envio"
              description="Integração com Correios e Melhor Envio. Etiqueta gerada e enviada ao cliente automaticamente."
              gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
              delay={0.4}
            />
            <FeatureCard
              icon={RefreshCw}
              title="Recuperação Automática"
              description="Email e WhatsApp recuperam carrinhos abandonados. Robôs de IA fazem o follow-up por você."
              gradient="bg-gradient-to-br from-green-500 to-emerald-600"
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Quiz Section */}
      <section id="quiz" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-4 border-orange-500/50 text-orange-600 bg-orange-50">
                <Puzzle className="h-3 w-3 mr-2" />
                Quiz de qualificação integrado com CRM
              </Badge>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Qualifique leads <GradientText>antes de vender</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Crie quizzes interativos que qualificam leads automaticamente. 
                  Só chegam ao seu time os clientes realmente interessados.
                </p>

                <div className="space-y-4">
                  {[
                    { icon: ClipboardCheck, text: "Perguntas de qualificação personalizáveis" },
                    { icon: Target, text: "Score automático de cada lead" },
                    { icon: Route, text: "Roteamento para vendedor certo" },
                    { icon: BarChart3, text: "Analytics de conversão do quiz" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-orange-600" />
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
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                    <CardTitle className="text-lg">Quiz: Qual produto ideal para você?</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="p-4 bg-muted rounded-xl">
                      <p className="font-medium mb-3">1. Qual seu objetivo principal?</p>
                      <div className="space-y-2">
                        <div className="p-2 bg-primary/10 border border-primary rounded-lg text-sm">✓ Emagrecer</div>
                        <div className="p-2 bg-card border rounded-lg text-sm">Ganhar massa</div>
                        <div className="p-2 bg-card border rounded-lg text-sm">Mais energia</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Pergunta 1 de 5</span>
                      <div className="flex-1 mx-4 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="w-1/5 h-full bg-primary rounded-full" />
                      </div>
                      <span>20%</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Tracker Section */}
      <section id="tracker" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Target className="h-3 w-3 mr-2" />
              Tracker Facebook, Google
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Rastreamento de conversões <GradientText>integrado</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Pixel do Facebook e Google Ads configurados automaticamente. 
              Rastreie cada lead, carrinho e venda para otimizar suas campanhas.
            </p>

            <div className="flex justify-center gap-8">
              <Card className="p-6">
                <div className="w-16 h-16 mx-auto rounded-xl bg-blue-500 flex items-center justify-center mb-4">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <p className="font-medium">Facebook Pixel</p>
              </Card>
              <Card className="p-6">
                <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-r from-blue-500 via-green-500 to-yellow-500 flex items-center justify-center mb-4">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <p className="font-medium">Google Ads</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Email Marketing Section */}
      <section id="email-marketing" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Mail className="h-3 w-3 mr-2" />
              Email Marketing inteligente
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Email Marketing <GradientText>gerido por IA</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Robôs de IA escrevem e enviam suas campanhas. Segmentação automática, 
              copy persuasivo e timing perfeito. Você só aprova.
            </p>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: Brain, text: "IA escreve emails persuasivos" },
                { icon: Users, text: "Segmentação automática de lista" },
                { icon: Clock, text: "Envio no melhor horário" },
                { icon: BarChart3, text: "Analytics de abertura e cliques" },
                { icon: Repeat, text: "Sequências de nutrição automáticas" },
                { icon: Target, text: "A/B testing automático" },
              ].map(({ icon: Icon, text }, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="pt-6 text-center">
                    <Icon className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                    <p className="text-sm">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp Marketing Section */}
      <section id="whatsapp-marketing" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
              <Megaphone className="h-3 w-3 mr-2" />
              WhatsApp Marketing
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              WhatsApp Marketing <GradientText>gerido por IA</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Campanhas de WhatsApp criadas e disparadas por robôs. 
              Segmentação por comportamento, recuperação de vendas e follow-up automático.
            </p>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: Bot, text: "Robôs criam campanhas de WhatsApp" },
                { icon: Target, text: "Disparo segmentado por comportamento" },
                { icon: Volume2, text: "Mensagens de texto e áudio" },
                { icon: RefreshCw, text: "Recuperação de vendas abandonadas" },
                { icon: CheckCircle2, text: "Follow-up automático pós-venda" },
                { icon: BarChart3, text: "Analytics de engajamento" },
              ].map(({ icon: Icon, text }, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="pt-6 text-center">
                    <Icon className="h-8 w-8 mx-auto mb-3 text-green-600" />
                    <p className="text-sm">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WhatsApp Multi-Instância Section */}
      <section id="whatsapp-multi" className="py-20 md:py-32 bg-gradient-to-b from-green-50/50 to-background dark:from-green-950/20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                <Users className="h-3 w-3 mr-2" />
                WhatsApp multi agente e multi instância
              </Badge>
            </div>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  <GradientText>Múltiplas instâncias</GradientText> de WhatsApp
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Conecte vários números de WhatsApp. Cada instância pode ter seu próprio robô, 
                  configurações e equipe de atendentes. Tudo centralizado em um só lugar.
                </p>

                <div className="space-y-4">
                  {[
                    { icon: Phone, text: "Múltiplos números conectados simultaneamente" },
                    { icon: Users, text: "Equipes diferentes por instância" },
                    { icon: Bot, text: "Robô específico para cada número" },
                    { icon: Settings, text: "Configurações independentes" },
                    { icon: MessageCircle, text: "Transferência entre atendentes" },
                    { icon: BarChart3, text: "Métricas por instância" },
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
                <Card className="overflow-hidden shadow-2xl">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Central de WhatsApp
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {[
                      { name: "Vendas", number: "+55 11 9xxxx-1234", status: "online", messages: 23 },
                      { name: "Suporte", number: "+55 11 9xxxx-5678", status: "online", messages: 12 },
                      { name: "SAC", number: "+55 21 9xxxx-9012", status: "online", messages: 8 },
                    ].map((instance, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{instance.name}</p>
                          <p className="text-xs text-muted-foreground">{instance.number}</p>
                        </div>
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          {instance.messages} novas
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Tipos de Robôs Section */}
      <section id="tipos-robos" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <Badge variant="outline" className="mb-4">
              <Settings className="h-3 w-3 mr-2" />
              Com dezenas de tipos de robôs
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Robôs para <GradientText>cada necessidade</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
              Personalize cada aspecto do seu robô: idade, personalidade, tom de voz, 
              tamanho das respostas, sotaque regional e muito mais.
            </p>

            <div className="grid md:grid-cols-4 gap-4">
              {[
                { icon: ShoppingCart, label: "Vendedor" },
                { icon: Wrench, label: "Suporte" },
                { icon: Phone, label: "SAC" },
                { icon: ClipboardCheck, label: "Qualificador" },
                { icon: Calendar, label: "Agendador" },
                { icon: Receipt, label: "Financeiro" },
                { icon: Package, label: "Rastreio" },
                { icon: Heart, label: "Pós-venda" },
              ].map(({ icon: Icon, label }, i) => (
                <Card key={i} className="overflow-hidden hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-medium">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Depoimentos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              O que nossos clientes <GradientText>dizem</GradientText>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <TestimonialCard
              name="Mariana Costa"
              role="Clínica de Estética"
              company=""
              quote="A secretária IA mudou minha vida. Agora cadastro leads por áudio enquanto dirijo. Simplesmente funciona!"
              avatar="MC"
            />
            <TestimonialCard
              name="Amanda Pimentel"
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
      <section id="precos" className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Investimento que <GradientText>se paga</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Quanto custa um lead esquecido? Uma venda perdida por falta de follow-up?
              O Morphews custa menos que um café por dia.
            </p>

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
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className={cn(
                          "w-full",
                          isPro 
                            ? "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90" 
                            : ""
                        )}
                        variant={isPro ? "default" : "outline"}
                        onClick={() => handleSelectPlan(plan.id, plan.name, plan)}
                        disabled={createCheckout.isPending}
                      >
                        {createCheckout.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : plan.price_cents === 0 ? (
                          "Começar Grátis"
                        ) : (
                          "Escolher Plano"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Enterprise */}
          <div className="max-w-2xl mx-auto mt-12">
            <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-2 border-dashed border-primary/30">
              <CardContent className="py-8 text-center">
                <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Precisa de mais?</h3>
                <p className="text-muted-foreground mb-4">
                  Planos Enterprise com instâncias ilimitadas, usuários ilimitados e suporte dedicado.
                </p>
                <Button 
                  variant="outline" 
                  asChild
                  className="border-primary text-primary hover:bg-primary hover:text-white"
                >
                  <a href={whatsappConsultorLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Falar com Consultor
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <img src="/favicon.jpg" alt="Morphews" className="h-5 w-5 rounded" />
              </div>
              <span className="font-bold">Morphews</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Morphews. Todos os direitos reservados.
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
            <DialogTitle className="text-center">
              Quase lá! 🎉
            </DialogTitle>
            <DialogDescription className="text-center">
              Preencha seus dados para continuar com o plano <strong>{selectedPlan?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="(00) 00000-0000"
                value={leadForm.whatsapp}
                onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
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
                Continuar para o Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
