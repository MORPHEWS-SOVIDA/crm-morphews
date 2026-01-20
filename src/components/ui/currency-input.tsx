import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number; // valor em centavos
  onChange: (valueCents: number) => void;
}

function formatCurrency(cents: number): string {
  if (cents === 0) return '';
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
  ({ className, value, onChange, placeholder = '0,00', ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatCurrency(value || 0));
    const [isFocused, setIsFocused] = React.useState(false);

    // Atualiza display quando value externo muda (e não está focado)
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatCurrency(value || 0));
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // Se apagou tudo, limpa
      if (!rawValue.trim()) {
        setDisplayValue('');
        onChange(0);
        return;
      }
      
      const cents = parseCurrency(rawValue);
      
      // Limita a 10 dígitos (R$ 99.999.999,99)
      if (cents > 9999999999) return;
      
      // Formata e exibe
      const formatted = formatCurrency(cents);
      setDisplayValue(formatted);
      onChange(cents);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // Seleciona todo o texto ao focar para facilitar digitação
      setTimeout(() => e.target.select(), 0);
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Reformata ao sair do campo
      setDisplayValue(formatCurrency(value || 0));
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">
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
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
