import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePaymentLinkTransactions, usePaymentLinkStats } from '@/hooks/usePaymentLinks';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CreditCard,
  QrCode,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
  paid: { label: 'Pago', color: 'bg-green-500/10 text-green-600', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-600', icon: XCircle },
  refunded: { label: 'Estornado', color: 'bg-purple-500/10 text-purple-600', icon: AlertCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-500/10 text-gray-600', icon: XCircle },
};

const paymentMethodIcons: Record<string, React.ElementType> = {
  pix: QrCode,
  boleto: FileText,
  credit_card: CreditCard,
};

export function TransactionsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  
  const { data: transactions, isLoading } = usePaymentLinkTransactions({
    status: statusFilter || undefined,
    payment_method: methodFilter || undefined,
  });
  const { data: stats } = usePaymentLinkStats();

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recebido
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.totalReceived || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.transactionCount || 0} transações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Líquido
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalNet || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Taxas: {formatCurrency(stats?.totalFees || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disponível p/ Saque
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats?.availableBalance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Liberado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Liberar
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats?.pendingRelease || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Em liquidação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="refunded">Estornado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={methodFilter || '__all__'} onValueChange={(v) => setMethodFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="credit_card">Cartão</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Liberação</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const status = statusConfig[tx.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const MethodIcon = paymentMethodIcons[tx.payment_method] || CreditCard;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">
                        {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{tx.customer_name || '-'}</p>
                          <p className="text-xs text-muted-foreground">{tx.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MethodIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">
                            {tx.payment_method === 'credit_card' ? 'Cartão' : tx.payment_method.toUpperCase()}
                            {tx.installments > 1 && ` ${tx.installments}x`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(tx.amount_cents)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCurrency(tx.fee_cents)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tx.release_date 
                          ? format(new Date(tx.release_date), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
