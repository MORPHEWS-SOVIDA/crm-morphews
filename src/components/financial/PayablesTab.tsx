import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Search, Eye, Check, AlertTriangle, Ban, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/format';

import { 
  useAccountsPayable, 
  usePayableSummary, 
  useApprovePayable,
  type AccountPayable 
} from '@/hooks/useAccountsPayable';
import { useSuppliers } from '@/hooks/useSuppliers';
import { PayableFormDialog } from './PayableFormDialog';
import { PayableDetailDialog } from './PayableDetailDialog';
import { ConfirmPayableDialog } from './ConfirmPayableDialog';

const ALL_VALUE = '__all__';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  paid: { label: 'Pago', variant: 'outline' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

export function PayablesTab() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [supplierFilter, setSupplierFilter] = useState<string>(ALL_VALUE);
  const [search, setSearch] = useState('');
  
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<AccountPayable | null>(null);
  
  const { data: payables, isLoading } = useAccountsPayable({
    status: statusFilter === 'all' ? undefined : statusFilter,
    supplierId: supplierFilter === ALL_VALUE ? undefined : supplierFilter,
    search,
  });
  const { data: summary } = usePayableSummary();
  const { data: suppliers } = useSuppliers();
  const approvePayable = useApprovePayable();

  const handleApprove = (payable: AccountPayable) => {
    approvePayable.mutate(payable.id);
  };

  const summaryCards = [
    {
      title: 'Pendentes',
      value: summary?.totalPending || 0,
      count: summary?.countPending || 0,
      icon: FileText,
      color: 'text-amber-500',
    },
    {
      title: 'Aguardando Aprovação',
      value: summary?.totalApprovalPending || 0,
      count: 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
    },
    {
      title: 'Pagos este Mês',
      value: summary?.totalPaid || 0,
      count: summary?.countPaid || 0,
      icon: Check,
      color: 'text-green-500',
    },
    {
      title: 'Vencidos',
      value: summary?.totalOverdue || 0,
      count: summary?.countOverdue || 0,
      icon: Ban,
      color: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">{formatCurrency(card.value)}</p>
                    {card.count > 0 && (
                      <p className="text-xs text-muted-foreground">{card.count} itens</p>
                    )}
                  </div>
                  <Icon className={`h-8 w-8 ${card.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                {suppliers?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button onClick={() => { setSelectedPayable(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma conta encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  payables?.map((payable) => {
                    const status = STATUS_CONFIG[payable.status] || STATUS_CONFIG.pending;
                    const isOverdue = new Date(payable.due_date) < new Date() && payable.status !== 'paid';
                    
                    return (
                      <TableRow key={payable.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payable.description}</p>
                            {payable.document_number && (
                              <p className="text-xs text-muted-foreground">{payable.document_number}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {payable.supplier?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                            {format(new Date(payable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payable.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOverdue ? 'destructive' : status.variant}>
                            {isOverdue ? 'Vencido' : status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedPayable(payable);
                                setDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {payable.requires_approval && payable.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleApprove(payable)}
                                disabled={approvePayable.isPending}
                              >
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                            )}
                            
                            {(payable.status === 'approved' || (!payable.requires_approval && payable.status === 'pending')) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPayable(payable);
                                  setConfirmOpen(true);
                                }}
                              >
                                Baixar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Dialogs */}
      <PayableFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setSelectedPayable(null); }}
        payable={selectedPayable}
      />
      
      <PayableDetailDialog
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedPayable(null); }}
        payable={selectedPayable}
        onEdit={() => {
          setDetailOpen(false);
          setFormOpen(true);
        }}
        onConfirmPayment={() => {
          setDetailOpen(false);
          setConfirmOpen(true);
        }}
      />
      
      <ConfirmPayableDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setSelectedPayable(null); }}
        payable={selectedPayable}
      />
    </div>
  );
}
