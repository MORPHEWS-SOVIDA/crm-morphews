import { useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useSalesCampaign, getFortnightRange, CampaignSeller } from '@/hooks/useSalesCampaign';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Package, DollarSign, Layers, CalendarDays, Loader2, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

interface RankingCardProps {
  title: string;
  emoji: string;
  prize: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  ringColor: string;
  sellers: { seller: CampaignSeller; value: string }[];
  icon: React.ReactNode;
  position: '🥇' | '🥈' | '🥉';
}

function RankingCard({ title, emoji, prize, color, gradientFrom, gradientTo, ringColor, sellers, icon, position }: RankingCardProps) {
  if (sellers.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className={cn('pb-4', `bg-gradient-to-r ${gradientFrom} ${gradientTo}`)}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">{emoji}</span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground py-8">Nenhuma venda entregue ainda</p>
        </CardContent>
      </Card>
    );
  }

  const winner = sellers[0];

  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn('pb-4', `bg-gradient-to-r ${gradientFrom} ${gradientTo}`)}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1">
            <span>{title}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <Gift className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-normal text-muted-foreground">{prize}</span>
            </div>
          </div>
          <span className="text-2xl">{position}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Winner highlight */}
        <div className={cn(
          'flex flex-col items-center p-6 rounded-2xl mb-4 relative overflow-hidden',
          `bg-gradient-to-b ${gradientFrom} ${gradientTo}`
        )}>
          <div className="absolute top-2 right-2 text-4xl opacity-20">{emoji}</div>
          <Trophy className={cn('w-8 h-8 mb-2', color)} />
          <Avatar className={cn('w-20 h-20 ring-4 ring-offset-2 mb-3', ringColor)}>
            <AvatarImage src={winner.seller.avatarUrl || undefined} alt={winner.seller.name} />
            <AvatarFallback className="text-xl font-bold bg-primary/20 text-primary">
              {winner.seller.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <p className="text-lg font-bold">{winner.seller.name.split(' ')[0]}</p>
          <p className={cn('text-2xl font-black mt-1', color)}>{winner.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{winner.seller.deliveredCount} vendas entregues</p>
        </div>

        {/* Other sellers */}
        {sellers.length > 1 && (
          <div className="space-y-2">
            {sellers.slice(1).map((item, index) => (
              <div
                key={item.seller.userId}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {index + 2}º
                </span>
                <Avatar className="w-10 h-10">
                  <AvatarImage src={item.seller.avatarUrl || undefined} alt={item.seller.name} />
                  <AvatarFallback className="text-xs">
                    {item.seller.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium truncate">{item.seller.name}</span>
                <span className={cn('text-sm font-bold', color)}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SalesDashboard() {
  const { data: sellers, isLoading } = useSalesCampaign();
  const fortnight = getFortnightRange();

  // Rankings
  const valueRanking = useMemo(() => {
    if (!sellers) return [];
    return [...sellers]
      .sort((a, b) => b.deliveredValueCents - a.deliveredValueCents)
      .map(s => ({ seller: s, value: formatCurrency(s.deliveredValueCents) }));
  }, [sellers]);

  const frascosRanking = useMemo(() => {
    if (!sellers) return [];
    return [...sellers]
      .sort((a, b) => b.totalFrascos - a.totalFrascos)
      .map(s => ({ seller: s, value: `${s.totalFrascos} frascos` }));
  }, [sellers]);

  const aggregatedRanking = useMemo(() => {
    if (!sellers) return [];
    return [...sellers]
      .sort((a, b) => b.aggregatedSalesCount - a.aggregatedSalesCount)
      .map(s => ({ seller: s, value: `${s.aggregatedSalesCount} vendas agregadas` }));
  }, [sellers]);

  // Summary
  const summary = useMemo(() => {
    if (!sellers || sellers.length === 0) return { totalDelivered: 0, totalValue: 0, totalFrascos: 0, totalAggregated: 0, participantes: 0 };
    return {
      totalDelivered: sellers.reduce((s, x) => s + x.deliveredCount, 0),
      totalValue: sellers.reduce((s, x) => s + x.deliveredValueCents, 0),
      totalFrascos: sellers.reduce((s, x) => s + x.totalFrascos, 0),
      totalAggregated: sellers.reduce((s, x) => s + x.aggregatedSalesCount, 0),
      participantes: sellers.length,
    };
  }, [sellers]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Campaign Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 p-6 border">
          <div className="absolute top-2 right-4 text-6xl opacity-10">🏆</div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                🚀 Campanha Quinzenal de Vendas
              </h1>
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <CalendarDays className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {format(fortnight.from, "dd/MM", { locale: ptBR })} a {format(fortnight.to, "dd/MM/yyyy", { locale: ptBR })}
                </span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">
                  {summary.participantes} participantes
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <span>⚠️ Só conta venda <strong>ENTREGUE</strong></span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Vendas Entregues</span>
              </div>
              <p className="text-2xl font-bold">{summary.totalDelivered}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Valor Total</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">💊</span>
                <span className="text-xs text-muted-foreground">Total Frascos</span>
              </div>
              <p className="text-2xl font-bold">{summary.totalFrascos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">Vendas Agregadas</span>
              </div>
              <p className="text-2xl font-bold">{summary.totalAggregated}</p>
            </CardContent>
          </Card>
        </div>

        {/* 3 Rankings */}
        <div className="grid lg:grid-cols-3 gap-6">
          <RankingCard
            title="Maior Valor Entregue"
            emoji="💰"
            prize="Kit energético + vodka + Energético"
            color="text-yellow-600"
            gradientFrom="from-yellow-500/15"
            gradientTo="to-amber-500/5"
            ringColor="ring-yellow-400"
            sellers={valueRanking}
            icon={<DollarSign className="w-5 h-5" />}
            position="🥇"
          />
          <RankingCard
            title="Mais Frascos Vendidos"
            emoji="💊"
            prize="Pizza grande (12 fatias – 45 cm)"
            color="text-slate-600"
            gradientFrom="from-slate-400/15"
            gradientTo="to-slate-300/5"
            ringColor="ring-slate-400"
            sellers={frascosRanking}
            icon={<Package className="w-5 h-5" />}
            position="🥈"
          />
          <RankingCard
            title="Mais Vendas Agregadas"
            emoji="🎯"
            prize="Fardinho de cerveja"
            color="text-amber-700"
            gradientFrom="from-amber-600/15"
            gradientTo="to-orange-500/5"
            ringColor="ring-amber-500"
            sellers={aggregatedRanking}
            icon={<Layers className="w-5 h-5" />}
            position="🥉"
          />
        </div>

        {/* Rules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              📋 Regras da Campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="flex items-start gap-2"><span>✔</span> Só conta venda <strong>ENTREGUE</strong></p>
                <p className="flex items-start gap-2"><span>✔</span> Pedido reagendado pode contar, desde que entregue dentro da quinzena</p>
                <p className="flex items-start gap-2"><span>✔</span> Cada vendedor ganha apenas 1 prêmio (não acumula)</p>
              </div>
              <div className="space-y-2">
                <p className="flex items-start gap-2"><span>🥇</span> <strong>1º lugar:</strong> Maior valor em vendas entregues</p>
                <p className="flex items-start gap-2"><span>🥈</span> <strong>2º lugar:</strong> Mais frascos vendidos no total</p>
                <p className="flex items-start gap-2"><span>🥉</span> <strong>3º lugar:</strong> Mais vendas agregadas (produtos extras)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
