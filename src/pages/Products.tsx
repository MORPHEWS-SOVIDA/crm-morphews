import { useState, useEffect } from 'react';
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
import { Plus, Search, Package, Loader2 } from 'lucide-react';
import { ProductCard } from '@/components/products/ProductCard';
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
import type { DynamicQuestion } from '@/components/products/DynamicQuestionsManager';
import type { ProductFaq } from '@/components/products/ProductFaqManager';
import type { ProductIngredient } from '@/components/products/ProductIngredientsManager';

type ViewMode = 'list' | 'create' | 'edit';

// Categorias que usam kits dinâmicos
const CATEGORIES_WITH_KITS = ['produto_pronto', 'print_on_demand', 'dropshipping'];

export default function Products() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialKits, setInitialKits] = useState<ProductPriceKitFormData[]>([]);
  const [initialQuestions, setInitialQuestions] = useState<DynamicQuestion[]>([]);
  const [initialFaqs, setInitialFaqs] = useState<ProductFaq[]>([]);
  const [initialIngredients, setInitialIngredients] = useState<ProductIngredient[]>([]);
  const [initialVisibleUserIds, setInitialVisibleUserIds] = useState<string[]>([]);

  const { data: products, isLoading } = useProducts();
  const { data: isOwner } = useIsOwner();
  const { data: myPermissions } = useMyPermissions();
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

  // Load kits and other data when editing a product
  const { data: productKits } = useProductPriceKits(selectedProduct?.id);
  const { data: productQuestions } = useProductQuestions(selectedProduct?.id);
  const { data: productFaqs } = useProductFaqs(selectedProduct?.id);
  const { data: productIngredients } = useProductIngredients(selectedProduct?.id);
  const { data: productVisibility } = useProductVisibility(selectedProduct?.id);

  useEffect(() => {
    if (productKits) {
      setInitialKits(productKits.map(kit => ({
        quantity: kit.quantity,
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

  const filteredProducts = products?.filter((p) =>
    normalizeText(p.name).includes(normalizeText(searchTerm)) ||
    normalizeText(p.description || '').includes(normalizeText(searchTerm))
  );

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
          position: i 
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

  const handleCancel = () => {
    setViewMode('list');
    setSelectedProduct(null);
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
          {canManageProducts && (
            <Button onClick={() => setViewMode('create')}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onView={setViewProduct}
                onEdit={handleEdit}
                onDelete={setProductToDelete}
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
