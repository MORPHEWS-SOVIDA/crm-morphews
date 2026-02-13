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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Loader2, Package, DollarSign, Link2, HelpCircle, ImageIcon, FlaskConical, Users, Globe, Youtube, Barcode, Ruler, FileText, Settings, ShoppingBag, FileQuestion, MessageSquare, Bot, Factory, Star, History } from 'lucide-react';
import { Label } from '@/components/ui/label';
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
import { CreateBrandDialog } from './CreateBrandDialog';
import { BaseUnitPricing } from './BaseUnitPricing';
import { ProductCombosReadOnly } from './ProductCombosReadOnly';
import { ProductIndustryCostsManager } from './ProductIndustryCostsManager';
import { ProductChangesLogTab } from './ProductChangesLogTab';

// Categorias que usam o sistema de kits dinâmicos (múltiplos de 2+)
const CATEGORIES_WITH_KITS = ['produto_pronto', 'print_on_demand', 'dropshipping', 'outro'];

// Categorias que têm preço único (sem kits)
const CATEGORIES_SINGLE_PRICE = ['ebook', 'info_video_aula', 'servico'];

// Categorias sem preço no cadastro (preço definido na hora da venda)
const CATEGORIES_NO_PRICE = ['manipulado'];

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().max(200, 'Máximo 200 caracteres').optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  sales_script: z.string().optional(),
  // Campos legados (mantidos para compatibilidade)
  price_1_unit: z.coerce.number().min(0).optional(),
  price_3_units: z.coerce.number().min(0).optional(),
  price_6_units: z.coerce.number().min(0).optional(),
  price_12_units: z.coerce.number().min(0).optional(),
  minimum_price: z.coerce.number().min(0).optional(),
  usage_period_days: z.coerce.number().min(0).optional(),
  // Campos NOVOS de 1 Unidade (base fixa)
  base_price_cents: z.coerce.number().min(0).optional(),
  base_commission_percentage: z.coerce.number().min(0).max(100).nullable().optional(),
  base_use_default_commission: z.boolean().optional(),
  base_points: z.coerce.number().min(0).optional(),
  base_usage_period_days: z.coerce.number().min(0).optional(),
  base_sales_hack: z.string().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  cost_cents: z.coerce.number().min(0).optional(),
  stock_quantity: z.coerce.number().min(0).optional(),
  minimum_stock: z.coerce.number().min(0).optional(),
  track_stock: z.boolean().optional(),
  crosssell_product_1_id: z.string().nullable().optional(),
  crosssell_product_2_id: z.string().nullable().optional(),
  restrict_to_users: z.boolean().optional(),
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
  fiscal_icms_base: z.coerce.number().min(0).nullable().optional(),
  fiscal_icms_st_base: z.coerce.number().min(0).nullable().optional(),
  fiscal_icms_st_value: z.coerce.number().min(0).nullable().optional(),
  fiscal_icms_own_value: z.coerce.number().min(0).nullable().optional(),
  fiscal_ipi_exception_code: z.string().optional(),
  fiscal_pis_fixed: z.coerce.number().min(0).nullable().optional(),
  fiscal_cofins_fixed: z.coerce.number().min(0).nullable().optional(),
  fiscal_additional_info: z.string().optional(),
  fiscal_benefit_code: z.string().optional(),
  fiscal_icms_info: z.string().optional(),
  fiscal_icms_fisco_info: z.string().optional(),
  // Controle de mídia para robô
  bot_can_send_image: z.boolean().optional(),
  bot_can_send_video: z.boolean().optional(),
  bot_can_send_site_link: z.boolean().optional(),
  // Avaliações (prova social)
  review_count: z.coerce.number().min(0).max(200).optional(),
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
  const [activeTab, setActiveTab] = useState('basic');
  
  const { data: users = [] } = useUsers();
  const { data: brands = [] } = useProductBrands();
  const { data: orgFeatures } = useOrgFeatures();
  
  // Sync state when initial values change - always sync when initialPriceKits changes
  useEffect(() => {
    setPriceKits(initialPriceKits);
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
      // Campos de 1 Unidade (base fixa)
      base_price_cents: (product as any)?.base_price_cents || 0,
      base_commission_percentage: (product as any)?.base_commission_percentage || null,
      base_use_default_commission: (product as any)?.base_use_default_commission ?? true,
      base_points: (product as any)?.base_points || 0,
      base_usage_period_days: (product as any)?.base_usage_period_days || 0,
      base_sales_hack: (product as any)?.base_sales_hack || '',
      is_active: product?.is_active ?? true,
      is_featured: product?.is_featured ?? false,
      cost_cents: product?.cost_cents || 0,
      stock_quantity: product?.stock_quantity || 0,
      minimum_stock: product?.minimum_stock || 0,
      track_stock: product?.track_stock ?? false,
      crosssell_product_1_id: product?.crosssell_product_1_id || null,
      crosssell_product_2_id: product?.crosssell_product_2_id || null,
      restrict_to_users: product?.restrict_to_users ?? false,
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
      // Avaliações (prova social) - se não existir, gera aleatório entre 50-200
      review_count: (product as any)?.review_count ?? Math.floor(Math.random() * 151 + 50),
    },
  });

  const watchedCategory = form.watch('category');
  const isManipulado = CATEGORIES_NO_PRICE.includes(watchedCategory);
  const isSinglePrice = CATEGORIES_SINGLE_PRICE.includes(watchedCategory);
  const usesKits = CATEGORIES_WITH_KITS.includes(watchedCategory);
  const showBaseUnitPricing = !isManipulado; // Todos exceto manipulados têm preço de 1 UN
  const watchedRestrictToUsers = form.watch('restrict_to_users');

  // Callback para quando uma nova marca é criada
  const handleBrandCreated = (brandId: string) => {
    form.setValue('brand_id', brandId);
  };

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const validQuestions = questions.filter(q => q.question_text.trim() !== '');
    const validFaqs = faqs.filter(f => f.question.trim() !== '' && f.answer.trim() !== '');
    const validIngredients = ingredients.filter(i => i.name.trim() !== '');
    
    const dataWithImages = {
      ...values,
      image_url: imageUrl,
      label_image_url: labelImageUrl,
    } as ProductFormData;
    
    const usersToSave = values.restrict_to_users ? selectedUserIds : [];
    onSubmit(dataWithImages, usesKits ? priceKits : undefined, validQuestions, validFaqs, validIngredients, usersToSave);
  };

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
        {/* Header com abas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 lg:grid-cols-8 gap-1 h-auto p-1">
            <TabsTrigger value="basic" className="gap-1.5 text-xs sm:text-sm py-2">
              <Package className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Básico</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-1.5 text-xs sm:text-sm py-2">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preços</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-1.5 text-xs sm:text-sm py-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Conteúdo</span>
            </TabsTrigger>
            <TabsTrigger value="logistics" className="gap-1.5 text-xs sm:text-sm py-2">
              <Ruler className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logística</span>
            </TabsTrigger>
            <TabsTrigger value="fiscal" className="gap-1.5 text-xs sm:text-sm py-2">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fiscal</span>
            </TabsTrigger>
            <TabsTrigger value="industry" className="gap-1.5 text-xs sm:text-sm py-2">
              <Factory className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Indústria</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm py-2">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Config.</span>
            </TabsTrigger>
            {product?.id && (
              <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm py-2">
                <History className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* =============== TAB BÁSICO =============== */}
          <TabsContent value="basic" className="mt-6 space-y-6">
            {/* Categoria */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Tipo de Produto</CardTitle>
              </CardHeader>
              <CardContent>
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

            {/* Imagens */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Imagens
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
              </CardContent>
            </Card>

            {/* Informações Básicas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    name="brand_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca</FormLabel>
                        <div className="flex gap-2">
                          <Select 
                            onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                            value={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger className="flex-1">
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
                          <CreateBrandDialog onBrandCreated={handleBrandCreated} />
                        </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <FormField
                    control={form.control}
                    name="barcode_ean"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras (EAN)</FormLabel>
                        <FormControl>
                          <Input placeholder="7891234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4 flex-1">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Ativo</FormLabel>
                          <FormDescription className="text-xs">
                            Disponível para venda
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
                    name="is_featured"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4 flex-1">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Destaque</FormLabel>
                          <FormDescription className="text-xs">
                            Botão rápido na seleção
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Prova Social - Avaliações */}
                <FormField
                  control={form.control}
                  name="review_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Número de Avaliações (Prova Social)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0} 
                          max={200} 
                          placeholder="0 a 200" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Exibido na loja virtual. Novo produto recebe valor aleatório (50-200).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Links do Produto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="hot_site_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hot Site</FormLabel>
                      <FormControl>
                        <Input placeholder="https://produto.exemplo.com" {...field} />
                      </FormControl>
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
                        Vídeo YouTube
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://youtube.com/watch?v=..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Toggle para Robô enviar mídia */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Bot className="h-4 w-4" />
                    Robô de IA - Compartilhamento Automático
                  </Label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Quando o robô identificar este produto na conversa, ele pode enviar:
                  </p>
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="bot_can_send_image"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                            <div>
                              <FormLabel className="cursor-pointer">Enviar Foto do Produto</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Robô envia a imagem principal automaticamente
                              </p>
                            </div>
                          </div>
                          <FormControl>
                            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bot_can_send_video"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-red-500" />
                            <div>
                              <FormLabel className="cursor-pointer">Enviar Vídeo do Produto</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Robô envia o link do vídeo YouTube
                              </p>
                            </div>
                          </div>
                          <FormControl>
                            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bot_can_send_site_link"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-green-500" />
                            <div>
                              <FormLabel className="cursor-pointer">Enviar Link do Site</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Robô envia o Hot Site para mais detalhes
                              </p>
                            </div>
                          </div>
                          <FormControl>
                            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== TAB PREÇOS =============== */}
          <TabsContent value="pricing" className="mt-6 space-y-6">
            {/* Aviso para Manipulados */}
            {isManipulado && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <p className="text-amber-800 text-sm">
                    <strong>Produtos manipulados</strong> não possuem preço fixo. O valor é definido pelo vendedor na hora da venda, 
                    e os custos são lançados separadamente no menu <strong>Produtos → Custos Manipulados</strong>.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Custo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Custo e Margem
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

            {/* Preço de 1 Unidade - NOVO (para todos exceto manipulados) */}
            {showBaseUnitPricing && (
              <BaseUnitPricing form={form} disabled={isManipulado} />
            )}

            {/* Kits de Preço - apenas para categorias que suportam (múltiplos 2+) */}
            {usesKits && !isSinglePrice && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Kits de Preço (Múltiplos)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure kits com 2 ou mais unidades. O preço de 1 unidade já está definido acima.
                  </p>
                </CardHeader>
                <CardContent>
                  <PriceKitsManager
                    kits={priceKits}
                    onChange={setPriceKits}
                  />
                </CardContent>
              </Card>
            )}

            {/* Combos - read only (mostra quais combos este produto faz parte) */}
            {product?.id && (
              <ProductCombosReadOnly productId={product.id} />
            )}

            {/* ERP (min. price, usage period) */}
            {!isManipulado && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Parâmetros ERP</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="minimum_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço Mínimo</FormLabel>
                          <FormControl>
                            <CurrencyInput
                              value={field.value || 0}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormDescription>
                            Preço mínimo permitido para venda
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
                            <Input type="number" min="0" placeholder="30" {...field} />
                          </FormControl>
                          <FormDescription>
                            Duração estimada do produto
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cross-Sell */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Cross-Sell
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sugira até 2 produtos relacionados durante a venda.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="crosssell_product_1_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto 1</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                          value={field.value || 'none'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
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
                        <FormLabel>Produto 2</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === 'none' ? null : value)} 
                          value={field.value || 'none'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== TAB CONTEÚDO =============== */}
          <TabsContent value="content" className="mt-6 space-y-6">
            {/* Script de Vendas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Script de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="sales_script"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Roteiro completo para auxiliar vendedores na apresentação do produto..."
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Perguntas Personalizadas */}
            {orgFeatures?.custom_questions !== false && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileQuestion className="h-5 w-5" />
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

            {/* Composição */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Composição / Ingredientes
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
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  FAQ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductFaqManager
                  faqs={faqs}
                  onChange={setFaqs}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== TAB LOGÍSTICA =============== */}
          <TabsContent value="logistics" className="mt-6 space-y-6">
            {/* Dimensões */}
            <Card>
              <CardHeader className="pb-3">
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="net_weight_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso Líquido (g)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" min="0" placeholder="0" 
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
                            type="number" min="0" placeholder="0" 
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

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="width_cm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Largura (cm)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                          <Input type="number" min="0" step="0.01" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                          <Input type="number" min="0" step="0.01" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Estoque */}
            <Card>
              <CardHeader className="pb-3">
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
                        <FormDescription className="text-xs">
                          Ativar controle de quantidade
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="stock_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} />
                        </FormControl>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== TAB FISCAL =============== */}
          <TabsContent value="fiscal" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dados Fiscais (Nota Fiscal)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Preencha somente se for emitir nota fiscal.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Classificação */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="fiscal_origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value ?? 0)}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">0 - Nacional</SelectItem>
                            <SelectItem value="1">1 - Estrangeira - Importação</SelectItem>
                            <SelectItem value="2">2 - Estrangeira - Merc. Interno</SelectItem>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* CFOP e CST */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="fiscal_cfop"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CFOP</FormLabel>
                        <FormControl>
                          <Input placeholder="5102" maxLength={4} {...field} />
                        </FormControl>
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
                          <Input type="number" step="0.01" min="0" max="100" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                        <FormLabel>GTIN Tributário</FormLabel>
                        <FormControl>
                          <Input placeholder="7891234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ICMS */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">ICMS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="fiscal_icms_base"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base ICMS ST</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" min="0" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                          <FormLabel>Valor ICMS ST</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" min="0" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fiscal_benefit_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cód. Benefício Fiscal</FormLabel>
                          <FormControl>
                            <Input placeholder="SC12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* PIS/COFINS */}
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
                            <Input type="number" step="0.0001" min="0" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
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
                            <Input type="number" step="0.0001" min="0" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Serviços */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-sm text-muted-foreground">Serviços (NFS-e)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="fiscal_product_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo Fiscal</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'product'}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="product">Produto (NF-e)</SelectItem>
                              <SelectItem value="service">Serviço (NFS-e)</SelectItem>
                              <SelectItem value="mixed">Misto</SelectItem>
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
                            <Input type="number" step="0.01" min="0" max="100" placeholder="5.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Info adicional */}
                <div className="border-t pt-4">
                  <FormField
                    control={form.control}
                    name="fiscal_additional_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Informações Adicionais</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Informações que serão incluídas na NF..." rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* =============== TAB INDÚSTRIA =============== */}
          <TabsContent value="industry" className="mt-6 space-y-6">
            {product?.id ? (
              <ProductIndustryCostsManager productId={product.id} />
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Factory className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Salve o produto primeiro</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Após criar o produto, você poderá vincular custos de indústrias/fornecedores
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* =============== TAB CONFIGURAÇÕES =============== */}
          <TabsContent value="settings" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Visibilidade por Usuário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="restrict_to_users"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Restringir a Usuários</FormLabel>
                        <FormDescription className="text-xs">
                          Apenas usuários selecionados podem vender este produto
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {watchedRestrictToUsers && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users className="h-4 w-4" />
                      Selecione os usuários permitidos
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
          </TabsContent>

          {/* =============== TAB HISTÓRICO =============== */}
          {product?.id && (
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Histórico de Alterações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ProductChangesLogTab productId={product.id} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Botões sempre visíveis */}
        <div className="flex gap-4 justify-end sticky bottom-0 bg-background py-4 border-t">
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