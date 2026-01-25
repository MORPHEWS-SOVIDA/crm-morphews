import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Banknote, 
  CreditCard, 
  CheckCircle, 
  Wallet,
  ChevronRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useUnmatchedPosTransactions, 
  useLinkPosTransactionToSale,
  useConfirmDeliveryPayment,
  formatCentsToCurrency,
  getCardBrandLabel,
  type UnmatchedPosTransaction 
} from '@/hooks/usePosTransactionsForDelivery';

interface DeliveryPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    id: string;
    total_cents: number;
    lead?: { name: string } | null;
  };
  onComplete: () => void;
}

type PaymentStep = 'select_type' | 'select_transaction';

export function DeliveryPaymentDialog({ 
  open, 
  onOpenChange, 
  sale,
  onComplete 
}: DeliveryPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>('select_type');
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  
  const { data: transactions = [], isLoading: loadingTransactions } = useUnmatchedPosTransactions();
  const linkTransaction = useLinkPosTransactionToSale();
  const confirmPayment = useConfirmDeliveryPayment();
  
  const isProcessing = linkTransaction.isPending || confirmPayment.isPending;
  
  // Filter transactions that match the sale amount (with 5% tolerance)
  const matchingTransactions = transactions.filter(tx => {
    const tolerance = sale.total_cents * 0.05; // 5% tolerance
    return Math.abs(tx.amount_cents - sale.total_cents) <= tolerance;
  });
  
  const otherTransactions = transactions.filter(tx => {
    const tolerance = sale.total_cents * 0.05;
    return Math.abs(tx.amount_cents - sale.total_cents) > tolerance;
  });

  const handleSelectPaymentType = async (type: 'cash' | 'prepaid') => {
    try {
      await confirmPayment.mutateAsync({ saleId: sale.id, paymentType: type });
      handleClose();
      onComplete();
    } catch (error) {
      // Error handled in hook
    }
  };
  
  const handleSelectCard = () => {
    setStep('select_transaction');
  };
  
  const handleLinkTransaction = async () => {
    if (!selectedTransaction) return;
    
    try {
      await linkTransaction.mutateAsync({ 
        transactionId: selectedTransaction, 
        saleId: sale.id 
      });
      await confirmPayment.mutateAsync({ saleId: sale.id, paymentType: 'pos_card' });
      handleClose();
      onComplete();
    } catch (error) {
      // Error handled in hook
    }
  };
  
  const handleClose = () => {
    setStep('select_type');
    setSelectedTransaction(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {step === 'select_type' ? 'Como foi o pagamento?' : 'Selecionar Transação'}
          </DialogTitle>
          <DialogDescription>
            {sale.lead?.name} • {formatCentsToCurrency(sale.total_cents)}
          </DialogDescription>
        </DialogHeader>

        {step === 'select_type' && (
          <div className="grid gap-3 py-4">
            {/* Cash */}
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={() => handleSelectPaymentType('cash')}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <Banknote className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Dinheiro</p>
                  <p className="text-sm text-muted-foreground">Cliente pagou em espécie</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Button>

            {/* Prepaid */}
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={() => handleSelectPaymentType('prepaid')}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Já estava pago</p>
                  <p className="text-sm text-muted-foreground">PIX, cartão online ou outro</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Button>

            {/* Card/POS */}
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={handleSelectCard}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Máquina de Cartão</p>
                  <p className="text-sm text-muted-foreground">
                    {transactions.length > 0 
                      ? `${transactions.length} transação(ões) pendente(s)`
                      : 'Vincular transação POS'
                    }
                  </p>
                </div>
                {transactions.length > 0 && (
                  <Badge variant="secondary">{transactions.length}</Badge>
                )}
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Button>
          </div>
        )}

        {step === 'select_transaction' && (
          <div className="py-4">
            {loadingTransactions ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhuma transação pendente</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As transações aparecem aqui após passar o cartão na máquina
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setStep('select_type')}
                >
                  Voltar
                </Button>
              </div>
            ) : (
              <>
                {matchingTransactions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Valor compatível
                    </p>
                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2">
                        {matchingTransactions.map(tx => (
                          <TransactionCard
                            key={tx.id}
                            transaction={tx}
                            isSelected={selectedTransaction === tx.id}
                            onSelect={() => setSelectedTransaction(tx.id)}
                            isMatch
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                
                {otherTransactions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Outras transações
                    </p>
                    <ScrollArea className="max-h-[150px]">
                      <div className="space-y-2">
                        {otherTransactions.map(tx => (
                          <TransactionCard
                            key={tx.id}
                            transaction={tx}
                            isSelected={selectedTransaction === tx.id}
                            onSelect={() => setSelectedTransaction(tx.id)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'select_transaction' && transactions.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setStep('select_type')}
              disabled={isProcessing}
            >
              Voltar
            </Button>
            <Button 
              onClick={handleLinkTransaction}
              disabled={!selectedTransaction || isProcessing}
            >
              {isProcessing ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Transaction card component
function TransactionCard({ 
  transaction, 
  isSelected, 
  onSelect,
  isMatch = false
}: { 
  transaction: UnmatchedPosTransaction;
  isSelected: boolean;
  onSelect: () => void;
  isMatch?: boolean;
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all ${
        isSelected 
          ? 'ring-2 ring-primary bg-primary/5' 
          : 'hover:bg-muted/50'
      } ${isMatch ? 'border-green-200' : ''}`}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              transaction.transaction_type === 'credit' 
                ? 'bg-purple-100 dark:bg-purple-900' 
                : 'bg-blue-100 dark:bg-blue-900'
            }`}>
              <CreditCard className={`w-4 h-4 ${
                transaction.transaction_type === 'credit' 
                  ? 'text-purple-600' 
                  : 'text-blue-600'
              }`} />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {formatCentsToCurrency(transaction.amount_cents)}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {transaction.card_brand && (
                  <span>{getCardBrandLabel(transaction.card_brand)}</span>
                )}
                {transaction.card_last_digits && (
                  <span>•••• {transaction.card_last_digits}</span>
                )}
                {transaction.terminal_name && (
                  <>
                    <span>•</span>
                    <span>{transaction.terminal_name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={transaction.transaction_type === 'credit' ? 'default' : 'secondary'} className="text-xs">
              {transaction.transaction_type === 'credit' ? 'Crédito' : 'Débito'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" />
              {transaction.created_at && format(new Date(transaction.created_at), "HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        {transaction.nsu && (
          <p className="text-xs text-muted-foreground mt-2">
            NSU: {transaction.nsu} {transaction.authorization_code && `• Auth: ${transaction.authorization_code}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
