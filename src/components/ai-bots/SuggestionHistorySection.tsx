import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Sparkles, 
  ShoppingBag, 
  ThumbsUp, 
  ThumbsDown, 
  Search,
  Calendar,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { useSuggestionHistory } from '@/hooks/useLeadIntelligence';
import { useUsers } from '@/hooks/useUsers';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SuggestionHistorySection() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: history, isLoading } = useSuggestionHistory({ limit: 500 });
  const { data: users } = useUsers();

  // Create user map for quick lookup
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users?.forEach(u => {
      map[u.user_id] = `${u.first_name} ${u.last_name}`.trim();
    });
    return map;
  }, [users]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;

    const total = history.length;
    const used = history.filter((s: any) => s.status === 'used').length;
    const dismissed = history.filter((s: any) => s.status === 'dismissed').length;
    const pending = history.filter((s: any) => s.status === 'pending').length;
    const positive = history.filter((s: any) => s.feedback === 'positive').length;
    const negative = history.filter((s: any) => s.feedback === 'negative').length;
    const followups = history.filter((s: any) => s.suggestion_type === 'followup').length;
    const products = history.filter((s: any) => s.suggestion_type === 'products').length;

    const usageRate = total > 0 ? Math.round((used / total) * 100) : 0;
    const satisfactionRate = (positive + negative) > 0 
      ? Math.round((positive / (positive + negative)) * 100) 
      : 0;

    return {
      total,
      used,
      dismissed,
      pending,
      positive,
      negative,
      followups,
      products,
      usageRate,
      satisfactionRate,
    };
  }, [history]);

  // Filter suggestions
  const filteredHistory = useMemo(() => {
    if (!history) return [];

    return history.filter((s: any) => {
      if (typeFilter !== 'all' && s.suggestion_type !== typeFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (userFilter !== 'all' && s.user_id !== userFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !s.lead_name?.toLowerCase().includes(search) &&
          !s.reason?.toLowerCase().includes(search) &&
          !s.suggested_script?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [history, typeFilter, statusFilter, userFilter, searchTerm]);

  // Get unique users from history
  const usersInHistory = useMemo(() => {
    if (!history) return [];
    const userIds = [...new Set(history.map((s: any) => s.user_id))];
    return userIds.map(id => ({
      id,
      name: userMap[id] || 'Usuário',
    }));
  }, [history, userMap]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Sugestões</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {stats.followups}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <ShoppingBag className="w-3 h-3 mr-1" />
                      {stats.products}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Uso</p>
                  <p className="text-2xl font-bold">{stats.usageRate}%</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {stats.used} usadas
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Satisfação</p>
                  <p className="text-2xl font-bold">{stats.satisfactionRate}%</p>
                  <div className="flex gap-2 mt-1">
                    <Badge className="text-xs bg-green-100 text-green-700">
                      <ThumbsUp className="w-3 h-3 mr-1" />
                      {stats.positive}
                    </Badge>
                    <Badge className="text-xs bg-amber-100 text-amber-700">
                      <ThumbsDown className="w-3 h-3 mr-1" />
                      {stats.negative}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <ThumbsUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <XCircle className="w-3 h-3 mr-1" />
                      {stats.dismissed} dispensadas
                    </Badge>
                  </div>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Histórico de Sugestões IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por lead ou conteúdo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
                <SelectItem value="products">Produtos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="used">Usadas</SelectItem>
                <SelectItem value="dismissed">Dispensadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vendedores</SelectItem>
                {usersInHistory.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results Table */}
          <ScrollArea className="h-[500px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Sugestão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma sugestão encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(s.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={s.suggestion_type === 'followup' 
                            ? 'border-blue-300 text-blue-700' 
                            : 'border-purple-300 text-purple-700'}
                        >
                          {s.suggestion_type === 'followup' ? (
                            <><Sparkles className="w-3 h-3 mr-1" /> Follow-up</>
                          ) : (
                            <><ShoppingBag className="w-3 h-3 mr-1" /> Produtos</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {userMap[s.user_id] || 'Usuário'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[150px]">
                          <p className="font-medium truncate">{s.lead_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[300px]">
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {s.reason}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            s.status === 'used' ? 'default' : 
                            s.status === 'dismissed' ? 'secondary' : 
                            'outline'
                          }
                        >
                          {s.status === 'used' ? 'Usada' : 
                           s.status === 'dismissed' ? 'Dispensada' : 
                           'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.feedback ? (
                          <Badge 
                            className={s.feedback === 'positive' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-amber-100 text-amber-700'}
                          >
                            {s.feedback === 'positive' ? (
                              <><ThumbsUp className="w-3 h-3 mr-1" /> Útil</>
                            ) : (
                              <><ThumbsDown className="w-3 h-3 mr-1" /> Não útil</>
                            )}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="text-sm text-muted-foreground text-right">
            Mostrando {filteredHistory.length} de {history?.length || 0} sugestões
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
