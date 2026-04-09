import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Send, MessageSquare, TrendingUp, Zap, Users } from "lucide-react";
import { useSuperIAStats } from "@/hooks/useSuperIA";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  organizationId: string;
}

export function SuperIADashboard({ organizationId }: Props) {
  const { data: stats, isLoading } = useSuperIAStats(organizationId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: "Na Fila",
      value: stats?.queue_pending || 0,
      icon: Zap,
      description: "Follow-ups aguardando envio",
      color: "text-amber-500",
    },
    {
      title: "Enviados (24h)",
      value: stats?.sent_24h || 0,
      icon: Send,
      description: "Follow-ups enviados hoje",
      color: "text-green-500",
    },
    {
      title: "Enviados (7d)",
      value: stats?.sent_7d || 0,
      icon: TrendingUp,
      description: "Follow-ups na última semana",
      color: "text-blue-500",
    },
    {
      title: "Memória IA",
      value: stats?.total_preferences_learned || 0,
      icon: Brain,
      description: "Preferências aprendidas",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
                {metric.title}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <p>
              <strong>Memória:</strong> A cada conversa encerrada, a IA extrai preferências, 
              objeções e próximos passos do cliente automaticamente.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <p>
              <strong>Follow-up Inteligente:</strong> Quando o cliente fica inativo, 
              a IA lê TODO o histórico e gera uma mensagem curta e natural, como um vendedor real faria.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <p>
              <strong>CRM Integrado:</strong> O agente consulta produtos, pedidos e movimenta 
              leads no funil automaticamente durante a conversa.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">4</span>
            </div>
            <p>
              <strong>Gatilhos:</strong> Carrinho abandonado, mudança de etapa no funil e 
              pós-venda geram follow-ups automáticos com contexto completo.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
