import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, ArrowRight, User } from 'lucide-react';
import { useLeadOwnershipHistory } from '@/hooks/useLeadOwnership';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadOwnershipHistoryProps {
  leadId: string;
}

const reasonLabels: Record<string, string> = {
  cadastro: 'Tentativa de cadastro',
  atendimento_whatsapp: 'Atendimento WhatsApp',
  manual: 'Transferência manual',
  receptivo: 'Atendimento receptivo',
  first_assignment: 'Primeiro cadastro',
};

export function LeadOwnershipHistory({ leadId }: LeadOwnershipHistoryProps) {
  const { data: history, isLoading } = useLeadOwnershipHistory(leadId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma transferência registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((transfer) => {
        const fromName = transfer.from_user 
          ? `${transfer.from_user.first_name} ${transfer.from_user.last_name}`.trim()
          : 'Sem responsável anterior';
        const toName = transfer.to_user 
          ? `${transfer.to_user.first_name} ${transfer.to_user.last_name}`.trim()
          : 'Usuário desconhecido';
        const byName = transfer.transferred_by_user 
          ? `${transfer.transferred_by_user.first_name} ${transfer.transferred_by_user.last_name}`.trim()
          : 'Sistema';

        return (
          <div 
            key={transfer.id}
            className="p-3 rounded-lg border bg-muted/30 space-y-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{fromName}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="w-4 h-4" />
                <span>{toName}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {reasonLabels[transfer.transfer_reason] || transfer.transfer_reason}
              </span>
              <span>
                {format(new Date(transfer.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>

            {transfer.notes && (
              <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                {transfer.notes}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Transferido por: {byName}
            </p>
          </div>
        );
      })}
    </div>
  );
}
