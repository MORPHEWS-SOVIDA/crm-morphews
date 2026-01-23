import { CreditCard, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavedCard {
  id: string;
  card_brand: string | null;
  card_last_digits: string | null;
  is_default: boolean;
  gateway_type: string;
}

interface SavedCardsSelectorProps {
  cards: SavedCard[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string | null) => void;
  primaryColor?: string;
}

const BRAND_ICONS: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  elo: '💳',
  amex: '💳',
  hipercard: '💳',
};

export function SavedCardsSelector({
  cards,
  selectedCardId,
  onSelectCard,
  primaryColor,
}: SavedCardsSelectorProps) {
  if (cards.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      <p className="text-sm font-medium text-muted-foreground">Cartões salvos</p>
      
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelectCard(card.id)}
          className={cn(
            "w-full flex items-center gap-3 p-3 border rounded-lg transition-all text-left",
            selectedCardId === card.id
              ? "border-2 bg-muted/50"
              : "hover:bg-muted/30"
          )}
          style={selectedCardId === card.id ? { borderColor: primaryColor } : undefined}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {card.card_brand?.toUpperCase() || 'Cartão'} •••• {card.card_last_digits || '****'}
            </p>
            {card.is_default && (
              <span className="text-xs text-muted-foreground">Padrão</span>
            )}
          </div>
          {selectedCardId === card.id && (
            <Check className="h-5 w-5" style={{ color: primaryColor }} />
          )}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onSelectCard(null)}
        className={cn(
          "w-full flex items-center gap-3 p-3 border rounded-lg transition-all text-left",
          selectedCardId === null
            ? "border-2 bg-muted/50"
            : "hover:bg-muted/30 border-dashed"
        )}
        style={selectedCardId === null ? { borderColor: primaryColor } : undefined}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
          <Plus className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Usar novo cartão</p>
          <span className="text-xs text-muted-foreground">Pagar com outro cartão</span>
        </div>
        {selectedCardId === null && (
          <Check className="h-5 w-5" style={{ color: primaryColor }} />
        )}
      </button>
    </div>
  );
}
