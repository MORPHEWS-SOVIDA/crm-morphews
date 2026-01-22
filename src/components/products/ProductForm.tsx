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
import { Loader2, Package, DollarSign, Link2, HelpCircle, ImageIcon, FlaskConical, Users, Globe, Youtube, Barcode, Ruler, FileText } from 'lucide-react';
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
import { useProductBrands } from '@/hooks/useProductBrands';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';

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
  // New fields
  brand_id: z.string().nullable().optional(),
  hot_site_url: z.string().optional(),
  youtube_video_url: z.string().optional(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  net_weight_grams: z.coerce.number().min(0).nullable().optional(),
  gross_weight_grams: z.coerce.number().min(0).nullable().optional(),
  width_cm: z.coerce.number().min(0).nullable().optional(),
  height_cm: z.coerce.number().min(0).nullable().optional(),
  depth_cm: z.coerce.number().min(0).nullable().optional(),
  barcode_ean: z.string().optional(),
  gtin_tax: z.string().optional(),
  // Fiscal fields
  fiscal_ncm: z.string().optional(),
  fiscal_cest: z.string().optional(),
  fiscal_cfop: z.string().optional(),
  fiscal_cst: z.string().optional(),
  fiscal_origin: z.coerce.number().min(0).max(8).optional(),
  fiscal_product_type: z.string().optional(),
  fiscal_item_type: z.string().optional(),
  fiscal_tax_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
  fiscal_lc116_code: z.string().optional(),
  fiscal_iss_aliquota: z.coerce.number().min(0).max(100).nullable().optional(),
  // ICMS fields
  fiscal_icms_base: z.coerce.number().min(0).nullable().optional(),
  fiscal_icms_st_base: z.coerce.number().min(0).nullable().optional(),
  fiscal_icms_st_value: z.coerce.number().min(0).nullable().optional(),
  fiscal_icms_own_value: z.coerce.number().min(0).nullable().optional(),
  // IPI field
  fiscal_ipi_exception_code: z.string().optional(),
  // PIS/COFINS fields
  fiscal_pis_fixed: z.coerce.number().min(0).nullable().optional(),
  fiscal_cofins_fixed: z.coerce.number().min(0).nullable().optional(),
  // Additional info
  fiscal_additional_info: z.string().optional(),
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
  const { data: brands = [] } = useProductBrands();
  const { data: orgFeatures } = useOrgFeatures();
  
  // Sync state when initial values change - only sync if content actually changed
  // This prevents resetting state when empty arrays are recreated on parent re-renders
  useEffect(() => {
    if (initialPriceKits.length > 0 || (initialPriceKits.length === 0 && priceKits.length === 0 && product)) {
      setPriceKits(initialPriceKits);
    }
  }, [JSON.stringify(initialPriceKits)]);

  useEffect(() => {
    if (initialFaqs.length > 0 || (initialFaqs.length === 0 && faqs.length === 0 && product)) {
      setFaqs(initialFaqs);
    }
  }, [JSON.stringify(initialFaqs)]);

  useEffect(() => {
    if (initialIngredients.length > 0 || (initialIngredients.length === 0 && ingredients.length === 0 && product)) {
      setIngredients(initialIngredients);
    }
  }, [JSON.stringify(initialIngredients)]);

  useEffect(() => {
    if (initialQuestions.length > 0 || (initialQuestions.length === 0 && questions.length === 0 && product)) {
      setQuestions(initialQuestions);
    }
  }, [JSON.stringify(initialQuestions)]);

  useEffect(() => {
    if (initialVisibleUserIds.length > 0 || (initialVisibleUserIds.length === 0 && selectedUserIds.length === 0 && product)) {
      setSelectedUserIds(initialVisibleUserIds);
    }
  }, [JSON.stringify(initialVisibleUserIds)]);

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
      // New fields
      brand_id: product?.brand_id || null,
      hot_site_url: product?.hot_site_url || '',
      youtube_video_url: product?.youtube_video_url || '',
      sku: product?.sku || '',
      unit: product?.unit || '',
      net_weight_grams: product?.net_weight_grams || null,
      gross_weight_grams: product?.gross_weight_grams || null,
      width_cm: product?.width_cm || null,
      height_cm: product?.height_cm || null,
      depth_cm: product?.depth_cm || null,
      barcode_ean: product?.barcode_ean || '',
      gtin_tax: product?.gtin_tax || '',
      // Fiscal fields
      fiscal_ncm: (product as any)?.fiscal_ncm || '',
      fiscal_cest: (product as any)?.fiscal_cest || '',
      fiscal_cfop: (product as any)?.fiscal_cfop || '',
      fiscal_cst: (product as any)?.fiscal_cst || '',
      fiscal_origin: (product as any)?.fiscal_origin ?? 0,
      fiscal_product_type: (product as any)?.fiscal_product_type || 'product',
      fiscal_item_type: (product as any)?.fiscal_item_type || '',
      fiscal_tax_percentage: (product as any)?.fiscal_tax_percentage || null,
      fiscal_lc116_code: (product as any)?.fiscal_lc116_code || '',
      fiscal_iss_aliquota: (product as any)?.fiscal_iss_aliquota || null,
      fiscal_icms_base: (product as any)?.fiscal_icms_base || null,
      fiscal_icms_st_base: (product as any)?.fiscal_icms_st_base || null,
      fiscal_icms_st_value: (product as any)?.fiscal_icms_st_value || null,
      fiscal_icms_own_value: (product as any)?.fiscal_icms_own_value || null,
      fiscal_ipi_exception_code: (product as any)?.fiscal_ipi_exception_code || '',
      fiscal_pis_fixed: (product as any)?.fiscal_pis_fixed || null,
      fiscal_cofins_fixed: (product as any)?.fiscal_cofins_fixed || null,
      fiscal_additional_info: (product as any)?.fiscal_additional_info || '',
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

        {/* Identificação e Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Identificação e Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="brand_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a marca" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem marca</SelectItem>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Cadastre marcas em Configurações
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código (SKU)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC-123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="barcode_ean"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Barras (EAN/GTIN)</FormLabel>
                    <FormControl>
                      <Input placeholder="7891234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gtin_tax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GTIN/EAN Tributário</FormLabel>
                    <FormControl>
                      <Input placeholder="7891234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="hot_site_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Hot Site
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://produto.exemplo.com" {...field} />
                  </FormControl>
                  <FormDescription>Link do site próprio do produto</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="youtube_video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Youtube className="h-4 w-4" />
                    Link Vídeo YouTube
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://youtube.com/watch?v=..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Dimensões e Peso */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Dimensões e Peso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade</FormLabel>
                  <FormControl>
                    <Input placeholder="UN, CX, KG, L..." {...field} />
                  </FormControl>
                  <FormDescription>Unidade de medida do produto</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="net_weight_grams"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Líquido (g)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gross_weight_grams"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso Bruto (g)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="width_cm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Largura (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="height_cm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Altura (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="depth_cm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profundidade (cm)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        placeholder="0" 
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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

        {/* Perguntas Personalizadas - Dinâmicas - only show if plan has custom_questions feature */}
        {orgFeatures?.custom_questions !== false && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Perguntas Personalizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DynamicQuestionsManager
                questions={questions}
                onChange={setQuestions}
              />
            </CardContent>
          </Card>
        )}

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

        {/* Composição */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Composição
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

        {/* Dados Fiscais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dados Fiscais (Nota Fiscal)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Preencha somente se for emitir nota fiscal.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Linha 1: Origem, NCM, CEST */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="fiscal_origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value ?? 0)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0 - Nacional, exceto códigos 3, 4, 5 e 8</SelectItem>
                        <SelectItem value="1">1 - Estrangeira - Importação direta</SelectItem>
                        <SelectItem value="2">2 - Estrangeira - Adquirida mercado interno</SelectItem>
                        <SelectItem value="3">3 - Nacional (40-70% conteúdo importação)</SelectItem>
                        <SelectItem value="4">4 - Nacional (PPB)</SelectItem>
                        <SelectItem value="5">5 - Nacional (&lt;40% conteúdo importação)</SelectItem>
                        <SelectItem value="6">6 - Estrangeira - Importação s/ similar CAMEX</SelectItem>
                        <SelectItem value="7">7 - Estrangeira - Mercado interno s/ similar CAMEX</SelectItem>
                        <SelectItem value="8">8 - Nacional (&gt;70% conteúdo importação)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_ncm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NCM</FormLabel>
                    <FormControl>
                      <Input placeholder="00000000" maxLength={8} {...field} />
                    </FormControl>
                    <FormDescription>
                      Nomenclatura Comum do Mercosul
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_cest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEST</FormLabel>
                    <FormControl>
                      <Input placeholder="0000000" maxLength={7} {...field} />
                    </FormControl>
                    <FormDescription>
                      Cód. Especificador Substituição Tributária
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Linha 2: Tipo do item, % Tributos, CFOP, CST */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="fiscal_item_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo do Item</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="revenda">Mercadoria para Revenda</SelectItem>
                        <SelectItem value="materia_prima">Matéria-Prima</SelectItem>
                        <SelectItem value="embalagem">Embalagem</SelectItem>
                        <SelectItem value="em_processo">Produto em Processo</SelectItem>
                        <SelectItem value="acabado">Produto Acabado</SelectItem>
                        <SelectItem value="subproduto">Subproduto</SelectItem>
                        <SelectItem value="intermediario">Produto Intermediário</SelectItem>
                        <SelectItem value="uso_consumo">Material de Uso e Consumo</SelectItem>
                        <SelectItem value="ativo">Ativo Imobilizado</SelectItem>
                        <SelectItem value="servico">Serviços</SelectItem>
                        <SelectItem value="outros_insumos">Outros Insumos</SelectItem>
                        <SelectItem value="outras">Outras</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_tax_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Tributos</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        max="100" 
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>
                      % aprox. tributos
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_cfop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CFOP Padrão</FormLabel>
                    <FormControl>
                      <Input placeholder="5102" maxLength={4} {...field} />
                    </FormControl>
                    <FormDescription>
                      Código Fiscal de Operação
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_cst"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CST/CSOSN</FormLabel>
                    <FormControl>
                      <Input placeholder="102" maxLength={4} {...field} />
                    </FormControl>
                    <FormDescription>
                      Situação Tributária
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ICMS Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">ICMS</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fiscal_icms_base"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor base ICMS ST - retenção</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.0001" 
                          min="0" 
                          placeholder="0,0000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fiscal_icms_st_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor ICMS ST para retenção</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.0001" 
                          min="0" 
                          placeholder="0,0000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fiscal_icms_own_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor ICMS próprio do substituto</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.0001" 
                          min="0" 
                          placeholder="0,0000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* IPI Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">IPI</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fiscal_ipi_exception_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código exceção da TIPI</FormLabel>
                      <FormControl>
                        <Input placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* PIS / COFINS Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">PIS / COFINS</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fiscal_pis_fixed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor PIS fixo</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.0001" 
                          min="0" 
                          placeholder="0,0000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fiscal_cofins_fixed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor COFINS fixo</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.0001" 
                          min="0" 
                          placeholder="0,0000"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Serviços Section */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">Serviços (NFS-e)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fiscal_product_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo Fiscal</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || 'product'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="product">Produto (NF-e)</SelectItem>
                          <SelectItem value="service">Serviço (NFS-e)</SelectItem>
                          <SelectItem value="mixed">Misto (ambos)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fiscal_lc116_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código LC 116</FormLabel>
                      <FormControl>
                        <Input placeholder="17.06" {...field} />
                      </FormControl>
                      <FormDescription>
                        Código do serviço
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fiscal_iss_aliquota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alíquota ISS (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          max="100" 
                          placeholder="5.00"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Dados Adicionais */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 text-sm text-muted-foreground">Dados Adicionais</h4>
              <FormField
                control={form.control}
                name="fiscal_additional_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Informações Adicionais</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Informações adicionais que serão incluídas na nota fiscal..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Texto a ser incluído nas informações complementares da NF
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
