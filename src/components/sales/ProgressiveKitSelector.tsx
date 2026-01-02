import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Coins, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { ProductPriceKit } from '@/hooks/useProductPriceKits';
import { calculateCommissionValue, compareCommission, CommissionComparison } from '@/hooks/useSellerCommission';
import { cn } from '@/lib/utils';

type PriceType = 'regular' | 'promotional' | 'promotional_2' | 'minimum' | 'custom';

interface ProgressiveKitSelectorProps {
  kits: ProductPriceKit[];
  selectedKitId: string;
  selectedPriceType: PriceType;
  onSelectKit: (kitId: string, priceType: PriceType) => void;
  rejectedKitIds: string[];
  onRejectKit: (kitId: string, reason: string, quantity: number, priceCents: number) => void;
  sellerDefaultCommission: number;
}

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

const CommissionBadge = ({ comparison, value }: { comparison: CommissionComparison; value: number }) => {
  if (comparison === 'higher') {
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1">
        🤩 <TrendingUp className="w-3 h-3" /> {formatPrice(value)}
      </Badge>
    );
  }
  if (comparison === 'lower') {
    return (
      <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1">
        ☹️ <TrendingDown className="w-3 h-3" /> {formatPrice(value)}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Coins className="w-3 h-3" /> {formatPrice(value)}
    </Badge>
  );
};

export function ProgressiveKitSelector({
  kits,
  selectedKitId,
  selectedPriceType,
  onSelectKit,
  rejectedKitIds,
  onRejectKit,
  sellerDefaultCommission,
}: ProgressiveKitSelectorProps) {
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPromo2, setShowPromo2] = useState(false);
  const [showMinimum, setShowMinimum] = useState(false);

  // Sort kits by position
  const sortedKits = [...kits].sort((a, b) => a.position - b.position);

  // Find the current visible kit index (first non-rejected kit)
  const visibleKitIndex = sortedKits.findIndex(kit => !rejectedKitIds.includes(kit.id));
  const currentKit = visibleKitIndex >= 0 ? sortedKits[visibleKitIndex] : null;

  // Get all previously rejected kits (for display)
  const previousKits = sortedKits.filter(kit => rejectedKitIds.includes(kit.id));

  // Check if all kits have been revealed (all rejected at least once, or we're at the last kit)
  const allKitsRevealed = rejectedKitIds.length >= sortedKits.length - 1 || 
    (currentKit && sortedKits.indexOf(currentKit) === sortedKits.length - 1);

  const handleRejectCurrentKit = () => {
    if (!currentKit || !rejectionReason.trim()) return;

    // Get the price being rejected (promotional if available, otherwise regular)
    const priceCents = currentKit.promotional_price_cents || currentKit.regular_price_cents;

    onRejectKit(
      currentKit.id,
      rejectionReason.trim(),
      currentKit.quantity,
      priceCents
    );

    setRejectionReason('');
    setShowRejectionForm(false);
  };

  const renderKitPriceOption = (
    kit: ProductPriceKit,
    type: PriceType,
    label: string,
    priceCents: number | null,
    useDefault: boolean,
    customCommission: number | null,
    isHidden: boolean = false
  ) => {
    if (!priceCents) return null;

    // Check if this is a hidden price type
    if (isHidden && type === 'promotional_2' && !showPromo2) return null;
    if (isHidden && type === 'minimum' && !showMinimum) return null;

    const effectiveCommission = useDefault ? sellerDefaultCommission : (customCommission || sellerDefaultCommission);
    const commissionComparison = compareCommission(customCommission, sellerDefaultCommission, useDefault);
    const commissionValueForPrice = calculateCommissionValue(priceCents * kit.quantity, effectiveCommission);

    return (
      <label 
        key={`${kit.id}-${type}`}
        className={cn(
          "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all",
          selectedKitId === kit.id && selectedPriceType === type
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "hover:border-primary/50",
          isHidden && "opacity-75"
        )}
        onClick={() => onSelectKit(kit.id, type)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
            selectedKitId === kit.id && selectedPriceType === type
              ? "border-primary"
              : "border-muted-foreground"
          )}>
            {selectedKitId === kit.id && selectedPriceType === type && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          <div>
            <p className="font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">
              {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">{formatPrice(priceCents)}</p>
          <CommissionBadge comparison={commissionComparison} value={commissionValueForPrice} />
        </div>
      </label>
    );
  };

  const renderKitOptions = (kit: ProductPriceKit, showHiddenOptions: boolean = false) => (
    <div className="space-y-2">
      {/* Regular Price - Always Hidden in Seller View */}
      {/* Promotional Price renamed to "Venda por:" - Main visible option */}
      {kit.promotional_price_cents && renderKitPriceOption(
        kit, 
        'promotional', 
        'Venda por:', 
        kit.promotional_price_cents,
        kit.promotional_use_default_commission,
        kit.promotional_custom_commission,
        false
      )}
      
      {/* Fallback to regular if no promotional */}
      {!kit.promotional_price_cents && renderKitPriceOption(
        kit, 
        'regular', 
        'Venda por:', 
        kit.regular_price_cents,
        kit.regular_use_default_commission,
        kit.regular_custom_commission,
        false
      )}
      
      {/* Hidden options - Promotional 2 and Minimum */}
      {showHiddenOptions && (
        <>
          {/* Promotional Price 2 Button */}
          {kit.promotional_price_2_cents && !showPromo2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setShowPromo2(true);
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver Valor Promocional 2
            </Button>
          )}
          
          {showPromo2 && kit.promotional_price_2_cents && renderKitPriceOption(
            kit, 
            'promotional_2', 
            'Preço Promocional 2', 
            kit.promotional_price_2_cents,
            kit.promotional_2_use_default_commission,
            kit.promotional_2_custom_commission,
            false
          )}
          
          {/* Minimum Price Button */}
          {kit.minimum_price_cents && !showMinimum && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setShowMinimum(true);
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver Valor Mínimo
            </Button>
          )}
          
          {showMinimum && kit.minimum_price_cents && renderKitPriceOption(
            kit, 
            'minimum', 
            'Preço Mínimo', 
            kit.minimum_price_cents,
            kit.minimum_use_default_commission,
            kit.minimum_custom_commission,
            false
          )}
        </>
      )}
    </div>
  );

  if (!currentKit && sortedKits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum kit de preço disponível.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Previously revealed kits */}
      {previousKits.map((kit) => (
        <div 
          key={kit.id}
          className="border rounded-lg p-3 bg-muted/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-bold">
              {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Opção anterior
            </Badge>
          </div>
          <div className="space-y-2">
            {renderKitOptions(kit, true)}
          </div>
        </div>
      ))}

      {/* Current kit (the one being offered) */}
      {currentKit && (
        <div className="border-2 border-primary/30 rounded-lg p-4 bg-primary/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge className="font-bold bg-primary">
                {currentKit.quantity} {currentKit.quantity === 1 ? 'unidade' : 'unidades'}
              </Badge>
              {visibleKitIndex === 0 && (
                <Badge variant="secondary" className="text-xs">
                  ⭐ Oferta Principal
                </Badge>
              )}
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {renderKitOptions(currentKit, true)}
          </div>

          {/* Reject button - only show if there are more kits and not showing rejection form */}
          {!allKitsRevealed && sortedKits.length > 1 && !showRejectionForm && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => setShowRejectionForm(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Não consegui vender esse, mostrar outra opção de valor
            </Button>
          )}

          {/* Rejection form */}
          {showRejectionForm && (
            <div className="mt-4 p-4 border border-amber-200 rounded-lg bg-amber-50/50 space-y-3">
              <Label className="text-amber-900 font-medium">
                Por que o cliente não quis essa oferta?
              </Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Cliente achou caro, quer quantidade menor, etc..."
                rows={2}
                className="border-amber-200"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowRejectionForm(false);
                    setRejectionReason('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!rejectionReason.trim()}
                  onClick={handleRejectCurrentKit}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Confirmar e Ver Próxima Opção
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All kits revealed message */}
      {allKitsRevealed && sortedKits.length > 1 && (
        <div className="text-center text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
          ✅ Todas as opções de kit foram reveladas. Selecione a melhor opção acima.
        </div>
      )}
    </div>
  );
}
