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
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Edit, Landmark, Upload, FileSpreadsheet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency } from '@/lib/format';

import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  parseOFX,
  useImportOFX,
  type BankAccount,
} from '@/hooks/useBankAccounts';

const BANKS = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '104', name: 'Caixa Econômica' },
  { code: '237', name: 'Bradesco' },
  { code: '341', name: 'Itaú' },
  { code: '422', name: 'Safra' },
  { code: '745', name: 'Citibank' },
  { code: '260', name: 'Nubank' },
  { code: '077', name: 'Inter' },
  { code: '212', name: 'Banco Original' },
  { code: '336', name: 'C6 Bank' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  bank_code: z.string().optional(),
  bank_name: z.string().optional(),
  agency: z.string().optional(),
  account_number: z.string().optional(),
  account_type: z.string().default('corrente'),
  initial_balance: z.string().optional(),
  color: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function BankAccountsManager() {
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [importAccountId, setImportAccountId] = useState<string>('');
  
  const { data: accounts, isLoading } = useBankAccounts(false);
  const createMutation = useCreateBankAccount();
  const updateMutation = useUpdateBankAccount();
  const importMutation = useImportOFX();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      bank_code: '',
      bank_name: '',
      agency: '',
      account_number: '',
      account_type: 'corrente',
      initial_balance: '',
      color: '',
    },
  });
  
  const openForm = (account?: BankAccount) => {
    if (account) {
      setSelectedAccount(account);
      form.reset({
        name: account.name,
        bank_code: account.bank_code || '',
        bank_name: account.bank_name || '',
        agency: account.agency || '',
        account_number: account.account_number || '',
        account_type: account.account_type || 'corrente',
        initial_balance: (account.initial_balance_cents / 100).toFixed(2).replace('.', ','),
        color: account.color || '',
      });
    } else {
      setSelectedAccount(null);
      form.reset({
        name: '',
        bank_code: '',
        bank_name: '',
        agency: '',
        account_number: '',
        account_type: 'corrente',
        initial_balance: '',
        color: '',
      });
    }
    setFormOpen(true);
  };
  
  const onSubmit = async (data: FormData) => {
    const balanceCents = data.initial_balance 
      ? Math.round(parseFloat(data.initial_balance.replace(',', '.')) * 100)
      : 0;
    
    const bank = BANKS.find(b => b.code === data.bank_code);
    
    const payload = {
      name: data.name,
      bank_code: data.bank_code || null,
      bank_name: bank?.name || data.bank_name || null,
      agency: data.agency || null,
      account_number: data.account_number || null,
      account_type: data.account_type,
      initial_balance_cents: balanceCents,
      color: data.color || null,
    };
    
    if (selectedAccount) {
      await updateMutation.mutateAsync({ id: selectedAccount.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setFormOpen(false);
  };
  
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importAccountId) return;
    
    const content = await file.text();
    const { transactions, startDate, endDate } = parseOFX(content);
    
    if (transactions.length === 0) {
      alert('Nenhuma transação encontrada no arquivo OFX');
      return;
    }
    
    await importMutation.mutateAsync({
      bankAccountId: importAccountId,
      transactions,
      fileName: file.name,
      startDate,
      endDate,
    });
    
    setImportOpen(false);
    e.target.value = '';
  };
  
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Contas Bancárias
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Importar OFX
              </Button>
              <Button onClick={() => openForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !accounts?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conta bancária cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Agência/Conta</TableHead>
                  <TableHead className="text-right">Saldo Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map(account => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {account.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: account.color }}
                          />
                        )}
                        <span className="font-medium">{account.name}</span>
                        {account.is_default && (
                          <Badge variant="secondary" className="text-xs">Padrão</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.bank_name || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {account.agency && account.account_number
                        ? `${account.agency} / ${account.account_number}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={account.current_balance_cents >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(account.current_balance_cents)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? 'default' : 'secondary'}>
                        {account.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openForm(account)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount ? 'Editar Conta' : 'Nova Conta Bancária'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Conta *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Conta Principal Itaú" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="bank_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o banco" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BANKS.map(bank => (
                          <SelectItem key={bank.code} value={bank.code}>
                            {bank.code} - {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agência</FormLabel>
                      <FormControl>
                        <Input placeholder="0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="account_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta</FormLabel>
                      <FormControl>
                        <Input placeholder="00000-0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="account_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="corrente">Corrente</SelectItem>
                          <SelectItem value="poupanca">Poupança</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="initial_balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo Inicial</FormLabel>
                      <FormControl>
                        <Input placeholder="0,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor de Identificação</FormLabel>
                    <FormControl>
                      <Input type="color" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {selectedAccount ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Import OFX Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Extrato OFX
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Conta Bancária *</label>
              <Select value={importAccountId} onValueChange={setImportAccountId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => a.is_active).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">Arquivo OFX</label>
              <Input
                type="file"
                accept=".ofx,.OFX"
                onChange={handleFileImport}
                disabled={!importAccountId || importMutation.isPending}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Exporte o extrato do seu banco no formato OFX e importe aqui
              </p>
            </div>
            
            {importMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando transações...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
