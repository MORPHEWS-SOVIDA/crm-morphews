import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { Product, ProductFormData } from '@/hooks/useProducts';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().max(200, 'Máximo 200 caracteres').optional(),
  sales_script: z.string().optional(),
  key_question_1: z.string().optional(),
  key_question_2: z.string().optional(),
  key_question_3: z.string().optional(),
  price_1_unit: z.coerce.number().min(0).optional(),
  price_3_units: z.coerce.number().min(0).optional(),
  price_6_units: z.coerce.number().min(0).optional(),
  price_12_units: z.coerce.number().min(0).optional(),
  minimum_price: z.coerce.number().min(0).optional(),
  usage_period_days: z.coerce.number().min(0).optional(),
  is_active: z.boolean().optional(),
});

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (data: ProductFormData) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function ProductForm({ product, onSubmit, isLoading, onCancel }: ProductFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      sales_script: product?.sales_script || '',
      key_question_1: product?.key_question_1 || '',
      key_question_2: product?.key_question_2 || '',
      key_question_3: product?.key_question_3 || '',
      price_1_unit: product?.price_1_unit || 0,
      price_3_units: product?.price_3_units || 0,
      price_6_units: product?.price_6_units || 0,
      price_12_units: product?.price_12_units || 0,
      minimum_price: product?.minimum_price || 0,
      usage_period_days: product?.usage_period_days || 0,
      is_active: product?.is_active ?? true,
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values as ProductFormData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do produto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Curta</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição breve do produto (máx. 200 caracteres)"
                      className="resize-none"
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length || 0}/200 caracteres
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Produto Ativo</FormLabel>
                    <FormDescription>
                      Produtos inativos não aparecem nas opções de venda
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Script de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Script de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="sales_script"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Script de Vendas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Script detalhado para vendedores..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Roteiro completo para auxiliar vendedores na apresentação do produto
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Perguntas Chave */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Perguntas Chave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="key_question_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pergunta Chave 1</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Primeira pergunta importante..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="key_question_2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pergunta Chave 2</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Segunda pergunta importante..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="key_question_3"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pergunta Chave 3</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Terceira pergunta importante..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Tabela de Preços */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tabela de Preços</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="price_1_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço 1 Unidade</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price_3_units"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço 3 Unidades</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price_6_units"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço 6 Unidades</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price_12_units"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço 12 Unidades</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Configurações ERP */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configurações ERP</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="minimum_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Mínimo</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Abaixo desse valor, venda precisa de autorização
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="usage_period_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período de Uso (dias)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="0" {...field} />
                  </FormControl>
                  <FormDescription>
                    Usado para avisar quando tratamento está terminando
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
