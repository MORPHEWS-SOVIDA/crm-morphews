import { Filter, X, Star, User, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { useState } from 'react';

interface MobileFiltersProps {
  selectedStars: number | null;
  selectedStage: FunnelStage | null;
  selectedResponsavel: string | null;
  onSelectStars: (stars: number | null) => void;
  onSelectStage: (stage: FunnelStage | null) => void;
  onSelectResponsavel: (responsavel: string | null) => void;
  responsaveis: string[];
}

export function MobileFilters({
  selectedStars,
  selectedStage,
  selectedResponsavel,
  onSelectStars,
  onSelectStage,
  onSelectResponsavel,
  responsaveis,
}: MobileFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasFilters = selectedStars !== null || selectedStage !== null || selectedResponsavel !== null;
  const filterCount = [selectedStars, selectedStage, selectedResponsavel].filter(Boolean).length;

  const clearFilters = () => {
    onSelectStars(null);
    onSelectStage(null);
    onSelectResponsavel(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 relative">
          <Filter className="w-4 h-4" />
          Filtros
          {filterCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {filterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Filtros</SheetTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive">
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Stars Filter */}
          <div>
            <h4 className="flex items-center gap-2 font-medium text-foreground mb-3">
              <Star className="w-4 h-4" />
              Classificação por Estrelas
            </h4>
            <div className="flex flex-wrap gap-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <button
                  key={stars}
                  onClick={() => onSelectStars(selectedStars === stars ? null : stars)}
                  className={cn(
                    'flex items-center gap-1 px-4 py-2 rounded-full border transition-all',
                    selectedStars === stars
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 border-border hover:bg-muted'
                  )}
                >
                  <Star className={cn('w-4 h-4', selectedStars === stars ? 'fill-current' : 'fill-yellow-400 text-yellow-400')} />
                  <span className="text-sm font-medium">{stars}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stage Filter */}
          <div>
            <h4 className="flex items-center gap-2 font-medium text-foreground mb-3">
              <Layers className="w-4 h-4" />
              Etapa do Funil
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FUNNEL_STAGES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => onSelectStage(selectedStage === key ? null : key as FunnelStage)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                    selectedStage === key
                      ? cn(value.color, value.textColor, 'border-transparent')
                      : 'bg-muted/50 border-border hover:bg-muted text-foreground'
                  )}
                >
                  {value.label}
                </button>
              ))}
            </div>
          </div>

          {/* Responsavel Filter */}
          {responsaveis.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 font-medium text-foreground mb-3">
                <User className="w-4 h-4" />
                Responsável
              </h4>
              <div className="flex flex-wrap gap-2">
                {responsaveis.map((responsavel) => (
                  <button
                    key={responsavel}
                    onClick={() => onSelectResponsavel(selectedResponsavel === responsavel ? null : responsavel)}
                    className={cn(
                      'px-4 py-2 rounded-full border text-sm font-medium transition-all',
                      selectedResponsavel === responsavel
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 border-border hover:bg-muted text-foreground'
                    )}
                  >
                    {responsavel}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button className="w-full" onClick={() => setIsOpen(false)}>
          Aplicar Filtros
        </Button>
      </SheetContent>
    </Sheet>
  );
}
