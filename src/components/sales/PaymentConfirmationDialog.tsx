import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard } from 'lucide-react';
import { SplitPaymentEditor, PaymentLine } from './SplitPaymentEditor';

export interface PaymentConfirmationData {
  payment_method_id: string;
  payment_method_name: string;
  payment_notes?: string;
  /** Split payment lines — when provided, the above fields reflect the primary method */
  payment_lines?: PaymentLine[];
  /** Adjusted total (for baixa) */
  adjusted_total_cents?: number;
  // Legacy conciliation fields (kept for backward compat with installment logic)
  transaction_date?: Date;
  card_brand?: string;
  transaction_type?: string;
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
  /** Allow total editing (for baixa screens) */
  allowTotalEdit?: boolean;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

let lineIdCounter = 100;
const genLineId = () => `confirm_line_${lineIdCounter++}_${Date.now()}`;

export function PaymentConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  totalCents,
  existingPaymentMethodId,
  allowTotalEdit = false,
}: PaymentConfirmationDialogProps) {
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [notes, setNotes] = useState('');
  const [adjustedTotal, setAdjustedTotal] = useState(totalCents);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setNotes('');
      setAdjustedTotal(totalCents);
      // Start with one empty line pre-filled with existing method if available
      if (existingPaymentMethodId) {
        setLines([
          {
            id: genLineId(),
            payment_method_id: existingPaymentMethodId,
            payment_method_name: '',
            amount_cents: totalCents,
          },
        ]);
      } else {
        setLines([]);
      }
    }
  }, [open, existingPaymentMethodId, totalCents]);

  const handleSubmit = () => {
    if (lines.length === 0) return;
    
    // Primary = first line (or largest amount)
    const primary = lines.reduce((a, b) => (b.amount_cents > a.amount_cents ? b : a), lines[0]);

    const data: PaymentConfirmationData = {
      payment_method_id: primary.payment_method_id,
      payment_method_name: primary.payment_method_name,
      payment_notes: notes || undefined,
      payment_lines: lines,
      adjusted_total_cents: allowTotalEdit ? adjustedTotal : undefined,
    };

    onConfirm(data);
  };

  const sumCents = lines.reduce((s, l) => s + l.amount_cents, 0);
  const isBalanced = sumCents === adjustedTotal && lines.length > 0;
  const allMethodsSelected = lines.every((l) => l.payment_method_id);
  const isFormValid = isBalanced && allMethodsSelected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Confirmar Pagamento
          </DialogTitle>
          <DialogDescription>
            Valor: {formatCurrency(adjustedTotal)}
            {lines.length > 1 && ' — Pagamento dividido'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <SplitPaymentEditor
            totalCents={adjustedTotal}
            lines={lines}
            onChange={setLines}
            allowTotalEdit={allowTotalEdit}
            onTotalChange={setAdjustedTotal}
          />

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
          <Button onClick={handleSubmit} disabled={!isFormValid}>
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
