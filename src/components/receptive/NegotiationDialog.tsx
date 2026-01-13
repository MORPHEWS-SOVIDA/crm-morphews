import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Coins, Calculator, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPriceCents: number;
  minimumPriceCents: number | null;
  quantity: number;
  originalCommission: number;
  defaultCommission: number;
  minimumCommission: number | null;
  onConfirm: (negotiatedPriceCents: number, installments: number, effectiveCommission: number) => void;
}

const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

// Installment calculation: total / 10, shown as 12x
const calculateInstallmentValue = (totalCents: number, installments: number) => {
  // Business rule: divide by 10, then multiply to get financed total
  const financedTotal = Math.round(totalCents / 10) * 12;
  return Math.round(financedTotal / installments);
};

const calculateInstallmentTotal = (totalCents: number) => {
  // Financed total = (total / 10) * 12
  return Math.round(totalCents / 10) * 12;
};

export function NegotiationDialog({
  open,
  onOpenChange,
  originalPriceCents,
  minimumPriceCents,
  quantity,
  originalCommission,
  defaultCommission,
  minimumCommission,
  onConfirm,
}: NegotiationDialogProps) {
  const [inputMode, setInputMode] = useState<'unit' | 'total'>('total');
  const [inputValue, setInputValue] = useState('');
  const [installments, setInstallments] = useState(12);

  // Calculate negotiated price in cents
  const negotiatedPriceCents = useMemo(() => {
    const numValue = parseFloat(inputValue.replace(',', '.')) || 0;
    if (inputMode === 'unit') {
      return Math.round(numValue * 100 * quantity);
    }
    return Math.round(numValue * 100);
  }, [inputValue, inputMode, quantity]);

  // Derived values
  const unitPriceCents = useMemo(() => {
    return quantity > 0 ? Math.round(negotiatedPriceCents / quantity) : 0;
  }, [negotiatedPriceCents, quantity]);

  const hasDiscount = negotiatedPriceCents < originalPriceCents && negotiatedPriceCents > 0;
  const discountAmount = hasDiscount ? originalPriceCents - negotiatedPriceCents : 0;
  const discountPercentage = hasDiscount ? Math.round((discountAmount / originalPriceCents) * 100) : 0;

  const isBelowMinimum = minimumPriceCents ? negotiatedPriceCents < minimumPriceCents : false;
  const isAtOrBelowMinimum = minimumPriceCents ? negotiatedPriceCents <= minimumPriceCents : false;

  // Determine effective commission based on business rules
  const effectiveCommission = useMemo(() => {
    if (!negotiatedPriceCents || negotiatedPriceCents <= 0) return originalCommission;
    
    // Rule 1: If below minimum price, use minimum commission
    if (minimumPriceCents && negotiatedPriceCents < minimumPriceCents) {
      return minimumCommission ?? defaultCommission;
    }
    
    // Rule 2: If at minimum price, use minimum commission
    if (minimumPriceCents && negotiatedPriceCents === minimumPriceCents) {
      return minimumCommission ?? defaultCommission;
    }
    
    // Rule 3: If has any discount, use default commission
    if (hasDiscount) {
      return defaultCommission;
    }
    
    // No discount, use original commission
    return originalCommission;
  }, [negotiatedPriceCents, hasDiscount, minimumPriceCents, originalCommission, defaultCommission, minimumCommission]);

  const commissionValueCents = useMemo(() => {
    return Math.round(negotiatedPriceCents * (effectiveCommission / 100));
  }, [negotiatedPriceCents, effectiveCommission]);

  // Installment calculations
  const financedTotal = calculateInstallmentTotal(negotiatedPriceCents);
  const installmentValue = calculateInstallmentValue(negotiatedPriceCents, installments);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setInputValue((originalPriceCents / 100).toFixed(2).replace('.', ','));
      setInputMode('total');
      setInstallments(12);
    }
  }, [open, originalPriceCents]);

  const handleConfirm = () => {
    if (negotiatedPriceCents > 0) {
      onConfirm(negotiatedPriceCents, installments, effectiveCommission);
      onOpenChange(false);
    }
  };

  const commissionChanged = effectiveCommission !== originalCommission;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Negociar Valor
          </DialogTitle>
          <DialogDescription>
            Ajuste o valor do kit de {quantity} {quantity === 1 ? 'unidade' : 'unidades'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Original Price Reference */}
          <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Valor original:</span>
            <span className="font-bold">{formatPrice(originalPriceCents)}</span>
          </div>

          {/* Input Mode Toggle */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Editar por:</Label>
            <RadioGroup
              value={inputMode}
              onValueChange={(v) => {
                setInputMode(v as 'unit' | 'total');
                // Convert value when switching modes
                if (v === 'unit' && negotiatedPriceCents > 0) {
                  setInputValue((unitPriceCents / 100).toFixed(2).replace('.', ','));
                } else if (v === 'total' && negotiatedPriceCents > 0) {
                  setInputValue((negotiatedPriceCents / 100).toFixed(2).replace('.', ','));
                }
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="total" id="total" />
                <Label htmlFor="total" className="cursor-pointer">Valor Total</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unit" id="unit" />
                <Label htmlFor="unit" className="cursor-pointer">Valor Unitário</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Price Input */}
          <div className="space-y-2">
            <Label>{inputMode === 'total' ? 'Valor Total (R$)' : 'Valor por Unidade (R$)'}</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => {
                // Allow only numbers, comma and period
                const value = e.target.value.replace(/[^\d,\.]/g, '');
                setInputValue(value);
              }}
              placeholder="0,00"
              className="text-lg font-bold"
            />
          </div>

          {/* Calculated Values */}
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Valor Total:</span>
              <span className="font-bold">{formatPrice(negotiatedPriceCents)}</span>
            </div>
            {quantity > 1 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Por unidade:</span>
                <span>{formatPrice(unitPriceCents)}</span>
              </div>
            )}
            {hasDiscount && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Desconto:</span>
                <span>-{formatPrice(discountAmount)} ({discountPercentage}%)</span>
              </div>
            )}
          </div>

          {/* Minimum Price Warning */}
          {isBelowMinimum && minimumPriceCents && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Abaixo do Valor Mínimo ({formatPrice(minimumPriceCents)})
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Será necessário autorização do gerente para este desconto.
              </p>
            </div>
          )}

          <Separator />

          {/* Installments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Parcelamento:</Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 6, 10, 12].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={installments === n ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInstallments(n)}
                  className="min-w-[60px]"
                >
                  {n}x
                </Button>
              ))}
            </div>
            
            <div className="p-3 bg-primary/5 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {installments === 1 ? 'À vista:' : `${installments}x de:`}
                </span>
                <span className="font-bold text-lg">
                  {installments === 1 
                    ? formatPrice(negotiatedPriceCents)
                    : formatPrice(installmentValue)
                  }
                </span>
              </div>
              {installments > 1 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total parcelado:</span>
                  <span>{formatPrice(financedTotal)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Commission Info */}
          <div className={cn(
            "p-3 rounded-lg border",
            commissionChanged 
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
              : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                <span className="text-sm font-medium">Sua Comissão:</span>
              </div>
              <div className="text-right">
                <Badge variant="outline" className={cn(
                  commissionChanged ? "text-amber-600 border-amber-600" : "text-green-600 border-green-600"
                )}>
                  {effectiveCommission}%
                </Badge>
                <p className="font-bold text-lg mt-1">{formatPrice(commissionValueCents)}</p>
              </div>
            </div>
            
            {commissionChanged && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Com desconto aplicado, a comissão é calculada pela taxa padrão ({defaultCommission}%)
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={negotiatedPriceCents <= 0}>
            <Check className="w-4 h-4 mr-2" />
            Aplicar Valor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
