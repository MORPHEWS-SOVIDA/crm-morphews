import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Landmark,
  Building2,
  QrCode,
  FileText,
  CheckCircle,
  Clock,
  User,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  useMatchingTransactions,
  useMatchTransaction,
  usePendingTransactionCounts,
  IncomingTransaction,
  getSourceDisplayName,
  formatCurrency,
} from '@/hooks/useIncomingTransactions';

interface PaymentSourceSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  amountCents: number;
  onManualConfirm: () => void;
}

type PaymentSourceType = 'pagarme' | 'efipay' | 'getnet' | 'banrisul' | 'manual';

const SOURCE_CONFIG: Record<PaymentSourceType, { icon: React.ReactNode; label: string; description: string }> = {
  pagarme: {
    icon: <CreditCard className="h-5 w-5" />,
    label: 'Pagar.me',
    description: 'Checkout online (automático via webhook)',
  },
  efipay: {
    icon: <QrCode className="h-5 w-5" />,
    label: 'EfiPay PIX',
    description: 'PIX recebido na conta EfiPay',
  },
  getnet: {
    icon: <Landmark className="h-5 w-5" />,
    label: 'Getnet TEF',
    description: 'Maquininha Getnet (em breve)',
  },
  banrisul: {
    icon: <Building2 className="h-5 w-5" />,
    label: 'Banrisul/Vero',
    description: 'Maquininha Vero (em breve)',
  },
  manual: {
    icon: <FileText className="h-5 w-5" />,
    label: 'Comprovante Manual',
    description: 'Anexar comprovante de pagamento',
  },
};

export function PaymentSourceSelector({
  open,
  onOpenChange,
  saleId,
  amountCents,
  onManualConfirm,
}: PaymentSourceSelectorProps) {
  const [selectedSource, setSelectedSource] = useState<PaymentSourceType | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  
  const { data: counts = {} } = usePendingTransactionCounts();
  const { data: matchingTransactions = [], isLoading: loadingTx } = useMatchingTransactions(
    selectedSource && selectedSource !== 'manual' && selectedSource !== 'pagarme' ? amountCents : null
  );
  const matchTransaction = useMatchTransaction();

  const handleSourceSelect = (source: PaymentSourceType) => {
    setSelectedSource(source);
    setSelectedTransaction(null);
  };

  const handleConfirm = async () => {
    if (selectedSource === 'manual') {
      onManualConfirm();
      onOpenChange(false);
      return;
    }

    if (selectedTransaction) {
      await matchTransaction.mutateAsync({
        transactionId: selectedTransaction,
        saleId,
      });
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedSource(null);
    setSelectedTransaction(null);
    onOpenChange(false);
  };

  const renderTransactionList = () => {
    if (!selectedSource || selectedSource === 'manual' || selectedSource === 'pagarme') {
      return null;
    }

    if (loadingTx) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (matchingTransactions.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <QrCode className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma transação pendente encontrada</p>
          <p className="text-sm mt-1">
            Valor procurado: {formatCurrency(amountCents)}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          Transações pendentes ({matchingTransactions.length})
        </h4>
        <ScrollArea className="h-[200px]">
          <RadioGroup
            value={selectedTransaction || ''}
            onValueChange={setSelectedTransaction}
            className="space-y-2"
          >
            {matchingTransactions.map((tx) => (
              <div
                key={tx.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedTransaction === tx.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedTransaction(tx.id)}
              >
                <RadioGroupItem value={tx.id} id={tx.id} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">
                      {formatCurrency(tx.amount_cents)}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {getSourceDisplayName(tx.source)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(tx.transaction_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                  {tx.payer_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {tx.payer_name}
                      {tx.payer_document && ` • ${tx.payer_document}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        </ScrollArea>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
          <DialogDescription>
            Valor da venda: <strong>{formatCurrency(amountCents)}</strong>
            <br />
            Selecione a origem do pagamento para confirmar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Selection */}
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(SOURCE_CONFIG) as [PaymentSourceType, typeof SOURCE_CONFIG[PaymentSourceType]][]).map(
              ([source, config]) => {
                const count = counts[source] || 0;
                const isDisabled = source === 'getnet' || source === 'banrisul';
                const isSelected = selectedSource === source;

                return (
                  <Button
                    key={source}
                    variant={isSelected ? 'default' : 'outline'}
                    className="h-auto py-3 px-4 justify-start relative"
                    disabled={isDisabled}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="flex items-center gap-3">
                      {config.icon}
                      <div className="text-left">
                        <div className="font-medium">{config.label}</div>
                        {count > 0 && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {count} pendente{count > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isDisabled && (
                      <Badge variant="outline" className="absolute top-1 right-1 text-xs">
                        Em breve
                      </Badge>
                    )}
                  </Button>
                );
              }
            )}
          </div>

          {/* Transaction List or Manual Info */}
          {selectedSource && (
            <>
              <Separator />
              
              {selectedSource === 'pagarme' ? (
                <div className="text-center py-4 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Pagamentos via Pagar.me são confirmados automaticamente</p>
                  <p className="text-sm mt-1">
                    O webhook já processa as confirmações
                  </p>
                </div>
              ) : selectedSource === 'manual' ? (
                <div className="text-center py-4">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-primary" />
                  <p>Você poderá anexar um comprovante de pagamento</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    O status será atualizado manualmente
                  </p>
                </div>
              ) : (
                renderTransactionList()
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !selectedSource ||
              (selectedSource !== 'manual' && selectedSource !== 'pagarme' && !selectedTransaction) ||
              selectedSource === 'getnet' ||
              selectedSource === 'banrisul' ||
              matchTransaction.isPending
            }
          >
            {matchTransaction.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Associando...
              </>
            ) : selectedSource === 'manual' ? (
              <>
                Anexar Comprovante
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Confirmar Pagamento
                <CheckCircle className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
