import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Package, DollarSign, Link2, HelpCircle, ImageIcon, FlaskConical, Users } from 'lucide-react';
import type { Product, ProductFormData } from '@/hooks/useProducts';
import { PRODUCT_CATEGORIES, useProducts } from '@/hooks/useProducts';
import { PriceKitsManager } from './PriceKitsManager';
import { DynamicQuestionsManager, type DynamicQuestion } from './DynamicQuestionsManager';
import type { ProductPriceKitFormData } from '@/hooks/useProductPriceKits';
import { ProductImageUpload } from './ProductImageUpload';
import { ProductFaqManager, type ProductFaq } from './ProductFaqManager';
import { ProductIngredientsManager, type ProductIngredient } from './ProductIngredientsManager';
import { useUsers } from '@/hooks/useUsers';
import { useProductVisibility } from '@/hooks/useProductVisibility';

// Categorias que usam o sistema de kits dinâmicos
const CATEGORIES_WITH_KITS = ['produto_pronto', 'print_on_demand', 'dropshipping'];

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().max(200, 'Máximo 200 caracteres').optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  sales_script: z.string().optional(),
  price_1_unit: z.coerce.number().min(0).optional(),
  price_3_units: z.coerce.number().min(0).optional(),
  price_6_units: z.coerce.number().min(0).optional(),
  price_12_units: z.coerce.number().min(0).optional(),
  minimum_price: z.coerce.number().min(0).optional(),
  usage_period_days: z.coerce.number().min(0).optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  cost_cents: z.coerce.number().min(0).optional(),
  stock_quantity: z.coerce.number().min(0).optional(),
  minimum_stock: z.coerce.number().min(0).optional(),
  track_stock: z.boolean().optional(),
  crosssell_product_1_id: z.string().nullable().optional(),
  crosssell_product_2_id: z.string().nullable().optional(),
  restrict_to_users: z.boolean().optional(),
});

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (data: ProductFormData, priceKits?: ProductPriceKitFormData[], questions?: DynamicQuestion[], faqs?: ProductFaq[], ingredients?: ProductIngredient[], selectedUserIds?: string[]) => void;
  isLoading?: boolean;
  onCancel: () => void;
  initialPriceKits?: ProductPriceKitFormData[];
  initialQuestions?: DynamicQuestion[];
  initialFaqs?: ProductFaq[];
  initialIngredients?: ProductIngredient[];
  initialVisibleUserIds?: string[];
}

export function ProductForm({ product, onSubmit, isLoading, onCancel, initialPriceKits = [], initialQuestions = [], initialFaqs = [], initialIngredients = [], initialVisibleUserIds = [] }: ProductFormProps) {
  const [priceKits, setPriceKits] = useState<ProductPriceKitFormData[]>(initialPriceKits);
  const [questions, setQuestions] = useState<DynamicQuestion[]>(initialQuestions);
  const [faqs, setFaqs] = useState<ProductFaq[]>(initialFaqs);
  const [ingredients, setIngredients] = useState<ProductIngredient[]>(initialIngredients);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url || null);
  const [labelImageUrl, setLabelImageUrl] = useState<string | null>(product?.label_image_url || null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialVisibleUserIds);
  
  const { data: users = [] } = useUsers();
  // Sync state when initial values change
  useEffect(() => {
    setPriceKits(initialPriceKits);
  }, [initialPriceKits]);

  useEffect(() => {
    setFaqs(initialFaqs);
  }, [initialFaqs]);

  useEffect(() => {
    setIngredients(initialIngredients);
  }, [initialIngredients]);

  useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  useEffect(() => {
    setSelectedUserIds(initialVisibleUserIds);
  }, [initialVisibleUserIds]);

  const { data: allProducts = [] } = useProducts();
  
  // Filter out current product from cross-sell options
  const crossSellOptions = allProducts.filter(p => p.id !== product?.id && p.is_active);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      category: product?.category || 'produto_pronto',
      sales_script: product?.sales_script || '',
      price_1_unit: product?.price_1_unit || 0,
      price_3_units: product?.price_3_units || 0,
      price_6_units: product?.price_6_units || 0,
      price_12_units: product?.price_12_units || 0,
      minimum_price: product?.minimum_price || 0,
      usage_period_days: product?.usage_period_days || 0,
      is_active: product?.is_active ?? true,
      is_featured: product?.is_featured ?? false,
      cost_cents: product?.cost_cents || 0,
      stock_quantity: product?.stock_quantity || 0,
      minimum_stock: product?.minimum_stock || 0,
      track_stock: product?.track_stock ?? false,
      crosssell_product_1_id: product?.crosssell_product_1_id || null,
      crosssell_product_2_id: product?.crosssell_product_2_id || null,
      restrict_to_users: product?.restrict_to_users ?? false,
    },
  });

  const watchedCategory = form.watch('category');
  const isManipulado = watchedCategory === 'manipulado';
  const usesKits = CATEGORIES_WITH_KITS.includes(watchedCategory);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // Filter out empty questions
    const validQuestions = questions.filter(q => q.question_text.trim() !== '');
    const validFaqs = faqs.filter(f => f.question.trim() !== '' && f.answer.trim() !== '');
    const validIngredients = ingredients.filter(i => i.name.trim() !== '');
    
    // Include image URLs in the form data
    const dataWithImages = {
      ...values,
      image_url: imageUrl,
      label_image_url: labelImageUrl,
    } as ProductFormData;
    
    // Pass selectedUserIds only if restrict_to_users is true
    const usersToSave = values.restrict_to_users ? selectedUserIds : [];
    onSubmit(dataWithImages, usesKits ? priceKits : undefined, validQuestions, validFaqs, validIngredients, usersToSave);
  };

  const watchedRestrictToUsers = form.watch('restrict_to_users');

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Categoria - PRIMEIRO CAMPO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tipo de Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isManipulado 
                      ? 'Produtos manipulados têm preço definido pelo vendedor na hora da venda'
                      : 'Define o tipo de produto para organização e relatórios'
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Imagens do Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Imagens do Produto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <ProductImageUpload
                label="Foto do Produto"
                currentUrl={imageUrl}
                onUploadComplete={setImageUrl}
                productId={product?.id}
                imageType="product"
              />
              <ProductImageUpload
                label="Foto do Rótulo"
                currentUrl={labelImageUrl}
                onUploadComplete={setLabelImageUrl}
                productId={product?.id}
                imageType="label"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              A foto do produto será exibida durante a venda. A foto do rótulo pode ser visualizada pelo vendedor em caso de dúvidas.
            </p>
          </CardContent>
        </Card>

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

            <FormField
              control={form.control}
              name="is_featured"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Produto Destaque</FormLabel>
                    <FormDescription>
                      Produtos destaque aparecem como botões rápidos na seleção
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

            <FormField
              control={form.control}
              name="restrict_to_users"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Restringir a Usuários Específicos</FormLabel>
                    <FormDescription>
                      Quando ativado, apenas os usuários selecionados podem vender este produto
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

            {watchedRestrictToUsers && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" />
                  Selecione os usuários que podem vender este produto
                </div>
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum usuário encontrado</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {users.map((user) => (
                      <div
                        key={user.user_id}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleUserSelection(user.user_id)}
                      >
                        <Checkbox 
                          checked={selectedUserIds.includes(user.user_id)} 
                          onCheckedChange={() => toggleUserSelection(user.user_id)}
                        />
                        <span className="text-sm">
                          {user.first_name} {user.last_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUserIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedUserIds.length} usuário(s) selecionado(s)
                  </p>
                )}
              </div>
            )}
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

        {/* Perguntas Chave - Dinâmicas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Perguntas Chave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DynamicQuestionsManager
              questions={questions}
              onChange={setQuestions}
            />
          </CardContent>
        </Card>

        {/* Kits de Preço Dinâmicos - Para categorias específicas */}
        {usesKits && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kits de Preço</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceKitsManager
                kits={priceKits}
                onChange={setPriceKits}
              />
            </CardContent>
          </Card>
        )}

        {/* Ingredientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Ingredientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductIngredientsManager
              ingredients={ingredients}
              onChange={setIngredients}
            />
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              FAQ (Perguntas Frequentes)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductFaqManager
              faqs={faqs}
              onChange={setFaqs}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Custo e Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="cost_cents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custo do Produto</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value || 0}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Custo de aquisição para cálculo de lucro
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Controle de Estoque */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Controle de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="track_stock"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Controlar Estoque</FormLabel>
                    <FormDescription>
                      Ativar controle de quantidade em estoque para este produto
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stock_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade em Estoque</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Quantidade inicial disponível
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimum_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque Mínimo</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Alerta quando estoque ficar abaixo desse valor
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cross-Sell */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Cross-Sell (Venda Casada)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione até 2 produtos para sugerir venda casada quando este produto for vendido.
            </p>
            
            <FormField
              control={form.control}
              name="crosssell_product_1_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto Cross-Sell 1</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {crossSellOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="crosssell_product_2_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produto Cross-Sell 2</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {crossSellOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
