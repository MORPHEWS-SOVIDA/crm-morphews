import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package, Check, ArrowLeft, ArrowUpRight, Plus, Minus, Star, Shield, Truck, CreditCard, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getTemplateStyles, type TemplateSlug } from './templateUtils';
import { AddToCartConfirmDialog } from '../AddToCartConfirmDialog';
import { calculateInstallmentWithInterest } from '@/hooks/ecommerce/useTenantInstallmentFees';

// Dynamic kit structure - supports any quantity
export interface KitOption {
  quantity: number;
  price: number;           // in cents
  originalPrice: number;   // in cents (for showing crossed-out price)
  isBestSeller?: boolean;
}

interface InstallmentConfig {
  installment_fees: Record<string, number>;
  installment_fee_passed_to_buyer: boolean;
  max_installments: number;
}

interface ProductData {
  id: string;
  name: string;
  description?: string;
  images: string[];
  videoUrl?: string;
  benefits: string[];
  basePrice: number;
  kits: KitOption[];  // Dynamic list of kit options
}

interface TemplatedProductPageProps {
  product: ProductData;
  storefrontSlug: string;
  storefrontName: string;
  primaryColor: string;
  templateSlug?: TemplateSlug;
  showKitUpsell?: boolean;
  onAddToCart: (quantity: number, kitSize: number) => void;
  installmentConfig?: InstallmentConfig;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Format currency with cents in different style
function formatCurrencyParts(cents: number): { main: string; decimals: string } {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
  
  // Split at the comma (Brazilian format uses comma for decimals)
  const parts = formatted.split(',');
  return {
    main: parts[0], // "R$ 30"
    decimals: parts[1] ? `,${parts[1]}` : '' // ",72"
  };
}

export function TemplatedProductPage({
  product,
  storefrontSlug,
  storefrontName,
  primaryColor,
  templateSlug = 'minimal-clean',
  showKitUpsell = true,
  onAddToCart,
  installmentConfig,
}: TemplatedProductPageProps) {
  // Get the default kit (first one with quantity 1, or just the first kit)
  const defaultKit = product.kits.find(k => k.quantity === 1) || product.kits[0];
  const [selectedKitQty, setSelectedKitQty] = useState<number>(defaultKit?.quantity || 1);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [showCartConfirm, setShowCartConfirm] = useState(false);
  const [addedProduct, setAddedProduct] = useState<{ quantity: number; kitSize: number; totalPrice: number } | null>(null);

  const styles = getTemplateStyles(templateSlug);
  const selectedKit = product.kits.find(k => k.quantity === selectedKitQty) || defaultKit;
  const totalPrice = (selectedKit?.price || product.basePrice) * quantity;
  
  // Get installment config with defaults
  const maxInstallments = installmentConfig?.max_installments || 12;

  const isVitrineModerna = templateSlug === 'vitrine-moderna';
  const isPremiumSaude = templateSlug === 'premium-saude';

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  return (
    <div className={`min-h-screen ${isVitrineModerna ? 'bg-gradient-to-br from-pink-50 via-white to-purple-50' : ''}`}>
      {/* Blob decorations for vitrine-moderna */}
      {isVitrineModerna && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div 
            className="blob-shape blob-shape-1 w-96 h-96 -top-48 -left-48"
            style={{ backgroundColor: primaryColor }}
          />
          <div 
            className="blob-shape blob-shape-2 w-80 h-80 top-1/3 -right-40"
            style={{ backgroundColor: primaryColor }}
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 animate-fade-in">
          <Link to={`/loja/${storefrontSlug}`} className="hover:text-foreground transition-colors">
            Início
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{product.name}</span>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4 animate-slide-up">
            {/* Main Image */}
            <div className={`
              relative aspect-square rounded-2xl overflow-hidden 
              ${isVitrineModerna ? 'shadow-2xl' : 'shadow-lg'}
              ${isPremiumSaude ? 'border border-gray-100' : ''}
            `}>
              {product.images.length > 0 ? (
                <>
                  <img 
                    src={showVideo && product.videoUrl ? '' : product.images[currentImageIndex]} 
                    alt={product.name}
                    className={`w-full h-full object-cover transition-transform duration-500 ${showVideo ? 'hidden' : ''}`}
                  />
                  {showVideo && product.videoUrl && (
                    <iframe
                      src={product.videoUrl}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  )}
                  
                  {/* Navigation Arrows */}
                  {product.images.length > 1 && !showVideo && (
                    <>
                      <button 
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-all hover:scale-110"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button 
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-all hover:scale-110"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {(product.images.length > 1 || product.videoUrl) && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setCurrentImageIndex(idx); setShowVideo(false); }}
                    className={`
                      flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all
                      ${idx === currentImageIndex && !showVideo 
                        ? 'border-primary ring-2 ring-primary/20 scale-105' 
                        : 'border-transparent hover:border-gray-200'}
                    `}
                    style={idx === currentImageIndex && !showVideo ? { borderColor: primaryColor } : undefined}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {product.videoUrl && (
                  <button
                    onClick={() => setShowVideo(true)}
                    className={`
                      flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all
                      bg-black/80 flex items-center justify-center
                      ${showVideo 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-transparent hover:border-gray-200'}
                    `}
                    style={showVideo ? { borderColor: primaryColor } : undefined}
                  >
                    <Play className="h-8 w-8 text-white" fill="white" />
                  </button>
                )}
              </div>
            )}

            {/* Trust badges - Premium Saúde style */}
            {isPremiumSaude && (
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center p-4 rounded-xl bg-green-50 border border-green-100">
                  <Shield className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-xs font-medium text-green-800">Garantia de 30 dias</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <Truck className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-medium text-blue-800">Entrega Rápida</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <CreditCard className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <p className="text-xs font-medium text-purple-800">12x sem juros</p>
                </div>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6 animate-slide-up animation-delay-200">
            {/* Title & Rating */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-5 w-5 text-amber-400" fill="currentColor" />
                ))}
                <span className="text-sm text-muted-foreground ml-2">(127 avaliações)</span>
              </div>
              <h1 className={`
                ${styles.heroTitle} mb-4
                ${isVitrineModerna ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-pink-600 bg-clip-text text-transparent' : ''}
              `}>
                {product.name}
              </h1>
              {product.description && (
                <div 
                  className="text-lg text-muted-foreground leading-relaxed prose prose-lg max-w-none"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}
            </div>

            {/* Benefits */}
            {product.benefits.length > 0 && (
              <Card className={`
                ${isVitrineModerna ? 'bg-white/80 backdrop-blur-sm border-0 shadow-xl' : ''}
                ${isPremiumSaude ? 'border-gray-100 shadow-sm' : ''}
              `}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Check className="h-5 w-5" style={{ color: primaryColor }} />
                    Benefícios
                  </h3>
                  <ul className="space-y-3">
                    {product.benefits.map((benefit, idx) => (
                      <li 
                        key={idx} 
                        className="flex items-start gap-3 animate-fade-in"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${primaryColor}20` }}
                        >
                          <Check className="h-4 w-4" style={{ color: primaryColor }} />
                        </div>
                        <span className="text-gray-700">{String(benefit)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Kit Selection - Dynamic kits */}
            {showKitUpsell && product.kits.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Escolha seu kit:</h3>
                <div className="space-y-3">
                  {product.kits.map((kit) => {
                    if (kit.price <= 0) return null;
                    
                    const hasDiscount = kit.originalPrice > kit.price;
                    const isSelected = selectedKitQty === kit.quantity;
                    
                    // Calculate installment with real interest rates
                    const installmentInfo = calculateInstallmentWithInterest(
                      kit.price,
                      maxInstallments,
                      installmentConfig?.installment_fees,
                      installmentConfig?.installment_fee_passed_to_buyer ?? true
                    );

                    return (
                      <div
                        key={kit.quantity}
                        onClick={() => setSelectedKitQty(kit.quantity)}
                        className={`
                          relative p-5 rounded-2xl border-2 cursor-pointer transition-all
                          ${isSelected 
                            ? `border-primary bg-primary/5 shadow-lg ${isVitrineModerna ? 'animate-glow-pulse' : ''}` 
                            : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}
                        `}
                        style={isSelected ? { 
                          borderColor: primaryColor,
                          '--glow-color': primaryColor 
                        } as any : undefined}
                      >
                        {/* Badges */}
                        <div className="absolute -top-3 left-4 flex gap-2">
                          {kit.isBestSeller && (
                            <Badge 
                              className="text-xs px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 border-0 text-white shadow-lg"
                            >
                              <ArrowUpRight className="h-3 w-3 mr-1" />
                              Mais vendido
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div 
                              className={`
                                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                                ${isSelected ? 'border-primary scale-110' : 'border-gray-300'}
                              `}
                              style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : undefined}
                            >
                              {isSelected && <Check className="h-4 w-4 text-white" />}
                            </div>
                            <div>
                              <span className="font-bold text-lg">
                                Kit {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
                              </span>
                              {/* Show "DE R$___ POR R$___" when there's a discount */}
                              {hasDiscount ? (
                                <p className="text-sm">
                                  <span className="text-muted-foreground line-through">
                                    De {formatCurrency(kit.originalPrice)}
                                  </span>
                                  {' '}
                                  <span className="font-medium text-green-600">
                                    Por {formatCurrency(kit.price)}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(kit.price)} à vista
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Installment value - HIGHLIGHT */}
                          <div className="text-right">
                            <div className="flex items-baseline justify-end gap-0.5">
                              <span className="text-sm text-muted-foreground">{maxInstallments}x</span>
                              {(() => {
                                const parts = formatCurrencyParts(installmentInfo.installmentValue);
                                return (
                                  <>
                                    <span 
                                      className="text-2xl font-bold"
                                      style={{ color: primaryColor }}
                                    >
                                      {parts.main}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      {parts.decimals}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-6">
              <span className="font-semibold">Quantidade:</span>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-12 w-12 rounded-xl"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <span className="w-12 text-center font-bold text-xl">{quantity}</span>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-12 w-12 rounded-xl"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Total & Add to Cart */}
            {(() => {
              // Calculate total installment with real interest rates
              const totalInstallmentInfo = calculateInstallmentWithInterest(
                totalPrice,
                maxInstallments,
                installmentConfig?.installment_fees,
                installmentConfig?.installment_fee_passed_to_buyer ?? true
              );
              const totalParts = formatCurrencyParts(totalInstallmentInfo.installmentValue);
              
              return (
                <div className={`
                  p-6 rounded-2xl space-y-4
                  ${isVitrineModerna ? 'bg-gradient-to-r from-pink-50 to-purple-50' : 'bg-gray-50'}
                `}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg">Total:</span>
                    <div className="text-right">
                      {/* Installment value - HIGHLIGHT */}
                      <div className="flex items-baseline justify-end gap-0.5">
                        <span className="text-sm text-muted-foreground">{maxInstallments}x</span>
                        <span 
                          className="text-3xl font-bold"
                          style={{ color: primaryColor }}
                        >
                          {totalParts.main}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {totalParts.decimals}
                        </span>
                      </div>
                      {/* Cash price - secondary */}
                      <p className="text-sm text-muted-foreground">
                        ou {formatCurrency(totalPrice)} à vista
                      </p>
                    </div>
                  </div>

              <Button 
                size="lg" 
                className={`
                  w-full h-16 text-lg font-bold gap-3 rounded-xl
                  ${isVitrineModerna ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]' : ''}
                `}
                style={!isVitrineModerna ? { backgroundColor: primaryColor } : undefined}
                onClick={() => {
                  const kitQty = selectedKit?.quantity || 1;
                  const kitPrice = selectedKit?.price || product.basePrice;
                  onAddToCart(quantity, kitQty);
                  setAddedProduct({
                    quantity,
                    kitSize: kitQty,
                    totalPrice: kitPrice * quantity,
                  });
                  setShowCartConfirm(true);
                }}
              >
                <ShoppingCart className="h-6 w-6" />
                Adicionar ao Carrinho
              </Button>

              {/* Payment icons */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/MasterCard_Logo.svg/1200px-MasterCard_Logo.svg.png" alt="Mastercard" className="h-6" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/1200px-Visa_Inc._logo.svg.png" alt="Visa" className="h-6" />
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/1200px-American_Express_logo_%282018%29.svg.png" alt="Amex" className="h-6" />
                <span className="text-xs text-muted-foreground">Pix • Boleto</span>
              </div>
            </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Add to Cart Confirmation Dialog */}
      {addedProduct && (
        <AddToCartConfirmDialog
          open={showCartConfirm}
          onOpenChange={setShowCartConfirm}
          storefrontSlug={storefrontSlug}
          productName={product.name}
          quantity={addedProduct.quantity}
          kitSize={addedProduct.kitSize}
          totalPrice={addedProduct.totalPrice}
          primaryColor={primaryColor}
          installmentConfig={installmentConfig}
        />
      )}
    </div>
  );
}
