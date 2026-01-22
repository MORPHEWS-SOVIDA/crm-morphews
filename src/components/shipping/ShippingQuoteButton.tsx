import { useState } from 'react';
import { Package, Loader2, Truck, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useShippingQuote, ShippingQuote, formatShippingPrice } from '@/hooks/useShippingQuote';
import { toast } from 'sonner';

interface ShippingQuoteButtonProps {
  cep: string;
  weightGrams?: number;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSelectQuote?: (quote: ShippingQuote) => void;
}

export function ShippingQuoteButton({
  cep,
  weightGrams,
  variant = 'outline',
  size = 'sm',
  className,
  onSelectQuote,
}: ShippingQuoteButtonProps) {
  const { getQuotes, isLoading } = useShippingQuote();
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [open, setOpen] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    
    if (isOpen && !hasQueried) {
      try {
        const result = await getQuotes({
          destination_cep: cep,
          weight_grams: weightGrams,
        });
        setQuotes(result);
        setHasQueried(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao consultar frete');
        setOpen(false);
      }
    }
  };

  const handleRefresh = async () => {
    try {
      const result = await getQuotes({
        destination_cep: cep,
        weight_grams: weightGrams,
      });
      setQuotes(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao consultar frete');
    }
  };

  // Clean CEP for display
  const cleanCep = cep?.replace(/\D/g, '') || '';
  const isValidCep = cleanCep.length === 8;

  if (!isValidCep) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Truck className="w-4 h-4" />
          )}
          <span className="ml-1.5">Ver Frete</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Frete para CEP {cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2')}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-7 px-2"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Atualizar'}
            </Button>
          </div>
        </div>
        
        <div className="p-2 max-h-64 overflow-y-auto">
          {isLoading && quotes.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Consultando...
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">Nenhuma opção disponível</p>
            </div>
          ) : (
            <div className="space-y-1">
              {quotes.map((quote) => (
                <div
                  key={quote.service_code}
                  className={`p-3 rounded-lg border transition-colors ${
                    quote.error 
                      ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                      : 'hover:bg-accent cursor-pointer'
                  }`}
                  onClick={() => {
                    if (!quote.error && onSelectQuote) {
                      onSelectQuote(quote);
                      setOpen(false);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{quote.service_name}</span>
                    {quote.error ? (
                      <Badge variant="outline" className="text-xs text-destructive">
                        Indisponível
                      </Badge>
                    ) : (
                      <span className="font-semibold text-primary">
                        {formatShippingPrice(quote.price_cents)}
                      </span>
                    )}
                  </div>
                  {quote.error ? (
                    <p className="text-xs text-muted-foreground">{quote.error}</p>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        {quote.delivery_days === 1 
                          ? '1 dia útil' 
                          : `${quote.delivery_days} dias úteis`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
