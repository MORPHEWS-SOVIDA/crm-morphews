import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';

import { useConfirmPayment, type AccountPayable } from '@/hooks/useAccountsPayable';
import { useBankAccounts } from '@/hooks/useBankAccounts';

interface ConfirmPayableDialogProps {
  open: boolean;
  onClose: () => void;
  payable: AccountPayable | null;
}

export function ConfirmPayableDialog({ open, onClose, payable }: ConfirmPayableDialogProps) {
  const [paidAmount, setPaidAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [interest, setInterest] = useState('');
  const [fine, setFine] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  
  const confirmMutation = useConfirmPayment();
  const { data: bankAccounts } = useBankAccounts();
  
  // Reset form when payable changes
  useState(() => {
    if (payable) {
      setPaidAmount((payable.amount_cents / 100).toFixed(2).replace('.', ','));
      setDiscount('');
      setInterest('');
      setFine('');
      setBankAccountId(payable.bank_account_id || '');
    }
  });
  
  if (!payable) return null;
  
  const parseAmount = (value: string): number => {
    if (!value) return 0;
    return Math.round(parseFloat(value.replace(',', '.')) * 100);
  };
  
  const originalAmount = payable.amount_cents;
  const discountCents = parseAmount(discount);
  const interestCents = parseAmount(interest);
  const fineCents = parseAmount(fine);
  const calculatedTotal = originalAmount - discountCents + interestCents + fineCents;
  
  const handleSubmit = async () => {
    await confirmMutation.mutateAsync({
      id: payable.id,
      paidAmount: parseAmount(paidAmount) || calculatedTotal,
      discount: discountCents,
      interest: interestCents,
      fine: fineCents,
      bankAccountId: bankAccountId || undefined,
    });
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Confirmar Pagamento
          </DialogTitle>
          <DialogDescription>
            {payable.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Original Amount */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor Original</span>
              <span className="font-bold">{formatCurrency(originalAmount)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-muted-foreground">Vencimento</span>
              <span className="text-sm">{format(new Date(payable.due_date), 'dd/MM/yyyy')}</span>
            </div>
          </div>
          
          {/* Adjustments */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="discount">Desconto</Label>
              <Input
                id="discount"
                placeholder="0,00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="interest">Juros</Label>
              <Input
                id="interest"
                placeholder="0,00"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fine">Multa</Label>
              <Input
                id="fine"
                placeholder="0,00"
                value={fine}
                onChange={(e) => setFine(e.target.value)}
              />
            </div>
          </div>
          
          {/* Calculated Total */}
          <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total a Pagar</span>
              <span className="text-xl font-bold text-green-600">
                {formatCurrency(calculatedTotal)}
              </span>
            </div>
          </div>
          
          {/* Bank Account */}
          <div>
            <Label htmlFor="bank">Conta de Saída</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts?.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.current_balance_cents > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        ({formatCurrency(acc.current_balance_cents)})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Paid Amount (optional override) */}
          <div>
            <Label htmlFor="paidAmount">Valor Pago (opcional)</Label>
            <Input
              id="paidAmount"
              placeholder={formatCurrency(calculatedTotal).replace('R$ ', '')}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Deixe em branco para usar o valor calculado
            </p>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={confirmMutation.isPending}>
            {confirmMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
