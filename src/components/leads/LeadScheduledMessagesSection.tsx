import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
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
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  WifiOff,
  Send,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calendar,
  Pencil,
  Trash2,
  Plus,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LeadScheduledMessagesSectionProps {
  leadId: string;
  leadName?: string;
  leadWhatsapp?: string;
}

interface ScheduledMessageForLead {
  id: string;
  scheduled_at: string;
  sent_at: string | null;
  final_message: string;
  status: string;
  failure_reason: string | null;
  whatsapp_instance?: {
    name: string;
  } | null;
  template?: {
    non_purchase_reason?: {
      name: string;
    } | null;
  } | null;
}

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

function useLeadScheduledMessages(leadId: string) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-scheduled-messages', leadId],
    queryFn: async () => {
      if (!tenantId || !leadId) return [];

      const { data, error } = await supabase
        .from('lead_scheduled_messages')
        .select(`
          id,
          scheduled_at,
          sent_at,
          final_message,
          status,
          failure_reason,
          whatsapp_instance:whatsapp_instances!lead_scheduled_messages_whatsapp_instance_id_fkey(name),
          template:non_purchase_message_templates!lead_scheduled_messages_template_id_fkey(
            non_purchase_reason:non_purchase_reasons!non_purchase_message_templates_non_purchase_reason_id_fkey(name)
          )
        `)
        .eq('lead_id', leadId)
        .eq('organization_id', tenantId)
        .is('deleted_at', null)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ScheduledMessageForLead[];
    },
    enabled: !!tenantId && !!leadId,
  });
}

export function LeadScheduledMessagesSection({ leadId, leadName, leadWhatsapp }: LeadScheduledMessagesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessageForLead | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const { data: messages = [], isLoading } = useLeadScheduledMessages(leadId);
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: 'Cancelado pelo usuário',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scheduled-messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem cancelada');
    },
    onError: () => toast.error('Erro ao cancelar mensagem'),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, final_message, scheduled_at }: { id: string; final_message: string; scheduled_at: string }) => {
      const { error } = await supabase
        .from('lead_scheduled_messages')
        .update({
          final_message,
          scheduled_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scheduled-messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem atualizada');
      setEditingMessage(null);
    },
    onError: () => toast.error('Erro ao atualizar mensagem'),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async ({ final_message, scheduled_at, whatsapp_instance_id }: { final_message: string; scheduled_at: string; whatsapp_instance_id: string | null }) => {
      if (!tenantId) throw new Error('Organização não encontrada');
      const { error } = await supabase
        .from('lead_scheduled_messages')
        .insert({
          organization_id: tenantId,
          lead_id: leadId,
          final_message,
          scheduled_at,
          original_scheduled_at: scheduled_at,
          status: 'pending',
          created_by: user?.id || null,
          whatsapp_instance_id: whatsapp_instance_id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scheduled-messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages'] });
      toast.success('Mensagem agendada');
      setShowCreateDialog(false);
    },
    onError: () => toast.error('Erro ao agendar mensagem'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const pendingCount = messages.filter(m => m.status === 'pending').length;

  return (
    <>
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="w-5 h-5 text-primary" />
                  Mensagens Agendadas
                  {messages.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {messages.length}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setShowCreateDialog(true); }}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma mensagem agendada para este lead</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agendar mensagem
                  </Button>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="border rounded-lg p-3 space-y-2">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(msg.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-xs">
                          ({isPast(new Date(msg.scheduled_at))
                            ? `há ${formatDistanceToNow(new Date(msg.scheduled_at), { locale: ptBR })}`
                            : `em ${formatDistanceToNow(new Date(msg.scheduled_at), { locale: ptBR })}`})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={msg.status} />
                        {msg.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingMessage(msg)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                                    onClick={() => cancelMutation.mutate(msg.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Cancelar mensagem
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {msg.template?.non_purchase_reason?.name && (
                        <span>Motivo: {msg.template.non_purchase_reason.name}</span>
                      )}
                      {msg.whatsapp_instance?.name && (
                        <span>Instância: {msg.whatsapp_instance.name}</span>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                      {msg.final_message.length > 200 
                        ? msg.final_message.slice(0, 200) + '...'
                        : msg.final_message
                      }
                    </div>

                    {msg.failure_reason && (
                      <div className="p-2 bg-destructive/10 text-destructive rounded text-xs">
                        <strong>Erro:</strong> {msg.failure_reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Edit Dialog */}
      <EditMessageDialog 
        message={editingMessage} 
        onClose={() => setEditingMessage(null)}
        onSave={(data) => updateMutation.mutate({ id: editingMessage!.id, ...data })}
        isPending={updateMutation.isPending}
      />

      {/* Create Dialog */}
      <CreateMessageDialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSave={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        leadName={leadName}
        tenantId={tenantId}
      />
    </>
  );
}

interface EditDialogProps {
  message: ScheduledMessageForLead | null;
  onClose: () => void;
  onSave: (data: { final_message: string; scheduled_at: string }) => void;
  isPending: boolean;
}

function EditMessageDialog({ message, onClose, onSave, isPending }: EditDialogProps) {
  const [messageText, setMessageText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  // Reset when message changes
  if (message && messageText === '' && scheduledAt === '') {
    setMessageText(message.final_message);
    setScheduledAt(format(new Date(message.scheduled_at), "yyyy-MM-dd'T'HH:mm"));
  }

  const handleClose = () => {
    setMessageText('');
    setScheduledAt('');
    onClose();
  };

  const handleSave = () => {
    onSave({ final_message: messageText, scheduled_at: new Date(scheduledAt).toISOString() });
  };

  if (!message) return null;

  return (
    <Dialog open={!!message} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Editar Mensagem
          </DialogTitle>
          <DialogDescription>
            Altere o texto e/ou a data de envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Data/Hora de Envio</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
  onSave: (data: { final_message: string; scheduled_at: string; whatsapp_instance_id: string | null }) => void;
  isPending: boolean;
  leadName?: string;
  tenantId: string | null;
}

function CreateMessageDialog({ open, onClose, onSave, isPending, leadName, tenantId }: CreateDialogProps) {
  const [messageText, setMessageText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  // Fetch available WhatsApp instances
  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances-for-schedule', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, name, phone_number, status')
        .eq('organization_id', tenantId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const handleClose = () => {
    setMessageText('');
    setScheduledAt('');
    setSelectedInstanceId('');
    onClose();
  };

  const handleSave = () => {
    if (!messageText || !scheduledAt) return;
    onSave({ 
      final_message: messageText, 
      scheduled_at: new Date(scheduledAt).toISOString(),
      whatsapp_instance_id: selectedInstanceId || null,
    });
    setMessageText('');
    setScheduledAt('');
    setSelectedInstanceId('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Nova Mensagem Agendada
          </DialogTitle>
          <DialogDescription>
            Agende uma mensagem para {leadName || 'este lead'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione uma instância...</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} {inst.phone_number ? `(${inst.phone_number})` : ''} {inst.status === 'connected' ? '🟢' : '🔴'}
                </option>
              ))}
            </select>
            {instances.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma instância configurada</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data/Hora de Envio *</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensagem *</Label>
            <Textarea
              rows={6}
              placeholder="Digite a mensagem..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending || !messageText || !scheduledAt}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
