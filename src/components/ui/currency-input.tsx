import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number; // valor em centavos
  onChange: (valueCents: number) => void;
}

function formatCurrency(cents: number): string {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(formattedValue: string): number {
  // Remove tudo exceto dígitos
  const onlyDigits = formattedValue.replace(/\D/g, '');
  return parseInt(onlyDigits || '0', 10);
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatCurrency(value || 0));

    // Atualiza display quando value externo muda
    React.useEffect(() => {
      setDisplayValue(formatCurrency(value || 0));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const cents = parseCurrency(rawValue);
      
      // Limita a 10 dígitos (R$ 99.999.999,99)
      if (cents > 9999999999) return;
      
      setDisplayValue(formatCurrency(cents));
      onChange(cents);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Seleciona todo o texto ao focar
      e.target.select();
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-right',
            className
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
