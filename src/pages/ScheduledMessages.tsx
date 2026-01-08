import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  Pencil,
  Plus,
  ChevronDown,
  Filter
} from 'lucide-react';
import { 
  useScheduledMessages, 
  useCancelScheduledMessage, 
  useRetryFailedMessage,
  useUpdateScheduledMessage,
  useCreateScheduledMessage,
  ScheduledMessage 
} from '@/hooks/useScheduledMessages';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useTenant } from '@/hooks/useTenant';
import { useUsers } from '@/hooks/useUsers';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useLeads } from '@/hooks/useLeads';
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

interface EditDialogProps {
  message: ScheduledMessage | null;
  onClose: () => void;
}

function EditMessageDialog({ message, onClose }: EditDialogProps) {
  const [messageText, setMessageText] = useState(message?.final_message || '');
  const [scheduledAt, setScheduledAt] = useState(
    message ? format(new Date(message.scheduled_at), "yyyy-MM-dd'T'HH:mm") : ''
  );
  
  const updateMessage = useUpdateScheduledMessage();

  const handleSave = () => {
    if (!message) return;
    updateMessage.mutate(
      { id: message.id, final_message: messageText, scheduled_at: new Date(scheduledAt).toISOString() },
      { onSuccess: () => onClose() }
    );
  };

  if (!message) return null;

  return (
    <Dialog open={!!message} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editar Mensagem Agendada
          </DialogTitle>
          <DialogDescription>
            Altere o texto e/ou a data de envio desta mensagem pendente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Lead</Label>
            <p className="text-sm text-muted-foreground">
              {message.lead?.name} ({message.lead?.whatsapp})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Data/Hora de Envio</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageText">Mensagem</Label>
            <Textarea
              id="messageText"
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateMessage.isPending}>
            {updateMessage.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}

function CreateMessageDialog({ open, onClose }: CreateDialogProps) {
  const [leadId, setLeadId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [leadSearch, setLeadSearch] = useState('');

  const { data: leads = [] } = useLeads();
  const { data: instances = [] } = useWhatsAppInstances();
  const createMessage = useCreateScheduledMessage();

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      l.whatsapp.includes(leadSearch)
  );

  const handleCreate = () => {
    if (!leadId || !messageText || !scheduledAt) return;
    createMessage.mutate(
      {
        lead_id: leadId,
        final_message: messageText,
        scheduled_at: new Date(scheduledAt).toISOString(),
        whatsapp_instance_id: instanceId || undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setLeadId('');
          setMessageText('');
          setScheduledAt('');
          setInstanceId('');
          setLeadSearch('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nova Mensagem Agendada
          </DialogTitle>
          <DialogDescription>
            Crie uma mensagem para ser enviada automaticamente em uma data/hora específica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar Lead</Label>
            <Input
              placeholder="Nome ou telefone..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
            />
            {leadSearch && filteredLeads.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredLeads.slice(0, 10).map((lead) => (
                  <div
                    key={lead.id}
                    className={`p-2 cursor-pointer hover:bg-muted ${leadId === lead.id ? 'bg-primary/10' : ''}`}
                    onClick={() => {
                      setLeadId(lead.id);
                      setLeadSearch(lead.name);
                    }}
                  >
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.whatsapp}</p>
                  </div>
                ))}
              </div>
            )}
            {leadId && (
              <p className="text-xs text-green-600">
                Lead selecionado: {leads.find((l) => l.id === leadId)?.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newScheduledAt">Data/Hora de Envio *</Label>
            <Input
              id="newScheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Instância WhatsApp (opcional)</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar instância..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Automática</SelectItem>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newMessageText">Mensagem *</Label>
            <Textarea
              id="newMessageText"
              rows={6}
              placeholder="Digite a mensagem que será enviada..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMessage.isPending || !leadId || !messageText || !scheduledAt}
          >
            {createMessage.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Agendar Mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ScheduledMessages() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(true);
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [scheduledFrom, setScheduledFrom] = useState('');
  const [scheduledTo, setScheduledTo] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: permissions } = useMyPermissions();
  const { isAdmin, isOwner } = useTenant();
  const { data: users = [] } = useUsers();

  const canManage = isAdmin || isOwner || permissions?.scheduled_messages_manage;
  const canViewAll = isAdmin || isOwner;

  const { data: messages = [], isLoading, refetch } = useScheduledMessages({
    status: statusFilter === 'all' ? undefined : statusFilter,
    onlyMine: showOnlyMine && !canViewAll,
    createdBy: createdByFilter || undefined,
    scheduledFrom: scheduledFrom ? new Date(scheduledFrom).toISOString() : undefined,
    scheduledTo: scheduledTo ? new Date(scheduledTo + 'T23:59:59').toISOString() : undefined,
    createdFrom: createdFrom ? new Date(createdFrom).toISOString() : undefined,
    createdTo: createdTo ? new Date(createdTo + 'T23:59:59').toISOString() : undefined,
  });

  const cancelMessage = useCancelScheduledMessage();
  const retryMessage = useRetryFailedMessage();

  // Filter by search query
  const filteredMessages = messages.filter((msg) => {
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
    pending: messages.filter((m) => m.status === 'pending').length,
    sent: messages.filter((m) => m.status === 'sent').length,
    failed: messages.filter((m) => m.status === 'failed_offline' || m.status === 'failed_other').length,
    cancelled: messages.filter((m) => m.status === 'cancelled').length,
  };

  const handleCancel = (id: string) => {
    cancelMessage.mutate({ id });
  };

  const handleRetry = (id: string) => {
    retryMessage.mutate(id);
  };

  const clearFilters = () => {
    setCreatedByFilter('');
    setScheduledFrom('');
    setScheduledTo('');
    setCreatedFrom('');
    setCreatedTo('');
  };

  const hasActiveFilters = createdByFilter || scheduledFrom || scheduledTo || createdFrom || createdTo;

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
            <p className="text-muted-foreground">Acompanhe e gerencie suas mensagens automáticas</p>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Mensagem
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
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
          <CardContent className="p-4 space-y-4">
            {/* Basic filters */}
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
                <Select
                  value={showOnlyMine ? 'mine' : 'all'}
                  onValueChange={(v) => setShowOnlyMine(v === 'mine')}
                >
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

            {/* Advanced filters collapsible */}
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros avançados
                  {hasActiveFilters && <Badge variant="secondary" className="ml-1">Ativos</Badge>}
                  <ChevronDown className={`w-4 h-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Vendedor/Criador</Label>
                    <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.first_name} {u.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data Criada (de)</Label>
                    <Input
                      type="date"
                      value={createdFrom}
                      onChange={(e) => setCreatedFrom(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data Criada (até)</Label>
                    <Input
                      type="date"
                      value={createdTo}
                      onChange={(e) => setCreatedTo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Agendada para (de)</Label>
                    <Input
                      type="date"
                      value={scheduledFrom}
                      onChange={(e) => setScheduledFrom(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Agendada para (até)</Label>
                    <Input
                      type="date"
                      value={scheduledTo}
                      onChange={(e) => setScheduledTo(e.target.value)}
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Messages List */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
            <CardDescription>{filteredMessages.length} mensagem(ns) encontrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma mensagem agendada encontrada</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Link to={`/leads/${msg.lead_id}`} className="font-medium hover:underline">
                          {msg.lead?.name || 'Lead não encontrado'}
                        </Link>
                        <span className="text-xs text-muted-foreground">{msg.lead?.whatsapp}</span>
                        <StatusBadge status={msg.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        {msg.status === 'pending' && canManage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingMessage(msg)}
                            className="gap-1"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </Button>
                        )}

                        {msg.status === 'pending' && canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(msg.id)}
                            disabled={retryMessage.isPending}
                            className="gap-1"
                          >
                            {retryMessage.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Agendada: {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        <span className="text-xs">
                          ({isPast(new Date(msg.scheduled_at))
                            ? `há ${formatDistanceToNow(new Date(msg.scheduled_at), { locale: ptBR })}`
                            : `em ${formatDistanceToNow(new Date(msg.scheduled_at), { locale: ptBR })}`})
                        </span>
                      </div>
                      {msg.creator && (
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>Por: {msg.creator.first_name} {msg.creator.last_name}</span>
                        </div>
                      )}
                      {msg.template?.non_purchase_reason?.name && (
                        <span>Motivo: {msg.template.non_purchase_reason.name}</span>
                      )}
                      {msg.whatsapp_instance?.name && (
                        <span>Instância: {msg.whatsapp_instance.name}</span>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="p-3 bg-muted/50 rounded-md whitespace-pre-wrap text-sm">
                      {msg.final_message}
                    </div>

                    {msg.failure_reason && (
                      <div className="p-2 bg-destructive/10 text-destructive rounded text-sm">
                        <strong>Erro:</strong> {msg.failure_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <EditMessageDialog message={editingMessage} onClose={() => setEditingMessage(null)} />

      {/* Create Dialog */}
      <CreateMessageDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} />
    </Layout>
  );
}
