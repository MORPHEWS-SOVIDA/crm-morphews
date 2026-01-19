import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Star, 
  DollarSign, 
  ClipboardList, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  Plus,
  Eye,
  EyeOff,
  FileText,
  Coins,
  HelpCircle,
  Calculator
} from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { useProductQuestions, ProductQuestion } from '@/hooks/useProductQuestions';
import { ProductInfoButtons } from '@/components/products/ProductInfoButtons';
import { ProductImageViewer } from '@/components/products/ProductImageViewer';
import { NegotiationDialog } from './NegotiationDialog';

interface ProductPriceKit {
  id: string;
  quantity: number;
  regular_price_cents: number;
  promotional_price_cents: number | null;
  promotional_price_2_cents: number | null;
  minimum_price_cents: number | null;
  regular_use_default_commission: boolean;
  regular_custom_commission: number | null;
  promotional_use_default_commission: boolean;
  promotional_custom_commission: number | null;
  promotional_2_use_default_commission: boolean;
  promotional_2_custom_commission: number | null;
  minimum_use_default_commission: boolean;
  minimum_custom_commission: number | null;
  position: number;
  sales_hack?: string | null;
}

interface ProductOfferCardProps {
  product: Product;
  sortedKits: ProductPriceKit[];
  currentKitId: string | null;
  currentPriceType: 'regular' | 'promotional' | 'promotional_2' | 'minimum' | 'negotiated';
  currentRejectedKitIds: string[];
  showPromo2: boolean;
  showMinimum: boolean;
  currentAnswers: Record<string, string>;
  dynamicAnswers: Record<string, string>; // For dynamic product questions
  defaultCommission: number;
  requisitionNumber?: string;
  manipuladoPrice?: number;
  manipuladoQuantity?: number;
  leadId?: string;
  showRejectionInput: boolean;
  rejectionReason: string;
  isRejecting: boolean;
  // Negotiation props
  negotiatedPriceCents?: number;
  negotiatedInstallments?: number;
  negotiatedCommission?: number;
  onNegotiate?: (priceCents: number, installments: number, commission: number) => void;
  onKitSelect: (kitId: string, priceType: 'regular' | 'promotional' | 'promotional_2' | 'minimum') => void;
  onRevealPromo2: () => void;
  onRevealMinimum: () => void;
  onAnswersChange: (answers: Record<string, string>) => void;
  onDynamicAnswersChange: (answers: Record<string, string>) => void; // For dynamic product questions
  onRequisitionChange?: (value: string) => void;
  onManipuladoPriceChange?: (value: number) => void;
  onManipuladoQuantityChange?: (value: number) => void;
  onShowRejectionInput: (show: boolean) => void;
  onRejectionReasonChange: (value: string) => void;
  onRejectKit: () => void;
  onAddProduct: () => void;
  onResetProduct: () => void;
  currentUnitPrice: number;
  currentQuantity: number;
  currentCommission: number;
}

const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

// Format price with total and unit display
const formatPriceWithUnit = (totalCents: number, quantity: number) => {
  const total = formatPrice(totalCents);
  const unit = formatPrice(Math.round(totalCents / quantity));
  
  if (quantity === 1) {
    return { total, unit: null };
  }
  
  return { total, unit };
};

// Format as installment - divide by 10, show as 12x
const formatInstallment = (cents: number) => {
  const installmentValue = Math.round(cents / 10);
  return `12x de ${formatPrice(installmentValue)}`;
};

// Calculate actual commission value in cents
// Note: priceCents is already the TOTAL price of the kit, not unit price
// So we DON'T multiply by quantity again
const calculateCommissionValue = (priceCents: number, commissionPercentage: number) => {
  return Math.round(priceCents * (commissionPercentage / 100));
};

export function ProductOfferCard({
  product,
  sortedKits,
  currentKitId,
  currentPriceType,
  currentRejectedKitIds,
  showPromo2,
  showMinimum,
  currentAnswers,
  dynamicAnswers,
  defaultCommission,
  requisitionNumber = '',
  manipuladoPrice = 0,
  manipuladoQuantity = 1,
  leadId,
  showRejectionInput,
  rejectionReason,
  isRejecting,
  // Negotiation props
  negotiatedPriceCents,
  negotiatedInstallments = 12,
  negotiatedCommission,
  onNegotiate,
  onKitSelect,
  onRevealPromo2,
  onRevealMinimum,
  onAnswersChange,
  onDynamicAnswersChange,
  onRequisitionChange,
  onManipuladoPriceChange,
  onManipuladoQuantityChange,
  onShowRejectionInput,
  onRejectionReasonChange,
  onRejectKit,
  onAddProduct,
  onResetProduct,
  currentUnitPrice,
  currentQuantity,
  currentCommission,
}: ProductOfferCardProps) {
  
  // Fetch dynamic questions for this product
  const { data: productQuestions = [], isLoading: loadingQuestions } = useProductQuestions(product.id);
  
  // State to control whether script/questions have been completed
  const [questionsCompleted, setQuestionsCompleted] = useState(false);
  
  // State for negotiation dialog
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  
  // Auto-complete questions step if answers already exist
  useEffect(() => {
    if (productQuestions.length > 0 && Object.keys(dynamicAnswers).length > 0) {
      const allAnswered = productQuestions.every(q => dynamicAnswers[q.id]?.trim());
      if (allAnswered) {
        setQuestionsCompleted(true);
      }
    }
  }, [productQuestions, dynamicAnswers]);

  // Get all available (non-rejected) kits
  const availableKits = useMemo(() => {
    return sortedKits.filter(k => !currentRejectedKitIds.includes(k.id));
  }, [sortedKits, currentRejectedKitIds]);

  // Get rejected kits (to show above current kit)
  const rejectedKits = useMemo(() => {
    return sortedKits.filter(k => currentRejectedKitIds.includes(k.id));
  }, [sortedKits, currentRejectedKitIds]);

  // Find current visible kit (first non-rejected)
  const currentVisibleKit = useMemo(() => {
    return sortedKits.find(k => !currentRejectedKitIds.includes(k.id));
  }, [sortedKits, currentRejectedKitIds]);

  const hasMoreKits = useMemo(() => {
    // Check if there are more non-rejected kits after the current visible one
    if (!currentVisibleKit) return false;
    const visibleIndex = sortedKits.findIndex(k => k.id === currentVisibleKit.id);
    // Check if any kit after the current one is not rejected
    return sortedKits.slice(visibleIndex + 1).some(k => !currentRejectedKitIds.includes(k.id));
  }, [sortedKits, currentVisibleKit, currentRejectedKitIds]);

  const allKitsRejected = useMemo(() => {
    return sortedKits.length > 0 && sortedKits.every(k => currentRejectedKitIds.includes(k.id));
  }, [sortedKits, currentRejectedKitIds]);

  const getCommissionForType = (kit: ProductPriceKit, type: 'regular' | 'promotional' | 'promotional_2' | 'minimum') => {
    switch (type) {
      case 'regular':
        return kit.regular_use_default_commission ? defaultCommission : (kit.regular_custom_commission || 0);
      case 'promotional':
        return kit.promotional_use_default_commission ? defaultCommission : (kit.promotional_custom_commission || 0);
      case 'promotional_2':
        return kit.promotional_2_use_default_commission ? defaultCommission : (kit.promotional_2_custom_commission || 0);
      case 'minimum':
        return kit.minimum_use_default_commission ? defaultCommission : (kit.minimum_custom_commission || 0);
    }
  };

  const getPriceForType = (kit: ProductPriceKit, type: 'regular' | 'promotional' | 'promotional_2' | 'minimum') => {
    switch (type) {
      case 'regular':
        return kit.regular_price_cents;
      case 'promotional':
        return kit.promotional_price_cents || kit.regular_price_cents;
      case 'promotional_2':
        return kit.promotional_price_2_cents || kit.regular_price_cents;
      case 'minimum':
        return kit.minimum_price_cents || kit.regular_price_cents;
    }
  };

  // Commission badge with value in R$ - price is already the total kit price
  const CommissionDisplay = ({ price, commissionPercentage }: { price: number; commissionPercentage: number }) => {
    const commissionValue = calculateCommissionValue(price, commissionPercentage);
    const isGood = commissionPercentage >= defaultCommission;
    
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge variant="outline" className={`text-xs ${isGood ? 'text-green-600 border-green-600' : 'text-amber-600 border-amber-600'}`}>
          {isGood ? '🤩' : '☹️'} {commissionPercentage}%
        </Badge>
        <span className={`text-xs font-medium ${isGood ? 'text-green-600' : 'text-amber-600'}`}>
          Ganhe {formatPrice(commissionValue)}
        </span>
      </div>
    );
  };

  // Price option card
  const PriceOption = ({ 
    type, 
    label, 
    price, 
    commission, 
    isSelected, 
    kit,
    variant = 'default'
  }: { 
    type: 'regular' | 'promotional' | 'promotional_2' | 'minimum';
    label: string;
    price: number;
    commission: number;
    isSelected: boolean;
    kit: ProductPriceKit;
    variant?: 'default' | 'success' | 'warning' | 'danger';
  }) => {
    const variantClasses = {
      default: isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-muted hover:border-muted-foreground/50',
      success: isSelected ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-muted hover:border-muted-foreground/50',
      warning: isSelected ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-muted hover:border-muted-foreground/50',
      danger: isSelected ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : 'border-muted hover:border-muted-foreground/50',
    };

    const priceClasses = {
      default: '',
      success: 'text-green-600',
      warning: 'text-amber-600',
      danger: 'text-red-600',
    };

    const priceDisplay = formatPriceWithUnit(price, kit.quantity);

    return (
      <button
        onClick={() => onKitSelect(kit.id, type)}
        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${variantClasses[variant]}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium ${variant === 'danger' ? 'text-red-700' : 'text-muted-foreground'}`}>
                {label}
                {variant === 'danger' && <AlertTriangle className="w-4 h-4 inline ml-1 text-red-500" />}
              </p>
            </div>
            <p className={`text-2xl font-bold ${priceClasses[variant]}`}>
              {priceDisplay.total}
            </p>
            {priceDisplay.unit && (
              <p className="text-sm font-medium text-muted-foreground">
                ({priceDisplay.unit}/un)
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              ou {formatInstallment(price)}
            </p>
          </div>
          <CommissionDisplay price={price} commissionPercentage={commission} />
        </div>
      </button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Oferta - {product.name}
        </CardTitle>
        <CardDescription>
          {product.category === 'manipulado' 
            ? 'Informe o valor e requisição' 
            : 'Selecione o kit e preço para o cliente'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Product Header with Image */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {product.is_featured && <Star className="w-4 h-4 text-amber-500" />}
              <span className="font-medium">{product.name}</span>
              <Badge variant="outline">{product.category}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onResetProduct}>
              Trocar
            </Button>
          </div>
          
          {/* Product Image and Label Viewer */}
          <ProductImageViewer
            imageUrl={product.image_url}
            labelImageUrl={product.label_image_url}
            productName={product.name}
          />
        </div>

        {/* Product Info Buttons (Composition, FAQ, Hot Site, Video) */}
        <ProductInfoButtons 
          productId={product.id}
          productName={product.name}
          hotSiteUrl={product.hot_site_url}
          youtubeVideoUrl={product.youtube_video_url}
        />

        {/* Dynamic Product Questions (from product_questions table) - BEFORE Script */}
        {loadingQuestions ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : productQuestions.length > 0 ? (
          <>
            <Separator />
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <h4 className="font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-4">
                <HelpCircle className="w-4 h-4" />
                Perguntas do Produto ({productQuestions.length})
              </h4>
              <div className="space-y-4">
                {productQuestions.map((question, index) => (
                  <div key={question.id} className="space-y-2">
                    <Label className="text-sm font-medium">{index + 1}. {question.question_text}</Label>
                    
                    {/* Render based on question type */}
                    {question.question_type === 'multiple_choice' && question.options && question.options.length > 0 ? (
                      // Multiple choice - Checkboxes
                      <div className="space-y-2 pl-2">
                        {question.options.map((option) => {
                          const selectedIds = (dynamicAnswers[question.id] || '').split(',').filter(Boolean);
                          const isChecked = selectedIds.includes(option.id);
                          return (
                            <div key={option.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`${question.id}-${option.id}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  let newSelectedIds = [...selectedIds];
                                  if (checked) {
                                    newSelectedIds.push(option.id);
                                  } else {
                                    newSelectedIds = newSelectedIds.filter(id => id !== option.id);
                                  }
                                  onDynamicAnswersChange({
                                    ...dynamicAnswers,
                                    [question.id]: newSelectedIds.join(',')
                                  });
                                }}
                              />
                              <Label htmlFor={`${question.id}-${option.id}`} className="text-sm font-normal cursor-pointer">
                                {option.option_text}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    ) : question.question_type === 'single_choice' && question.options && question.options.length > 0 ? (
                      // Single choice - Radio buttons
                      <RadioGroup
                        value={dynamicAnswers[question.id] || ''}
                        onValueChange={(value) => onDynamicAnswersChange({
                          ...dynamicAnswers,
                          [question.id]: value
                        })}
                        className="pl-2"
                      >
                        {question.options.map((option) => (
                          <div key={option.id} className="flex items-center gap-2">
                            <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                            <Label htmlFor={`${question.id}-${option.id}`} className="text-sm font-normal cursor-pointer">
                              {option.option_text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : question.question_type === 'number' ? (
                      // Number input
                      <Input
                        type="number"
                        value={dynamicAnswers[question.id] || ''}
                        onChange={(e) => onDynamicAnswersChange({
                          ...dynamicAnswers,
                          [question.id]: e.target.value
                        })}
                        placeholder="Digite o valor..."
                        className="bg-white dark:bg-background max-w-xs"
                      />
                    ) : (
                      // Default: Free text
                      <Textarea
                        value={dynamicAnswers[question.id] || ''}
                        onChange={(e) => onDynamicAnswersChange({ 
                          ...dynamicAnswers, 
                          [question.id]: e.target.value 
                        })}
                        placeholder="Resposta do cliente..."
                        rows={2}
                        className="bg-white dark:bg-background"
                      />
                    )}
                  </div>
                ))}
              </div>
              
            </div>
          </>
        ) : null}

        {/* Legacy Product Questions (key_question_1/2/3) - only show if no dynamic questions */}
        {productQuestions.length === 0 && (product.key_question_1 || product.key_question_2 || product.key_question_3) && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Perguntas Personalizadas
              </h4>
              {product.key_question_1 && (
                <div className="space-y-2">
                  <Label className="text-sm">1. {product.key_question_1}</Label>
                  <Textarea
                    value={currentAnswers.answer_1 || ''}
                    onChange={(e) => onAnswersChange({ ...currentAnswers, answer_1: e.target.value })}
                    placeholder="Resposta..."
                    rows={2}
                  />
                </div>
              )}
              {product.key_question_2 && (
                <div className="space-y-2">
                  <Label className="text-sm">2. {product.key_question_2}</Label>
                  <Textarea
                    value={currentAnswers.answer_2 || ''}
                    onChange={(e) => onAnswersChange({ ...currentAnswers, answer_2: e.target.value })}
                    placeholder="Resposta..."
                    rows={2}
                  />
                </div>
              )}
              {product.key_question_3 && (
                <div className="space-y-2">
                  <Label className="text-sm">3. {product.key_question_3}</Label>
                  <Textarea
                    value={currentAnswers.answer_3 || ''}
                    onChange={(e) => onAnswersChange({ ...currentAnswers, answer_3: e.target.value })}
                    placeholder="Resposta..."
                    rows={2}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Sales Script - AFTER Questions */}
        {product.sales_script && (
          <>
            <Separator />
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-medium flex items-center gap-2 text-primary mb-2">
                <FileText className="w-4 h-4" />
                Script de Vendas
              </h4>
              <p className="text-sm whitespace-pre-wrap">{product.sales_script}</p>
            </div>
          </>
        )}

        {/* Manipulado Product */}
        {product.category === 'manipulado' && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Número da Requisição *</Label>
                <Input
                  value={requisitionNumber}
                  onChange={(e) => onRequisitionChange?.(e.target.value)}
                  placeholder="Ex: REQ-12345"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={manipuladoQuantity}
                    onChange={(e) => onManipuladoQuantityChange?.(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Total (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={(manipuladoPrice / 100).toFixed(2)}
                    onChange={(e) => onManipuladoPriceChange?.(Math.round(parseFloat(e.target.value) * 100) || 0)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Kit Selection - Show rejected kits above, then current kit (progressive reveal) */}
        {product.category !== 'manipulado' && (currentVisibleKit || rejectedKits.length > 0) && !allKitsRejected && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">
                Selecione a quantidade e o preço:
              </h4>
              
              {/* Show previously rejected kits (still selectable) */}
              {rejectedKits.map((kit) => (
                <div 
                  key={kit.id}
                  className={`p-4 rounded-lg border-2 ${currentKitId === kit.id ? 'border-primary bg-primary/5' : 'border-muted bg-muted/30'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={currentKitId === kit.id ? "default" : "secondary"} className="text-base px-3 py-1">
                        {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Opção anterior
                      </Badge>
                    </div>
                  </div>

                  {/* Price Options for rejected kit */}
                  <div className="space-y-2">
                    {/* Regular Price */}
                    <PriceOption
                      type="regular"
                      label="Preço Regular"
                      price={kit.regular_price_cents}
                      commission={getCommissionForType(kit, 'regular')}
                      isSelected={currentKitId === kit.id && currentPriceType === 'regular'}
                      kit={kit}
                      variant="default"
                    />

                    {/* Promotional */}
                    {kit.promotional_price_cents && (
                      <PriceOption
                        type="promotional"
                        label="Venda Por"
                        price={kit.promotional_price_cents}
                        commission={getCommissionForType(kit, 'promotional')}
                        isSelected={currentKitId === kit.id && currentPriceType === 'promotional'}
                        kit={kit}
                        variant="success"
                      />
                    )}

                    {/* Promotional 2 */}
                    {kit.promotional_price_2_cents && (
                      <PriceOption
                        type="promotional_2"
                        label="Preço Promocional"
                        price={kit.promotional_price_2_cents}
                        commission={getCommissionForType(kit, 'promotional_2')}
                        isSelected={currentKitId === kit.id && currentPriceType === 'promotional_2'}
                        kit={kit}
                        variant="warning"
                      />
                    )}

                    {/* Minimum */}
                    {kit.minimum_price_cents && (
                      <PriceOption
                        type="minimum"
                        label="Valor Mínimo"
                        price={kit.minimum_price_cents}
                        commission={getCommissionForType(kit, 'minimum')}
                        isSelected={currentKitId === kit.id && currentPriceType === 'minimum'}
                        kit={kit}
                        variant="danger"
                      />
                    )}
                  </div>

                  {/* Negotiate button for rejected kit if selected */}
                  {currentKitId === kit.id && onNegotiate && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        className="w-full text-primary border-primary hover:bg-primary/5"
                        onClick={() => setShowNegotiationDialog(true)}
                      >
                        <Calculator className="w-4 h-4 mr-2" />
                        Negociar Valor / Parcelamento
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Show ONLY the current visible kit */}
              {currentVisibleKit && (
                <div 
                  className={`p-5 rounded-lg border-2 ${currentKitId === currentVisibleKit.id ? 'border-primary bg-primary/5' : 'border-muted'}`}
                >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={currentKitId === currentVisibleKit.id ? "default" : "secondary"} className="text-lg px-3 py-1">
                      {currentVisibleKit.quantity} {currentVisibleKit.quantity === 1 ? 'unidade' : 'unidades'}
                    </Badge>
                  </div>
                </div>

                {/* Sales Hack - Tip for seller */}
                {currentVisibleKit.sales_hack && currentKitId === currentVisibleKit.id && (
                  <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">💡</span>
                      <div>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                          Hack para Vender Mais
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          {currentVisibleKit.sales_hack}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Options */}
                <div className="space-y-3">
                  {/* 1. PREÇO REGULAR (always visible) */}
                  <PriceOption
                    type="regular"
                    label="Preço Regular"
                    price={currentVisibleKit.regular_price_cents}
                    commission={getCommissionForType(currentVisibleKit, 'regular')}
                    isSelected={currentKitId === currentVisibleKit.id && currentPriceType === 'regular'}
                    kit={currentVisibleKit}
                    variant="default"
                  />

                  {/* 2. VENDA POR / Promotional (always visible if exists) */}
                  {currentVisibleKit.promotional_price_cents && (
                    <PriceOption
                      type="promotional"
                      label="Venda Por"
                      price={currentVisibleKit.promotional_price_cents}
                      commission={getCommissionForType(currentVisibleKit, 'promotional')}
                      isSelected={currentKitId === currentVisibleKit.id && currentPriceType === 'promotional'}
                      kit={currentVisibleKit}
                      variant="success"
                    />
                  )}

                  {/* 3. PREÇO PROMOCIONAL (revealed only when clicking button) */}
                  {currentVisibleKit.promotional_price_2_cents && (
                    <>
                      {!showPromo2 ? (
                        <Button
                          variant="ghost"
                          className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            onKitSelect(currentVisibleKit.id, 'promotional_2');
                            onRevealPromo2();
                          }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Preço Promocional
                        </Button>
                      ) : (
                        <PriceOption
                          type="promotional_2"
                          label="Preço Promocional"
                          price={currentVisibleKit.promotional_price_2_cents}
                          commission={getCommissionForType(currentVisibleKit, 'promotional_2')}
                          isSelected={currentKitId === currentVisibleKit.id && currentPriceType === 'promotional_2'}
                          kit={currentVisibleKit}
                          variant="warning"
                        />
                      )}
                    </>
                  )}

                  {/* 4. VALOR MÍNIMO (revealed only when clicking button AND promo2 revealed) */}
                  {currentVisibleKit.minimum_price_cents && (
                    <>
                      {!showMinimum ? (
                        <Button
                          variant="ghost"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            onKitSelect(currentVisibleKit.id, 'minimum');
                            onRevealMinimum();
                          }}
                          disabled={currentVisibleKit.promotional_price_2_cents && !showPromo2}
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Solicitar Valor Mínimo
                        </Button>
                      ) : (
                        <PriceOption
                          type="minimum"
                          label="Valor Mínimo"
                          price={currentVisibleKit.minimum_price_cents}
                          commission={getCommissionForType(currentVisibleKit, 'minimum')}
                          isSelected={currentKitId === currentVisibleKit.id && currentPriceType === 'minimum'}
                          kit={currentVisibleKit}
                          variant="danger"
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Negotiate Button */}
                {currentKitId === currentVisibleKit.id && onNegotiate && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="w-full text-primary border-primary hover:bg-primary/5"
                      onClick={() => setShowNegotiationDialog(true)}
                    >
                      <Calculator className="w-4 h-4 mr-2" />
                      Negociar Valor / Parcelamento
                    </Button>
                  </div>
                )}

                {/* Rejection button to show next kit - only if there are more kits */}
                {hasMoreKits && (
                  <div className="mt-4 pt-4 border-t border-dashed">
                    {!showRejectionInput ? (
                      <Button
                        variant="ghost"
                        className="w-full text-muted-foreground hover:text-foreground"
                        onClick={() => onShowRejectionInput(true)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Não consegui vender esse, mostrar outra opção de valor
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Por que não conseguiu vender {currentVisibleKit.quantity} {currentVisibleKit.quantity === 1 ? 'unidade' : 'unidades'}?
                        </Label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => onRejectionReasonChange(e.target.value)}
                          placeholder="Ex: Cliente achou caro, quer menos unidades..."
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onShowRejectionInput(false);
                              onRejectionReasonChange('');
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={onRejectKit}
                            disabled={!rejectionReason.trim() || isRejecting}
                          >
                            {isRejecting ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Mostrar próxima opção
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Negotiation Dialog - works with any selected kit */}
              {onNegotiate && currentKitId && (() => {
                const selectedKit = sortedKits.find(k => k.id === currentKitId);
                if (!selectedKit) return null;
                return (
                  <NegotiationDialog
                    open={showNegotiationDialog}
                    onOpenChange={setShowNegotiationDialog}
                    originalPriceCents={getPriceForType(selectedKit, currentPriceType as any)}
                    minimumPriceCents={selectedKit.minimum_price_cents}
                    quantity={selectedKit.quantity}
                    originalCommission={getCommissionForType(selectedKit, currentPriceType as any)}
                    defaultCommission={defaultCommission}
                    minimumCommission={selectedKit.minimum_custom_commission}
                    onConfirm={(price, installments, commission) => {
                      onNegotiate(price, installments, commission);
                    }}
                  />
                );
              })()}
            </div>
          </>
        )}

        {/* All kits rejected */}
        {product.category !== 'manipulado' && allKitsRejected && (
          <div className="p-6 border-2 border-dashed border-amber-500 rounded-lg text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-lg">Todas as ofertas foram rejeitadas</p>
            <p className="text-muted-foreground mt-1">
              Finalize o atendimento selecionando um motivo de não compra
            </p>
          </div>
        )}

        {/* Summary for current selection - only when questions answered */}
        {currentUnitPrice > 0 && (productQuestions.length === 0 || questionsCompleted) && (
          <>
            <Separator />
            <div className={`p-4 rounded-lg border ${
              currentPriceType === 'negotiated' || negotiatedPriceCents
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                : 'bg-primary/5 border-primary/20'
            }`}>
              {/* Negotiated indicator */}
              {(currentPriceType === 'negotiated' || negotiatedPriceCents) && (
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    <Calculator className="w-3 h-3 mr-1" />
                    Valor Negociado
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Kit {currentQuantity} {currentQuantity === 1 ? 'unidade' : 'unidades'}:</span>
                {/* For kit system, currentUnitPrice is already the total kit price, don't multiply */}
                <span className="text-xl font-bold">{formatPrice(currentUnitPrice)}</span>
              </div>
              
              {/* Show installments - either negotiated or default */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {negotiatedInstallments && negotiatedInstallments !== 12 ? (
                  <span>
                    {negotiatedInstallments === 1 
                      ? 'À vista'
                      : `ou ${negotiatedInstallments}x de ${formatPrice(Math.round((currentUnitPrice / 10 * 12) / negotiatedInstallments))}`
                    }
                  </span>
                ) : (
                  <span>ou {formatInstallment(currentUnitPrice)}</span>
                )}
              </div>
              
              <Separator className="my-3" />
              
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Coins className="w-4 h-4" />
                  Sua comissão ({currentCommission}%):
                </span>
                <span className={`font-bold ${currentCommission < defaultCommission ? 'text-amber-600' : 'text-green-600'}`}>
                  {/* For kit system, commission is based on the kit price (already total) */}
                  Ganhe {formatPrice(calculateCommissionValue(currentUnitPrice, currentCommission))}
                </span>
              </div>
              
              {/* Commission notice when discount applied */}
              {currentCommission === defaultCommission && (currentPriceType === 'negotiated' || negotiatedPriceCents) && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Com desconto aplicado, comissão usa taxa padrão
                </p>
              )}
            </div>
          </>
        )}

        {/* Add to offer button - only when questions answered */}
        {currentUnitPrice > 0 && (productQuestions.length === 0 || questionsCompleted) && (
          <>
            <Button
              className="w-full"
              variant="outline"
              onClick={onAddProduct}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar e Escolher Outro Produto
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
