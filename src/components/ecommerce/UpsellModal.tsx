import { useState } from 'react';
import { Gift, CreditCard, Loader2, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface UpsellProduct {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  original_price_cents: number;
  upsell_price_cents: number;
  discount_percentage: number;
}

interface SavedCard {
  id: string;
  card_brand: string;
  card_last_digits: string;
}

interface UpsellModalProps {
  open: boolean;
  onClose: () => void;
  product: UpsellProduct;
  savedCard?: SavedCard;
  saleId: string;
  onSuccess?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function getCardBrandIcon(brand: string): string {
  const brands: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    elo: '💳',
    hipercard: '💳',
  };
  return brands[brand.toLowerCase()] || '💳';
}

export function UpsellModal({
  open,
  onClose,
  product,
  savedCard,
  saleId,
  onSuccess,
}: UpsellModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleOneClickPurchase = async () => {
    if (!savedCard) {
      toast.error('Nenhum cartão salvo disponível');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecommerce-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            parent_sale_id: saleId,
            items: [{
              product_id: product.id,
              quantity: 1,
              price_cents: product.upsell_price_cents,
            }],
            payment_method: 'credit_card',
            card_token: savedCard.id,
            is_upsell: true,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao processar pagamento');
      }

      setIsSuccess(true);
      toast.success('Compra realizada com sucesso!');
      
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Upsell error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">Compra Confirmada!</h3>
            <p className="text-muted-foreground">
              {product.name} foi adicionado ao seu pedido.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Gift className="h-5 w-5" />
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              OFERTA EXCLUSIVA
            </Badge>
          </div>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          <DialogDescription>
            {product.description || 'Aproveite essa oferta especial!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Image */}
          {product.image_url && (
            <div className="aspect-square w-full max-w-[200px] mx-auto rounded-lg overflow-hidden bg-muted">
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Pricing */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-3">
              <span className="text-lg text-muted-foreground line-through">
                {formatCurrency(product.original_price_cents)}
              </span>
              <Badge className="bg-red-500">-{product.discount_percentage}%</Badge>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(product.upsell_price_cents)}
            </p>
          </div>

          {/* Saved Card Info */}
          {savedCard && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">
                Pagar com {getCardBrandIcon(savedCard.card_brand)} ****{savedCard.card_last_digits}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
            onClick={handleOneClickPurchase}
            disabled={isProcessing || !savedCard}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Comprar com 1 Clique
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={onClose}
            disabled={isProcessing}
          >
            Não, obrigado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
