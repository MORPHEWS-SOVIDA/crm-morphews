import { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  Check, Zap, Crown, Rocket, Loader2, Star, Phone, ArrowRight, MessageCircle, 
  Sparkles, Shield, Clock, Mic, Bot, Play, Users, Target, BarChart3, 
  CheckCircle2, Headphones, FileText, Brain, Kanban, ClipboardCheck, 
  UserCheck, MessageSquare, Volume2, Bell, Menu, X, Heart, Award,
  ListTodo, HeartHandshake, AlertCircle, HelpCircle, DollarSign,
  Timer, AudioLines, ImageIcon, Building2, GraduationCap, ShoppingCart, 
  Wrench, Cpu, ThumbsUp, Smile, Frown, Meh, LucideIcon
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
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import donnaAvatar from "@/assets/donna-avatar.png";

export interface NicheConfig {
  slug: string;
  title: string;
  subtitle: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  painPoints: string[];
  benefits: { icon: LucideIcon; title: string; description: string }[];
  testimonial: { name: string; role: string; company: string; quote: string; avatar: string };
  ctaText: string;
  color: string; // tailwind color like "blue", "green", etc
}

// Animated counter component
const AnimatedCounter = ({ end, duration = 2, suffix = "" }: { end: number; duration?: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  return <span ref={ref}>{end.toLocaleString("pt-BR")}{suffix}</span>;
};

// Gradient text component
const GradientText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent", className)}>
    {children}
  </span>
);

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

export default function NicheLandingPage({ config }: { config: NicheConfig }) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const createCheckout = useCreateCheckout();
  const navigate = useNavigate();
  
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

  const colorClasses: Record<string, { bg: string; text: string; border: string; bgLight: string }> = {
    blue: { bg: "bg-blue-600", text: "text-blue-600", border: "border-blue-500/50", bgLight: "bg-blue-50" },
    green: { bg: "bg-green-600", text: "text-green-600", border: "border-green-500/50", bgLight: "bg-green-50" },
    purple: { bg: "bg-purple-600", text: "text-purple-600", border: "border-purple-500/50", bgLight: "bg-purple-50" },
    orange: { bg: "bg-orange-600", text: "text-orange-600", border: "border-orange-500/50", bgLight: "bg-orange-50" },
    red: { bg: "bg-red-600", text: "text-red-600", border: "border-red-500/50", bgLight: "bg-red-50" },
    cyan: { bg: "bg-cyan-600", text: "text-cyan-600", border: "border-cyan-500/50", bgLight: "bg-cyan-50" },
    pink: { bg: "bg-pink-600", text: "text-pink-600", border: "border-pink-500/50", bgLight: "bg-pink-50" },
    amber: { bg: "bg-amber-600", text: "text-amber-600", border: "border-amber-500/50", bgLight: "bg-amber-50" },
    indigo: { bg: "bg-indigo-600", text: "text-indigo-600", border: "border-indigo-500/50", bgLight: "bg-indigo-50" },
    teal: { bg: "bg-teal-600", text: "text-teal-600", border: "border-teal-500/50", bgLight: "bg-teal-50" },
    rose: { bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-500/50", bgLight: "bg-rose-50" },
    emerald: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-500/50", bgLight: "bg-emerald-50" },
    slate: { bg: "bg-slate-600", text: "text-slate-600", border: "border-slate-500/50", bgLight: "bg-slate-50" },
  };

  const colors = colorClasses[config.color] || colorClasses.blue;

  const handleSelectPlan = (planId: string, planName: string, plan?: any) => {
    if (user) {
      if (plan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual ? plan.atomicpay_annual_url : plan.atomicpay_monthly_url;
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
      toast({ title: "Preencha todos os campos", variant: "destructive" });
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
        source: `niche_${config.slug}`,
      });

      setShowLeadModal(false);

      if (selectedPlan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual ? selectedPlan.atomicpay_annual_url : selectedPlan.atomicpay_monthly_url;
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
          cancelUrl: window.location.href,
          billingCycle: isAnnual ? 'annual' : 'monthly',
        },
      });

      if (checkoutError) throw checkoutError;
      if (data?.error) throw new Error(data.error);
      if (data?.success) {
        toast({ title: "Conta criada com sucesso! 🎉" });
        navigate(`/signup-success?email=${encodeURIComponent(leadForm.email.trim())}`);
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      toast({ title: "Erro ao processar", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const getAnnualPrice = (monthlyCents: number) => Math.round(monthlyCents * 0.6);
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const getPlanFeatures = (planName: string) => {
    const name = planName.toLowerCase();
    if (name === "start" || name === "starter") return ["1 usuário", "100 leads", "1 instância WhatsApp", "SAC integrado", "Funil de vendas visual"];
    if (name === "growth") return ["3 usuários", "1.000 leads", "2 Robôs WhatsApp", "Follow-up com IA", "Mensagens automáticas"];
    if (name === "pro") return ["10 usuários", "10.000 leads", "3 instâncias WhatsApp", "Robôs ilimitados", "Integrações webhook"];
    return ["Recursos personalizados"];
  };

  const whatsappConsultorLink = `https://wa.me/555130760116?text=${encodeURIComponent(`Vim da página ${config.title} e quero saber mais`)}`;

  if (plansLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/2026" className="flex items-center gap-2">
              <img src="/favicon.jpg" alt="Morphews" className="h-8 w-8 rounded" />
              <span className="font-bold text-xl">Morphews</span>
            </Link>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Button asChild><Link to="/">Acessar Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
                  <Button onClick={() => scrollToSection("precos")} className={colors.bg}>Começar Agora</Button>
                </>
              )}
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="md:hidden border-t bg-background">
            <div className="container mx-auto px-4 py-4 space-y-2">
              {user ? (
                <Button asChild className="w-full"><Link to="/">Acessar Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="outline" asChild className="w-full"><Link to="/login">Entrar</Link></Button>
                  <Button onClick={() => scrollToSection("precos")} className={cn("w-full", colors.bg)}>Começar Agora</Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Badge variant="outline" className={cn("mb-6 px-4 py-1.5 text-sm", colors.border, colors.text, colors.bgLight)}>
                <Sparkles className="h-4 w-4 mr-2" />
                {config.subtitle}
              </Badge>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              {config.heroTitle}
              <br />
              <span className={colors.text}>{config.heroHighlight}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              {config.heroDescription}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => scrollToSection("precos")} className={cn("text-lg h-14 px-8 shadow-xl", colors.bg)}>
                {config.ctaText}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg h-14 px-8">
                <a href={whatsappConsultorLink} target="_blank" rel="noopener noreferrer">
                  <Phone className="mr-2 h-5 w-5" /> Falar com Consultor
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Pain Points */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Você está cansado de...</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {config.painPoints.map((pain, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 p-4 bg-card border rounded-xl">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <span>{pain}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">A Solução</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Com o Morphews você terá</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {config.benefits.map(({ icon: Icon, title, description }, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", colors.bg)}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Highlight */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4"><Bot className="h-3 w-3 mr-2" />Automação Inteligente</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Robôs que atendem <span className={colors.text}>por você</span></h2>
              <p className="text-lg text-muted-foreground mb-8">Atendimento 24/7 com IA que entende áudio, imagens e texto. Qualifica leads, responde dúvidas e até fala por áudio!</p>
              <div className="space-y-3">
                {[
                  { icon: Mic, text: "Transcrição de áudio automática" },
                  { icon: ImageIcon, text: "Leitura de imagens e documentos" },
                  { icon: AudioLines, text: "Respostas por áudio natural" },
                  { icon: Cpu, text: "Escolha entre GPT-5 e Gemini" },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors.bgLight)}>
                      <Icon className={cn("h-4 w-4", colors.text)} />
                    </div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative flex justify-center">
              <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-primary/20 shadow-2xl">
                <img src={donnaAvatar} alt="Donna - Assistente IA" className="w-full h-full object-cover" />
              </div>
              <FloatingElement delay={0} className="absolute -top-4 -right-4">
                <div className={cn("text-white px-3 py-1.5 rounded-full text-sm shadow-lg", colors.bg)}>🤖 IA 24/7</div>
              </FloatingElement>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-3xl mx-auto border-0 bg-gradient-to-br from-card to-muted/50">
            <CardContent className="pt-8 text-center">
              <div className="flex gap-1 justify-center mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />)}
              </div>
              <p className="text-xl mb-6 italic">"{config.testimonial.quote}"</p>
              <div className="flex items-center justify-center gap-3">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-bold", colors.bg)}>
                  {config.testimonial.avatar}
                </div>
                <div className="text-left">
                  <p className="font-semibold">{config.testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{config.testimonial.role} {config.testimonial.company && `• ${config.testimonial.company}`}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Planos</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Investimento que <GradientText>se paga</GradientText></h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">Quanto custa um cliente perdido por falta de follow-up?</p>
            <div className="inline-flex items-center gap-4 bg-card border rounded-full px-6 py-3">
              <span className={cn("text-sm font-medium", !isAnnual && "text-primary")}>Mensal</span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span className={cn("text-sm font-medium flex items-center gap-2", isAnnual && "text-primary")}>
                Anual <Badge className="bg-green-500 text-white text-xs">40% OFF</Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans?.slice(0, 3).map((plan, index) => {
              const isPro = plan.name.toLowerCase() === "pro";
              const displayPrice = isAnnual && plan.price_cents > 0 ? getAnnualPrice(plan.price_cents) : plan.price_cents;
              const features = getPlanFeatures(plan.name);
              
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                  <Card className={cn("relative h-full flex flex-col", isPro && "border-primary shadow-xl")}>
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"><Crown className="h-3 w-3 mr-1" />RECOMENDADO</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="mt-4">
                        {isAnnual && plan.price_cents > 0 && <div className="text-sm text-muted-foreground line-through">{formatPrice(plan.price_cents)}/mês</div>}
                        <span className="text-4xl font-bold">{formatPrice(displayPrice)}</span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button className={cn("w-full", isPro && colors.bg)} variant={isPro ? "default" : "outline"} onClick={() => handleSelectPlan(plan.id, plan.name, plan)}>
                        Contratar
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="max-w-xl mx-auto mt-8 text-center">
            <div className="inline-flex items-center gap-3 bg-card border rounded-full px-6 py-3">
              <Shield className="h-5 w-5 text-primary" />
              <span><strong>Garantia de 7 dias.</strong> Não gostou? Devolvemos seu dinheiro.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Pronto para transformar seu negócio?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => scrollToSection("precos")} className={cn("text-lg h-14 px-8", colors.bg)}>
              Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg h-14 px-8">
              <a href={whatsappConsultorLink} target="_blank"><Phone className="mr-2 h-5 w-5" />Falar com Consultor</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Morphews" className="h-6 w-6 rounded" />
            <span className="font-bold">Morphews</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Morphews. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Lead Modal */}
      <Dialog open={showLeadModal} onOpenChange={setShowLeadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              <div className={cn("w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center", colors.bg)}>
                <Rocket className="h-8 w-8 text-white" />
              </div>
              Quase lá! 🚀
            </DialogTitle>
            <DialogDescription className="text-center">
              Preencha seus dados para ativar o plano <strong>{selectedPlan?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input id="name" placeholder="Seu nome" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input id="whatsapp" placeholder="(00) 00000-0000" value={leadForm.whatsapp} onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleLeadSubmit} disabled={isSubmitting} className={cn("w-full", colors.bg)}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : <>Continuar para Pagamento<ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
