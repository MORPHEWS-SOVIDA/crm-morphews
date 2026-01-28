import { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  Check, Zap, Rocket, Loader2, ArrowRight, MessageCircle, 
  Sparkles, Shield, Bot, ChevronRight, Play, 
  Brain, Menu, X, Mail, Package, FileText,
  ShoppingCart, Puzzle, Store, LayoutTemplate, RefreshCw,
  Phone, Webhook, Send, Clock, Users
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

// Feature Section Card
const FeatureSection = ({ 
  badge, 
  title, 
  description, 
  features, 
  icon: Icon,
  gradient,
  reverse = false 
}: { 
  badge: string;
  title: React.ReactNode;
  description: string;
  features: { icon: React.ElementType; title: string; description: string }[];
  icon: React.ElementType;
  gradient: string;
  reverse?: boolean;
}) => (
  <section className="py-16 md:py-24">
    <div className="container mx-auto px-4">
      <div className={cn("max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center", reverse && "lg:grid-flow-col-dense")}>
        <motion.div
          initial={{ opacity: 0, x: reverse ? 30 : -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className={reverse ? "lg:col-start-2" : ""}
        >
          <Badge variant="outline" className="mb-4">
            <Icon className="h-3 w-3 mr-2" />
            {badge}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
          <p className="text-lg text-muted-foreground mb-8">{description}</p>
          
          <div className="space-y-4">
            {features.map(({ icon: FIcon, title, description }, i) => (
              <div key={i} className="flex gap-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", gradient)}>
                  <FIcon className="h-5 w-5 text-white" />
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
          initial={{ opacity: 0, x: reverse ? -30 : 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className={cn("relative flex justify-center", reverse ? "lg:col-start-1" : "")}
        >
          <div className={cn("w-32 h-32 md:w-48 md:h-48 rounded-3xl flex items-center justify-center shadow-2xl", gradient)}>
            <Icon className="h-16 w-16 md:h-24 md:w-24 text-white" />
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default function SalesLanding() {
  const { user } = useAuth();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const createCheckout = useCreateCheckout();
  const navigate = useNavigate();
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [leadForm, setLeadForm] = useState({ name: "", whatsapp: "", email: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const handleSelectPlan = (plan: any) => {
    if (user) {
      if (plan?.payment_provider === "atomicpay") {
        const checkoutUrl = isAnnual ? plan.atomicpay_annual_url : plan.atomicpay_monthly_url;
        if (checkoutUrl) { window.location.href = checkoutUrl; return; }
      }
      createCheckout.mutate({ planId: plan.id, mode: 'new' });
    } else {
      setSelectedPlan(plan);
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

      const { data } = await supabase.functions.invoke("create-checkout", {
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
      
      if (data?.success) {
        navigate(`/signup-success?email=${encodeURIComponent(leadForm.email.trim())}`);
        return;
      }
      if (data?.url) { window.location.href = data.url; }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const getAnnualPrice = (monthlyCents: number) => Math.round(monthlyCents * 0.6);

  const whatsappLink = `https://wa.me/555130760116?text=${encodeURIComponent("Vim do site crm.morphews.com/sales e quero saber mais")}`;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
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
              <button onClick={() => scrollToSection("ecommerce")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                E-commerce
              </button>
              <button onClick={() => scrollToSection("automacoes")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Automações
              </button>
              <button onClick={() => scrollToSection("precos")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Button asChild><Link to="/">Acessar Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
                  <Button onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-primary to-purple-600">
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
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="md:hidden border-t bg-background">
            <div className="container mx-auto px-4 py-4 space-y-3">
              <button onClick={() => scrollToSection("robos")} className="block w-full text-left py-2">Robôs IA</button>
              <button onClick={() => scrollToSection("ecommerce")} className="block w-full text-left py-2">E-commerce</button>
              <button onClick={() => scrollToSection("automacoes")} className="block w-full text-left py-2">Automações</button>
              <button onClick={() => scrollToSection("precos")} className="block w-full text-left py-2">Preços</button>
              <div className="pt-4 border-t space-y-2">
                {!user && <Button variant="outline" asChild className="w-full"><Link to="/login">Entrar</Link></Button>}
                <Button onClick={() => scrollToSection("precos")} className="w-full bg-gradient-to-r from-primary to-purple-600">Começar</Button>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* Hero Section */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm border-primary/50">
                <Bot className="h-4 w-4 mr-2 text-primary" />
                Robôs + IA + Automação Total
              </Badge>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              Robôs que vão fazer
              <br />
              <GradientText>sua empresa vender mais</GradientText>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-4">
              <strong className="text-foreground">Tudo em um único lugar</strong>
            </motion.p>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              E-commerce com IA, Quiz de qualificação, Landing Pages automáticas, 
              Email Marketing inteligente, WhatsApp Marketing, NF-e e etiquetas automáticas.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-primary to-purple-600 text-lg h-14 px-8 shadow-xl shadow-primary/25">
                Automatizar Meu Negócio
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollToSection("robos")} className="text-lg h-14 px-8">
                Ver Como Funciona
                <Play className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {[
                { value: "24/7", label: "Robôs ativos" },
                { value: "0", label: "Leads esquecidos" },
                { value: "100%", label: "Automatizado" },
                { value: "∞", label: "Escalabilidade" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

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
      </motion.section>

      {/* CRM Section */}
      <section id="robos" className="py-16 md:py-24 bg-muted/30">
        <FeatureSection
          badge="Gestão de Leads Completa"
          title={<>CRM que sua equipe <GradientText>vai usar de verdade</GradientText></>}
          description="Funil visual, Kanban, histórico completo, gestão de vendedores e muito mais. Tudo integrado com WhatsApp e automações."
          icon={Users}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
          features={[
            { icon: Webhook, title: "Funil Visual", description: "Veja todos os leads em um funil intuitivo" },
            { icon: MessageCircle, title: "WhatsApp Integrado", description: "Converse direto pelo CRM" },
            { icon: Brain, title: "IA Assistente", description: "Sugestões de follow-up automáticas" },
          ]}
        />
      </section>

      {/* E-commerce & Landing Pages */}
      <section id="ecommerce" className="py-16 md:py-24">
        <FeatureSection
          badge="E-commerce & Landing Pages"
          title={<>Sites de alta conversão <GradientText>gerados por IA</GradientText></>}
          description="Crie landing pages e lojas virtuais automaticamente. A IA gera copy, design e estrutura otimizada para converter."
          icon={Store}
          gradient="bg-gradient-to-br from-purple-500 to-pink-600"
          reverse
          features={[
            { icon: LayoutTemplate, title: "Landing Pages por IA", description: "Páginas de alta conversão criadas em minutos" },
            { icon: ShoppingCart, title: "E-commerce Completo", description: "Carrinho, checkout, pagamento integrado" },
            { icon: RefreshCw, title: "Recuperação Automática", description: "Email e WhatsApp recuperam carrinhos abandonados" },
          ]}
        />
      </section>

      {/* Quiz System */}
      <section className="py-16 md:py-24 bg-muted/30">
        <FeatureSection
          badge="Qualificação Inteligente"
          title={<>Quiz interativo para <GradientText>qualificar leads</GradientText></>}
          description="Crie quizzes personalizados que qualificam leads automaticamente antes de chegarem ao seu time de vendas."
          icon={Puzzle}
          gradient="bg-gradient-to-br from-orange-500 to-red-600"
          features={[
            { icon: ChevronRight, title: "Fluxo Condicional", description: "Perguntas baseadas em respostas anteriores" },
            { icon: Users, title: "Lead Scoring", description: "Pontuação automática de cada lead" },
            { icon: Webhook, title: "Integração CRM", description: "Dados direto no perfil do lead" },
          ]}
        />
      </section>

      {/* Email Marketing */}
      <section id="automacoes" className="py-16 md:py-24">
        <FeatureSection
          badge="Email Marketing IA"
          title={<>Emails escritos e enviados <GradientText>por robôs</GradientText></>}
          description="A IA escreve, personaliza e envia emails de follow-up, recuperação e nutrição. Você define a estratégia, ela executa."
          icon={Mail}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
          reverse
          features={[
            { icon: Brain, title: "Copy Gerado por IA", description: "Textos persuasivos e personalizados" },
            { icon: Clock, title: "Cadências Automáticas", description: "Sequências de emails programadas" },
            { icon: RefreshCw, title: "Recuperação de Carrinho", description: "Emails automáticos para carrinhos abandonados" },
          ]}
        />
      </section>

      {/* WhatsApp Marketing */}
      <section className="py-16 md:py-24 bg-muted/30">
        <FeatureSection
          badge="WhatsApp Marketing IA"
          title={<>Mensagens de vendas <GradientText>no piloto automático</GradientText></>}
          description="Robôs conversam com seus leads, respondem dúvidas, fazem follow-up e fecham vendas pelo WhatsApp 24/7."
          icon={MessageCircle}
          gradient="bg-gradient-to-br from-green-500 to-emerald-600"
          features={[
            { icon: Bot, title: "Robôs Vendedores", description: "Atendimento 24h com personalidade customizada" },
            { icon: Send, title: "Disparos em Massa", description: "Campanhas segmentadas por perfil" },
            { icon: RefreshCw, title: "Follow-up Automático", description: "Nunca mais esqueça um lead" },
          ]}
        />
      </section>

      {/* NF-e & Shipping */}
      <section className="py-16 md:py-24">
        <FeatureSection
          badge="Operação Automatizada"
          title={<>Nota fiscal e envio <GradientText>100% automático</GradientText></>}
          description="Emita NF-e, gere etiquetas Correios/Melhor Envio e notifique clientes automaticamente. Zero trabalho manual."
          icon={Package}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          reverse
          features={[
            { icon: FileText, title: "NF-e Automática", description: "Emissão integrada com a venda" },
            { icon: Package, title: "Etiquetas de Envio", description: "Correios e transportadoras integradas" },
            { icon: MessageCircle, title: "Tracking WhatsApp", description: "Cliente recebe atualizações automáticas" },
          ]}
        />
      </section>

      {/* Pricing */}
      <section id="precos" className="py-20 md:py-32 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4"><Sparkles className="h-3 w-3 mr-2" />Planos</Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Escolha o plano ideal para <GradientText>automatizar tudo</GradientText>
            </h2>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <span className={cn("text-sm", !isAnnual && "text-muted-foreground")}>Mensal</span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
              <span className={cn("text-sm", isAnnual && "text-muted-foreground")}>
                Anual <Badge variant="secondary" className="ml-1 text-green-600">-40%</Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plansLoading ? (
              <div className="col-span-3 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              plans?.filter(p => p.is_active).slice(0, 3).map((plan, index) => {
                const displayPrice = isAnnual && plan.price_cents > 0 ? getAnnualPrice(plan.price_cents) : plan.price_cents;
                const isPro = plan.name.toLowerCase().includes("pro") || plan.name.toLowerCase().includes("growth");
                
                return (
                  <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                    <Card className={cn("relative h-full flex flex-col", isPro && "border-primary shadow-xl shadow-primary/10")}>
                      {isPro && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white">Mais Popular</Badge>
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription>Plano {plan.name}</CardDescription>
                        <div className="pt-4">
                          <span className="text-4xl font-bold">{formatPrice(displayPrice)}</span>
                          <span className="text-muted-foreground">/mês</span>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <ul className="space-y-3">
                          {[
                            "Acesso ao CRM completo",
                            "Robôs de WhatsApp",
                            "Landing Pages IA",
                            "Email Marketing",
                            "Automações",
                          ].map((f, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button className={cn("w-full", isPro && "bg-gradient-to-r from-primary to-purple-600")} variant={isPro ? "default" : "outline"} onClick={() => handleSelectPlan(plan)}>
                          Começar Agora
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto mt-12 text-center">
            <div className="inline-flex items-center gap-3 bg-card border rounded-full px-6 py-3">
              <Shield className="h-6 w-6 text-primary" />
              <span><strong>Garantia de 7 dias.</strong> Não gostou? Devolvemos seu dinheiro.</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Pronto para colocar <GradientText>robôs trabalhando por você?</GradientText>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Automatize vendas, atendimento, marketing e operações. Tudo em um único lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => scrollToSection("precos")} className="bg-gradient-to-r from-primary to-purple-600 text-lg h-14 px-8 shadow-xl">
                Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg h-14 px-8" asChild>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Phone className="mr-2 h-5 w-5" /> Falar com Consultor
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Morphews" className="h-8 w-8 rounded" />
            <span className="font-bold text-xl">Morphews</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <a href="mailto:contato@morphews.com" className="hover:text-foreground">Contato</a>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Morphews</p>
        </div>
      </footer>

      {/* Lead Modal */}
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
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome completo *</Label>
              <Input placeholder="Seu nome" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <Input placeholder="(00) 00000-0000" value={leadForm.whatsapp} onChange={(e) => setLeadForm({ ...leadForm, whatsapp: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" placeholder="seu@email.com" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleLeadSubmit} disabled={isSubmitting} className="w-full bg-gradient-to-r from-primary to-purple-600">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : <>Continuar <ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
