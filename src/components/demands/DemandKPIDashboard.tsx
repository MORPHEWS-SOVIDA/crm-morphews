import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDemandKPIs } from '@/hooks/useDemandKPIs';
import { useDemandBoards } from '@/hooks/useDemandBoards';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Target,
  Users,
  Timer,
  BarChart3,
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const URGENCY_COLORS = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#ef4444',
};

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

export function DemandKPIDashboard() {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const { data: boards, isLoading: boardsLoading } = useDemandBoards();
  const { data: kpis, isLoading: kpisLoading } = useDemandKPIs(selectedBoardId);

  const isLoading = boardsLoading || kpisLoading;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const urgencyData = kpis ? [
    { name: 'Baixa', value: kpis.demandsByUrgency.low, color: URGENCY_COLORS.low },
    { name: 'Média', value: kpis.demandsByUrgency.medium, color: URGENCY_COLORS.medium },
    { name: 'Alta', value: kpis.demandsByUrgency.high, color: URGENCY_COLORS.high },
  ] : [];

  const activityData = kpis?.recentActivity.map(a => ({
    ...a,
    dateLabel: format(new Date(a.date), 'EEE', { locale: ptBR }),
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard de Demandas</h2>
          <p className="text-muted-foreground">Acompanhe os KPIs e performance da equipe</p>
        </div>
        <Select 
          value={selectedBoardId || 'all'} 
          onValueChange={(v) => setSelectedBoardId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os quadros" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os quadros</SelectItem>
            {boards?.map(board => (
              <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : kpis ? (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Demandas</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.totalDemands}</div>
                <p className="text-xs text-muted-foreground">
                  {kpis.openDemands} abertas • {kpis.completedDemands} concluídas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxa de SLA</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.slaComplianceRate}%</div>
                <Progress value={kpis.slaComplianceRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{kpis.overdueDemands}</div>
                <p className="text-xs text-muted-foreground">
                  demandas com SLA estourado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis.avgCompletionTimeHours}h</div>
                <p className="text-xs text-muted-foreground">
                  para conclusão
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Atividade (7 dias)</CardTitle>
                <CardDescription>Demandas criadas vs concluídas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dateLabel" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="created" 
                        name="Criadas"
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        dot={{ fill: '#8b5cf6' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="completed" 
                        name="Concluídas"
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={{ fill: '#22c55e' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Urgency Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Urgência</CardTitle>
                <CardDescription>Distribuição das demandas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={urgencyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {urgencyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* By Column */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Por Coluna
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpis.demandsByColumn} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {kpis.demandsByColumn.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* By User */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Por Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {kpis.demandsByUser.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum responsável atribuído
                    </p>
                  ) : (
                    kpis.demandsByUser.slice(0, 5).map((user, index) => (
                      <div key={user.userId} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.userName}</p>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {user.count} total
                            </Badge>
                            <Badge variant="outline" className="text-xs text-green-600">
                              {user.completed} concluídas
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold">{Math.round((user.completed / user.count) * 100)}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Tracking */}
          {kpis.timeByUser.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Tempo por Usuário
                </CardTitle>
                <CardDescription>Total de horas registradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {kpis.timeByUser.slice(0, 8).map((user) => (
                    <div key={user.userId} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm font-medium truncate">{user.userName}</p>
                      <p className="text-2xl font-bold">{formatTime(user.totalSeconds)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
}
