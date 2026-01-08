import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Search,
  RefreshCw,
  MessageSquare,
  User,
  Calendar,
  Loader2,
  WifiOff,
  Send,
  Eye
} from 'lucide-react';
import { 
  useScheduledMessages, 
  useCancelScheduledMessage, 
  useRetryFailedMessage,
  ScheduledMessage 
} from '@/hooks/useScheduledMessages';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useTenant } from '@/hooks/useTenant';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  sent: { label: 'Enviada', icon: CheckCircle, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelada', icon: XCircle, className: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' },
  deleted: { label: 'Excluída', icon: XCircle, className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-500' },
  failed_offline: { label: 'Falhou (Offline)', icon: WifiOff, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  failed_other: { label: 'Falhou', icon: AlertTriangle, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  
  return (
    <Badge variant="secondary" className={`gap-1 ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function MessagePreviewDialog({ message }: { message: ScheduledMessage }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Eye className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Prévia da Mensagem
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                <span className="font-medium">{message.lead?.name}</span>
                <span className="text-muted-foreground">({message.lead?.whatsapp})</span>
              </div>
              <div className="p-3 bg-muted rounded-lg whitespace-pre-wrap text-foreground">
                {message.final_message}
              </div>
              {message.failure_reason && (
                <div className="p-2 bg-destructive/10 text-destructive rounded text-sm">
                  <strong>Erro:</strong> {message.failure_reason}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ScheduledMessages() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  
  const { data: permissions } = useMyPermissions();
  const { isAdmin, isOwner } = useTenant();
  
  const canManage = isAdmin || isOwner || permissions?.scheduled_messages_manage;
  const canViewAll = isAdmin || isOwner;
  
  const { data: messages = [], isLoading, refetch } = useScheduledMessages({
    status: statusFilter === 'all' ? undefined : statusFilter,
    onlyMine: showOnlyMine && !canViewAll,
  });
  
  const cancelMessage = useCancelScheduledMessage();
  const retryMessage = useRetryFailedMessage();

  // Filter by search query
  const filteredMessages = messages.filter(msg => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      msg.lead?.name?.toLowerCase().includes(query) ||
      msg.lead?.whatsapp?.includes(query) ||
      msg.final_message?.toLowerCase().includes(query)
    );
  });

  // Stats
  const stats = {
    pending: messages.filter(m => m.status === 'pending').length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed_offline' || m.status === 'failed_other').length,
    cancelled: messages.filter(m => m.status === 'cancelled').length,
  };

  const handleCancel = (id: string) => {
    cancelMessage.mutate({ id });
  };

  const handleRetry = (id: string) => {
    retryMessage.mutate(id);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Send className="w-6 h-6" />
              Mensagens Agendadas
            </h1>
            <p className="text-muted-foreground">
              Acompanhe e gerencie suas mensagens automáticas
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enviadas</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Falharam</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Canceladas</p>
                  <p className="text-2xl font-bold text-slate-600">{stats.cancelled}</p>
                </div>
                <XCircle className="w-8 h-8 text-slate-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou mensagem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="sent">Enviadas</SelectItem>
                  <SelectItem value="failed_offline">Falharam (Offline)</SelectItem>
                  <SelectItem value="failed_other">Falharam (Outros)</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              {canViewAll && (
                <Select value={showOnlyMine ? 'mine' : 'all'} onValueChange={(v) => setShowOnlyMine(v === 'mine')}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">Minhas mensagens</SelectItem>
                    <SelectItem value="all">Todas as mensagens</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Messages Table */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
            <CardDescription>
              {filteredMessages.length} mensagem(ns) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma mensagem agendada encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Agendada para</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Instância</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <Link 
                              to={`/leads/${msg.lead_id}`} 
                              className="font-medium hover:underline"
                            >
                              {msg.lead?.name || 'Lead não encontrado'}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {msg.lead?.whatsapp}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {msg.template?.non_purchase_reason?.name || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {isPast(new Date(msg.scheduled_at)) 
                                ? `há ${formatDistanceToNow(new Date(msg.scheduled_at), { locale: ptBR })}`
                                : `em ${formatDistanceToNow(new Date(msg.scheduled_at), { locale: ptBR })}`
                              }
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={msg.status} />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {msg.whatsapp_instance?.name || 'Não definida'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <MessagePreviewDialog message={msg} />
                            
                            {msg.status === 'pending' && canManage && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar mensagem?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta mensagem não será enviada. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancel(msg.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Cancelar mensagem
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            
                            {(msg.status === 'failed_offline' || msg.status === 'failed_other') && canManage && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleRetry(msg.id)}
                                disabled={retryMessage.isPending}
                              >
                                {retryMessage.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
