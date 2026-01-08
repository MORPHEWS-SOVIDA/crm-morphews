import { useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';

interface SyncedPriceInputProps {
  label: string;
  quantity: number;
  valueCents: number | null | undefined;
  onChange: (valueCents: number | null) => void;
  placeholder?: string;
}

export function SyncedPriceInput({
  label,
  quantity,
  valueCents,
  onChange,
  placeholder,
}: SyncedPriceInputProps) {
  const totalCents = valueCents || 0;
  
  // Calculate unit price (rounded to avoid floating point issues)
  const unitCents = useMemo(() => {
    if (!totalCents || quantity <= 0) return 0;
    return Math.round(totalCents / quantity);
  }, [totalCents, quantity]);

  // Handle total price change
  const handleTotalChange = useCallback((newTotal: number) => {
    onChange(newTotal || null);
  }, [onChange]);

  // Handle unit price change - recalculate total
  const handleUnitChange = useCallback((newUnit: number) => {
    const newTotal = Math.round(newUnit * quantity);
    onChange(newTotal || null);
  }, [onChange, quantity]);

  const quantityLabel = quantity === 1 ? 'un' : 'uns';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">
          {label} (Total × {quantity} {quantityLabel})
        </Label>
        <CurrencyInput
          value={totalCents}
          onChange={handleTotalChange}
          placeholder={placeholder}
        />
      </div>
      <div>
        <Label className="text-xs">
          {label} (Unitário)
        </Label>
        <CurrencyInput
          value={unitCents}
          onChange={handleUnitChange}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

// Format price for display (shows both total and unit)
export function formatPriceWithUnit(totalCents: number | null | undefined, quantity: number): string {
  if (!totalCents) return 'Não definido';
  
  const total = (totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const unit = ((totalCents / quantity) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  if (quantity === 1) {
    return total;
  }
  
  return `${total} (${unit}/un)`;
}
