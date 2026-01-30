import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Percent, DollarSign, Users, Package, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useCreateDiscountCoupon,
  useUpdateDiscountCoupon,
  type DiscountCoupon,
} from '@/hooks/useDiscountCoupons';
import { useProducts } from '@/hooks/useProducts';
import { useProductCombos } from '@/hooks/useProductCombos';
import { useOrganizationAffiliatesV2 } from '@/hooks/ecommerce/useOrganizationAffiliatesV2';

const formSchema = z.object({
  code: z.string().min(2, 'Mínimo 2 caracteres').max(20, 'Máximo 20 caracteres'),
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().min(1, 'Valor deve ser maior que 0'),
  applies_to: z.enum(['all', 'specific_products', 'specific_combos', 'specific_items']),
  product_ids: z.array(z.string()).optional(),
  combo_ids: z.array(z.string()).optional(),
  valid_from: z.date().optional().nullable(),
  valid_until: z.date().optional().nullable(),
  max_uses: z.number().optional().nullable(),
  max_uses_per_customer: z.number().optional().nullable(),
  min_order_cents: z.number().optional().nullable(),
  allow_with_affiliate: z.boolean(),
  affiliate_only: z.boolean(),
  auto_attribute_affiliate_id: z.string().optional().nullable(),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface CouponFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: DiscountCoupon | null;
}

export function CouponFormDialog({ open, onOpenChange, coupon }: CouponFormDialogProps) {
  const createCoupon = useCreateDiscountCoupon();
  const updateCoupon = useUpdateDiscountCoupon();
  const { data: products } = useProducts();
  const { data: combos } = useProductCombos();
  const { data: affiliates } = useOrganizationAffiliatesV2();

  const [itemsTab, setItemsTab] = useState<'products' | 'combos'>('products');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      applies_to: 'all',
      product_ids: [],
      combo_ids: [],
      valid_from: null,
      valid_until: null,
      max_uses: null,
      max_uses_per_customer: null,
      min_order_cents: null,
      allow_with_affiliate: true,
      affiliate_only: false,
      auto_attribute_affiliate_id: null,
      is_active: true,
    },
  });

  const watchDiscountType = form.watch('discount_type');
  const watchAppliesTo = form.watch('applies_to');
  const watchAutoAttribute = form.watch('auto_attribute_affiliate_id');

  useEffect(() => {
    if (open && coupon) {
      form.reset({
        code: coupon.code,
        name: coupon.name,
        description: coupon.description || '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_type === 'percentage' 
          ? coupon.discount_value_cents 
          : coupon.discount_value_cents / 100,
        applies_to: coupon.applies_to,
        product_ids: coupon.product_ids || [],
        combo_ids: coupon.combo_ids || [],
        valid_from: coupon.valid_from ? new Date(coupon.valid_from) : null,
        valid_until: coupon.valid_until ? new Date(coupon.valid_until) : null,
        max_uses: coupon.max_uses,
        max_uses_per_customer: coupon.max_uses_per_customer,
        min_order_cents: coupon.min_order_cents ? coupon.min_order_cents / 100 : null,
        allow_with_affiliate: coupon.allow_with_affiliate,
        affiliate_only: coupon.affiliate_only,
        auto_attribute_affiliate_id: coupon.auto_attribute_affiliate_id,
        is_active: coupon.is_active,
      });
    } else if (open) {
      form.reset({
        code: '',
        name: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 10,
        applies_to: 'all',
        product_ids: [],
        combo_ids: [],
        valid_from: null,
        valid_until: null,
        max_uses: null,
        max_uses_per_customer: null,
        min_order_cents: null,
        allow_with_affiliate: true,
        affiliate_only: false,
        auto_attribute_affiliate_id: null,
        is_active: true,
      });
    }
  }, [open, coupon, form]);

  const onSubmit = async (data: FormData) => {
    const discountValueCents = data.discount_type === 'percentage'
      ? data.discount_value
      : Math.round(data.discount_value * 100);

    const payload = {
      code: data.code,
      name: data.name,
      description: data.description,
      discount_type: data.discount_type,
      discount_value_cents: discountValueCents,
      applies_to: data.applies_to,
      product_ids: data.product_ids,
      combo_ids: data.combo_ids,
      valid_from: data.valid_from?.toISOString(),
      valid_until: data.valid_until?.toISOString(),
      max_uses: data.max_uses || undefined,
      max_uses_per_customer: data.max_uses_per_customer || undefined,
      min_order_cents: data.min_order_cents ? Math.round(data.min_order_cents * 100) : undefined,
      allow_with_affiliate: data.allow_with_affiliate,
      affiliate_only: data.affiliate_only,
      auto_attribute_affiliate_id: data.auto_attribute_affiliate_id || undefined,
      is_active: data.is_active,
    };

    if (coupon) {
      await updateCoupon.mutateAsync({ id: coupon.id, ...payload });
    } else {
      await createCoupon.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  const isPending = createCoupon.isPending || updateCoupon.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {coupon ? 'Editar Cupom' : 'Novo Cupom de Desconto'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código do Cupom</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="PROMO10"
                        className="uppercase"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>
                      Código que o cliente irá digitar
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Interno</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Promoção de Verão" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Descrição interna do cupom..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discount Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Desconto</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Porcentagem
                          </div>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Valor Fixo (R$)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchDiscountType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={watchDiscountType === 'percentage' ? '1' : '0.01'}
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Applies To */}
            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aplica-se a</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      <SelectItem value="specific_products">Produtos específicos</SelectItem>
                      <SelectItem value="specific_combos">Combos específicos</SelectItem>
                      <SelectItem value="specific_items">Produtos e Combos específicos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Product/Combo Selection */}
            {(watchAppliesTo === 'specific_products' || watchAppliesTo === 'specific_items') && (
              <FormField
                control={form.control}
                name="product_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Produtos
                    </FormLabel>
                    <ScrollArea className="h-40 border rounded-md p-3">
                      <div className="space-y-2">
                        {products?.filter(p => p.is_active).map((product) => (
                          <div key={product.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={field.value?.includes(product.id)}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...(field.value || []), product.id]
                                  : (field.value || []).filter(id => id !== product.id);
                                field.onChange(newValue);
                              }}
                            />
                            <span className="text-sm">{product.name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(watchAppliesTo === 'specific_combos' || watchAppliesTo === 'specific_items') && (
              <FormField
                control={form.control}
                name="combo_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Combos
                    </FormLabel>
                    <ScrollArea className="h-40 border rounded-md p-3">
                      <div className="space-y-2">
                        {combos?.filter(c => c.is_active).map((combo) => (
                          <div key={combo.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={field.value?.includes(combo.id)}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...(field.value || []), combo.id]
                                  : (field.value || []).filter(id => id !== combo.id);
                                field.onChange(newValue);
                              }}
                            />
                            <span className="text-sm">{combo.name}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Validity Period */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Válido a partir de</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd/MM/yyyy') : 'Imediato'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Válido até</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'dd/MM/yyyy') : 'Sem limite'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usos máximos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ilimitado"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Total de usos</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_uses_per_customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Por cliente</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ilimitado"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Usos por cliente</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_order_cents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pedido mínimo (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Sem mínimo"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Affiliate Rules */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Regras de Afiliados
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="allow_with_affiliate"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 p-3 border rounded-lg">
                      <div>
                        <FormLabel className="mb-0">Permite com afiliado</FormLabel>
                        <FormDescription className="text-xs">
                          Pode ser usado junto com link de afiliado
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="affiliate_only"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 p-3 border rounded-lg">
                      <div>
                        <FormLabel className="mb-0">Apenas com afiliado</FormLabel>
                        <FormDescription className="text-xs">
                          Só funciona se houver ref de afiliado
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="auto_attribute_affiliate_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vincular vendas a afiliado</FormLabel>
                    <Select 
                      value={field.value || ''} 
                      onValueChange={(v) => field.onChange(v || null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum (não vincular)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum (não vincular)</SelectItem>
                        {affiliates?.map((affiliate) => (
                          <SelectItem key={affiliate.id} value={affiliate.id}>
                            {affiliate.name || affiliate.email || 'Afiliado'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Quando o cupom for usado, a venda será atribuída a este afiliado (ideal para influenciadores)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Active Status */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2 p-4 border rounded-lg">
                  <div>
                    <FormLabel className="mb-0">Cupom Ativo</FormLabel>
                    <FormDescription>
                      Desative para pausar o cupom temporariamente
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Salvando...' : coupon ? 'Salvar Alterações' : 'Criar Cupom'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
