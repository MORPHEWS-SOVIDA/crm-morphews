import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
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
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenant } from '@/hooks/useTenant';

interface LeadScheduledMessagesSectionProps {
  leadId: string;
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

export function LeadScheduledMessagesSection({ leadId }: LeadScheduledMessagesSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: messages = [], isLoading } = useLeadScheduledMessages(leadId);

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
  const sentCount = messages.filter(m => m.status === 'sent').length;

  return (
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
                    <StatusBadge status={msg.status} />
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
  );
}
