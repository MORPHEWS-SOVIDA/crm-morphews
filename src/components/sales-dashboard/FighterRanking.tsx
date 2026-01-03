import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Flame, Swords, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FighterData {
  userId: string;
  name: string;
  avatarFighterUrl: string | null;
  avatarUrl: string | null;
  deliveredCount: number;
  paidCount: number;
  totalPaidCents: number;
}

interface FighterRankingProps {
  fighters: FighterData[];
}

export function FighterRanking({ fighters }: FighterRankingProps) {
  const sortedFighters = useMemo(() => {
    return [...fighters]
      .filter(f => f.deliveredCount > 0 || f.paidCount > 0)
      .sort((a, b) => {
        // Sort by paid count first, then by delivered, then by value
        if (b.paidCount !== a.paidCount) return b.paidCount - a.paidCount;
        if (b.deliveredCount !== a.deliveredCount) return b.deliveredCount - a.deliveredCount;
        return b.totalPaidCents - a.totalPaidCents;
      })
      .slice(0, 10);
  }, [fighters]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getPowerLevel = (index: number) => {
    if (index === 0) return { color: 'text-red-500', flames: 3, title: 'CAMPEÃO' };
    if (index === 1) return { color: 'text-orange-500', flames: 2, title: 'DESAFIANTE' };
    if (index === 2) return { color: 'text-yellow-500', flames: 1, title: 'ELITE' };
    return { color: 'text-muted-foreground', flames: 0, title: '' };
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-red-500/10 via-orange-500/5 to-yellow-500/10 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Swords className="w-5 h-5 text-red-500" />
          Arena de Lutadores - Entregas Pagas
          <Flame className="w-4 h-4 text-orange-500 ml-auto animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {sortedFighters.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-2 block">🥊</span>
            <p className="text-muted-foreground">Nenhuma entrega paga ainda...</p>
            <p className="text-sm text-muted-foreground">Quem será o campeão?</p>
          </div>
        ) : (
          <>
            {/* Top 3 - Podium style */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {sortedFighters.slice(0, 3).map((fighter, index) => {
                const power = getPowerLevel(index);
                const displayOrder = [1, 0, 2]; // 2nd, 1st, 3rd
                const actualIndex = displayOrder[index];
                const actualFighter = sortedFighters[actualIndex];
                const actualPower = getPowerLevel(actualIndex);
                
                if (!actualFighter) return null;
                
                return (
                  <div 
                    key={actualFighter.userId}
                    className={cn(
                      "flex flex-col items-center p-4 rounded-xl transition-all",
                      actualIndex === 0 ? "bg-gradient-to-b from-red-500/20 to-orange-500/10 ring-2 ring-red-500/30 scale-105" :
                      actualIndex === 1 ? "bg-gradient-to-b from-orange-500/15 to-yellow-500/5" :
                      "bg-gradient-to-b from-yellow-500/10 to-amber-500/5"
                    )}
                  >
                    {/* Champion crown */}
                    {actualIndex === 0 && (
                      <Crown className="w-6 h-6 text-yellow-500 mb-1 animate-bounce" />
                    )}
                    
                    {/* Fighter avatar */}
                    <div className="relative mb-2">
                      <Avatar className={cn(
                        "w-16 h-16 ring-2 ring-offset-2",
                        actualIndex === 0 ? "ring-red-500" :
                        actualIndex === 1 ? "ring-orange-400" :
                        "ring-yellow-400"
                      )}>
                        <AvatarImage 
                          src={actualFighter.avatarFighterUrl || actualFighter.avatarUrl || undefined}
                          alt={actualFighter.name}
                          className="object-cover"
                        />
                        <AvatarFallback className={cn(
                          "font-bold text-lg",
                          actualIndex === 0 ? "bg-red-100 text-red-700" :
                          actualIndex === 1 ? "bg-orange-100 text-orange-700" :
                          "bg-yellow-100 text-yellow-700"
                        )}>
                          🥊
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Flames */}
                      {actualPower.flames > 0 && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {Array(actualPower.flames).fill(0).map((_, i) => (
                            <Flame 
                              key={i} 
                              className={cn("w-3 h-3", actualPower.color)} 
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Position */}
                    <div className={cn(
                      "text-2xl font-black mb-1",
                      actualPower.color
                    )}>
                      {actualIndex + 1}º
                    </div>
                    
                    {/* Title */}
                    {actualPower.title && (
                      <span className={cn(
                        "text-[10px] font-bold tracking-wider mb-1",
                        actualPower.color
                      )}>
                        {actualPower.title}
                      </span>
                    )}
                    
                    {/* Name */}
                    <p className="text-sm font-semibold text-center truncate w-full">
                      {actualFighter.name.split(' ')[0]}
                    </p>
                    
                    {/* Stats */}
                    <div className="mt-2 text-center space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-bold text-green-600">{actualFighter.paidCount}</span> pagas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {actualFighter.deliveredCount} entregas
                      </p>
                      <p className="text-xs font-medium text-primary">
                        {formatCurrency(actualFighter.totalPaidCents)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* 4th-10th places */}
            {sortedFighters.length > 3 && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sortedFighters.slice(3, 10).map((fighter, index) => (
                    <div 
                      key={fighter.userId}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="w-6 text-center font-bold text-muted-foreground">
                        {index + 4}º
                      </span>
                      <Avatar className="w-10 h-10">
                        <AvatarImage 
                          src={fighter.avatarFighterUrl || fighter.avatarUrl || undefined}
                          alt={fighter.name}
                        />
                        <AvatarFallback className="text-sm">🥊</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fighter.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fighter.paidCount} pagas • {formatCurrency(fighter.totalPaidCents)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
