import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Search,
  CheckCircle,
  AlertTriangle,
  Clock,
  HelpCircle,
  Link2,
  Eye,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  usePosTransactions,
  usePosTerminals,
  useManualMatchTransaction,
  POS_GATEWAY_LABELS,
  type PosMatchStatus,
  type PosGatewayType,
} from '@/hooks/usePosTerminals';
import { useSales, formatCurrency } from '@/hooks/useSales';
import { useQueryClient } from '@tanstack/react-query';

const MATCH_STATUS_CONFIG: Record<PosMatchStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pendente', icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-200' },
  matched: { label: 'Vinculado', icon: CheckCircle, className: 'bg-green-100 text-green-700 border-green-200' },
  orphan: { label: 'Órfão', icon: AlertTriangle, className: 'bg-red-100 text-red-700 border-red-200' },
  manual: { label: 'Manual', icon: Link2, className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export default function PosTransactionsReport() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PosMatchStatus | 'all'>('all');
  const [terminalFilter, setTerminalFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [matchDialogTx, setMatchDialogTx] = useState<any | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');

  const { data: transactions = [], isLoading, refetch } = usePosTransactions({
    match_status: statusFilter === 'all' ? undefined : statusFilter,
    pos_terminal_id: terminalFilter === 'all' ? undefined : terminalFilter,
  });
  const { data: terminals = [] } = usePosTerminals();
  const { data: salesData } = useSales();
  const matchMutation = useManualMatchTransaction();

  // Filter by search (NSU, authorization code)
  const filteredTransactions = transactions.filter((tx) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      tx.nsu?.toLowerCase().includes(searchLower) ||
      tx.authorization_code?.toLowerCase().includes(searchLower) ||
      tx.card_last_digits?.includes(search)
    );
  });

  const handleManualMatch = async () => {
    if (!matchDialogTx || !selectedSaleId) return;
    await matchMutation.mutateAsync({
      transactionId: matchDialogTx.id,
      saleId: selectedSaleId,
    });
    setMatchDialogTx(null);
    setSelectedSaleId('');
  };

  // Get candidate sales for manual matching (same amount)
  const candidateSales = matchDialogTx
    ? (salesData || []).filter(
        (s) =>
          s.total_cents === matchDialogTx.amount_cents &&
          ['pending_expedition', 'shipped', 'delivered'].includes(s.status)
      )
    : [];

  const stats = {
    total: transactions.length,
    matched: transactions.filter((t) => t.match_status === 'matched' || t.match_status === 'manual').length,
    pending: transactions.filter((t) => t.match_status === 'pending').length,
    orphan: transactions.filter((t) => t.match_status === 'orphan').length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transações POS</h1>
            <p className="text-muted-foreground">
              Log de transações recebidas das máquinas de cartão
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.matched}</p>
                  <p className="text-xs text-muted-foreground">Vinculados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.orphan}</p>
                  <p className="text-xs text-muted-foreground">Órfãos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por NSU, Autorização ou Final do cartão..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="matched">Vinculados</SelectItem>
                  <SelectItem value="orphan">Órfãos</SelectItem>
                  <SelectItem value="manual">Manuais</SelectItem>
                </SelectContent>
              </Select>
              <Select value={terminalFilter} onValueChange={setTerminalFilter}>
                <SelectTrigger className="w-[180px]">
                  <CreditCard className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Máquina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas máquinas</SelectItem>
                  {terminals.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Nenhuma transação encontrada</p>
                <p className="text-sm mt-1">As transações aparecerão aqui quando as máquinas enviarem webhooks</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Bandeira</TableHead>
                      <TableHead>NSU</TableHead>
                      <TableHead>Autorização</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => {
                      const statusConfig = MATCH_STATUS_CONFIG[tx.match_status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(tx.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {(tx as any).terminal?.name ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {POS_GATEWAY_LABELS[(tx as any).terminal.gateway_type as PosGatewayType]}
                                </Badge>
                                <span className="text-sm">{(tx as any).terminal.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-bold">
                            {formatCurrency(tx.amount_cents)}
                          </TableCell>
                          <TableCell>
                            {tx.card_brand || '-'}
                            {tx.card_last_digits && (
                              <span className="text-muted-foreground text-xs ml-1">
                                ***{tx.card_last_digits}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {tx.nsu || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {tx.authorization_code || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig.className}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {tx.sale_id ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`/vendas/${tx.sale_id}`, '_blank')}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setMatchDialogTx(tx)}
                                >
                                  <Link2 className="w-4 h-4 mr-1" />
                                  Vincular
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Match Dialog */}
        <Dialog open={!!matchDialogTx} onOpenChange={() => setMatchDialogTx(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Vincular Transação Manualmente</DialogTitle>
            </DialogHeader>
            {matchDialogTx && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valor:</span>{' '}
                      <strong>{formatCurrency(matchDialogTx.amount_cents)}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NSU:</span>{' '}
                      <strong>{matchDialogTx.nsu || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bandeira:</span>{' '}
                      <strong>{matchDialogTx.card_brand || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span>{' '}
                      <strong>
                        {format(parseISO(matchDialogTx.created_at), 'dd/MM HH:mm')}
                      </strong>
                    </div>
                  </div>
                </div>

                {candidateSales.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma venda encontrada com o mesmo valor</p>
                    <p className="text-sm">({formatCurrency(matchDialogTx.amount_cents)})</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Vendas com mesmo valor ({candidateSales.length}):
                    </p>
                    <div className="max-h-60 overflow-auto space-y-2">
                      {candidateSales.map((sale) => (
                        <div
                          key={sale.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedSaleId === sale.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-muted-foreground'
                          }`}
                          onClick={() => setSelectedSaleId(sale.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{sale.lead?.name || 'Cliente'}</p>
                              <p className="text-xs text-muted-foreground">
                                #{sale.romaneio_number} • {format(parseISO(sale.created_at), 'dd/MM HH:mm')}
                              </p>
                            </div>
                            <Badge variant="outline">{sale.delivery_type}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMatchDialogTx(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleManualMatch}
                disabled={!selectedSaleId || matchMutation.isPending}
              >
                Vincular
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
