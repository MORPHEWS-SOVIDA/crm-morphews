import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Loader2, Plus, Minus, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useCreateStockMovement } from '@/hooks/useStock';
import type { Product } from '@/hooks/useProducts';

interface StockMovementDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  movement_type: z.enum(['entry', 'exit', 'adjustment']),
  quantity: z.coerce.number().min(1, 'Quantidade deve ser maior que 0'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const movementTypes = [
  { value: 'entry', label: 'Entrada', icon: ArrowDownToLine, color: 'text-green-600' },
  { value: 'exit', label: 'Saída', icon: ArrowUpFromLine, color: 'text-red-600' },
  { value: 'adjustment', label: 'Ajuste (definir quantidade)', icon: RefreshCw, color: 'text-blue-600' },
];

export function StockMovementDialog({ product, open, onOpenChange }: StockMovementDialogProps) {
  const createMovement = useCreateStockMovement();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      movement_type: 'entry',
      quantity: 1,
      notes: '',
    },
  });

  const movementType = form.watch('movement_type');
  const quantity = form.watch('quantity') || 0;

  const calculateNewStock = () => {
    if (!product) return 0;
    const currentStock = product.stock_quantity || 0;
    
    switch (movementType) {
      case 'entry':
        return currentStock + quantity;
      case 'exit':
        return Math.max(0, currentStock - quantity);
      case 'adjustment':
        return quantity;
      default:
        return currentStock;
    }
  };

  const handleSubmit = async (values: FormValues) => {
    if (!product) return;

    await createMovement.mutateAsync({
      product_id: product.id,
      movement_type: values.movement_type,
      quantity: values.quantity,
      notes: values.notes,
      reference_type: 'manual',
    });

    form.reset();
    onOpenChange(false);
  };

  if (!product) return null;

  const newStock = calculateNewStock();
  const willBeNegative = movementType === 'exit' && quantity > (product.stock_quantity || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentação de Estoque</DialogTitle>
        </DialogHeader>

        <div className="p-4 rounded-lg bg-muted/50 mb-4">
          <p className="text-sm text-muted-foreground">Produto</p>
          <p className="font-medium">{product.name}</p>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="text-xs text-muted-foreground">Estoque Atual</p>
              <p className="text-2xl font-bold">{product.stock_quantity || 0}</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div>
              <p className="text-xs text-muted-foreground">Novo Estoque</p>
              <p className={`text-2xl font-bold ${willBeNegative ? 'text-destructive' : 'text-green-600'}`}>
                {newStock}
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="movement_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimentação</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {movementTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className={`h-4 w-4 ${type.color}`} />
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {movementType === 'entry' && 'Adiciona quantidade ao estoque atual'}
                    {movementType === 'exit' && 'Remove quantidade do estoque atual'}
                    {movementType === 'adjustment' && 'Define a quantidade exata em estoque'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {movementType === 'adjustment' ? 'Nova Quantidade' : 'Quantidade'}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  {willBeNegative && (
                    <p className="text-sm text-destructive">
                      Estoque insuficiente! Máximo disponível: {product.stock_quantity}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Motivo da movimentação, nota fiscal, etc."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMovement.isPending || willBeNegative}
              >
                {createMovement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
