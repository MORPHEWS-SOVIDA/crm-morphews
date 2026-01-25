import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle, Clock, AlertTriangle, Link2, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { POS_GATEWAY_LABELS, type PosGatewayType, type PosMatchStatus } from '@/hooks/usePosTerminals';
import { formatCurrency } from '@/hooks/useSales';

interface PosTransactionInfoProps {
  saleId: string;
  posTransactionId?: string | null;
  compact?: boolean;
}

const MATCH_STATUS_CONFIG: Record<PosMatchStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-amber-100 text-amber-700' },
  matched: { label: 'Vinculado', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  orphan: { label: 'Órfão', icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  manual: { label: 'Manual', icon: Link2, className: 'bg-blue-100 text-blue-700' },
};

export function PosTransactionInfo({ saleId, posTransactionId, compact = false }: PosTransactionInfoProps) {
  const { data: transaction, isLoading } = useQuery({
    queryKey: ['pos-transaction-for-sale', saleId, posTransactionId],
    queryFn: async () => {
      if (!posTransactionId) {
        // Try to find by sale_id
        const { data } = await supabase
          .from('pos_transactions')
          .select(`
            *,
            terminal:pos_terminals(id, name, gateway_type)
          `)
          .eq('sale_id', saleId)
          .maybeSingle();
        return data;
      }

      const { data } = await supabase
        .from('pos_transactions')
        .select(`
          *,
          terminal:pos_terminals(id, name, gateway_type)
        `)
        .eq('id', posTransactionId)
        .maybeSingle();
      return data;
    },
    enabled: !!saleId,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-4 w-20 rounded bg-muted" />
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  const statusConfig = MATCH_STATUS_CONFIG[transaction.match_status as PosMatchStatus];
  const StatusIcon = statusConfig?.icon || Clock;
  const terminal = transaction.terminal as { id: string; name: string; gateway_type: PosGatewayType } | null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={statusConfig?.className || ''}>
          <CreditCard className="w-3 h-3 mr-1" />
          POS
        </Badge>
        {transaction.nsu && (
          <span className="text-xs text-muted-foreground font-mono">
            NSU: {transaction.nsu}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Transação POS</span>
        </div>
        <Badge variant="outline" className={statusConfig?.className || ''}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {statusConfig?.label || 'Desconhecido'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {terminal && (
          <div>
            <span className="text-muted-foreground text-xs">Máquina:</span>
            <p className="font-medium">
              {terminal.name}
              <Badge variant="outline" className="ml-2 text-xs">
                {POS_GATEWAY_LABELS[terminal.gateway_type]}
              </Badge>
            </p>
          </div>
        )}
        {transaction.nsu && (
          <div>
            <span className="text-muted-foreground text-xs">NSU:</span>
            <p className="font-mono font-medium">{transaction.nsu}</p>
          </div>
        )}
        {transaction.authorization_code && (
          <div>
            <span className="text-muted-foreground text-xs">Autorização:</span>
            <p className="font-mono font-medium">{transaction.authorization_code}</p>
          </div>
        )}
        {transaction.card_brand && (
          <div>
            <span className="text-muted-foreground text-xs">Bandeira:</span>
            <p className="font-medium">
              {transaction.card_brand}
              {transaction.card_last_digits && (
                <span className="text-muted-foreground"> ***{transaction.card_last_digits}</span>
              )}
            </p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground text-xs">Valor:</span>
          <p className="font-bold">{formatCurrency(transaction.amount_cents)}</p>
        </div>
        {transaction.matched_at && (
          <div>
            <span className="text-muted-foreground text-xs">Vinculado em:</span>
            <p className="text-xs">{format(parseISO(transaction.matched_at), 'dd/MM/yy HH:mm')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
