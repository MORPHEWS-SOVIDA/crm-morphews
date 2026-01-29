import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useTenantVirtualAccount, 
  useUpdateBankData, 
  useRequestWithdrawal,
  useMyWithdrawals
} from '@/hooks/ecommerce/useVirtualAccounts';
import { 
  Wallet, 
  Building2, 
  ArrowUpRight, 
  Plus,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WalletTabProps {
  canManageBank: boolean;
  canWithdraw: boolean;
}

const BANKS = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '104', name: 'Caixa Econômica' },
  { code: '237', name: 'Bradesco' },
  { code: '341', name: 'Itaú' },
  { code: '422', name: 'Safra' },
  { code: '077', name: 'Inter' },
  { code: '260', name: 'Nubank' },
  { code: '756', name: 'Sicoob' },
  { code: '748', name: 'Sicredi' },
  { code: '336', name: 'C6 Bank' },
];

export function WalletTab({ canManageBank, canWithdraw }: WalletTabProps) {
  const { data: account, isLoading } = useTenantVirtualAccount();
  const { data: withdrawals } = useMyWithdrawals();
  const updateBankMutation = useUpdateBankData();
  const withdrawMutation = useRequestWithdrawal();
  
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  
  // Bank form
  const [bankCode, setBankCode] = useState('');
  const [agency, setAgency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [holderName, setHolderName] = useState('');
  const [holderDocument, setHolderDocument] = useState('');
  const [pixKey, setPixKey] = useState('');
  
  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSaveBank = async () => {
    if (!account?.id) return;
    
    await updateBankMutation.mutateAsync({
      virtualAccountId: account.id,
      bank_code: bankCode,
      bank_name: BANKS.find(b => b.code === bankCode)?.name || bankCode,
      agency,
      account_number: accountNumber,
      account_type: accountType,
      holder_name: holderName,
      holder_document: holderDocument.replace(/\D/g, ''),
      pix_key: pixKey || null,
      pix_key_type: null,
      is_primary: true,
    });
    
    setShowBankDialog(false);
  };

  const handleWithdraw = async () => {
    if (!account?.id || withdrawAmount <= 0) return;
    
    await withdrawMutation.mutateAsync({
      virtualAccountId: account.id,
      amountCents: withdrawAmount,
    });
    
    setShowWithdrawDialog(false);
    setWithdrawAmount(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const bankData = account?.bank_data?.[0];
  const availableBalance = (account?.balance_cents || 0) - (account?.pending_balance_cents || 0);

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Total
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(account?.balance_cents || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disponível p/ Saque
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(availableBalance > 0 ? availableBalance : 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Recebido
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(account?.total_received_cents || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Conta Bancária
              </CardTitle>
              <CardDescription>
                Cadastre sua conta para receber os valores
              </CardDescription>
            </div>
            {canManageBank && (
              <Button onClick={() => setShowBankDialog(true)}>
                {bankData ? 'Editar' : 'Cadastrar'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {bankData ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{bankData.bank_name}</span>
                <Badge variant="outline">{bankData.account_type === 'checking' ? 'Corrente' : 'Poupança'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Ag: {bankData.agency} | Conta: {bankData.account_number}
              </p>
              <p className="text-sm text-muted-foreground">
                Titular: {bankData.holder_name}
              </p>
              {bankData.pix_key && (
                <p className="text-sm text-muted-foreground">
                  PIX: {bankData.pix_key}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Nenhuma conta cadastrada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Withdraw Button */}
      {canWithdraw && bankData && availableBalance > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => setShowWithdrawDialog(true)}
            >
              <ArrowUpRight className="h-5 w-5 mr-2" />
              Solicitar Saque
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal History */}
      {withdrawals && withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Saques</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {withdrawals.slice(0, 10).map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{formatCurrency(w.amount_cents)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(w.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      w.status === 'completed' ? 'default' :
                      w.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {w.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {w.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {w.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                    {w.status === 'pending' ? 'Pendente' :
                     w.status === 'approved' ? 'Aprovado' :
                     w.status === 'processing' ? 'Processando' :
                     w.status === 'completed' ? 'Concluído' :
                     w.status === 'rejected' ? 'Recusado' : w.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados Bancários</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Banco *</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.code} - {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Agência *</Label>
                <Input
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="0000"
                />
              </div>
              <div>
                <Label>Conta *</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="00000-0"
                />
              </div>
            </div>
            
            <div>
              <Label>Tipo de Conta</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as 'checking' | 'savings')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Nome do Titular *</Label>
              <Input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            
            <div>
              <Label>CPF/CNPJ do Titular *</Label>
              <Input
                value={holderDocument}
                onChange={(e) => setHolderDocument(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            
            <div>
              <Label>Chave PIX (opcional)</Label>
              <Input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveBank} 
              disabled={updateBankMutation.isPending || !bankCode || !agency || !accountNumber || !holderName || !holderDocument}
            >
              {updateBankMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar Saque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Saldo Disponível</Label>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(availableBalance > 0 ? availableBalance : 0)}
              </p>
            </div>
            
            <div>
              <Label>Valor do Saque *</Label>
              <Input
                type="number"
                value={withdrawAmount ? withdrawAmount / 100 : ''}
                onChange={(e) => setWithdrawAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
                placeholder="0,00"
                step="0.01"
                max={availableBalance / 100}
              />
            </div>
            
            <Button 
              variant="link" 
              className="p-0 h-auto"
              onClick={() => setWithdrawAmount(availableBalance)}
            >
              Sacar tudo
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleWithdraw} 
              disabled={withdrawMutation.isPending || withdrawAmount <= 0 || withdrawAmount > availableBalance}
            >
              {withdrawMutation.isPending ? 'Solicitando...' : 'Solicitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
