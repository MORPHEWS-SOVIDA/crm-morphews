import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  salesCount: number;
  totalCents: number;
}

interface SalesPodiumProps {
  sellers: SellerData[];
  title: string;
  metric: 'count' | 'value';
}

export function SalesPodium({ sellers, title, metric }: SalesPodiumProps) {
  const sortedSellers = useMemo(() => {
    return [...sellers]
      .sort((a, b) => metric === 'count' 
        ? b.salesCount - a.salesCount 
        : b.totalCents - a.totalCents
      )
      .slice(0, 5);
  }, [sellers, metric]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getPositionStyles = (position: number) => {
    switch (position) {
      case 0: // 1º lugar
        return {
          height: 'h-32',
          bg: 'bg-gradient-to-t from-amber-500 to-yellow-400',
          border: 'border-yellow-300',
          shadow: 'shadow-lg shadow-yellow-500/30',
          trophy: <Trophy className="w-6 h-6 text-yellow-300" />,
        };
      case 1: // 2º lugar
        return {
          height: 'h-24',
          bg: 'bg-gradient-to-t from-slate-400 to-slate-300',
          border: 'border-slate-200',
          shadow: 'shadow-md shadow-slate-400/30',
          trophy: <Medal className="w-5 h-5 text-slate-200" />,
        };
      case 2: // 3º lugar
        return {
          height: 'h-20',
          bg: 'bg-gradient-to-t from-amber-700 to-amber-600',
          border: 'border-amber-500',
          shadow: 'shadow-md shadow-amber-600/30',
          trophy: <Medal className="w-5 h-5 text-amber-400" />,
        };
      default:
        return {
          height: 'h-16',
          bg: 'bg-gradient-to-t from-muted to-muted/80',
          border: 'border-border',
          shadow: 'shadow-sm',
          trophy: null,
        };
    }
  };

  const getOrderForDisplay = () => {
    // Reorder for podium display: 2nd, 1st, 3rd
    if (sortedSellers.length >= 3) {
      return [sortedSellers[1], sortedSellers[0], sortedSellers[2], ...sortedSellers.slice(3)];
    }
    return sortedSellers;
  };

  const displayOrder = getOrderForDisplay();
  const originalPositions = sortedSellers.length >= 3 ? [1, 0, 2, 3, 4] : [0, 1, 2, 3, 4];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {sortedSellers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma venda registrada</p>
        ) : (
          <div className="flex items-end justify-center gap-3 mb-6">
            {displayOrder.slice(0, 3).map((seller, displayIndex) => {
              const originalPosition = originalPositions[displayIndex];
              const styles = getPositionStyles(originalPosition);
              
              return (
                <div key={seller.userId} className="flex flex-col items-center">
                  <div className="relative mb-2">
                    <Avatar className={cn(
                      "w-14 h-14 ring-2",
                      originalPosition === 0 ? "ring-yellow-400 ring-offset-2" : 
                      originalPosition === 1 ? "ring-slate-300 ring-offset-1" : 
                      "ring-amber-500 ring-offset-1"
                    )}>
                      <AvatarImage src={seller.avatarUrl || undefined} alt={seller.name} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {seller.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {styles.trophy && (
                      <div className="absolute -top-2 -right-2 bg-background rounded-full p-1 shadow-md">
                        {styles.trophy}
                      </div>
                    )}
                  </div>
                  
                  <div className={cn(
                    "w-20 rounded-t-lg flex flex-col items-center justify-end pb-2 transition-all",
                    styles.height,
                    styles.bg,
                    styles.shadow
                  )}>
                    <span className="text-white font-bold text-xl drop-shadow-md">
                      {originalPosition + 1}º
                    </span>
                  </div>
                  
                  <div className="mt-2 text-center max-w-[80px]">
                    <p className="text-xs font-medium truncate" title={seller.name}>
                      {seller.name.split(' ')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric === 'count' 
                        ? `${seller.salesCount} vendas`
                        : formatCurrency(seller.totalCents)
                      }
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4º e 5º lugares */}
        {sortedSellers.length > 3 && (
          <div className="border-t pt-4 space-y-2">
            {sortedSellers.slice(3, 5).map((seller, index) => (
              <div 
                key={seller.userId}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {index + 4}º
                </span>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={seller.avatarUrl || undefined} alt={seller.name} />
                  <AvatarFallback className="text-xs">
                    {seller.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium truncate">{seller.name}</span>
                <span className="text-sm text-muted-foreground">
                  {metric === 'count' 
                    ? `${seller.salesCount} vendas`
                    : formatCurrency(seller.totalCents)
                  }
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
