import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Mail,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Building2,
  RefreshCw,
  Filter,
  Phone,
  User,
} from "lucide-react";

interface CommunicationLog {
  id: string;
  created_at: string;
  channel: "whatsapp" | "email";
  source: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_name: string;
  organization_id: string | null;
  organization_name: string | null;
  sale_id: string | null;
  subject: string | null;
  message_content: string;
  status: "pending" | "sent" | "failed" | "delivered";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

const SOURCE_LABELS: Record<string, string> = {
  partner_notification: "Notificação de Parceiro",
  secretary: "Secretária Morphews",
  onboarding: "Onboarding",
  ecommerce: "E-commerce",
  cart_recovery: "Recuperação de Carrinho",
  sale_confirmation: "Confirmação de Venda",
};

const SOURCE_OPTIONS = [
  { value: "all", label: "Todas as Fontes" },
  { value: "partner_notification", label: "Notificação de Parceiro" },
  { value: "secretary", label: "Secretária Morphews" },
  { value: "onboarding", label: "Onboarding" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "cart_recovery", label: "Recuperação de Carrinho" },
];

export function CommunicationLogsTab() {
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["system-communication-logs", channelFilter, sourceFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("system_communication_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (channelFilter !== "all") {
        query = query.eq("channel", channelFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommunicationLog[];
    },
  });

  // Filter by search term
  const filteredLogs = logs?.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.recipient_name?.toLowerCase().includes(searchLower) ||
      log.recipient_phone?.includes(search) ||
      log.recipient_email?.toLowerCase().includes(searchLower) ||
      log.organization_name?.toLowerCase().includes(searchLower) ||
      log.message_content?.toLowerCase().includes(searchLower)
    );
  });

  // Stats
  const stats = {
    total: logs?.length || 0,
    whatsapp: logs?.filter((l) => l.channel === "whatsapp").length || 0,
    email: logs?.filter((l) => l.channel === "email").length || 0,
    sent: logs?.filter((l) => l.status === "sent").length || 0,
    failed: logs?.filter((l) => l.status === "failed").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Histórico de Comunicações</h2>
          <p className="text-muted-foreground">
            Visualize todas as mensagens WhatsApp e E-mails enviados pela plataforma
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.whatsapp}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              E-mail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.email}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Enviados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Falhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Channel Icon */}
                      <div
                        className={`p-2 rounded-full ${
                          log.channel === "whatsapp"
                            ? "bg-green-100 text-green-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                      >
                        {log.channel === "whatsapp" ? (
                          <MessageSquare className="h-4 w-4" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.recipient_name}</span>
                          <Badge
                            variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                          >
                            {log.status === "sent" ? "Enviado" : log.status === "failed" ? "Falha" : "Pendente"}
                          </Badge>
                          <Badge variant="outline">
                            {SOURCE_LABELS[log.source] || log.source}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {log.recipient_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {log.recipient_phone}
                            </span>
                          )}
                          {log.recipient_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {log.recipient_email}
                            </span>
                          )}
                          {log.organization_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {log.organization_name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {log.channel === "whatsapp" ? (
                              <MessageSquare className="h-5 w-5 text-green-600" />
                            ) : (
                              <Mail className="h-5 w-5 text-blue-600" />
                            )}
                            Detalhes da Mensagem
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          {/* Basic Info */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Canal</p>
                              <p className="font-medium capitalize">{log.channel}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Status</p>
                              <Badge
                                variant={log.status === "sent" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                              >
                                {log.status === "sent" ? "Enviado" : log.status === "failed" ? "Falha" : log.status}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Destinatário</p>
                              <p className="font-medium">{log.recipient_name}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Contato</p>
                              <p className="font-medium">{log.recipient_phone || log.recipient_email}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Fonte</p>
                              <p className="font-medium">{SOURCE_LABELS[log.source] || log.source}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Data/Hora</p>
                              <p className="font-medium">
                                {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                              </p>
                            </div>
                          </div>

                          {/* Organization */}
                          {log.organization_name && (
                            <div>
                              <p className="text-sm text-muted-foreground">Organização</p>
                              <p className="font-medium">{log.organization_name}</p>
                            </div>
                          )}

                          {/* Subject (for emails) */}
                          {log.subject && (
                            <div>
                              <p className="text-sm text-muted-foreground">Assunto</p>
                              <p className="font-medium">{log.subject}</p>
                            </div>
                          )}

                          {/* Message Content */}
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Conteúdo da Mensagem</p>
                            <div className="bg-muted rounded-lg p-4 whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">
                              {log.message_content}
                            </div>
                          </div>

                          {/* Error Message */}
                          {log.error_message && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Erro</p>
                              <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">
                                {log.error_message}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Metadados</p>
                              <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum log de comunicação encontrado</p>
              <p className="text-sm">As mensagens enviadas aparecerão aqui</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
