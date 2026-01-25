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

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  paid: { label: 'Pago', variant: 'outline' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

export function PayablesTab() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<AccountPayable | null>(null);
  
  const { data: payables, isLoading } = useAccountsPayable({
    status: statusFilter,
    supplierId: supplierFilter || undefined,
    search: search || undefined,
  });
  const { data: summary } = usePayableSummary();
  const { data: suppliers } = useSuppliers();
  const approveMutation = useApprovePayable();
  
  const handleView = (payable: AccountPayable) => {
    setSelectedPayable(payable);
    setDetailOpen(true);
  };
  
  const handleConfirmPayment = (payable: AccountPayable) => {
    setSelectedPayable(payable);
    setConfirmOpen(true);
  };
  
  const handleApprove = async (payable: AccountPayable) => {
    await approveMutation.mutateAsync(payable.id);
  };
  
  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'paid' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date(format(new Date(), 'yyyy-MM-dd'));
  };
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary?.totalPending || 0)}</p>
            <p className="text-xs text-muted-foreground">{summary?.countPending || 0} contas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary?.totalApprovalPending || 0)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary?.totalOverdue || 0)}</p>
            <p className="text-xs text-muted-foreground">{summary?.countOverdue || 0} contas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Esta Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary?.weekDue || 0)}</p>
            <p className="text-xs text-muted-foreground">vencendo</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, documento ou fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
                <SelectItem value="">Todos</SelectItem>
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !payables?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma conta encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.map((item) => {
                  const overdue = isOverdue(item.due_date, item.status);
                  
                  return (
                    <TableRow key={item.id} className={overdue ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {overdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          <span className={overdue ? 'text-red-600 font-medium' : ''}>
                            {format(new Date(item.due_date), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        {item.total_installments > 1 && (
                          <span className="text-xs text-muted-foreground">
                            {item.installment_number}/{item.total_installments}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.description}</p>
                          {item.document_number && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {item.document_number}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.supplier?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount_cents)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={overdue ? 'destructive' : STATUS_CONFIG[item.status]?.variant || 'secondary'}>
                            {overdue ? 'Vencido' : STATUS_CONFIG[item.status]?.label || item.status}
                          </Badge>
                          {item.requires_approval && item.status === 'pending' && (
                            <Badge variant="outline" className="text-amber-600">
                              Aguarda aprovação
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleView(item)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {item.requires_approval && item.status === 'pending' && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleApprove(item)}
                              disabled={approveMutation.isPending}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          
                          {(item.status === 'pending' || item.status === 'approved') && !item.requires_approval && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleConfirmPayment(item)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
