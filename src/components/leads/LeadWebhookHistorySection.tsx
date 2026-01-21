import { useState } from 'react';
import { ChevronDown, ChevronUp, History, Copy, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLeadWebhookHistory } from '@/hooks/useLeadWebhookHistory';

interface LeadWebhookHistorySectionProps {
  leadId: string;
}

export function LeadWebhookHistorySection({ leadId }: LeadWebhookHistorySectionProps) {
  const { data: history = [], isLoading } = useLeadWebhookHistory(leadId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCopy = (payload: Record<string, any>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Dados copiados!');
  };

  // Format payload into a readable summary
  const formatPayloadSummary = (payload: Record<string, any>) => {
    const items: { label: string; value: string }[] = [];
    
    const extractValue = (obj: any, path: string[]): any => {
      let current = obj;
      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return null;
        }
      }
      return current;
    };
    
    // Common fields to look for
    const fieldMappings = [
      { paths: [['transaction_id'], ['order_id'], ['pedido_id'], ['id']], label: 'ID' },
      { paths: [['status'], ['payment_status'], ['state']], label: 'Status' },
      { paths: [['total'], ['value'], ['amount'], ['price']], label: 'Valor' },
      { paths: [['product', 'name'], ['product_name'], ['item_name']], label: 'Produto' },
      { paths: [['customer', 'name'], ['name'], ['nome']], label: 'Nome' },
    ];
    
    for (const mapping of fieldMappings) {
      for (const path of mapping.paths) {
        const value = extractValue(payload, path);
        if (value !== null && value !== undefined) {
          items.push({ 
            label: mapping.label, 
            value: typeof value === 'object' ? JSON.stringify(value) : String(value).slice(0, 50) 
          });
          break;
        }
      }
    }
    
    return items;
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-foreground">Histórico de Webhooks</h2>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return null; // Don't show section if no webhook history
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-semibold text-foreground">Histórico de Webhooks</h2>
        <Badge variant="secondary" className="ml-auto">
          {history.length} {history.length === 1 ? 'evento' : 'eventos'}
        </Badge>
      </div>
      
      <ScrollArea className="max-h-[400px]">
        <div className="space-y-3">
          {history.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const summary = formatPayloadSummary(entry.payload);
            
            return (
              <div
                key={entry.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Header - always visible */}
                <div
                  className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  {/* Status indicator */}
                  {entry.processed_successfully ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {entry.integration_name || 'Integração'}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(entry.received_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    
                    {/* Quick summary badges */}
                    {summary.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {summary.slice(0, 3).map((item, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs font-normal">
                            <span className="text-muted-foreground mr-1">{item.label}:</span>
                            {item.value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Button variant="ghost" size="sm" className="shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="flex justify-between items-center p-2 bg-muted/20">
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.received_at).toLocaleString('pt-BR')}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(entry.payload);
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copiar JSON
                      </Button>
                    </div>
                    
                    {entry.error_message && (
                      <div className="p-2 bg-red-500/10 border-b">
                        <p className="text-xs text-red-600 dark:text-red-400">
                          ⚠️ {entry.error_message}
                        </p>
                      </div>
                    )}
                    
                    <div className="p-3 bg-muted/10 overflow-auto max-h-64">
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
