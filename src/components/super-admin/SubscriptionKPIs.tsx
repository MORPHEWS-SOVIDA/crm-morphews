import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  CreditCard, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  XCircle,
  CheckCircle
} from "lucide-react";

interface Subscription {
  id: string;
  organization_id: string;
  status: string;
  subscription_plans: {
    name: string;
    price_cents: number;
  } | null;
}

interface SubscriptionKPIsProps {
  organizations: any[];
  subscriptions: Subscription[];
  members: any[];
  onFilterChange?: (status: string | null) => void;
  activeFilter?: string | null;
}

export function SubscriptionKPIs({ 
  organizations, 
  subscriptions, 
  members,
  onFilterChange,
  activeFilter 
}: SubscriptionKPIsProps) {
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  // Calculate counts
  const activeCount = subscriptions?.filter((s) => s.status === "active").length || 0;
  const trialCount = subscriptions?.filter((s) => s.status === "trialing").length || 0;
  const pastDueCount = subscriptions?.filter((s) => s.status === "past_due").length || 0;
  const canceledCount = subscriptions?.filter((s) => s.status === "canceled").length || 0;

  // Calculate MRR (only active subscriptions)
  const totalMRR = subscriptions?.reduce((acc, sub) => {
    if (sub.status === "active" && sub.subscription_plans) {
      return acc + sub.subscription_plans.price_cents;
    }
    return acc;
  }, 0) || 0;

  // Calculate at-risk revenue (past_due subscriptions)
  const atRiskMRR = subscriptions?.reduce((acc, sub) => {
    if (sub.status === "past_due" && sub.subscription_plans) {
      return acc + sub.subscription_plans.price_cents;
    }
    return acc;
  }, 0) || 0;

  const handleClick = (status: string | null) => {
    if (onFilterChange) {
      onFilterChange(activeFilter === status ? null : status);
    }
  };

  return (
    <div className="space-y-4">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${activeFilter === null ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleClick(null)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Organizações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {organizations?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              {members?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR (Receita Mensal)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {formatPrice(totalMRR)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {formatPrice(atRiskMRR)}
            </div>
            {atRiskMRR > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {pastDueCount} assinaturas pendentes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-green-500 ${activeFilter === 'active' ? 'ring-2 ring-green-500 bg-green-500/5' : ''}`}
          onClick={() => handleClick('active')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/50" />
            </div>
            {activeFilter === 'active' && (
              <Badge className="mt-2 bg-green-500">Filtro ativo</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-blue-500 ${activeFilter === 'trialing' ? 'ring-2 ring-blue-500 bg-blue-500/5' : ''}`}
          onClick={() => handleClick('trialing')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Trial</p>
                <p className="text-2xl font-bold text-blue-600">{trialCount}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/50" />
            </div>
            {activeFilter === 'trialing' && (
              <Badge className="mt-2 bg-blue-500">Filtro ativo</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-amber-500 ${activeFilter === 'past_due' ? 'ring-2 ring-amber-500 bg-amber-500/5' : ''}`}
          onClick={() => handleClick('past_due')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inadimplentes</p>
                <p className="text-2xl font-bold text-amber-600">{pastDueCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500/50" />
            </div>
            {activeFilter === 'past_due' && (
              <Badge className="mt-2 bg-amber-500">Filtro ativo</Badge>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-l-4 border-l-destructive ${activeFilter === 'canceled' ? 'ring-2 ring-destructive bg-destructive/5' : ''}`}
          onClick={() => handleClick('canceled')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cancelados</p>
                <p className="text-2xl font-bold text-destructive">{canceledCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive/50" />
            </div>
            {activeFilter === 'canceled' && (
              <Badge className="mt-2" variant="destructive">Filtro ativo</Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
