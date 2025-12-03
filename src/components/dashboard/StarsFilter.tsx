import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Lead } from '@/types/lead';

interface StarsFilterProps {
  leads: Lead[];
  selectedStars: number | null;
  onSelectStars: (stars: number | null) => void;
}

export function StarsFilter({ leads, selectedStars, onSelectStars }: StarsFilterProps) {
  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: leads.filter((lead) => lead.stars === star).length,
  }));

  return (
    <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold text-foreground mb-4">Classificação dos Leads</h3>
      <div className="space-y-3">
        {starCounts.map(({ star, count }) => (
          <button
            key={star}
            onClick={() => onSelectStars(selectedStars === star ? null : star)}
            className={cn(
              'w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200',
              selectedStars === star
                ? 'bg-primary/10 ring-2 ring-primary'
                : 'bg-muted/50 hover:bg-muted'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'w-4 h-4',
                      i < star
                        ? 'fill-star-filled text-star-filled'
                        : 'fill-transparent text-star-empty'
                    )}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                {star === 5 && 'Top Priority'}
                {star === 4 && 'Alta Prioridade'}
                {star === 3 && 'Média'}
                {star === 2 && 'Baixa'}
                {star === 1 && 'Iniciante'}
              </span>
            </div>
            <span className={cn(
              'px-3 py-1 rounded-full text-sm font-semibold',
              count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
