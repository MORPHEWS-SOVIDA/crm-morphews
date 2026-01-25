import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreatePayable, useUpdatePayable, type AccountPayable } from '@/hooks/useAccountsPayable';

const NONE_VALUE = '__none__';

const payableSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amount_cents: z.number().min(1, 'Valor deve ser maior que zero'),
  issue_date: z.date(),
  due_date: z.date(),
  supplier_id: z.string().optional(),
  category_id: z.string().optional(),
  cost_center_id: z.string().optional(),
  bank_account_id: z.string().optional(),
  payment_method: z.string().optional(),
  barcode: z.string().optional(),
  pix_code: z.string().optional(),
  document_number: z.string().optional(),
  notes: z.string().optional(),
  is_recurring: z.boolean().optional(),
  recurrence_type: z.string().optional(),
  recurrence_end_date: z.date().optional(),
  requires_approval: z.boolean().optional(),
});

type PayableFormData = z.infer<typeof payableSchema>;

interface PayableFormDialogProps {
  open: boolean;
  onClose: () => void;
  payable?: AccountPayable | null;
}

export function PayableFormDialog({ open, onClose, payable }: PayableFormDialogProps) {
  const { data: suppliers } = useSuppliers();
  const { data: bankAccounts } = useBankAccounts();
  const createPayable = useCreatePayable();
  const updatePayable = useUpdatePayable();
  
  const { data: categories } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_categories')
        .select('*')
        .eq('type', 'expense')
        .order('name');
      return data || [];
    },
  });
  
  const { data: costCenters } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_cost_centers')
        .select('*')
        .order('name');
      return data || [];
    },
  });

  const form = useForm<PayableFormData>({
    resolver: zodResolver(payableSchema),
    defaultValues: {
      description: '',
      amount_cents: 0,
      issue_date: new Date(),
      due_date: new Date(),
      supplier_id: NONE_VALUE,
      category_id: NONE_VALUE,
      cost_center_id: NONE_VALUE,
      bank_account_id: NONE_VALUE,
      payment_method: NONE_VALUE,
      barcode: '',
      pix_code: '',
      document_number: '',
      notes: '',
      is_recurring: false,
      recurrence_type: NONE_VALUE,
      requires_approval: false,
    },
  });

  useEffect(() => {
    if (payable) {
      form.reset({
        description: payable.description,
        amount_cents: payable.amount_cents,
        issue_date: new Date(payable.issue_date),
        due_date: new Date(payable.due_date),
        supplier_id: payable.supplier_id || NONE_VALUE,
        category_id: payable.category_id || NONE_VALUE,
        cost_center_id: payable.cost_center_id || NONE_VALUE,
        bank_account_id: payable.bank_account_id || NONE_VALUE,
        payment_method: payable.payment_method || NONE_VALUE,
        barcode: payable.barcode || '',
        pix_code: payable.pix_code || '',
        document_number: payable.document_number || '',
        notes: payable.notes || '',
        is_recurring: payable.is_recurring || false,
        recurrence_type: payable.recurrence_type || NONE_VALUE,
        requires_approval: payable.requires_approval || false,
      });
    } else {
      form.reset({
        description: '',
        amount_cents: 0,
        issue_date: new Date(),
        due_date: new Date(),
        supplier_id: NONE_VALUE,
        category_id: NONE_VALUE,
        cost_center_id: NONE_VALUE,
        bank_account_id: NONE_VALUE,
        payment_method: NONE_VALUE,
        barcode: '',
        pix_code: '',
        document_number: '',
        notes: '',
        is_recurring: false,
        recurrence_type: NONE_VALUE,
        requires_approval: false,
      });
    }
  }, [payable, form]);

  const onSubmit = (data: PayableFormData) => {
    // Convert NONE_VALUE back to null/undefined for database
    const cleanData = {
      ...data,
      supplier_id: data.supplier_id === NONE_VALUE ? null : data.supplier_id,
      category_id: data.category_id === NONE_VALUE ? null : data.category_id,
      cost_center_id: data.cost_center_id === NONE_VALUE ? null : data.cost_center_id,
      bank_account_id: data.bank_account_id === NONE_VALUE ? null : data.bank_account_id,
      payment_method: data.payment_method === NONE_VALUE ? null : data.payment_method,
      recurrence_type: data.recurrence_type === NONE_VALUE ? null : data.recurrence_type,
      issue_date: format(data.issue_date, 'yyyy-MM-dd'),
      due_date: format(data.due_date, 'yyyy-MM-dd'),
      recurrence_end_date: data.recurrence_end_date ? format(data.recurrence_end_date, 'yyyy-MM-dd') : null,
    };

    if (payable) {
      updatePayable.mutate({ id: payable.id, ...cleanData } as any, {
        onSuccess: () => onClose(),
      });
    } else {
      createPayable.mutate(cleanData as any, {
        onSuccess: () => onClose(),
      });
    }
  };

  const isSubmitting = createPayable.isPending || updatePayable.isPending;
  const isRecurring = form.watch('is_recurring');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payable ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Aluguel Janeiro" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <FormField
                control={form.control}
                name="amount_cents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={(field.value / 100).toFixed(2)}
                        onChange={(e) => field.onChange(Math.round(parseFloat(e.target.value || '0') * 100))}
                        placeholder="0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Document Number */}
              <FormField
                control={form.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Documento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: NF 12345" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Issue Date */}
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Emissão</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Vencimento *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Supplier */}
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um fornecedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cost Center */}
              <FormField
                control={form.control}
                name="cost_center_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Centro de Custo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                        {costCenters?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bank Account */}
              <FormField
                control={form.control}
                name="bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Bancária</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                        {bankAccounts?.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Payment info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Barras</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Código do boleto" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pix_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Chave ou código PIX" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <FormField
                control={form.control}
                name="is_recurring"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Conta Recorrente</FormLabel>
                  </FormItem>
                )}
              />

              {isRecurring && (
                <FormField
                  control={form.control}
                  name="recurrence_type"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || NONE_VALUE}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Frequência" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Selecione</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Notas adicionais..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {payable ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
