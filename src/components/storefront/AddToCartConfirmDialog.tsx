import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Home, CreditCard, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { calculateInstallmentWithInterest } from '@/hooks/ecommerce/useTenantInstallmentFees';

interface AddToCartConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefrontSlug: string;
  productName: string;
  quantity: number;
  kitSize: number;
  totalPrice: number;
  primaryColor: string;
  // Optional installment config for real interest rates
  installmentConfig?: {
    installment_fees?: Record<string, number>;
    installment_fee_passed_to_buyer?: boolean;
    max_installments?: number;
  };
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatCurrencyParts(cents: number): { main: string; decimals: string } {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
  
  const match = formatted.match(/^(R\$\s*\d+(?:\.\d{3})*)(,\d{2})$/);
  if (match) {
    return { main: match[1], decimals: match[2] };
  }
  return { main: formatted, decimals: '' };
}

export function AddToCartConfirmDialog({
  open,
  onOpenChange,
  storefrontSlug,
  productName,
  quantity,
  kitSize,
  totalPrice,
  primaryColor,
  installmentConfig,
}: AddToCartConfirmDialogProps) {
  const navigate = useNavigate();

  const handleContinueShopping = () => {
    onOpenChange(false);
    navigate(`/loja/${storefrontSlug}`);
  };

  const handleGoToCheckout = () => {
    onOpenChange(false);
    navigate(`/loja/${storefrontSlug}/carrinho`);
  };

  const totalUnits = quantity * kitSize;
  
  // Calculate installment with interest
  const maxInstallments = installmentConfig?.max_installments || 12;
  const installmentInfo = calculateInstallmentWithInterest(
    totalPrice,
    maxInstallments,
    installmentConfig?.installment_fees,
    installmentConfig?.installment_fee_passed_to_buyer ?? true
  );
  const parts = formatCurrencyParts(installmentInfo.installmentValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Check className="h-6 w-6" style={{ color: primaryColor }} />
            </div>
            Produto Adicionado!
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Product Summary */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 mb-6">
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              <Package className="h-6 w-6" style={{ color: primaryColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{productName}</p>
              <p className="text-sm text-muted-foreground">
                {kitSize > 1 ? `Kit ${kitSize} un` : '1 unidade'} × {quantity}
                {totalUnits > 1 && ` = ${totalUnits} unidades`}
              </p>
            </div>
            <div className="text-right">
              {/* Installment value - HIGHLIGHT */}
              <div className="flex items-baseline justify-end gap-0.5">
                <span className="text-sm text-muted-foreground">{maxInstallments}x</span>
                <span 
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {parts.main}
                </span>
                <span className="text-sm text-muted-foreground">
                  {parts.decimals}
                </span>
              </div>
              {/* Cash price - secondary */}
              <p className="text-xs text-muted-foreground">
                ou {formatCurrency(totalPrice)} à vista
              </p>
            </div>
          </div>

          {/* Action Buttons - Full Width for Mobile */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full h-14 text-base font-semibold gap-3"
              style={{ backgroundColor: primaryColor }}
              onClick={handleGoToCheckout}
            >
              <CreditCard className="h-5 w-5" />
              Finalizar Compra
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-14 text-base font-semibold gap-3"
              onClick={handleContinueShopping}
            >
              <Home className="h-5 w-5" />
              Continuar Comprando
            </Button>
          </div>

          {/* Cart indicator */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t text-sm text-muted-foreground">
            <ShoppingCart className="h-4 w-4" />
            <span>Seu carrinho foi atualizado</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
