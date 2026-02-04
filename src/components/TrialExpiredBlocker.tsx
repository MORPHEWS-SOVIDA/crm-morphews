import { useIsTrialExpired } from "@/hooks/useSubscriptionStatus";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CreditCard, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TrialExpiredBlockerProps {
  children: React.ReactNode;
}

export function TrialExpiredBlocker({ children }: TrialExpiredBlockerProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isTrialExpired, isLoading, daysRemaining, isTrial, planName, trialEndsAt } = useIsTrialExpired();

  // Show loading while checking status
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in or no trial expired, render children normally
  if (!user || !isTrialExpired) {
    // Show trial banner if in active trial with few days remaining
    if (isTrial && daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0) {
      return (
        <>
          <TrialBanner daysRemaining={daysRemaining} planName={planName} />
          {children}
        </>
      );
    }
    return <>{children}</>;
  }

  // Trial expired - show full-screen blocker
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="max-w-lg w-full shadow-2xl border-destructive/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Período de Teste Expirado</CardTitle>
          <CardDescription className="text-base mt-2">
            Seu trial do plano <strong className="text-foreground">{planName || "Premium"}</strong> acabou
            {trialEndsAt && (
              <> em {format(trialEndsAt, "dd 'de' MMMM", { locale: ptBR })}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Para continuar usando o Morphews CRM e acessar todas as funcionalidades, você precisa assinar um plano.
            </p>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Acesso completo a todos os módulos
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Secretária IA no WhatsApp
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Suporte prioritário
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="w-full gap-2">
              <Link to="/planos">
                <CreditCard className="h-4 w-4" />
                Ver Planos e Assinar
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="w-full">
              <a href="https://wa.me/5511999999999?text=Oi! Meu trial expirou e gostaria de ajuda para assinar.">
                Falar com Suporte
              </a>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Já tem uma assinatura? <Link to="/login" className="text-primary hover:underline">Faça login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Banner component for active trials with few days remaining
function TrialBanner({ daysRemaining, planName }: { daysRemaining: number; planName: string | null }) {
  const isUrgent = daysRemaining <= 3;
  
  return (
    <div className={`sticky top-0 z-50 px-4 py-2 flex items-center justify-between gap-4 text-sm ${
      isUrgent 
        ? "bg-destructive/90 text-destructive-foreground" 
        : "bg-primary/90 text-primary-foreground"
    }`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <span>
          {isUrgent ? "⚠️ " : ""}
          Seu trial do {planName || "plano"} termina em <strong>{daysRemaining} {daysRemaining === 1 ? "dia" : "dias"}</strong>
        </span>
      </div>
      <Button 
        asChild 
        size="sm" 
        variant={isUrgent ? "secondary" : "outline"} 
        className="shrink-0"
      >
        <Link to="/planos">Assinar Agora</Link>
      </Button>
    </div>
  );
}
