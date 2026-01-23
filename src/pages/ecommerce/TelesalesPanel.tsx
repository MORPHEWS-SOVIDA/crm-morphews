import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Phone, 
  Search, 
  CreditCard, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  ShieldAlert,
  Clock,
  DollarSign,
  User,
  Loader2,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

interface PaymentAttempt {
  id: string;
  sale_id: string;
  gateway: string;
  payment_method: string;
  amount_cents: number;
  status: string;
  error_code: string | null;
  error_message: string | null;
  is_fallback: boolean;
  attempt_number: number;
  created_at: string;
}

interface SaleWithDetails {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total_cents: number;
  notes: string | null;
  lead: {
    id: string;
    name: string;
    whatsapp: string;
    email: string;
  } | null;
}

export default function TelesalesPanel() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('failed');
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    type: 'reprocess' | 'release_antifraud' | 'manual_capture' | null;
    sale: SaleWithDetails | null;
  }>({ type: null, sale: null });
  const [actionNotes, setActionNotes] = useState('');

  // Fetch sales with failed/pending payments
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['telesales-sales', statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select(`
          id,
          created_at,
          status,
          payment_status,
          total_cents,
          notes,
          lead:leads(id, name, whatsapp, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('payment_status', statusFilter);
      }

      if (searchTerm) {
        // Search in notes or by sale ID
        query = query.or(`id.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SaleWithDetails[];
    },
  });

  // Fetch payment attempts for selected sale
  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ['payment-attempts', selectedSale?.id],
    queryFn: async () => {
      if (!selectedSale) return [];
      
      const { data, error } = await supabase
        .from('payment_attempts')
        .select('*')
        .eq('sale_id', selectedSale.id)
        .order('attempt_number', { ascending: true });
      
      if (error) throw error;
      return (data || []) as unknown as PaymentAttempt[];
    },
    enabled: !!selectedSale,
  });

  // Admin action mutation
  const adminActionMutation = useMutation({
    mutationFn: async ({ 
      saleId, 
      actionType, 
      notes 
    }: { 
      saleId: string; 
      actionType: string; 
      notes: string;
    }) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get user profile for org
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Record admin action
      const { error: actionError } = await supabase
        .from('payment_admin_actions')
        .insert({
          sale_id: saleId,
          organization_id: profile.organization_id,
          action_type: actionType,
          performed_by: user.id,
          notes,
          result_status: 'completed',
        });

      if (actionError) throw actionError;

      // For reprocess, call the checkout function again
      if (actionType === 'reprocess') {
        // Get the sale and lead info
        const { data: sale } = await supabase
          .from('sales')
          .select(`
            *,
            lead:leads(*)
          `)
          .eq('id', saleId)
          .single();

        if (!sale || !sale.lead) throw new Error('Venda não encontrada');

        // Call edge function
        const saleData = sale as Record<string, unknown>;
        const leadData = saleData.lead as Record<string, unknown>;
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecommerce-checkout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              storefront_id: saleData.organization_id,
              customer: {
                name: leadData.name,
                email: leadData.email,
                phone: leadData.whatsapp,
              },
              payment_method: 'credit_card',
              items: [],
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao reprocessar');
        }
      }

      // For antifraud release or manual capture, update sale status
      if (actionType === 'release_antifraud' || actionType === 'manual_capture') {
        await supabase
          .from('sales')
          .update({
            payment_status: 'paid',
            status: 'payment_confirmed',
          })
          .eq('id', saleId);
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Ação executada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['telesales-sales'] });
      queryClient.invalidateQueries({ queryKey: ['payment-attempts'] });
      setActionDialog({ type: null, sale: null });
      setActionNotes('');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Pendente', variant: 'secondary' },
      processing: { label: 'Processando', variant: 'outline' },
      paid: { label: 'Pago', variant: 'default' },
      failed: { label: 'Falhou', variant: 'destructive' },
      refunded: { label: 'Reembolsado', variant: 'secondary' },
      analyzing: { label: 'Antifraude', variant: 'outline' },
    };
    const config = configs[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Phone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Televendas</h1>
            <p className="text-sm text-muted-foreground">
              Reprocesse pagamentos e libere antifraude
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sales?.filter(s => s.payment_status === 'failed').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pagamentos Falhos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-amber-500/10">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sales?.filter(s => s.payment_status === 'analyzing').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Aguardando Antifraude</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sales?.filter(s => s.payment_status === 'pending').length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    sales?.filter(s => s.payment_status === 'failed')
                      .reduce((acc, s) => acc + s.total_cents, 0) || 0
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Valor a Recuperar</p>
              </div>
            </div>
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
                placeholder="Buscar por ID ou notas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="analyzing">Antifraude</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas para Ação</CardTitle>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{sale.lead?.name || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{sale.lead?.whatsapp}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(sale.total_cents)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(sale.payment_status)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {sale.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {sale.payment_status === 'failed' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setActionDialog({ type: 'reprocess', sale })}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Reprocessar
                          </Button>
                        )}
                        {sale.payment_status === 'analyzing' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setActionDialog({ type: 'release_antifraud', sale })}
                          >
                            <ShieldAlert className="h-4 w-4 mr-1" />
                            Liberar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sales?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Attempts Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Tentativas</DialogTitle>
            <DialogDescription>
              Venda #{selectedSale?.id.slice(0, 8)} - {selectedSale?.lead?.name}
            </DialogDescription>
          </DialogHeader>

          {attemptsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {attempts?.map((attempt) => (
                <div 
                  key={attempt.id} 
                  className={`p-4 rounded-lg border ${
                    attempt.status === 'success' ? 'border-green-500 bg-green-50' :
                    attempt.status === 'failed' ? 'border-red-500 bg-red-50' :
                    'border-muted'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Tentativa {attempt.attempt_number}
                      </Badge>
                      {attempt.is_fallback && (
                        <Badge variant="secondary">Fallback</Badge>
                      )}
                    </div>
                    {attempt.status === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : attempt.status === 'failed' ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Gateway:</span>{' '}
                      <span className="font-medium">{attempt.gateway?.toUpperCase() || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Método:</span>{' '}
                      <span className="font-medium">{attempt.payment_method}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor:</span>{' '}
                      <span className="font-medium">{formatCurrency(attempt.amount_cents)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span>{' '}
                      <span className="font-medium">
                        {format(new Date(attempt.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  </div>
                  {attempt.error_message && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                      <strong>Erro:</strong> {attempt.error_code} - {attempt.error_message}
                    </div>
                  )}
                </div>
              ))}
              {attempts?.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma tentativa registrada
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog 
        open={!!actionDialog.type} 
        onOpenChange={(open) => !open && setActionDialog({ type: null, sale: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'reprocess' && 'Reprocessar Pagamento'}
              {actionDialog.type === 'release_antifraud' && 'Liberar Antifraude'}
              {actionDialog.type === 'manual_capture' && 'Captura Manual'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'reprocess' && 
                'O sistema tentará processar o pagamento novamente usando os gateways configurados.'
              }
              {actionDialog.type === 'release_antifraud' && 
                'Você está liberando manualmente esta transação da análise antifraude.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{actionDialog.sale?.lead?.name}</span>
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(actionDialog.sale?.total_cents || 0)}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Motivo da ação..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </div>

            {actionDialog.type === 'release_antifraud' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Atenção</p>
                  <p>Ao liberar manualmente, você assume a responsabilidade por eventuais chargebacks.</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ type: null, sale: null })}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.sale && actionDialog.type) {
                  adminActionMutation.mutate({
                    saleId: actionDialog.sale.id,
                    actionType: actionDialog.type,
                    notes: actionNotes,
                  });
                }
              }}
              disabled={adminActionMutation.isPending}
            >
              {adminActionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
