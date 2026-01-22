import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Loader2, 
  AlertTriangle, 
  Mail, 
  RefreshCw,
  CreditCard,
  Calendar,
  Building2,
  Send
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PastDueSubscription {
  id: string;
  organization_id: string;
  status: string;
  current_period_end: string | null;
  organizations: {
    id: string;
    name: string;
    owner_name: string | null;
    owner_email: string | null;
    phone: string | null;
  };
  subscription_plans: {
    name: string;
    price_cents: number;
  } | null;
}

interface ReminderLog {
  id: string;
  organization_id: string;
  reminder_type: string;
  sent_to: string;
  sent_at: string;
}

export function BillingManagementTab() {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch past_due subscriptions
  const { data: pastDueSubscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ["past-due-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          organization_id,
          status,
          current_period_end,
          organizations (
            id,
            name,
            owner_name,
            owner_email,
            phone
          ),
          subscription_plans (
            name,
            price_cents
          )
        `)
        .eq("status", "past_due");

      if (error) throw error;
      return data as unknown as PastDueSubscription[];
    },
  });

  // Fetch reminder logs
  const { data: reminderLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["payment-reminder-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_reminder_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ReminderLog[];
    },
  });

  // Process reminders mutation
  const processRemindersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-payment-reminders");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payment-reminder-logs"] });
      toast({
        title: "Processamento concluído",
        description: `${data.sent} emails enviados, ${data.errors} erros`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getDaysSinceDue = (periodEnd: string | null) => {
    if (!periodEnd) return null;
    return differenceInDays(new Date(), new Date(periodEnd));
  };

  const getRemindersSent = (orgId: string) => {
    return reminderLogs?.filter((r) => r.organization_id === orgId) || [];
  };

  const getReminderBadge = (type: string) => {
    switch (type) {
      case "day_3":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">D+3</Badge>;
      case "day_7":
        return <Badge variant="outline" className="text-orange-600 border-orange-600">D+7</Badge>;
      case "day_14":
        return <Badge variant="destructive">D+14</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const isLoading = subsLoading || logsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalAtRisk = pastDueSubscriptions?.reduce((acc, sub) => {
    return acc + (sub.subscription_plans?.price_cents || 0);
  }, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Inadimplentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {pastDueSubscriptions?.length || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              assinaturas com pagamento pendente
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-destructive" />
              Receita em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {formatPrice(totalAtRisk)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              MRR que pode ser perdido
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Lembretes Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {reminderLogs?.length || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              emails de cobrança no total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => processRemindersMutation.mutate()}
          disabled={processRemindersMutation.isPending}
          className="gap-2"
        >
          {processRemindersMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Processar Lembretes Agora
        </Button>
      </div>

      {/* Past Due Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Assinaturas Inadimplentes
          </CardTitle>
          <CardDescription>
            Clientes com pagamento pendente e histórico de lembretes enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pastDueSubscriptions?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma assinatura inadimplente! 🎉</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias em Atraso</TableHead>
                  <TableHead>Lembretes Enviados</TableHead>
                  <TableHead>Contato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastDueSubscriptions?.map((sub) => {
                  const daysSinceDue = getDaysSinceDue(sub.current_period_end);
                  const reminders = getRemindersSent(sub.organization_id);

                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {sub.organizations.name}
                        </div>
                        {sub.organizations.owner_name && (
                          <div className="text-xs text-muted-foreground">
                            {sub.organizations.owner_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sub.subscription_plans?.name || "Sem plano"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {sub.subscription_plans 
                          ? formatPrice(sub.subscription_plans.price_cents)
                          : "-"
                        }
                      </TableCell>
                      <TableCell>
                        {sub.current_period_end ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {daysSinceDue !== null ? (
                          <Badge 
                            variant={daysSinceDue > 7 ? "destructive" : "outline"}
                            className={daysSinceDue <= 7 ? "text-amber-600 border-amber-600" : ""}
                          >
                            {daysSinceDue} dias
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {reminders.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Nenhum</span>
                          ) : (
                            reminders.map((r) => (
                              <span key={r.id} title={format(new Date(r.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                                {getReminderBadge(r.reminder_type)}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {sub.organizations.owner_email && (
                            <a 
                              href={`mailto:${sub.organizations.owner_email}`}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </a>
                          )}
                          {sub.organizations.phone && (
                            <a 
                              href={`https://wa.me/${sub.organizations.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline text-xs"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Reminders Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Histórico de Lembretes
          </CardTitle>
          <CardDescription>
            Últimos emails de cobrança enviados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reminderLogs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lembrete enviado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Enviado Para</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminderLogs?.slice(0, 20).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getReminderBadge(log.reminder_type)}</TableCell>
                    <TableCell className="text-sm">{log.sent_to}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
