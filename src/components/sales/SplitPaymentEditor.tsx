import { useState } from 'react';
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
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActivePaymentMethodsEnhanced } from '@/hooks/usePaymentMethodsEnhanced';

export interface PaymentLine {
  id: string; // local temp id
  payment_method_id: string;
  payment_method_name: string;
  amount_cents: number;
}

interface SplitPaymentEditorProps {
  totalCents: number;
  lines: PaymentLine[];
  onChange: (lines: PaymentLine[]) => void;
  /** Allow editing the total (for baixa adjustments) */
  allowTotalEdit?: boolean;
  onTotalChange?: (newTotalCents: number) => void;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const parseCurrencyInput = (value: string): number => {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
};

let nextId = 1;
const genId = () => `line_${nextId++}_${Date.now()}`;

export function SplitPaymentEditor({
  totalCents,
  lines,
  onChange,
  allowTotalEdit = false,
  onTotalChange,
}: SplitPaymentEditorProps) {
  const { data: paymentMethods = [] } = useActivePaymentMethodsEnhanced();
  const [totalInput, setTotalInput] = useState((totalCents / 100).toFixed(2).replace('.', ','));

  const sumCents = lines.reduce((s, l) => s + l.amount_cents, 0);
  const remaining = totalCents - sumCents;
  const isBalanced = remaining === 0 && lines.length > 0;

  const addLine = () => {
    const newLine: PaymentLine = {
      id: genId(),
      payment_method_id: '',
      payment_method_name: '',
      amount_cents: Math.max(remaining, 0),
    };
    onChange([...lines, newLine]);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, updates: Partial<PaymentLine>) => {
    onChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...updates };
        // If method changed, update the name
        if (updates.payment_method_id) {
          const method = paymentMethods.find((m) => m.id === updates.payment_method_id);
          if (method) updated.payment_method_name = method.name;
        }
        return updated;
      })
    );
  };

  const handleTotalBlur = () => {
    const newTotal = parseCurrencyInput(totalInput);
    if (newTotal > 0 && onTotalChange) {
      onTotalChange(newTotal);
    }
  };

  return (
    <div className="space-y-3">
      {/* Total (editable in baixa mode) */}
      {allowTotalEdit && (
        <div className="space-y-1">
          <Label className="text-sm font-medium">Valor Total da Venda</Label>
          <Input
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            onBlur={handleTotalBlur}
            placeholder="0,00"
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            Ajuste se houve desconto ou acréscimo na hora
          </p>
        </div>
      )}

      {/* Payment lines */}
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div
            key={line.id}
            className="flex items-center gap-2 p-2 rounded-md border bg-background"
          >
            <div className="flex-1 min-w-0">
              <Select
                value={line.payment_method_id || '__none__'}
                onValueChange={(v) =>
                  updateLine(line.id, { payment_method_id: v === '__none__' ? '' : v })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Forma..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Selecione...</SelectItem>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Input
                className="h-8 text-sm text-right"
                value={(line.amount_cents / 100).toFixed(2).replace('.', ',')}
                onChange={(e) => {
                  const cents = parseCurrencyInput(e.target.value);
                  updateLine(line.id, { amount_cents: cents });
                }}
                placeholder="0,00"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => removeLine(line.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add button */}
      <Button variant="outline" size="sm" onClick={addLine} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar forma de pagamento
      </Button>

      {/* Balance indicator */}
      {lines.length > 0 && (
        <div
          className={`flex items-center gap-2 text-sm p-2 rounded-md ${
            isBalanced
              ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
          }`}
        >
          {isBalanced ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Valores conferem: {formatCurrency(totalCents)}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>
                {remaining > 0
                  ? `Falta: ${formatCurrency(remaining)}`
                  : `Excedeu: ${formatCurrency(Math.abs(remaining))}`}
                {' '}(Total: {formatCurrency(totalCents)} | Informado: {formatCurrency(sumCents)})
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
