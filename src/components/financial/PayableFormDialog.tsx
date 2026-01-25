import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

import { useCreatePayable, useUpdatePayable, type AccountPayable } from '@/hooks/useAccountsPayable';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
import { useBankAccounts } from '@/hooks/useBankAccounts';

const formSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.string().min(1, 'Valor obrigatório'),
  issue_date: z.string().min(1, 'Data de emissão obrigatória'),
  due_date: z.string().min(1, 'Data de vencimento obrigatória'),
  supplier_id: z.string().optional(),
  category_id: z.string().optional(),
  bank_account_id: z.string().optional(),
  payment_method: z.string().optional(),
  document_number: z.string().optional(),
  barcode: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PayableFormDialogProps {
  open: boolean;
  onClose: () => void;
  payable: AccountPayable | null;
}

export function PayableFormDialog({ open, onClose, payable }: PayableFormDialogProps) {
  const createMutation = useCreatePayable();
  const updateMutation = useUpdatePayable();
  const { data: suppliers } = useSuppliers();
  const { data: categories } = useFinancialCategories('expense');
  const { data: bankAccounts } = useBankAccounts();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: '',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: '',
      supplier_id: '',
      category_id: '',
      bank_account_id: '',
      payment_method: 'boleto',
      document_number: '',
      barcode: '',
      notes: '',
    },
  });
  
  useEffect(() => {
    if (payable) {
      form.reset({
        description: payable.description,
        amount: (payable.amount_cents / 100).toFixed(2).replace('.', ','),
        issue_date: payable.issue_date,
        due_date: payable.due_date,
        supplier_id: payable.supplier_id || '',
        category_id: payable.category_id || '',
        bank_account_id: payable.bank_account_id || '',
        payment_method: payable.payment_method || 'boleto',
        document_number: payable.document_number || '',
        barcode: payable.barcode || '',
        notes: payable.notes || '',
      });
    } else {
      form.reset({
        description: '',
        amount: '',
        issue_date: format(new Date(), 'yyyy-MM-dd'),
        due_date: '',
        supplier_id: '',
        category_id: '',
        bank_account_id: '',
        payment_method: 'boleto',
        document_number: '',
        barcode: '',
        notes: '',
      });
    }
  }, [payable, form]);
  
  const onSubmit = async (data: FormData) => {
    const amountCents = Math.round(parseFloat(data.amount.replace(',', '.')) * 100);
    
    const payload = {
      description: data.description,
      amount_cents: amountCents,
      issue_date: data.issue_date,
      due_date: data.due_date,
      supplier_id: data.supplier_id || null,
      category_id: data.category_id || null,
      bank_account_id: data.bank_account_id || null,
      payment_method: data.payment_method || null,
      document_number: data.document_number || null,
      barcode: data.barcode || null,
      notes: data.notes || null,
    };
    
    if (payable) {
      await updateMutation.mutateAsync({ id: payable.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    
    onClose();
  };
  
  const isLoading = createMutation.isPending || updateMutation.isPending;
  
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {payable ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pagamento fornecedor X" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <Input placeholder="0,00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de Pagamento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="transferencia">Transferência</SelectItem>
                        <SelectItem value="cartao">Cartão</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Emissão *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {suppliers?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {categories?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="document_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Documento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: NF 12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linha Digitável (Boleto)</FormLabel>
                  <FormControl>
                    <Input placeholder="Cole a linha digitável aqui" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações adicionais..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {payable ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
