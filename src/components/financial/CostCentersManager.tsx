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
import { Loader2, Plus, Edit, Building2, Landmark } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCnpj } from '@/lib/format';
import { useCostCenters, type CostCenter } from '@/hooks/usePaymentMethodsEnhanced';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const NONE_VALUE = '__none__';

const formSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  cnpj: z.string().optional(),
  default_bank_account_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function CostCentersManager() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  
  const { data: costCenters, isLoading } = useCostCenters();
  const { data: bankAccounts } = useBankAccounts();
  const queryClient = useQueryClient();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      cnpj: '',
      default_bank_account_id: NONE_VALUE,
    },
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const normalizedName = data.name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      const { data: result, error } = await supabase
        .from('payment_cost_centers')
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          normalized_name: normalizedName,
          cnpj: data.cnpj || null,
          default_bank_account_id: data.default_bank_account_id === NONE_VALUE ? null : data.default_bank_account_id,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Este centro de custo já existe');
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-cost-centers'] });
      toast.success('Centro de Custo criado');
      setFormOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar: ' + error.message);
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: FormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('payment_cost_centers')
        .update({
          name: data.name,
          normalized_name: data.name.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          cnpj: data.cnpj || null,
          default_bank_account_id: data.default_bank_account_id === NONE_VALUE ? null : data.default_bank_account_id,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-cost-centers'] });
      toast.success('Centro de Custo atualizado');
      setFormOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
  
  const openForm = (costCenter?: CostCenter) => {
    if (costCenter) {
      setSelectedCostCenter(costCenter);
      form.reset({
        name: costCenter.name,
        cnpj: costCenter.cnpj || '',
        default_bank_account_id: costCenter.default_bank_account_id || NONE_VALUE,
      });
    } else {
      setSelectedCostCenter(null);
      form.reset({
        name: '',
        cnpj: '',
        default_bank_account_id: NONE_VALUE,
      });
    }
    setFormOpen(true);
  };
  
  const onSubmit = async (data: FormData) => {
    if (selectedCostCenter) {
      await updateMutation.mutateAsync({ id: selectedCostCenter.id, ...data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };
  
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  
  const getBankAccountName = (id: string | null) => {
    if (!id) return '-';
    const account = bankAccounts?.find(a => a.id === id);
    return account?.name || '-';
  };
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Centros de Custo (CNPJ)
            </CardTitle>
            <Button onClick={() => openForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Centro de Custo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !costCenters?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nenhum centro de custo cadastrado</p>
              <p className="text-sm mt-1">Centros de custo representam CNPJs diferentes da sua empresa</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Conta Bancária Padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCenters.map(cc => (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">{cc.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {cc.cnpj ? formatCnpj(cc.cnpj) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        {getBankAccountName(cc.default_bank_account_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cc.is_active ? 'default' : 'secondary'}>
                        {cc.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openForm(cc)}>
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
              {selectedCostCenter ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Filial São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="00.000.000/0000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="default_bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta Bancária Padrão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE_VALUE}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                        {bankAccounts?.filter(a => a.is_active).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} {acc.bank_name ? `(${acc.bank_name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  {selectedCostCenter ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
