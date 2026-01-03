import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useActivePaymentMethodsEnhanced,
  useAcquirers,
  PaymentMethodEnhanced,
  CardBrand,
  CardTransactionType,
  CARD_BRAND_LABELS,
  TRANSACTION_TYPE_LABELS,
  CATEGORIES_REQUIRING_TRANSACTION_DATA,
} from '@/hooks/usePaymentMethodsEnhanced';

interface PaymentConfirmationData {
  payment_method_id: string;
  payment_method_name: string;
  payment_notes?: string;
  // Conciliation data for card-based methods
  transaction_date?: Date;
  card_brand?: CardBrand;
  transaction_type?: CardTransactionType;
  nsu_cv?: string;
  acquirer_id?: string;
  installments?: number;
}

interface PaymentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: PaymentConfirmationData) => void;
  totalCents: number;
  existingPaymentMethodId?: string | null;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  totalCents,
  existingPaymentMethodId,
}: PaymentConfirmationDialogProps) {
  const { data: paymentMethods = [] } = useActivePaymentMethodsEnhanced();
  const { data: acquirers = [] } = useAcquirers();

  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  // Conciliation fields
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [cardBrand, setCardBrand] = useState<CardBrand | ''>('');
  const [transactionType, setTransactionType] = useState<CardTransactionType | ''>('');
  const [nsuCv, setNsuCv] = useState('');
  const [acquirerId, setAcquirerId] = useState<string>('');
  const [installments, setInstallments] = useState<number>(1);

  // Get selected method details
  const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);
  const requiresTransactionData = selectedMethod?.category && 
    CATEGORIES_REQUIRING_TRANSACTION_DATA.includes(selectedMethod.category);
  
  // Get enabled transaction types for this method
  const enabledTransactionTypes = selectedMethod?.transaction_fees
    ?.filter(f => f.is_enabled)
    .map(f => f.transaction_type) || [];

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMethodId(existingPaymentMethodId || '');
      setNotes('');
      setTransactionDate(new Date());
      setCardBrand('');
      setTransactionType('');
      setNsuCv('');
      setAcquirerId(selectedMethod?.acquirer_id || '');
      setInstallments(1);
    }
  }, [open, existingPaymentMethodId]);

  // Update acquirer when method changes
  useEffect(() => {
    if (selectedMethod?.acquirer_id) {
      setAcquirerId(selectedMethod.acquirer_id);
    }
  }, [selectedMethod]);

  const handleSubmit = () => {
    if (!selectedMethod) return;

    const data: PaymentConfirmationData = {
      payment_method_id: selectedMethod.id,
      payment_method_name: selectedMethod.name,
      payment_notes: notes || undefined,
    };

    if (requiresTransactionData) {
      data.transaction_date = transactionDate;
      data.card_brand = cardBrand as CardBrand || undefined;
      data.transaction_type = transactionType as CardTransactionType || undefined;
      data.nsu_cv = nsuCv || undefined;
      data.acquirer_id = acquirerId || undefined;
      if (transactionType === 'credit_installment') {
        data.installments = installments;
      }
    }

    onConfirm(data);
  };

  const isFormValid = () => {
    if (!selectedMethodId) return false;
    
    if (requiresTransactionData) {
      // At minimum, require transaction type and NSU for card-based methods
      if (!transactionType) return false;
      if (!nsuCv.trim()) return false;
    }
    
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Confirmar Pagamento
          </DialogTitle>
          <DialogDescription>
            Valor: {formatCurrency(totalCents)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Forma de Pagamento *</Label>
            <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(pm => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conciliation fields for card-based methods */}
          {requiresTransactionData && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <p className="text-sm font-medium">Dados da Transação</p>
              
              {/* Transaction Date */}
              <div className="space-y-2">
                <Label>Data/Hora da Transação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !transactionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {transactionDate ? format(transactionDate, "dd/MM/yyyy HH:mm") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={transactionDate}
                      onSelect={(date) => date && setTransactionDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Card Brand */}
              <div className="space-y-2">
                <Label>Bandeira do Cartão</Label>
                <Select value={cardBrand} onValueChange={(v) => setCardBrand(v as CardBrand)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a bandeira..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CARD_BRAND_LABELS) as CardBrand[]).map(brand => (
                      <SelectItem key={brand} value={brand}>
                        {CARD_BRAND_LABELS[brand]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Type */}
              <div className="space-y-2">
                <Label>Tipo de Transação *</Label>
                <Select value={transactionType} onValueChange={(v) => setTransactionType(v as CardTransactionType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledTransactionTypes.length > 0 ? (
                      enabledTransactionTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {TRANSACTION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))
                    ) : (
                      // If no specific types configured, show all
                      (Object.keys(TRANSACTION_TYPE_LABELS) as CardTransactionType[]).map(type => (
                        <SelectItem key={type} value={type}>
                          {TRANSACTION_TYPE_LABELS[type]}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Installments (only for credit_installment) */}
              {transactionType === 'credit_installment' && (
                <div className="space-y-2">
                  <Label>Número de Parcelas</Label>
                  <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: selectedMethod?.max_installments || 12 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatCurrency(Math.ceil(totalCents / n))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* NSU/CV */}
              <div className="space-y-2">
                <Label>NSU/CV (Código da Transação) *</Label>
                <Input
                  value={nsuCv}
                  onChange={(e) => setNsuCv(e.target.value)}
                  placeholder="Número impresso no comprovante"
                />
                <p className="text-xs text-muted-foreground">
                  Número único da transação, presente no recibo do cliente
                </p>
              </div>

              {/* Acquirer */}
              <div className="space-y-2">
                <Label>Adquirente (Operadora)</Label>
                <Select value={acquirerId} onValueChange={setAcquirerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não informado</SelectItem>
                    {acquirers.map(acq => (
                      <SelectItem key={acq.id} value={acq.id}>
                        {acq.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre o pagamento..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid()}>
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
