import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RacerData {
  userId: string;
  name: string;
  avatarHorseUrl: string | null;
  avatarUrl: string | null;
  dailySales: number;
  draftSales: number;
  totalTodayCents: number;
}

interface HorseRaceProps {
  racers: RacerData[];
}

export function HorseRace({ racers }: HorseRaceProps) {
  const sortedRacers = useMemo(() => {
    return [...racers]
      .filter(r => r.dailySales > 0 || r.draftSales > 0)
      .sort((a, b) => {
        // Sort by total sales (confirmed + drafts), then by value
        const aTotal = a.dailySales + a.draftSales;
        const bTotal = b.dailySales + b.draftSales;
        if (bTotal !== aTotal) return bTotal - aTotal;
        return b.totalTodayCents - a.totalTodayCents;
      })
      .slice(0, 8);
  }, [racers]);

  const maxSales = useMemo(() => {
    if (sortedRacers.length === 0) return 1;
    return Math.max(...sortedRacers.map(r => r.dailySales + r.draftSales));
  }, [sortedRacers]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-2xl">🏇</span>
          Corrida do Dia - Vendas Ativas
          <TrendingUp className="w-4 h-4 text-green-500 ml-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {sortedRacers.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-2 block">🏁</span>
            <p className="text-muted-foreground">Nenhuma venda hoje ainda...</p>
            <p className="text-sm text-muted-foreground">Quem vai largar na frente?</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRacers.map((racer, index) => {
              const totalSales = racer.dailySales + racer.draftSales;
              const progress = (totalSales / maxSales) * 100;
              
              return (
                <div key={racer.userId} className="relative">
                  {/* Track */}
                  <div className="h-16 bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/20 dark:to-amber-800/10 rounded-lg border border-amber-200/50 dark:border-amber-700/30 overflow-hidden relative">
                    {/* Track lines */}
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dashed border-amber-300/50"></div>
                    </div>
                    
                    {/* Finish line */}
                    <div className="absolute right-4 top-0 bottom-0 w-1 bg-gradient-to-b from-black via-white to-black opacity-30"></div>
                    
                    {/* Horse/Racer */}
                    <div 
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out flex items-center gap-2",
                        index === 0 && "animate-pulse"
                      )}
                      style={{ left: `calc(${Math.min(progress, 95)}% - 40px)` }}
                    >
                      <div className="relative">
                        <Avatar className={cn(
                          "w-12 h-12 ring-2 ring-offset-1",
                          index === 0 ? "ring-green-500" : 
                          index === 1 ? "ring-blue-400" : 
                          "ring-border"
                        )}>
                          <AvatarImage 
                            src={racer.avatarHorseUrl || racer.avatarUrl || undefined} 
                            alt={racer.name}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                            🏇
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Position badge */}
                        <div className={cn(
                          "absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                          index === 0 ? "bg-green-500 text-white" :
                          index === 1 ? "bg-blue-500 text-white" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        
                        {/* Dust effect for leader */}
                        {index === 0 && (
                          <div className="absolute -right-3 top-1/2 -translate-y-1/2">
                            <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Seller info */}
                    <div className="absolute left-2 top-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                      {racer.name.split(' ')[0]}
                    </div>
                    
                    {/* Stats */}
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 text-right">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">
                          {racer.dailySales}
                        </span>
                        {racer.draftSales > 0 && (
                          <span className="text-xs text-muted-foreground">
                            (+{racer.draftSales})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(racer.totalTodayCents)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Confirmadas
              </span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">(+N)</span>
                Rascunhos
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
