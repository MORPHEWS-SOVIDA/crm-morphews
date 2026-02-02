import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { 
  Check, Zap, Crown, Rocket, Loader2, Star, Phone, ArrowRight, MessageCircle, 
  Sparkles, Shield, Clock, Mic, Bot, ChevronRight, Users, 
  Target, Calendar, BarChart3, TrendingUp, CheckCircle2, Headphones, 
  FileText, Settings, Webhook, Bell, Brain, Kanban, ClipboardCheck, 
  UserCheck, MessageSquare, Volume2, Eye, Globe, Cpu, Layers, Lock,
  ChevronDown, Menu, X, Heart, Flame, Award, Gauge, MousePointer,
  Workflow, ListTodo, HeartHandshake, AlertCircle, HelpCircle, DollarSign,
  Timer, Repeat, AudioLines, ImageIcon, Share2, Link2, Package,
  Building2, GraduationCap, ShoppingCart, Wrench, TrendingDown, Percent,
  ThumbsUp, ThumbsDown, Smile, Frown, Meh, Mail, Store, LayoutTemplate,
  RefreshCw, Puzzle, Receipt, Truck, Route, Network, Megaphone, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWhiteLabelBySlug } from '@/hooks/useWhiteLabel';
import { useWhiteLabelPlansByConfigId, WhiteLabelPlan } from '@/hooks/useWhiteLabelPlans';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import morphewsAvatar from "@/assets/morphews-avatar.png";

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

// Gradient text component - dynamic color
const GradientText = ({ children, className = "", primaryColor = "#8B5CF6" }: { children: React.ReactNode; className?: string; primaryColor?: string }) => (
  <span 
    className={cn("bg-clip-text text-transparent", className)}
    style={{ backgroundImage: `linear-gradient(to right, ${primaryColor}, #a855f7, #ec4899)` }}
  >
    {children}
  </span>
);

// Sales funnel visualization component
const SalesFunnel = ({ primaryColor }: { primaryColor: string }) => {
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

// Testimonial card
const TestimonialCard = ({ name, role, company, quote, avatar, primaryColor }: { name: string; role: string; company: string; quote: string; avatar: string; primaryColor: string }) => (
  <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card to-muted/50">
    <CardContent className="pt-6">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-lg mb-6 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, #9333ea)` }}
        >
          {avatar}
        </div>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{role}{company ? ` • ${company}` : ''}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Feature anchor items for the hero
const featureAnchors = [
  { id: "morphews", label: "Atualização do CRM por conversa no WhatsApp com MORPHEWS", icon: MessageCircle },
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

// Reserved slugs that should not be treated as white label pages
const RESERVED_SLUGS = [
  'login', 'forgot-password', 'reset-password', 'force-password-change', 'setup',
  'planos', 'secretaria-whatsapp', '2026', 'para', 'checkout', 'signup-success',
  'auth', 'legal', 'lp', 'helper', 'pagamento-sucesso', 'pagamento-cancelado',
  'c', 'pay', 'pix-pagamento', 'pagamento-confirmado', 'quiz', 'pagar', 't',
  'parceiro', 'convite-parceiros', 'rede', 'implementador', 'pv2', 'entrar',
  'white-admin', 'loja', 'dashboard-kanban', 'leads', 'sales', 'vendas',
  'produtos', 'expedicao', 'whatsapp', 'instagram', 'team', 'settings',
  'onboarding', 'integrations', 'demandas', 'sac', 'financial', 'receptivo',
  'ai-bots', 'fiscal', 'super-admin', 'cadastro', 'ecommerce', 'afiliado',
  'sales-landing', 'cobrar', 'produtos-custos', 'combos', 'notas-compra',
  'romaneio', 'fechamento', 'entregas', 'relatorios', 'nps', 'api-docs',
];

export default function WhiteLabelSalesPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  // Check if slug is reserved
  const isReservedSlug = slug ? RESERVED_SLUGS.includes(slug.toLowerCase()) : false;
  
  const { data: config, isLoading, error } = useWhiteLabelBySlug(isReservedSlug ? undefined : slug);
  const { data: plans, isLoading: plansLoading } = useWhiteLabelPlansByConfigId(config?.id);
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WhiteLabelPlan | null>(null);
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

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!config || error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Página não encontrada</h2>
            <p className="text-muted-foreground mb-4">
              Esta página não existe ou foi desativada.
            </p>
            <Button onClick={() => navigate('/')}>
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = config.primary_color || '#8B5CF6';
  const whatsappLink = config.support_whatsapp 
    ? `https://wa.me/${config.support_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Vim do site e quero saber mais sobre ${config.brand_name}`)}`
    : null;

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

  const handleSelectPlan = (plan: WhiteLabelPlan) => {
    // Navigate directly to checkout
    navigate(`/${slug}/checkout/${plan.slug}`);
  };

  const handleLeadSubmit = async () => {
    // Legacy - keep for quiz/contact forms if needed
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

      // Redirect to checkout instead of WhatsApp
      if (selectedPlan) {
        navigate(`/${slug}/checkout/${selectedPlan.slug}`);
      }

      setShowLeadModal(false);
      setLeadForm({ name: "", whatsapp: "", email: "" });
    } catch (error: any) {
      console.error("Error submitting lead:", error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlanFeatures = (plan: WhiteLabelPlan) => {
    const features: string[] = [];
    features.push(`${plan.max_users} usuário${plan.max_users > 1 ? 's' : ''}`);
    if (plan.max_whatsapp_instances) features.push(`${plan.max_whatsapp_instances} instância${plan.max_whatsapp_instances > 1 ? 's' : ''} WhatsApp`);
    if (plan.has_ai_bots) features.push("Robôs de IA");
    if (plan.has_whatsapp) features.push("WhatsApp integrado");
    if (plan.has_ecommerce) features.push("E-commerce");
    if (plan.has_erp) features.push("ERP completo");
    if (plan.has_nfe) features.push("Emissão de NF-e");
    if (plan.has_email_marketing) features.push("Email Marketing");
    if (plan.has_tracking) features.push("Tracking avançado");
    if (plan.max_energy_per_month) features.push(`${plan.max_energy_per_month.toLocaleString('pt-BR')} energia/mês`);
    return features;
  };

  return (
    <>
      <Helmet>
        <title>{config.brand_name} - Sistema de Vendas Inteligente</title>
        <meta name="description" content={`${config.brand_name} - CRM com WhatsApp, IA e automações para aumentar suas vendas.`} />
        {config.favicon_url && <link rel="icon" href={config.favicon_url} />}
      </Helmet>

      <div className="min-h-screen bg-background overflow-x-hidden">
        {/* Animated background elements */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: `${primaryColor}15` }} />
          <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        </div>

        {/* Navigation */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.brand_name} className="h-8" />
                ) : (
                  <span className="text-xl font-bold" style={{ color: primaryColor }}>
                    {config.brand_name}
                  </span>
                )}
              </div>

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
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Falar com consultor
                    </Button>
                  </a>
                )}
                <Link to="/login">
                  <Button variant="ghost" size="sm">Entrar</Button>
                </Link>
                <Button 
                  onClick={() => scrollToSection("precos")}
                  style={{ backgroundColor: primaryColor }}
                >
                  Começar Agora
                </Button>
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
                <Link to="/login" className="py-2">Entrar</Link>
                <Button onClick={() => scrollToSection("precos")} style={{ backgroundColor: primaryColor }} className="w-full">
                  Começar Agora
                </Button>
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
                <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm" style={{ borderColor: `${primaryColor}50` }}>
                  <Bot className="h-4 w-4 mr-2" style={{ color: primaryColor }} />
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
                <GradientText primaryColor={primaryColor}>sua empresa vender mais</GradientText>
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
                  Você já pode ter visto sistemas que têm alguma dessas funções, a <span className="font-bold" style={{ color: primaryColor }}>{config.brand_name}</span> tem tudo <span className="font-bold" style={{ color: primaryColor }}>INTEGRADO</span> em um só login e senha
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Button 
                  size="lg"
                  className="text-lg px-8"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => scrollToSection("precos")}
                >
                  Começar Agora
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="lg" className="text-lg px-8">
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Falar com consultor
                    </Button>
                  </a>
                )}
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Feature Anchors List */}
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
                    className="flex items-center gap-3 p-3 rounded-xl bg-card border hover:border-opacity-50 transition-all text-left group"
                    style={{ '--hover-border-color': primaryColor } as any}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <item.icon className="h-5 w-5" style={{ color: primaryColor }} />
                    </div>
                    <span className="text-sm font-medium transition-colors">{item.label}</span>
                    <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                  </motion.button>
                ))}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="text-center text-lg font-bold mt-8"
                style={{ color: primaryColor }}
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
                Conheça o {config.brand_name}
              </Badge>
              <h2 className="text-2xl md:text-4xl font-bold mb-6">
                Entenda como podemos <GradientText primaryColor={primaryColor}>transformar seu negócio</GradientText>
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Uma plataforma completa de automação comercial com inteligência artificial. 
                Unificamos CRM, E-commerce, WhatsApp, NF-e, etiquetas de envio e muito mais em um único sistema 
                que trabalha 24 horas por dia para você vender mais.
              </p>
            </div>
          </div>
        </section>

        {/* MORPHEWS Section */}
        <section id="morphews" className="py-20 md:py-32 bg-muted/30 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-20 left-10 w-72 h-72 rounded-full" style={{ backgroundColor: primaryColor }} />
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full" style={{ backgroundColor: primaryColor }} />
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-6xl mx-auto">
              {/* Section header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-12"
              >
                <Badge className="mb-4" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor, borderColor: primaryColor }}>
                  <Bot className="h-3 w-3 mr-2" />
                  Assistente Virtual Inteligente
                </Badge>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                  Dúvidas? <span className="block mt-2">Fale com</span>
                </h2>
                <div className="inline-block">
                  <span 
                    className="text-5xl md:text-6xl lg:text-7xl font-black bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, #a855f7, #ec4899)` }}
                  >
                    MORPHEWS
                  </span>
                </div>
              </motion.div>

              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="relative flex justify-center order-2 lg:order-1"
                >
                  <div className="relative">
                    {/* Main avatar with enhanced styling */}
                    <div 
                      className="w-72 h-72 md:w-96 md:h-96 rounded-[2rem] overflow-hidden shadow-2xl ring-4 ring-offset-4 ring-offset-background"
                      style={{ 
                        borderColor: `${primaryColor}50`,
                        boxShadow: `0 25px 60px -12px ${primaryColor}40`
                      }}
                    >
                      <img 
                        src={morphewsAvatar} 
                        alt="Morphews - Assistente Virtual" 
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    
                    {/* Floating badges */}
                    <FloatingElement delay={0} className="absolute -top-4 -right-4">
                      <div 
                        className="text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-xl flex items-center gap-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Bot className="h-4 w-4" />
                        Online 24/7
                      </div>
                    </FloatingElement>
                    
                    <FloatingElement delay={1} className="absolute -bottom-4 -left-4">
                      <div className="bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-xl flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Resposta Instantânea
                      </div>
                    </FloatingElement>

                    <FloatingElement delay={0.5} className="absolute top-1/2 -left-8 -translate-y-1/2">
                      <div className="bg-card border shadow-lg px-4 py-2 rounded-full text-sm flex items-center gap-2">
                        <Mic className="h-4 w-4 text-red-500" />
                        <span className="font-medium">Entende áudio</span>
                      </div>
                    </FloatingElement>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="order-1 lg:order-2"
                >
                  <p className="text-xl text-muted-foreground mb-8">
                    Atualize seu CRM por <strong className="text-foreground">áudio no WhatsApp</strong>. 
                    Basta falar: <em>"Morphews, cadastra o João, telefone tal, ele quer o produto X"</em>. 
                    Pronto! Lead cadastrado, etapa do funil definida.
                  </p>

                  <div className="grid gap-4 mb-8">
                    {[
                      { icon: Mic, text: "Cadastre leads por áudio enquanto dirige", highlight: true },
                      { icon: MessageCircle, text: "Atualize etapas do funil por mensagem", highlight: false },
                      { icon: Clock, text: "Agende follow-ups falando com o Morphews", highlight: false },
                      { icon: HelpCircle, text: "Tire dúvidas sobre o sistema instantaneamente", highlight: false },
                      { icon: Brain, text: "Receba sugestões inteligentes de ações", highlight: false },
                    ].map(({ icon: Icon, text, highlight }, i) => (
                      <motion.div 
                        key={i} 
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-xl transition-all",
                          highlight ? "bg-gradient-to-r from-primary/10 to-transparent" : "hover:bg-muted/50"
                        )}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" 
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: primaryColor }} />
                        </div>
                        <span className="font-medium">{text}</span>
                      </motion.div>
                    ))}
                  </div>

                  <Button 
                    size="lg" 
                    className="text-white font-bold group"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => {
                      const plansSection = document.getElementById('planos');
                      if (plansSection) plansSection.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Quero o Morphews no meu negócio
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
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
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
                          <Icon className="h-4 w-4" style={{ color: primaryColor }} />
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
                  <SalesFunnel primaryColor={primaryColor} />
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
                    NF-e e etiquetas <GradientText primaryColor={primaryColor}>100% automáticas</GradientText>
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
                    ].map(({ icon: Icon, text }, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
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

        {/* Robôs IA Section */}
        <section id="robos" className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto text-center">
              <Badge variant="outline" className="mb-4">
                <Bot className="h-3 w-3 mr-2" />
                Crie seu time de robôs de IA
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Crie colaboradores <GradientText primaryColor={primaryColor}>virtuais</GradientText>
              </h2>
              <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
                Robôs com personalidade, sotaque regional, gírias e comportamento customizável. 
                Eles entendem áudio, imagens e texto. Atendimento 24/7 sem custo de folha.
              </p>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                {[
                  { age: "18-25 anos", style: "Jovem, informal" },
                  { age: "26-35 anos", style: "Profissional, acessível" },
                  { age: "36-50 anos", style: "Formal, objetivo" },
                  { age: "50+ anos", style: "Muito formal" },
                ].map((item, i) => (
                  <Card key={i} className="text-center p-6 hover:border-opacity-50 transition-all" style={{ borderColor: i === 1 ? primaryColor : undefined }}>
                    <Bot className="h-8 w-8 mx-auto mb-3" style={{ color: primaryColor }} />
                    <p className="font-medium">{item.age}</p>
                    <p className="text-sm text-muted-foreground">{item.style}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* E-commerce Section */}
        <section id="ecommerce" className="py-20 md:py-32 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto text-center">
              <Badge variant="outline" className="mb-4">
                <Store className="h-3 w-3 mr-2" />
                E-commerce ou landing page feito por IA
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Loja ou Landing <GradientText primaryColor={primaryColor}>em minutos</GradientText>
              </h2>
              <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
                Crie lojas completas ou landing pages de alta conversão com ajuda da IA. 
                Checkout integrado, pagamentos automáticos e leads direto no CRM.
              </p>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { icon: LayoutTemplate, title: "Templates Prontos", desc: "Dezenas de modelos otimizados para conversão" },
                  { icon: Puzzle, title: "Quiz Integrado", desc: "Qualifique leads com perguntas inteligentes" },
                  { icon: Target, title: "Tracking Completo", desc: "Facebook Pixel, Google Analytics integrados" },
                ].map(({ icon: Icon, title, desc }, i) => (
                  <Card key={i} className="p-6">
                    <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${primaryColor}15` }}>
                      <Icon className="h-6 w-6" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="font-semibold mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WhatsApp Multi Section */}
        <section id="whatsapp-multi" className="py-20 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <Badge variant="outline" className="mb-4 border-green-500/50 text-green-600 bg-green-50">
                  <Phone className="h-3 w-3 mr-2" />
                  WhatsApp multi agente e multi instância
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  WhatsApp <GradientText primaryColor={primaryColor}>profissional</GradientText>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Conecte múltiplos números. Vários atendentes no mesmo número. Robôs que respondem automaticamente.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { title: "Multi-instância", desc: "Conecte vários números WhatsApp", icon: Phone },
                  { title: "Multi-agente", desc: "Vários atendentes no mesmo número", icon: Users },
                  { title: "Robôs 24/7", desc: "Automação completa de atendimento", icon: Bot },
                ].map(({ title, desc, icon: Icon }, i) => (
                  <Card key={i} className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
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
                O que nossos clientes <GradientText primaryColor={primaryColor}>dizem</GradientText>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <TestimonialCard
                name="Mariana Costa"
                role="Clínica de Estética"
                company=""
                quote="A secretária IA mudou minha vida. Agora cadastro leads por áudio enquanto dirijo. Simplesmente funciona!"
                avatar="MC"
                primaryColor={primaryColor}
              />
              <TestimonialCard
                name="Amanda Pimentel"
                role="InfoProdutora"
                company=""
                quote="Nunca mais esquecemos um follow-up. O sistema lembra tudo. Recuperamos clientes que estavam perdidos."
                avatar="AP"
                primaryColor={primaryColor}
              />
              <TestimonialCard
                name="Carlos Eduardo"
                role="Ecom de Nutraceuticos"
                company=""
                quote="Integração perfeita com nosso ERP. Vendas entram automaticamente, expedição é notificada. Zero retrabalho."
                avatar="CE"
                primaryColor={primaryColor}
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
                Investimento que <GradientText primaryColor={primaryColor}>se paga</GradientText>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Quanto custa um lead esquecido? Uma venda perdida por falta de follow-up?
              </p>

              <div className="inline-flex items-center gap-4 bg-card border rounded-full px-6 py-3">
                <span className={cn("text-sm font-medium", !isAnnual && "font-bold")} style={{ color: !isAnnual ? primaryColor : undefined }}>Mensal</span>
                <Switch
                  checked={isAnnual}
                  onCheckedChange={setIsAnnual}
                />
                <span className={cn("text-sm font-medium flex items-center gap-2", isAnnual && "font-bold")} style={{ color: isAnnual ? primaryColor : undefined }}>
                  Anual
                  <Badge className="bg-green-500 text-white text-xs">
                    40% OFF
                  </Badge>
                </span>
              </div>
            </div>

            {plansLoading ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : plans && plans.length > 0 ? (
              <div className={cn(
                "grid gap-6 max-w-6xl mx-auto",
                plans.length === 1 ? "md:grid-cols-1 max-w-md" :
                plans.length === 2 ? "md:grid-cols-2 max-w-2xl" :
                plans.length === 3 ? "md:grid-cols-3 max-w-4xl" :
                "md:grid-cols-2 lg:grid-cols-4"
              )}>
                {plans.map((plan, index) => {
                  const gradients = [
                    "from-gray-500 to-gray-600",
                    "from-blue-500 to-cyan-500",
                    "from-purple-500 to-pink-500",
                    "from-amber-500 to-orange-500",
                  ];

                  const displayPrice = isAnnual && plan.price_cents > 0 
                    ? getAnnualPrice(plan.price_cents)
                    : plan.price_cents;

                  const features = getPlanFeatures(plan);
                  const isPro = index === plans.length - 1 && plans.length > 1;
                  
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
                        isPro && "border-2 shadow-xl"
                      )} style={{ borderColor: isPro ? primaryColor : undefined }}>
                        {isPro && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge style={{ backgroundColor: primaryColor }} className="text-white">
                              <Crown className="h-3 w-3 mr-1" />
                              RECOMENDADO
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
                          {plan.description && (
                            <CardDescription>{plan.description}</CardDescription>
                          )}
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
                            className="w-full"
                            style={isPro ? { backgroundColor: primaryColor } : undefined}
                            variant={isPro ? "default" : "outline"}
                            onClick={() => handleSelectPlan(plan)}
                          >
                            {plan.price_cents === 0 ? "Começar Grátis" : "Escolher Plano"}
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Entre em contato para conhecer nossos planos.</p>
                {whatsappLink && (
                  <Button className="mt-4" style={{ backgroundColor: primaryColor }} asChild>
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Falar com Consultor
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Enterprise */}
            <div className="max-w-2xl mx-auto mt-12">
              <Card className="border-2 border-dashed" style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}05` }}>
                <CardContent className="py-8 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4" style={{ color: primaryColor }} />
                  <h3 className="text-xl font-bold mb-2">Precisa de mais?</h3>
                  <p className="text-muted-foreground mb-4">
                    Planos Enterprise com instâncias ilimitadas, usuários ilimitados e suporte dedicado.
                  </p>
                  {whatsappLink && (
                    <Button 
                      variant="outline" 
                      asChild
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Falar com Consultor
                      </a>
                    </Button>
                  )}
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
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.brand_name} className="h-6" />
                ) : (
                  <span className="font-bold" style={{ color: primaryColor }}>
                    {config.brand_name}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} {config.brand_name}. Todos os direitos reservados.
              </p>
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Suporte
                  </Button>
                </a>
              )}
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
              className="w-full"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
