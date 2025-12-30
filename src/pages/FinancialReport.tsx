import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  useInstallments, 
  useFinancialSummary, 
  useConfirmInstallment,
  useInstallmentHistory,
  type SaleInstallment 
} from '@/hooks/useFinancial';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  Filter,
  Calendar,
  FileText,
  ArrowUpRight,
  TrendingUp,
  Loader2,
  Eye,
  History,
  Upload,
  X
} from 'lucide-react';

// =====================================================
// HELPERS
// =====================================================

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getStatusBadge(status: string, dueDate?: string) {
  const today = startOfDay(new Date());
  const isOverdue = status === 'pending' && dueDate && isBefore(parseISO(dueDate), today);
  
  if (isOverdue || status === 'overdue') {
    return <Badge variant="destructive">Atrasado</Badge>;
  }
  
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pendente</Badge>;
    case 'confirmed':
      return <Badge className="bg-green-500 hover:bg-green-600">Recebido</Badge>;
    case 'cancelled':
      return <Badge variant="secondary">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// =====================================================
// SUMMARY CARDS
// =====================================================

function SummaryCards() {
  const { data: summary, isLoading } = useFinancialSummary();
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  const cards = [
    {
      title: 'A Receber (Pendente)',
      value: formatCurrency(summary?.totalPending || 0),
      count: summary?.countPending || 0,
      icon: Clock,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Recebido (Confirmado)',
      value: formatCurrency(summary?.totalConfirmed || 0),
      count: summary?.countConfirmed || 0,
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Em Atraso',
      value: formatCurrency(summary?.totalOverdue || 0),
      count: summary?.countOverdue || 0,
      icon: AlertTriangle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      title: 'Recebido Hoje',
      value: formatCurrency(summary?.todayReceived || 0),
      subtitle: `Este mês: ${formatCurrency(summary?.monthReceived || 0)}`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ];
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={cn('p-2 rounded-lg', card.bg)}>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.count !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {card.count} {card.count === 1 ? 'parcela' : 'parcelas'}
              </p>
            )}
            {card.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =====================================================
// KANBAN VIEW
// =====================================================

interface KanbanColumnProps {
  title: string;
  items: SaleInstallment[];
  color: string;
  onConfirm: (item: SaleInstallment) => void;
  onView: (item: SaleInstallment) => void;
  canConfirmPayment: boolean;
}

function KanbanColumn({ title, items, color, onConfirm, onView, canConfirmPayment }: KanbanColumnProps) {
  const total = items.reduce((sum, item) => sum + item.amount_cents, 0);
  
  return (
    <div className="flex-1 min-w-[280px] max-w-[350px]">
      <div className={cn('rounded-t-lg px-4 py-2 font-medium text-white', color)}>
        <div className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="secondary" className="bg-white/20 text-white">
            {items.length}
          </Badge>
        </div>
        <div className="text-sm opacity-90 mt-1">{formatCurrency(total)}</div>
      </div>
      
      <ScrollArea className="h-[400px] border border-t-0 rounded-b-lg bg-muted/30 p-2">
        <div className="space-y-2">
          {items.map(item => (
            <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {item.sale?.lead?.name || 'Cliente'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Parcela {item.installment_number}/{item.total_installments}
                    </p>
                  </div>
                  <p className="font-bold text-sm">{formatCurrency(item.amount_cents)}</p>
                </div>
                
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(item.due_date), 'dd/MM/yy')}
                  </span>
                  <span>{item.sale?.payment_method?.name}</span>
                </div>
                
                <div className="flex gap-1 mt-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="flex-1 h-7 text-xs"
                    onClick={() => onView(item)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                  {item.status === 'pending' && canConfirmPayment && (
                    <Button 
                      size="sm" 
                      className="flex-1 h-7 text-xs bg-green-500 hover:bg-green-600"
                      onClick={() => onConfirm(item)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Confirmar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {items.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Nenhuma parcela
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function KanbanView({ 
  installments, 
  onConfirm, 
  onView,
  canConfirmPayment
}: { 
  installments: SaleInstallment[]; 
  onConfirm: (item: SaleInstallment) => void;
  onView: (item: SaleInstallment) => void;
  canConfirmPayment: boolean;
}) {
  const today = startOfDay(new Date());
  
  const pending = installments.filter(i => 
    i.status === 'pending' && !isBefore(parseISO(i.due_date), today)
  );
  const overdue = installments.filter(i => 
    i.status === 'pending' && isBefore(parseISO(i.due_date), today) ||
    i.status === 'overdue'
  );
  const confirmed = installments.filter(i => i.status === 'confirmed');
  
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      <KanbanColumn 
        title="Pendentes" 
        items={pending} 
        color="bg-yellow-500" 
        onConfirm={onConfirm}
        onView={onView}
        canConfirmPayment={canConfirmPayment}
      />
      <KanbanColumn 
        title="Em Atraso" 
        items={overdue} 
        color="bg-destructive" 
        onConfirm={onConfirm}
        onView={onView}
        canConfirmPayment={canConfirmPayment}
      />
      <KanbanColumn 
        title="Recebidos" 
        items={confirmed} 
        color="bg-green-500" 
        onConfirm={onConfirm}
        onView={onView}
        canConfirmPayment={canConfirmPayment}
      />
    </div>
  );
}

// =====================================================
// LIST VIEW
// =====================================================

function ListView({ 
  installments, 
  onConfirm, 
  onView,
  canConfirmPayment
}: { 
  installments: SaleInstallment[]; 
  onConfirm: (item: SaleInstallment) => void;
  onView: (item: SaleInstallment) => void;
  canConfirmPayment: boolean;
}) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map(item => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.sale?.lead?.name || 'Cliente'}
              </TableCell>
              <TableCell>
                {item.installment_number}/{item.total_installments}
              </TableCell>
              <TableCell className="font-bold">
                {formatCurrency(item.amount_cents)}
              </TableCell>
              <TableCell>
                {format(parseISO(item.due_date), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>
                {item.sale?.payment_method?.name || '-'}
              </TableCell>
              <TableCell>
                {getStatusBadge(item.status, item.due_date)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onView(item)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {item.status === 'pending' && canConfirmPayment && (
                    <Button 
                      size="sm" 
                      className="bg-green-500 hover:bg-green-600"
                      onClick={() => onConfirm(item)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Confirmar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          
          {installments.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhuma parcela encontrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// =====================================================
// CONFIRM DIALOG
// =====================================================

function ConfirmPaymentDialog({ 
  installment, 
  open, 
  onClose 
}: { 
  installment: SaleInstallment | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const confirmMutation = useConfirmInstallment();
  
  const handleConfirm = async () => {
    if (!installment) return;
    
    try {
      await confirmMutation.mutateAsync({
        id: installment.id,
        notes: notes || undefined,
      });
      toast.success('Pagamento confirmado com sucesso!');
      onClose();
      setNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao confirmar pagamento');
    }
  };
  
  if (!installment) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Recebimento</DialogTitle>
          <DialogDescription>
            Confirme o recebimento desta parcela.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{installment.sale?.lead?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcela:</span>
              <span>{installment.installment_number}/{installment.total_installments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-bold text-lg">{formatCurrency(installment.amount_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vencimento:</span>
              <span>{format(parseISO(installment.due_date), 'dd/MM/yyyy')}</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea 
              placeholder="Ex: Pagamento via PIX, comprovante recebido..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={confirmMutation.isPending}
            className="bg-green-500 hover:bg-green-600"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Recebimento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// DETAIL DIALOG
// =====================================================

function InstallmentDetailDialog({ 
  installment, 
  open, 
  onClose 
}: { 
  installment: SaleInstallment | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const { data: history, isLoading: loadingHistory } = useInstallmentHistory(installment?.id || null);
  
  if (!installment) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Parcela</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status:</span>
              {getStatusBadge(installment.status, installment.due_date)}
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{installment.sale?.lead?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Parcela:</span>
              <span>{installment.installment_number}/{installment.total_installments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-bold text-lg">{formatCurrency(installment.amount_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vencimento:</span>
              <span>{format(parseISO(installment.due_date), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Método:</span>
              <span>{installment.sale?.payment_method?.name || '-'}</span>
            </div>
            {installment.confirmed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmado em:</span>
                <span>{format(parseISO(installment.confirmed_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            )}
            {installment.notes && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-sm">Observações:</span>
                <p className="mt-1">{installment.notes}</p>
              </div>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="h-4 w-4" />
              <h4 className="font-medium">Histórico</h4>
            </div>
            
            {loadingHistory ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : history && history.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                    <div className="flex justify-between">
                      <span>
                        {h.previous_status && <><Badge variant="outline" className="text-xs">{h.previous_status}</Badge> → </>}
                        <Badge className="text-xs">{h.new_status}</Badge>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {format(parseISO(h.created_at), 'dd/MM HH:mm')}
                      </span>
                    </div>
                    {h.notes && <p className="text-muted-foreground mt-1">{h.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum histórico ainda.</p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function FinancialReport() {
  const [activeTab, setActiveTab] = useState('kanban');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingInstallment, setConfirmingInstallment] = useState<SaleInstallment | null>(null);
  const [viewingInstallment, setViewingInstallment] = useState<SaleInstallment | null>(null);
  
  const { data: permissions, isLoading: loadingPermissions } = useMyPermissions();
  const canViewFinanceiro = permissions?.reports_view || permissions?.sales_confirm_payment;
  const canConfirmPayment = permissions?.sales_confirm_payment ?? false;
  
  const { data: installments, isLoading } = useInstallments({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchQuery || undefined,
  });
  
  // Redirect if no permission
  if (!loadingPermissions && !canViewFinanceiro) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <Layout>
      <div className="space-y-6 p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Contas a Receber
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus recebimentos e confirme pagamentos
            </p>
          </div>
        </div>
        
        {/* Summary Cards */}
        <SummaryCards />
        
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="confirmed">Recebidos</SelectItem>
                  <SelectItem value="overdue">Em Atraso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        {/* Views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
          </TabsList>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="kanban" className="mt-4">
                <KanbanView 
                  installments={installments || []}
                  onConfirm={setConfirmingInstallment}
                  onView={setViewingInstallment}
                  canConfirmPayment={canConfirmPayment}
                />
              </TabsContent>
              
              <TabsContent value="list" className="mt-4">
                <ListView 
                  installments={installments || []}
                  onConfirm={setConfirmingInstallment}
                  onView={setViewingInstallment}
                  canConfirmPayment={canConfirmPayment}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
      
      {/* Dialogs */}
      <ConfirmPaymentDialog 
        installment={confirmingInstallment}
        open={!!confirmingInstallment}
        onClose={() => setConfirmingInstallment(null)}
      />
      
      <InstallmentDetailDialog 
        installment={viewingInstallment}
        open={!!viewingInstallment}
        onClose={() => setViewingInstallment(null)}
      />
    </Layout>
  );
}
