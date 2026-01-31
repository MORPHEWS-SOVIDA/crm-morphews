import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Search, Package, Loader2, FlaskConical, FileInput, LayoutGrid, List, FolderOpen, ChevronRight } from 'lucide-react';
import { ProductCsvManager } from '@/components/products/ProductCsvManager';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductListItem } from '@/components/products/ProductListItem';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductDetailDialog } from '@/components/products/ProductDetailDialog';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useIsOwner,
  type Product,
  type ProductFormData,
} from '@/hooks/useProducts';
import { useProductBrands } from '@/hooks/useProductBrands';
import { 
  useProductPriceKits, 
  useBulkSaveProductPriceKits,
  type ProductPriceKitFormData 
} from '@/hooks/useProductPriceKits';
import { 
  useProductQuestions, 
  useSaveProductQuestions,
} from '@/hooks/useProductQuestions';
import { useProductFaqs, useSaveProductFaqs } from '@/hooks/useProductFaqs';
import { useProductIngredients, useSaveProductIngredients } from '@/hooks/useProductIngredients';
import { useProductVisibility, useSaveProductVisibility } from '@/hooks/useProductVisibility';
import { normalizeText } from '@/lib/utils';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useOrgHasFeature } from '@/hooks/usePlanFeatures';
import type { DynamicQuestion } from '@/components/products/DynamicQuestionsManager';
import type { ProductFaq } from '@/components/products/ProductFaqManager';
import type { ProductIngredient } from '@/components/products/ProductIngredientsManager';

type ViewMode = 'list' | 'create' | 'edit' | 'clone';
type DisplayMode = 'cards' | 'list' | 'brands';

// Categorias que usam kits dinâmicos (deve ser igual ao ProductForm.tsx)
const CATEGORIES_WITH_KITS = ['produto_pronto', 'print_on_demand', 'dropshipping', 'outro'];

export default function Products() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null); // Original product ID for cloning
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialKits, setInitialKits] = useState<ProductPriceKitFormData[]>([]);
  const [initialQuestions, setInitialQuestions] = useState<DynamicQuestion[]>([]);
  const [initialFaqs, setInitialFaqs] = useState<ProductFaq[]>([]);
  const [initialIngredients, setInitialIngredients] = useState<ProductIngredient[]>([]);
  const [initialVisibleUserIds, setInitialVisibleUserIds] = useState<string[]>([]);

  const { data: products, isLoading } = useProducts();
  const { data: brands = [] } = useProductBrands();
  const { data: isOwner } = useIsOwner();
  const { data: myPermissions } = useMyPermissions();
  const { data: hasManipulatedCostsFeature = false } = useOrgHasFeature("manipulated_costs");
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const bulkSaveKits = useBulkSaveProductPriceKits();
  const saveQuestions = useSaveProductQuestions();
  const saveFaqs = useSaveProductFaqs();
  const saveIngredients = useSaveProductIngredients();
  const saveProductVisibility = useSaveProductVisibility();
  
  // User can manage products if they are owner OR have products_manage permission
  const canManageProducts = isOwner || myPermissions?.products_manage || false;

  // Create brand lookup map
  const brandMap = useMemo(() => {
    const map: Record<string, string> = {};
    brands.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [brands]);

  // Load kits and other data when editing or cloning a product
  // For cloning, use the original product ID (cloneSourceId)
  const productIdForData = cloneSourceId || selectedProduct?.id;
  const { data: productKits } = useProductPriceKits(productIdForData);
  const { data: productQuestions } = useProductQuestions(productIdForData);
  const { data: productFaqs } = useProductFaqs(productIdForData);
  const { data: productIngredients } = useProductIngredients(productIdForData);
  const { data: productVisibility } = useProductVisibility(productIdForData);

  useEffect(() => {
    if (productKits) {
      setInitialKits(productKits.map(kit => ({
        quantity: kit.quantity,
        sku: kit.sku,
        regular_price_cents: kit.regular_price_cents,
        regular_use_default_commission: kit.regular_use_default_commission,
        regular_custom_commission: kit.regular_custom_commission,
        promotional_price_cents: kit.promotional_price_cents,
        promotional_use_default_commission: kit.promotional_use_default_commission,
        promotional_custom_commission: kit.promotional_custom_commission,
        promotional_price_2_cents: kit.promotional_price_2_cents,
        promotional_2_use_default_commission: kit.promotional_2_use_default_commission,
        promotional_2_custom_commission: kit.promotional_2_custom_commission,
        minimum_price_cents: kit.minimum_price_cents,
        minimum_use_default_commission: kit.minimum_use_default_commission,
        minimum_custom_commission: kit.minimum_custom_commission,
        points_regular: kit.points_regular,
        points_promotional: kit.points_promotional,
        points_promotional_2: kit.points_promotional_2,
        points_minimum: kit.points_minimum,
        usage_period_days: kit.usage_period_days,
        sales_hack: kit.sales_hack,
        position: kit.position,
      })));
    } else {
      setInitialKits([]);
    }
  }, [productKits]);

  useEffect(() => {
    if (productQuestions) {
      setInitialQuestions(productQuestions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        position: q.position,
        is_standard: q.is_standard,
        standard_question_id: q.standard_question_id || undefined,
      })));
    } else {
      setInitialQuestions([]);
    }
  }, [productQuestions]);

  useEffect(() => {
    if (productFaqs) {
      setInitialFaqs(productFaqs.map(f => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        position: f.position,
      })));
    } else {
      setInitialFaqs([]);
    }
  }, [productFaqs]);

  useEffect(() => {
    if (productIngredients) {
      setInitialIngredients(productIngredients.map(i => ({
        id: i.id,
        name: i.name,
        description: i.description,
        position: i.position,
      })));
    } else {
      setInitialIngredients([]);
    }
  }, [productIngredients]);

  useEffect(() => {
    if (productVisibility) {
      setInitialVisibleUserIds(productVisibility.map(v => v.user_id));
    } else {
      setInitialVisibleUserIds([]);
    }
  }, [productVisibility]);

  // Filter products by search and brand
  const filteredProducts = useMemo(() => {
    let result = products || [];
    
    // Filter by search term
    if (searchTerm) {
      result = result.filter((p) =>
        normalizeText(p.name).includes(normalizeText(searchTerm)) ||
        normalizeText(p.description || '').includes(normalizeText(searchTerm)) ||
        normalizeText(p.sku || '').includes(normalizeText(searchTerm))
      );
    }
    
    // Filter by brand
    if (selectedBrandId !== 'all') {
      if (selectedBrandId === 'no-brand') {
        result = result.filter(p => !p.brand_id);
      } else {
        result = result.filter(p => p.brand_id === selectedBrandId);
      }
    }
    
    // Sort alphabetically
    return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [products, searchTerm, selectedBrandId]);

  // Group products by brand for folder view
  const productsByBrand = useMemo(() => {
    const grouped: Record<string, Product[]> = { 'no-brand': [] };
    brands.forEach(b => { grouped[b.id] = []; });
    
    (products || []).forEach(p => {
      if (p.brand_id && grouped[p.brand_id]) {
        grouped[p.brand_id].push(p);
      } else {
        grouped['no-brand'].push(p);
      }
    });
    
    // Sort products within each group
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });
    
    return grouped;
  }, [products, brands]);

  const toggleBrandExpanded = (brandId: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brandId)) {
        next.delete(brandId);
      } else {
        next.add(brandId);
      }
      return next;
    });
  };

  const handleCreate = async (data: ProductFormData, priceKits?: ProductPriceKitFormData[], questions?: DynamicQuestion[], faqs?: ProductFaq[], ingredients?: ProductIngredient[], selectedUserIds?: string[]) => {
    const product = await createProduct.mutateAsync(data);
    
    // Save kits if provided
    if (priceKits && priceKits.length > 0 && product?.id) {
      await bulkSaveKits.mutateAsync({ productId: product.id, kits: priceKits });
    }

    // Save questions if provided
    if (questions && questions.length > 0 && product?.id) {
      await saveQuestions.mutateAsync({ 
        productId: product.id, 
        questions: questions.map((q, i) => ({ 
          question_text: q.question_text, 
          position: i,
          is_standard: q.is_standard,
          standard_question_id: q.standard_question_id,
        }))
      });
    }

    // Save FAQs if provided
    if (faqs && faqs.length > 0 && product?.id) {
      await saveFaqs.mutateAsync({ 
        productId: product.id, 
        faqs: faqs.map((f, i) => ({ 
          question: f.question, 
          answer: f.answer,
          position: i 
        }))
      });
    }

    // Save ingredients if provided
    if (ingredients && ingredients.length > 0 && product?.id) {
      await saveIngredients.mutateAsync({ 
        productId: product.id, 
        ingredients: ingredients.map((ing, i) => ({ 
          name: ing.name, 
          description: ing.description,
          position: i 
        }))
      });
    }

    // Save visibility if product is restricted
    if (data.restrict_to_users && selectedUserIds && selectedUserIds.length > 0 && product?.id) {
      await saveProductVisibility.mutateAsync({
        productId: product.id,
        userIds: selectedUserIds,
      });
    }
    
    setViewMode('list');
    setCloneSourceId(null); // Clear clone source on success
  };

  const handleUpdate = async (data: ProductFormData, priceKits?: ProductPriceKitFormData[], questions?: DynamicQuestion[], faqs?: ProductFaq[], ingredients?: ProductIngredient[], selectedUserIds?: string[]) => {
    if (!selectedProduct) return;
    await updateProduct.mutateAsync({ id: selectedProduct.id, data });
    
    // Save kits if this category uses kits
    if (CATEGORIES_WITH_KITS.includes(data.category || selectedProduct.category)) {
      await bulkSaveKits.mutateAsync({ 
        productId: selectedProduct.id, 
        kits: priceKits || [] 
      });
    }

    // Always save questions
    await saveQuestions.mutateAsync({
      productId: selectedProduct.id,
      questions: (questions || []).map((q, i) => ({
        id: q.id,
        question_text: q.question_text,
        position: i,
        is_standard: q.is_standard,
        standard_question_id: q.standard_question_id,
      }))
    });

    // Always save FAQs
    await saveFaqs.mutateAsync({
      productId: selectedProduct.id,
      faqs: (faqs || []).map((f, i) => ({
        question: f.question,
        answer: f.answer,
        position: i,
      }))
    });

    // Always save ingredients
    await saveIngredients.mutateAsync({
      productId: selectedProduct.id,
      ingredients: (ingredients || []).map((ing, i) => ({
        name: ing.name,
        description: ing.description,
        position: i,
      }))
    });

    // Always save visibility (will clear if not restricted)
    await saveProductVisibility.mutateAsync({
      productId: selectedProduct.id,
      userIds: selectedUserIds || [],
    });
    
    setViewMode('list');
    setSelectedProduct(null);
    setInitialKits([]);
    setInitialQuestions([]);
    setInitialFaqs([]);
    setInitialIngredients([]);
    setInitialVisibleUserIds([]);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    await deleteProduct.mutateAsync(productToDelete.id);
    setProductToDelete(null);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setViewMode('edit');
  };

  const handleClone = (product: Product) => {
    // Store original product ID to load kits/questions/faqs/ingredients
    setCloneSourceId(product.id);
    // Set the product as a clone source (we'll modify name to indicate it's a copy)
    setSelectedProduct({
      ...product,
      id: '', // Clear ID so it creates a new product
      name: `${product.name} (Cópia)`,
    } as Product);
    setViewMode('clone');
  };

  const handleCancel = () => {
    setViewMode('list');
    setSelectedProduct(null);
    setCloneSourceId(null);
    setInitialKits([]);
    setInitialQuestions([]);
    setInitialFaqs([]);
    setInitialIngredients([]);
    setInitialVisibleUserIds([]);
  };


  if (viewMode === 'create') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Novo Produto</h1>
          <ProductForm
            onSubmit={handleCreate}
            isLoading={createProduct.isPending || bulkSaveKits.isPending || saveQuestions.isPending || saveFaqs.isPending || saveIngredients.isPending || saveProductVisibility.isPending}
            onCancel={handleCancel}
          />
        </div>
      </Layout>
    );
  }

  if (viewMode === 'clone' && selectedProduct) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Clonar Produto</h1>
          <p className="text-muted-foreground mb-4">
            Criando uma cópia de <strong>{selectedProduct.name.replace(' (Cópia)', '')}</strong>
          </p>
          <ProductForm
            product={selectedProduct}
            onSubmit={handleCreate}
            isLoading={createProduct.isPending || bulkSaveKits.isPending || saveQuestions.isPending || saveFaqs.isPending || saveIngredients.isPending || saveProductVisibility.isPending}
            onCancel={handleCancel}
            initialPriceKits={initialKits}
            initialQuestions={initialQuestions}
            initialFaqs={initialFaqs}
            initialIngredients={initialIngredients}
            initialVisibleUserIds={initialVisibleUserIds}
          />
        </div>
      </Layout>
    );
  }

  if (viewMode === 'edit' && selectedProduct) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Editar Produto</h1>
          <ProductForm
            product={selectedProduct}
            onSubmit={handleUpdate}
            isLoading={updateProduct.isPending || bulkSaveKits.isPending || saveQuestions.isPending || saveFaqs.isPending || saveIngredients.isPending || saveProductVisibility.isPending}
            onCancel={handleCancel}
            initialPriceKits={initialKits}
            initialQuestions={initialQuestions}
            initialFaqs={initialFaqs}
            initialIngredients={initialIngredients}
            initialVisibleUserIds={initialVisibleUserIds}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">
              Gerencie seu catálogo de produtos
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => navigate('/produtos/notas-entrada')}
            >
              <FileInput className="h-4 w-4 mr-2" />
              Notas de Entrada
            </Button>
            {hasManipulatedCostsFeature && (myPermissions?.products_view_cost || isOwner) && (
              <Button 
                variant="outline" 
                onClick={() => navigate('/produtos/custos-manipulados')}
                className="bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-800"
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Custos Manipulados
              </Button>
            )}
            {canManageProducts && (
              <ProductCsvManager products={products || []} canManage={canManageProducts} />
            )}
            {canManageProducts && (
              <Button onClick={() => setViewMode('create')}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            )}
          </div>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Brand Filter */}
            {brands.length > 0 && displayMode !== 'brands' && (
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todas as marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as marcas</SelectItem>
                  <SelectItem value="no-brand">Sem marca</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* View Mode Toggle */}
          <ToggleGroup type="single" value={displayMode} onValueChange={(v) => v && setDisplayMode(v as DisplayMode)}>
            <ToggleGroupItem value="cards" aria-label="Cards">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            {brands.length > 0 && (
              <ToggleGroupItem value="brands" aria-label="Por Marca">
                <FolderOpen className="h-4 w-4" />
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayMode === 'brands' ? (
          /* Folder/Brand View */
          <div className="space-y-2">
            {brands.map(brand => {
              const brandProducts = productsByBrand[brand.id] || [];
              if (brandProducts.length === 0) return null;
              const isExpanded = expandedBrands.has(brand.id);
              
              return (
                <div key={brand.id} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleBrandExpanded(brand.id)}
                    className="w-full flex items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <span className="font-medium flex-1">{brand.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {brandProducts.length} {brandProducts.length === 1 ? 'produto' : 'produtos'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="divide-y">
                      {brandProducts.map(product => (
                        <ProductListItem
                          key={product.id}
                          product={product}
                          brandName={brand.name}
                          onView={setViewProduct}
                          onEdit={handleEdit}
                          onDelete={setProductToDelete}
                          onClone={handleClone}
                          canManage={canManageProducts}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Products without brand */}
            {productsByBrand['no-brand']?.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleBrandExpanded('no-brand')}
                  className="w-full flex items-center gap-3 p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedBrands.has('no-brand') ? 'rotate-90' : ''}`} />
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium flex-1 text-muted-foreground">Sem marca</span>
                  <span className="text-sm text-muted-foreground">
                    {productsByBrand['no-brand'].length} {productsByBrand['no-brand'].length === 1 ? 'produto' : 'produtos'}
                  </span>
                </button>
                {expandedBrands.has('no-brand') && (
                  <div className="divide-y">
                    {productsByBrand['no-brand'].map(product => (
                      <ProductListItem
                        key={product.id}
                        product={product}
                        onView={setViewProduct}
                        onEdit={handleEdit}
                        onDelete={setProductToDelete}
                        onClone={handleClone}
                        canManage={canManageProducts}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : filteredProducts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm
                ? 'Tente uma busca diferente'
                : 'Comece adicionando seu primeiro produto'}
            </p>
            {canManageProducts && !searchTerm && (
              <Button onClick={() => setViewMode('create')}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            )}
          </div>
        ) : displayMode === 'list' ? (
          /* List View */
          <div className="space-y-2">
            {filteredProducts?.map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                brandName={product.brand_id ? brandMap[product.brand_id] : undefined}
                onView={setViewProduct}
                onEdit={handleEdit}
                onDelete={setProductToDelete}
                onClone={handleClone}
                canManage={canManageProducts}
              />
            ))}
          </div>
        ) : (
          /* Cards View */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onView={setViewProduct}
                onEdit={handleEdit}
                onDelete={setProductToDelete}
                onClone={handleClone}
                canManage={canManageProducts}
              />
            ))}
          </div>
        )}

        {/* View Dialog */}
        <ProductDetailDialog
          product={viewProduct}
          open={!!viewProduct}
          onOpenChange={(open) => !open && setViewProduct(null)}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir "{productToDelete?.name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
