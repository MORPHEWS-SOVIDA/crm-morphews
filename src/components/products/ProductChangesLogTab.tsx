import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, History, User, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProductChangesLog, getProductChangeTypeLabel, type ProductChangeType } from '@/hooks/useProductChangesLog';

interface ProductChangesLogTabProps {
  productId: string | undefined;
}

function getChangeTypeBadgeVariant(type: ProductChangeType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (type) {
    case 'created':
    case 'cloned':
      return 'default';
    case 'deleted':
      return 'destructive';
    case 'price_changed':
    case 'commission_changed':
    case 'kit_changed':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function ProductChangesLogTab({ productId }: ProductChangesLogTabProps) {
  const { data: logs = [], isLoading } = useProductChangesLog(productId);

  if (!productId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Salve o produto para ver o histórico de alterações.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma alteração registrada ainda.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-3">
        {logs.map((log) => {
          const userName = log.changed_by_profile
            ? `${log.changed_by_profile.first_name} ${log.changed_by_profile.last_name}`
            : 'Usuário desconhecido';

          return (
            <div
              key={log.id}
              className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{userName}</span>
                  <Badge variant={getChangeTypeBadgeVariant(log.change_type as ProductChangeType)} className="text-xs">
                    {getProductChangeTypeLabel(log.change_type as ProductChangeType)}
                  </Badge>
                </div>

                {log.field_name && (
                  <p className="text-xs text-muted-foreground">
                    Campo: <span className="font-medium">{log.field_name}</span>
                  </p>
                )}

                {(log.old_value || log.new_value) && (
                  <div className="flex items-center gap-2 text-xs">
                    {log.old_value && (
                      <span className="text-destructive/70 line-through truncate max-w-[150px]">
                        {log.old_value}
                      </span>
                    )}
                    {log.old_value && log.new_value && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    {log.new_value && (
                      <span className="text-green-600 truncate max-w-[150px]">
                        {log.new_value}
                      </span>
                    )}
                  </div>
                )}

                {log.notes && (
                  <p className="text-xs text-muted-foreground italic">{log.notes}</p>
                )}

                <p className="text-xs text-muted-foreground">
                  {format(new Date(log.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
