import { Card, CardContent } from '@/components/ui/card';
import { OFFER_TYPE_CONFIGS, type OfferType } from './types';
import { cn } from '@/lib/utils';

interface StepTypeSelectionProps {
  selectedType: OfferType | null;
  onSelect: (type: OfferType) => void;
}

export function StepTypeSelection({ selectedType, onSelect }: StepTypeSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">O que você quer vender?</h2>
        <p className="text-muted-foreground">
          Escolha o tipo de oferta para personalizarmos a experiência
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {OFFER_TYPE_CONFIGS.map((config) => (
          <Card
            key={config.value}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
              selectedType === config.value && 'ring-2 ring-primary border-primary bg-primary/5'
            )}
            onClick={() => onSelect(config.value)}
          >
            <CardContent className="p-4 text-center space-y-2">
              <div className="text-3xl">{config.icon}</div>
              <div className="font-medium text-sm">{config.label}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {config.description}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
