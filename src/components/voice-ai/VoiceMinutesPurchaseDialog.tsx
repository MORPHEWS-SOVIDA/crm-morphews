import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Check, Zap, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VoicePackage {
  id: string;
  name: string;
  minutes: number;
  price_cents: number;
  price_per_minute_cents: number;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

interface VoiceMinutesPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceMinutesPurchaseDialog({ open, onOpenChange }: VoiceMinutesPurchaseDialogProps) {
  const { tenantId } = useTenant();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ['voice-minutes-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_minutes_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as VoicePackage[];
    },
  });

  const handlePurchase = async (pkg: VoicePackage) => {
    if (!tenantId) {
      toast.error('Organização não identificada');
      return;
    }

    setPurchasingId(pkg.id);

    try {
      const { data, error } = await supabase.functions.invoke('voice-ai-checkout', {
        body: {
          packageId: pkg.id,
          organizationId: tenantId,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de pagamento não recebida');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erro ao iniciar checkout');
      setPurchasingId(null);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutos`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const getDiscount = (pkg: VoicePackage, packages: VoicePackage[]) => {
    const basePackage = packages.find(p => p.display_order === 1);
    if (!basePackage || pkg.id === basePackage.id) return 0;
    
    const basePrice = basePackage.price_per_minute_cents;
    const discount = Math.round((1 - pkg.price_per_minute_cents / basePrice) * 100);
    return discount;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Comprar Minutos de Voice AI
          </DialogTitle>
          <DialogDescription>
            Escolha um pacote de minutos para ligações com inteligência artificial
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 py-4">
            {packages?.map((pkg, index) => {
              const discount = getDiscount(pkg, packages);
              const isPopular = index === 1;
              const isPurchasing = purchasingId === pkg.id;

              return (
                <Card 
                  key={pkg.id}
                  className={cn(
                    "relative overflow-hidden transition-all hover:shadow-lg cursor-pointer",
                    isPopular && "border-primary shadow-md ring-2 ring-primary/20"
                  )}
                  onClick={() => !isPurchasing && handlePurchase(pkg)}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-primary">
                        <Star className="h-3 w-3 mr-1" />
                        Popular
                      </Badge>
                    </div>
                  )}
                  
                  {discount > 0 && (
                    <div className="absolute top-0 left-0">
                      <Badge variant="secondary" className="rounded-none rounded-br-lg">
                        -{discount}%
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-6 pt-8">
                    <div className="text-center space-y-4">
                      <div>
                        <h3 className="text-lg font-bold">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatMinutes(pkg.minutes)}
                        </p>
                      </div>

                      <div>
                        <p className="text-3xl font-bold text-primary">
                          {formatCurrency(pkg.price_cents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(pkg.price_per_minute_cents)}/min
                        </p>
                      </div>

                      {pkg.description && (
                        <p className="text-xs text-muted-foreground">
                          {pkg.description}
                        </p>
                      )}

                      <Button 
                        className="w-full" 
                        variant={isPopular ? "default" : "outline"}
                        disabled={isPurchasing}
                      >
                        {isPurchasing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Comprar
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground">
          <p>Pagamento seguro via Stripe. Os minutos são creditados automaticamente após o pagamento.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
