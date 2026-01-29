import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ShoppingCart, Package, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicProduct, type StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';
import { useCrosssellProducts } from '@/hooks/ecommerce/useCrosssellProducts';
import { useCart } from './cart/CartContext';
import { TemplatedProductPage } from './templates/TemplatedProductPage';
import { ProductRecommendations } from './ProductRecommendations';
import { toast } from 'sonner';

export function StorefrontProductPage() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const { data: storefrontProduct, isLoading, error } = usePublicProduct(slug, productId);
  const { addItem } = useCart();

  // Fetch crosssell products
  const { data: crosssellProducts = [] } = useCrosssellProducts(
    storefront?.id,
    storefrontProduct?.product?.crosssell_product_1_id,
    storefrontProduct?.product?.crosssell_product_2_id
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square bg-muted rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !storefrontProduct) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Produto não encontrado</h1>
        <Link to={`/loja/${slug}`}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para a loja
          </Button>
        </Link>
      </div>
    );
  }

  const product = storefrontProduct.product;
  const displayName = product.ecommerce_title || product.name;
  const displayDescription = product.ecommerce_description || product.description;
  const images = product.ecommerce_images?.length > 0 
    ? product.ecommerce_images 
    : product.image_url ? [product.image_url] : [];
  const benefits = product.ecommerce_benefits || [];

  const basePrice = storefrontProduct.custom_price_cents || product.price_1_unit || product.base_price_cents || 0;
  
  const kitPrices = {
    1: basePrice,
    3: product.price_3_units || basePrice * 3,
    6: product.price_6_units || basePrice * 6,
    12: product.price_12_units || basePrice * 12,
  };

  const originalPrices = {
    1: basePrice,
    3: basePrice * 3,
    6: basePrice * 6,
    12: basePrice * 12,
  };

  // Determine template from storefront config
  const templateSlug = (storefront as any).template?.slug || 'minimal-clean';

  // Check if crosssell is enabled for this product
  const showCrosssell = storefrontProduct.show_crosssell !== false && crosssellProducts.length > 0;

  const handleAddToCart = (quantity: number, kitSize: 1 | 3 | 6 | 12) => {
    if (!slug) return;
    
    addItem({
      productId: product.id,
      storefrontProductId: storefrontProduct.id,
      name: displayName,
      imageUrl: images[0] || null,
      quantity,
      kitSize,
      unitPrice: kitPrices[kitSize] / kitSize,
    }, slug, storefront.id);
  };

  const handleQuickAddCrosssell = (crosssellProduct: any) => {
    if (!slug) return;
    
    const price = crosssellProduct.customPriceCents || crosssellProduct.price_1_unit || crosssellProduct.base_price_cents || 0;
    addItem({
      productId: crosssellProduct.id,
      storefrontProductId: crosssellProduct.storefrontProductId,
      name: crosssellProduct.ecommerce_title || crosssellProduct.name,
      imageUrl: crosssellProduct.ecommerce_images?.[0] || crosssellProduct.image_url || null,
      quantity: 1,
      kitSize: 1,
      unitPrice: price,
    }, slug, storefront.id);
    toast.success('Produto adicionado ao carrinho!');
  };

  return (
    <>
      <TemplatedProductPage
        product={{
          id: product.id,
          name: displayName,
          description: displayDescription,
          images,
          videoUrl: product.ecommerce_video_url || undefined,
          benefits: benefits.map(b => String(b)),
          basePrice,
          kitPrices,
          originalPrices,
        }}
        storefrontSlug={slug || ''}
        storefrontName={storefront.name}
        primaryColor={storefront.primary_color}
        templateSlug={templateSlug}
        showKitUpsell={storefrontProduct.show_kit_upsell !== false}
        onAddToCart={handleAddToCart}
      />

      {/* Cross-sell Recommendations */}
      {showCrosssell && (
        <div className="container mx-auto px-4 pb-12">
          <ProductRecommendations
            products={crosssellProducts}
            storefrontSlug={slug || ''}
            primaryColor={storefront.primary_color}
            title="Produtos Relacionados"
            subtitle="Clientes que compraram este produto também se interessaram por:"
            variant="product-page"
            onQuickAdd={handleQuickAddCrosssell}
          />
        </div>
      )}
    </>
  );
}
