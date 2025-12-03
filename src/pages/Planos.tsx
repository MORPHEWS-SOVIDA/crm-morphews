import { Check, Zap, Crown, Rocket, Users, Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSubscriptionPlans, useCreateCheckout, useCurrentSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";

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

export default function Planos() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: currentSubscription } = useCurrentSubscription();
  const createCheckout = useCreateCheckout();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("subscription") === "success") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      navigate("/login?redirect=/planos");
      return;
    }
    createCheckout.mutate(planId);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon.jpg" alt="Morphews CRM" className="h-8 w-8 rounded" />
            <span className="font-bold text-xl">Morphews CRM</span>
          </Link>
          {user ? (
            <Link to="/">
              <Button variant="outline">Voltar ao Dashboard</Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button>Entrar</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Badge variant="secondary" className="mb-4">
          Planos e Preços
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Escolha o plano ideal para seu negócio
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Comece a qualificar leads e fechar mais vendas com o Morphews CRM. Todos os planos incluem suporte e atualizações.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans?.map((plan, index) => {
            const isPro = plan.name === "Pro";
            const isCurrent = isCurrentPlan(plan.id);

            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  isPro ? "border-primary shadow-lg scale-105" : "hover:scale-102"
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
                    {plan.name === "Start" && "Para começar a organizar seus leads"}
                    {plan.name === "Pro" && "Para equipes em crescimento"}
                    {plan.name === "Ultra" && "Para operações de alta performance"}
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
                      <span className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        {plan.max_leads ? `${plan.max_leads} leads/mês` : "Leads ilimitados"}
                      </span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {plan.max_users} usuários inclusos
                      </span>
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <span>Dashboard completo</span>
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
                    Usuário adicional: {formatPrice(plan.extra_user_price_cents)}/mês
                  </p>
                </CardContent>

                <CardFooter>
                  <Button
                    className={`w-full ${isPro ? "bg-primary hover:bg-primary/90" : ""}`}
                    variant={isPro ? "default" : "outline"}
                    size="lg"
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent || createCheckout.isPending}
                  >
                    {createCheckout.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isCurrent ? "Plano Atual" : "Começar Agora"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Dúvidas Frequentes</h2>
          <div className="grid gap-6 text-left">
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
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Morphews CRM. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
