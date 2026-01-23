import { useState } from 'react';
import { Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, Building2, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useTenantVirtualAccount,
  useVirtualTransactions,
  useMyWithdrawals,
  useUpdateBankData,
  useRequestWithdrawal,
  usePlatformSettings,
  type WithdrawalStatus,
} from '@/hooks/ecommerce';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function getWithdrawalStatusConfig(status: WithdrawalStatus) {
  switch (status) {
    case 'pending':
      return { label: 'Pendente', variant: 'outline' as const, icon: Clock };
    case 'approved':
      return { label: 'Aprovado', variant: 'default' as const, icon: CheckCircle };
    case 'processing':
      return { label: 'Processando', variant: 'secondary' as const, icon: Clock };
    case 'completed':
      return { label: 'Concluído', variant: 'secondary' as const, icon: CheckCircle };
    case 'rejected':
      return { label: 'Rejeitado', variant: 'destructive' as const, icon: XCircle };
    default:
      return { label: status, variant: 'outline' as const, icon: Clock };
  }
}

export function VirtualAccountPanel() {
  const { data: account, isLoading: accountLoading } = useTenantVirtualAccount();
  const { data: transactions } = useVirtualTransactions(account?.id);
  const { data: withdrawals } = useMyWithdrawals();
  const { data: settings } = usePlatformSettings();
  const updateBankData = useUpdateBankData();
  const requestWithdrawal = useRequestWithdrawal();

  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);

  const [bankForm, setBankForm] = useState({
    bank_code: '',
    bank_name: '',
    agency: '',
    account_number: '',
    account_type: 'checking' as 'checking' | 'savings',
    holder_name: '',
    holder_document: '',
    pix_key: '',
    pix_key_type: '' as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' | '',
    is_primary: true,
  });

  const withdrawalRules = settings?.withdrawal_rules || {
    min_amount_cents: 5000,
    release_days: 14,
    fee_percentage: 2.5,
  };

  const handleSaveBankData = () => {
    if (!account) return;
    
    updateBankData.mutate(
      {
        virtualAccountId: account.id,
        ...bankForm,
        pix_key_type: bankForm.pix_key_type || undefined,
      },
      {
        onSuccess: () => setBankDialogOpen(false),
      }
    );
  };

  const handleRequestWithdrawal = () => {
    if (!account) return;
    
    requestWithdrawal.mutate(
      {
        virtualAccountId: account.id,
        amountCents: withdrawAmount,
      },
      {
        onSuccess: () => {
          setWithdrawDialogOpen(false);
          setWithdrawAmount(0);
        },
      }
    );
  };

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-12 w-48" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Conta virtual não configurada</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Sua conta virtual será criada automaticamente quando você receber sua primeira venda.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasBankData = account.bank_data && account.bank_data.length > 0;
  const primaryBank = account.bank_data?.find((b) => b.is_primary);

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo Disponível</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(account.balance_cents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo Pendente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(account.pending_balance_cents)}
            </div>
            <p className="text-xs text-muted-foreground">
              Liberação em {withdrawalRules.release_days} dias
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Recebido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(account.total_received_cents)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={() => setWithdrawDialogOpen(true)}
          disabled={account.balance_cents < withdrawalRules.min_amount_cents || !hasBankData}
          className="gap-2"
        >
          <ArrowUpRight className="h-4 w-4" />
          Solicitar Saque
        </Button>
        <Button variant="outline" onClick={() => setBankDialogOpen(true)} className="gap-2">
          <Building2 className="h-4 w-4" />
          {hasBankData ? 'Atualizar Dados Bancários' : 'Cadastrar Dados Bancários'}
        </Button>
      </div>

      {/* Bank Data */}
      {primaryBank && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados Bancários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Banco:</span>
                <span>{primaryBank.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agência:</span>
                <span>{primaryBank.agency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conta:</span>
                <span>{primaryBank.account_number}</span>
              </div>
              {primaryBank.pix_key && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pix:</span>
                  <span>{primaryBank.pix_key}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdrawals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Saques</CardTitle>
        </CardHeader>
        <CardContent>
          {!withdrawals || withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum saque realizado
            </p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const statusConfig = getWithdrawalStatusConfig(w.status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(w.net_amount_cents)}</span>
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(w.requested_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                        {w.fee_cents > 0 && ` • Taxa: ${formatCurrency(w.fee_cents)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions || transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma transação
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 border-b last:border-0"
                >
                  <div>
                    <div className="text-sm">{t.description || t.transaction_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                  <div
                    className={`font-medium ${
                      t.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {t.transaction_type === 'credit' ? '+' : '-'}
                    {formatCurrency(t.net_amount_cents)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bank Data Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados Bancários</DialogTitle>
            <DialogDescription>
              Informe os dados da conta para receber seus saques
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código do Banco</Label>
                <Input
                  value={bankForm.bank_code}
                  onChange={(e) => setBankForm((p) => ({ ...p, bank_code: e.target.value }))}
                  placeholder="001"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do Banco</Label>
                <Input
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))}
                  placeholder="Banco do Brasil"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={bankForm.agency}
                  onChange={(e) => setBankForm((p) => ({ ...p, agency: e.target.value }))}
                  placeholder="0001"
                />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm((p) => ({ ...p, account_number: e.target.value }))}
                  placeholder="12345-6"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Conta</Label>
              <Select
                value={bankForm.account_type}
                onValueChange={(v) => setBankForm((p) => ({ ...p, account_type: v as 'checking' | 'savings' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Titular</Label>
                <Input
                  value={bankForm.holder_name}
                  onChange={(e) => setBankForm((p) => ({ ...p, holder_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={bankForm.holder_document}
                  onChange={(e) => setBankForm((p) => ({ ...p, holder_document: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chave Pix (opcional)</Label>
                <Input
                  value={bankForm.pix_key}
                  onChange={(e) => setBankForm((p) => ({ ...p, pix_key: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo da Chave</Label>
                <Select
                  value={bankForm.pix_key_type}
                  onValueChange={(v) => setBankForm((p) => ({ ...p, pix_key_type: v as typeof bankForm.pix_key_type }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBankData} disabled={updateBankData.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
            <DialogDescription>
              Taxa de {withdrawalRules.fee_percentage}% será descontada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do Saque</Label>
              <CurrencyInput
                value={withdrawAmount}
                onChange={setWithdrawAmount}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo: {formatCurrency(withdrawalRules.min_amount_cents)}
                {' • '}
                Disponível: {formatCurrency(account.balance_cents)}
              </p>
            </div>

            {withdrawAmount > 0 && (
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Valor solicitado:</span>
                  <span>{formatCurrency(withdrawAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa ({withdrawalRules.fee_percentage}%):</span>
                  <span>
                    -{formatCurrency(Math.round(withdrawAmount * (withdrawalRules.fee_percentage / 100)))}
                  </span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1 mt-1">
                  <span>Você receberá:</span>
                  <span className="text-green-600">
                    {formatCurrency(
                      withdrawAmount - Math.round(withdrawAmount * (withdrawalRules.fee_percentage / 100))
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRequestWithdrawal}
              disabled={
                requestWithdrawal.isPending ||
                withdrawAmount < withdrawalRules.min_amount_cents ||
                withdrawAmount > account.balance_cents
              }
            >
              Solicitar Saque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
