import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFollowupQueue } from "@/hooks/useSuperIA";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  organizationId: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  generating: { label: "Gerando", variant: "secondary", icon: Clock },
  ready: { label: "Pronto", variant: "default", icon: Send },
  sending: { label: "Enviando", variant: "secondary", icon: Send },
  sent: { label: "Enviado", variant: "default", icon: CheckCircle2 },
  skipped: { label: "Ignorado", variant: "outline", icon: XCircle },
  failed: { label: "Falhou", variant: "destructive", icon: AlertCircle },
};

const TRIGGER_LABELS: Record<string, string> = {
  cron_inactive: "⏰ Inatividade",
  event_stage_change: "📊 Mudança de Etapa",
  event_cart_abandon: "🛒 Carrinho Abandonado",
  event_post_sale: "🎉 Pós-Venda",
  event_payment_declined: "❌ Pagamento Recusado",
  manual: "✋ Manual",
};

export function SuperIAQueue({ organizationId }: Props) {
  const { data: queue, isLoading } = useFollowupQueue(organizationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila de Follow-ups</CardTitle>
        <CardDescription>
          Mensagens geradas pela IA para envio automático
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!queue || queue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Send className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum follow-up na fila ainda.</p>
            <p className="text-sm mt-1">
              Ative os gatilhos na aba Configuração para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusCfg.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {TRIGGER_LABELS[item.trigger_type] || item.trigger_type}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>

                  {item.generated_message && (
                    <p className="text-sm bg-muted/50 p-3 rounded-md">
                      {item.generated_message}
                    </p>
                  )}

                  {item.error_message && (
                    <p className="text-xs text-destructive">
                      Erro: {item.error_message}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {item.ai_model_used && (
                      <span>Modelo: {item.ai_model_used}</span>
                    )}
                    {item.tokens_used && (
                      <span>{item.tokens_used} tokens</span>
                    )}
                    {item.sent_at && (
                      <span>
                        Enviado: {format(new Date(item.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
