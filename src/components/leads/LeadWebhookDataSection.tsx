import { useState } from 'react';
import { ChevronDown, ChevronUp, Webhook, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LeadWebhookDataSectionProps {
  webhookData: Record<string, any> | null;
}

export function LeadWebhookDataSection({ webhookData }: LeadWebhookDataSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!webhookData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(webhookData, null, 2));
    toast.success('Dados copiados!');
  };

  // Try to extract meaningful info from webhook data
  const extractInfo = () => {
    const info: { label: string; value: string }[] = [];
    const data = webhookData;

    // Common webhook fields to display
    const commonFields = [
      { key: 'transaction_id', label: 'ID Transação' },
      { key: 'order_id', label: 'ID Pedido' },
      { key: 'payment_status', label: 'Status Pagamento' },
      { key: 'status', label: 'Status' },
      { key: 'total_price', label: 'Valor Total' },
      { key: 'product', label: 'Produto', nested: 'name' },
      { key: 'integration_key', label: 'Chave Integração' },
    ];

    commonFields.forEach(({ key, label, nested }) => {
      if (data[key]) {
        const value = nested && typeof data[key] === 'object' ? data[key][nested] : data[key];
        if (value) {
          info.push({ label, value: String(value) });
        }
      }
    });

    return info;
  };

  const quickInfo = extractInfo();

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Webhook className="w-5 h-5 text-orange-500" />
          Dados Recebidos por Webhook
          <Badge variant="secondary" className="ml-2 text-xs">
            Integração Externa
          </Badge>
        </h2>
        <Button variant="ghost" size="sm">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Quick info badges - always visible */}
      {quickInfo.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {quickInfo.slice(0, 4).map((item, idx) => (
            <Badge 
              key={idx} 
              variant="outline" 
              className="text-xs font-normal"
            >
              <span className="text-muted-foreground mr-1">{item.label}:</span>
              <span className="font-medium">{item.value.slice(0, 30)}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Expanded view */}
      <div className={cn(
        'overflow-hidden transition-all duration-300',
        isExpanded ? 'max-h-[500px] mt-4' : 'max-h-0'
      )}>
        <div className="flex justify-end mb-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-1" />
            Copiar JSON
          </Button>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 overflow-auto max-h-96">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
            {JSON.stringify(webhookData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
