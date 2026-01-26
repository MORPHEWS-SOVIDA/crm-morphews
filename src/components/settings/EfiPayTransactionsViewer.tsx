import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  RefreshCw,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  FileJson,
} from 'lucide-react';
import { useAllIncomingTransactions } from '@/hooks/useEfiPayConfig';
import { formatCurrency } from '@/hooks/useIncomingTransactions';
import { useQueryClient } from '@tanstack/react-query';

const NONE_VALUE = '__all__';

export function EfiPayTransactionsViewer() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(NONE_VALUE);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayload, setSelectedPayload] = useState<unknown>(null);

  const { data: transactions = [], isLoading, isFetching } = useAllIncomingTransactions({
    source: 'efipay',
    status: statusFilter === NONE_VALUE ? undefined : statusFilter,
    limit: 100,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['all-incoming-transactions'] });
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      tx.payer_name?.toLowerCase().includes(search) ||
      tx.payer_document?.includes(search) ||
      tx.end_to_end_id?.toLowerCase().includes(search) ||
      tx.source_transaction_id?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Conciliado
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
      case 'ignored':
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" />
            Ignorado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-medium">Transações Recebidas</h4>
          <p className="text-sm text-muted-foreground">
            PIX recebidos via webhook EfiPay
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento ou End-to-End ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="matched">Conciliados</SelectItem>
            <SelectItem value="ignored">Ignorados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Nenhuma transação encontrada</p>
          <p className="text-sm mt-1">
            {statusFilter !== NONE_VALUE
              ? 'Tente alterar os filtros'
              : 'As transações aparecerão aqui quando forem recebidas via webhook'}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[400px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pagador</TableHead>
                <TableHead>End-to-End ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(tx.transaction_date || tx.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium text-green-600">
                    {formatCurrency(tx.amount_cents)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium truncate max-w-[150px]">
                        {tx.payer_name || 'N/A'}
                      </p>
                      {tx.payer_document && (
                        <p className="text-xs text-muted-foreground">
                          {tx.payer_document}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[120px]">
                      {tx.end_to_end_id?.slice(0, 15)}...
                    </code>
                  </TableCell>
                  <TableCell>{getStatusBadge(tx.status)}</TableCell>
                  <TableCell>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedPayload(tx.raw_payload)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-full sm:max-w-lg">
                        <SheetHeader>
                          <SheetTitle className="flex items-center gap-2">
                            <FileJson className="h-5 w-5" />
                            Payload da Transação
                          </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4 space-y-4">
                          {/* Transaction Details */}
                          <div className="grid gap-3">
                            <div>
                              <p className="text-sm text-muted-foreground">Valor</p>
                              <p className="font-medium text-lg text-green-600">
                                {formatCurrency(tx.amount_cents)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">End-to-End ID</p>
                              <code className="text-xs break-all">{tx.end_to_end_id}</code>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Data/Hora</p>
                              <p>
                                {format(new Date(tx.transaction_date || tx.created_at), "PPpp", { locale: ptBR })}
                              </p>
                            </div>
                            {tx.matched_sale_id && (
                              <div>
                                <p className="text-sm text-muted-foreground">Venda Vinculada</p>
                                <code className="text-xs">{tx.matched_sale_id}</code>
                              </div>
                            )}
                          </div>

                          {/* Raw Payload */}
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">Payload Original (JSON)</p>
                            <ScrollArea className="h-[300px] rounded-lg border bg-muted/50 p-3">
                              <pre className="text-xs whitespace-pre-wrap break-all">
                                {JSON.stringify(tx.raw_payload, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Footer Stats */}
      {filteredTransactions.length > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{filteredTransactions.length} transação(ões)</span>
          <span>
            Total: {formatCurrency(filteredTransactions.reduce((acc, tx) => acc + tx.amount_cents, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
