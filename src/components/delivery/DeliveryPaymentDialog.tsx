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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Banknote, 
  CreditCard, 
  CheckCircle, 
  Wallet,
  ChevronRight,
  Clock,
  AlertCircle,
  Camera,
  Receipt,
  ArrowLeft,
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface DeliveryPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    id: string;
    total_cents: number;
    payment_status?: string | null;
    payment_proof_url?: string | null;
    lead?: { name: string } | null;
  };
  onComplete: () => void;
}

type PaymentStep = 'select_type' | 'cash_amount' | 'card_proof' | 'select_transaction';

export function DeliveryPaymentDialog({ 
  open, 
  onOpenChange, 
  sale,
  onComplete 
}: DeliveryPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>('select_type');
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { user, profile } = useAuth();
  const { data: transactions = [], isLoading: loadingTransactions } = useUnmatchedPosTransactions();
  const linkTransaction = useLinkPosTransactionToSale();
  const confirmPayment = useConfirmDeliveryPayment();
  
  const isProcessing = linkTransaction.isPending || confirmPayment.isPending || isUploading;

  // Check if sale is already paid (prepaid with proof)
  const isPrepaid = sale.payment_status === 'paid_now' || 
    (sale.payment_status === 'will_pay_before' && sale.payment_proof_url);
  
  // Filter transactions that match the sale amount (with 5% tolerance)
  const matchingTransactions = transactions.filter(tx => {
    const tolerance = sale.total_cents * 0.05; // 5% tolerance
    return Math.abs(tx.amount_cents - sale.total_cents) <= tolerance;
  });
  
  const otherTransactions = transactions.filter(tx => {
    const tolerance = sale.total_cents * 0.05;
    return Math.abs(tx.amount_cents - sale.total_cents) > tolerance;
  });

  // Handle prepaid - just confirm delivery
  const handleConfirmPrepaid = async () => {
    try {
      await confirmPayment.mutateAsync({ saleId: sale.id, paymentType: 'prepaid' });
      handleClose();
      onComplete();
    } catch (error) {
      // Error handled in hook
    }
  };

  // Handle cash payment with amount confirmation
  const handleConfirmCash = async () => {
    if (!cashAmount || !user?.id || !profile?.organization_id) {
      toast.error('Informe o valor recebido');
      return;
    }

    const amountCents = Math.round(parseFloat(cashAmount.replace(',', '.')) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error('Valor inválido');
      return;
    }

    try {
      // First update sale status
      await confirmPayment.mutateAsync({ saleId: sale.id, paymentType: 'cash' });
      
      // Then create cash confirmation record
      const { error: confError } = await supabase
        .from('cash_payment_confirmations')
        .insert({
          organization_id: profile.organization_id,
          sale_id: sale.id,
          confirmed_by: user.id,
          confirmation_type: 'receipt',
          amount_cents: amountCents,
          notes: `Motoboy recebeu R$ ${cashAmount}`
        });
      
      if (confError) {
        console.error('Error creating cash confirmation:', confError);
      }
      
      handleClose();
      onComplete();
    } catch (error) {
      // Error handled in hook
    }
  };

  // Handle card/pix proof upload
  const handleProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmWithProof = async () => {
    if (!proofFile || !user?.id) {
      toast.error('Anexe o comprovante');
      return;
    }

    setIsUploading(true);
    try {
      // Upload proof file
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${sale.id}/payment-proof-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('sales-documents')
        .upload(fileName, proofFile);
      
      if (uploadError) throw uploadError;
      
      // Update sale with proof and mark as delivered
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          payment_proof_url: fileName,
          delivery_payment_type: 'pos_card',
          delivery_confirmed_at: new Date().toISOString(),
          delivery_confirmed_by: user.id,
          status: 'delivered',
          delivery_status: 'delivered_normal',
          delivered_at: new Date().toISOString(),
          payment_status: 'confirmed',
        })
        .eq('id', sale.id);
      
      if (updateError) throw updateError;
      
      toast.success('Entrega confirmada!');
      handleClose();
      onComplete();
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('Erro ao enviar comprovante');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSelectCard = () => {
    setStep('select_transaction');
  };

  const handleSelectCash = () => {
    // Pre-fill with sale total
    setCashAmount((sale.total_cents / 100).toFixed(2).replace('.', ','));
    setStep('cash_amount');
  };

  const handleSelectCardProof = () => {
    setStep('card_proof');
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
    setCashAmount('');
    setProofFile(null);
    setProofPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {step === 'select_type' && 'Como foi o pagamento?'}
            {step === 'cash_amount' && 'Recebeu em Dinheiro'}
            {step === 'card_proof' && 'Comprovante de Pagamento'}
            {step === 'select_transaction' && 'Selecionar Transação'}
          </DialogTitle>
          <DialogDescription>
            {sale.lead?.name} • {formatCentsToCurrency(sale.total_cents)}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Select payment type */}
        {step === 'select_type' && (
          <div className="grid gap-3 py-4">
            {/* Cash - opens amount input */}
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={handleSelectCash}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <Banknote className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Recebeu em Dinheiro</p>
                  <p className="text-sm text-muted-foreground">Informe o valor recebido</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Button>

            {/* Prepaid - direct confirmation */}
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={handleConfirmPrepaid}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Já estava pago</p>
                  <p className="text-sm text-muted-foreground">PIX antecipado, boleto, etc.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Button>

            {/* Card/PIX on delivery - needs proof */}
            <Button
              variant="outline"
              className="h-auto p-4 justify-start"
              onClick={handleSelectCardProof}
              disabled={isProcessing}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Cartão ou PIX na hora</p>
                  <p className="text-sm text-muted-foreground">Anexe foto do ticket/comprovante</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Button>

            {/* Link POS transaction - for integrated terminals */}
            {transactions.length > 0 && (
              <Button
                variant="outline"
                className="h-auto p-4 justify-start"
                onClick={handleSelectCard}
                disabled={isProcessing}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                    <Receipt className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold">Vincular Transação POS</p>
                    <p className="text-sm text-muted-foreground">
                      {transactions.length} transação(ões) pendente(s)
                    </p>
                  </div>
                  <Badge variant="secondary">{transactions.length}</Badge>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Button>
            )}
          </div>
        )}

        {/* STEP 2a: Cash amount input */}
        {step === 'cash_amount' && (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <Label className="text-green-700 dark:text-green-300 font-medium">
                Quanto recebeu em dinheiro?
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-semibold text-green-600">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0,00"
                  className="text-xl font-bold text-center h-12 bg-white dark:bg-background"
                  autoFocus
                />
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Valor da venda: {formatCentsToCurrency(sale.total_cents)}
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Esse valor será conferido depois pela expedição no botão "Dinheiro"
              </p>
            </div>
          </div>
        )}

        {/* STEP 2b: Card/PIX proof upload */}
        {step === 'card_proof' && (
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Foto do comprovante
              </Label>
              
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProofChange}
                className="hidden"
                id="proof-upload"
              />
              
              {proofPreview ? (
                <div className="relative">
                  <img 
                    src={proofPreview} 
                    alt="Comprovante" 
                    className="w-full h-48 object-contain rounded-lg border bg-muted"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => {
                      setProofFile(null);
                      setProofPreview(null);
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <label 
                  htmlFor="proof-upload"
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Tirar foto ou selecionar</span>
                </label>
              )}
            </div>
          </div>
        )}

        {/* STEP 2c: Select POS transaction */}
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

        {/* Footer with actions */}
        {step === 'cash_amount' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setStep('select_type')}
              disabled={isProcessing}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button 
              onClick={handleConfirmCash}
              disabled={!cashAmount || isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {isProcessing ? 'Confirmando...' : 'Confirmar Entrega'}
            </Button>
          </DialogFooter>
        )}

        {step === 'card_proof' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setStep('select_type')}
              disabled={isProcessing}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <Button 
              onClick={handleConfirmWithProof}
              disabled={!proofFile || isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              {isProcessing ? 'Enviando...' : 'Confirmar Entrega'}
            </Button>
          </DialogFooter>
        )}

        {step === 'select_transaction' && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setStep('select_type')}
              disabled={isProcessing}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            {transactions.length > 0 && (
              <Button 
                onClick={handleLinkTransaction}
                disabled={!selectedTransaction || isProcessing}
              >
                {isProcessing ? 'Processando...' : 'Confirmar'}
              </Button>
            )}
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