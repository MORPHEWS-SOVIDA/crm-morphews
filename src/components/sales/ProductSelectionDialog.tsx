import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Package, Check, Minus, Plus, Percent, DollarSign, HelpCircle, Save, TrendingUp, TrendingDown, Coins, Shield, Eye } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { useLeadProductAnswer, useUpsertLeadProductAnswer } from '@/hooks/useLeadProductAnswers';
import { useProductPriceKits, ProductPriceKit } from '@/hooks/useProductPriceKits';
import { useMyCommission, calculateCommissionValue, compareCommission, CommissionComparison } from '@/hooks/useSellerCommission';
import { useKitRejections, useCreateKitRejection } from '@/hooks/useKitRejections';
import { DiscountAuthorizationDialog } from './DiscountAuthorizationDialog';
import { ProgressiveKitSelector } from './ProgressiveKitSelector';
import { cn } from '@/lib/utils';

interface ProductSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  leadId?: string | null;
  onConfirm: (selection: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
    requisition_number?: string | null;
  }) => void;
}

// Categories that use the new kit system
const CATEGORIES_WITH_KITS = ['produto_pronto', 'print_on_demand', 'dropshipping'];

type PriceType = 'regular' | 'promotional' | 'promotional_2' | 'minimum' | 'custom';

export function ProductSelectionDialog({
  open,
  onOpenChange,
  product,
  leadId,
  onConfirm,
}: ProductSelectionDialogProps) {
  // Kit selection state
  const [selectedKitId, setSelectedKitId] = useState<string>('');
  const [selectedPriceType, setSelectedPriceType] = useState<PriceType>('regular');
  const [customPrice, setCustomPrice] = useState(0);
  
  // Legacy price selection (for categories without kits)
  const [legacyQuantity, setLegacyQuantity] = useState(1);
  const [legacyUnitPrice, setLegacyUnitPrice] = useState(0);
  
  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  
  // Manipulado specific fields
  const [requisitionNumber, setRequisitionNumber] = useState('');
  const [manipuladoPrice, setManipuladoPrice] = useState(0);
  const [manipuladoQuantity, setManipuladoQuantity] = useState(1);
  
  // Key questions answers
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [answer3, setAnswer3] = useState('');
  
  // Authorization state for below-minimum prices
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingBelowMinimum, setPendingBelowMinimum] = useState(false);
  const [authorizedBy, setAuthorizedBy] = useState<string | null>(null);
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [answersModified, setAnswersModified] = useState(false);
  
  // Progressive kit selection state
  const [rejectedKitIds, setRejectedKitIds] = useState<string[]>([]);

  // Fetch data
  const { data: existingAnswer } = useLeadProductAnswer(leadId || undefined, product?.id);
  const upsertAnswer = useUpsertLeadProductAnswer();
  const { data: priceKits = [] } = useProductPriceKits(product?.id);
  const { data: sellerCommission } = useMyCommission();
  const { data: existingRejections = [] } = useKitRejections(leadId || undefined, product?.id);
  const createKitRejection = useCreateKitRejection();

  const sellerDefaultCommission = sellerCommission?.commissionPercentage || 0;

  // Check product category
  const isManipulado = product?.category === 'manipulado';
  const usesKitSystem = product?.category && CATEGORIES_WITH_KITS.includes(product.category);

  // Find selected kit
  const selectedKit = priceKits.find(k => k.id === selectedKitId);

  // Load existing answers when they're fetched
  useEffect(() => {
    if (existingAnswer) {
      setAnswer1(existingAnswer.answer_1 || '');
      setAnswer2(existingAnswer.answer_2 || '');
      setAnswer3(existingAnswer.answer_3 || '');
      setAnswersModified(false);
    } else {
      setAnswer1('');
      setAnswer2('');
      setAnswer3('');
      setAnswersModified(false);
    }
  }, [existingAnswer, product?.id]);

  // Auto-select first kit when loaded (sorted by position)
  useEffect(() => {
    if (priceKits.length > 0 && !selectedKitId) {
      const sortedKits = [...priceKits].sort((a, b) => a.position - b.position);
      setSelectedKitId(sortedKits[0].id);
    }
  }, [priceKits, selectedKitId]);

  // Load existing rejections into state
  useEffect(() => {
    if (existingRejections.length > 0) {
      setRejectedKitIds(existingRejections.map(r => r.kit_id));
    }
  }, [existingRejections]);

  // Reset custom price when kit or price type changes
  useEffect(() => {
    if (selectedKit && selectedPriceType === 'custom') {
      // Initialize custom price to regular price
      setCustomPrice(selectedKit.regular_price_cents);
    }
  }, [selectedKit, selectedPriceType]);

  // Reset state when product changes
  useEffect(() => {
    setSelectedKitId('');
    setSelectedPriceType('regular');
    setCustomPrice(0);
    setLegacyQuantity(1);
    setLegacyUnitPrice(product?.price_1_unit || 0);
    setRequisitionNumber('');
    setManipuladoPrice(0);
    setManipuladoQuantity(1);
    setDiscountValue(0);
    // Reset authorization state
    setPendingBelowMinimum(false);
    setAuthorizedBy(null);
    setAuthorizationId(null);
    // Reset rejection state
    setRejectedKitIds([]);
  }, [product?.id]);

  // Handler for kit rejection (progressive reveal)
  const handleRejectKit = async (kitId: string, reason: string, quantity: number, priceCents: number) => {
    if (!leadId || !product) return;

    // Add to local rejected list
    setRejectedKitIds(prev => [...prev, kitId]);

    // Find the kit to get its ID
    const kit = priceKits.find(k => k.id === kitId);
    if (!kit) return;

    // Save rejection to database
    try {
      await createKitRejection.mutateAsync({
        lead_id: leadId,
        product_id: product.id,
        kit_id: kitId,
        rejection_reason: reason,
        kit_quantity: quantity,
        kit_price_cents: priceCents,
      });
    } catch (error) {
      console.error('Error saving kit rejection:', error);
    }

    // Auto-select next available kit
    const sortedKits = [...priceKits].sort((a, b) => a.position - b.position);
    const nextKit = sortedKits.find(k => !rejectedKitIds.includes(k.id) && k.id !== kitId);
    if (nextKit) {
      setSelectedKitId(nextKit.id);
      setSelectedPriceType('promotional'); // Default to promotional (Venda por)
    }
  };

  if (!product) return null;

  // Calculate current values based on selection
  const getSelectedValues = () => {
    if (isManipulado) {
      return {
        quantity: manipuladoQuantity,
        unitPrice: manipuladoPrice,
        commission: sellerDefaultCommission,
        isCustomCommission: false,
      };
    }

    if (usesKitSystem && selectedKit) {
      const quantity = selectedKit.quantity;
      let unitPrice = 0;
      let commission = sellerDefaultCommission;
      let isCustomCommission = false;

      switch (selectedPriceType) {
        case 'regular':
          unitPrice = selectedKit.regular_price_cents;
          if (!selectedKit.regular_use_default_commission && selectedKit.regular_custom_commission !== null) {
            commission = selectedKit.regular_custom_commission;
            isCustomCommission = true;
          }
          break;
        case 'promotional':
          unitPrice = selectedKit.promotional_price_cents || selectedKit.regular_price_cents;
          if (!selectedKit.promotional_use_default_commission && selectedKit.promotional_custom_commission !== null) {
            commission = selectedKit.promotional_custom_commission;
            isCustomCommission = true;
          }
          break;
        case 'promotional_2':
          unitPrice = selectedKit.promotional_price_2_cents || selectedKit.regular_price_cents;
          if (!selectedKit.promotional_2_use_default_commission && selectedKit.promotional_2_custom_commission !== null) {
            commission = selectedKit.promotional_2_custom_commission;
            isCustomCommission = true;
          }
          break;
        case 'minimum':
          unitPrice = selectedKit.minimum_price_cents || selectedKit.regular_price_cents;
          if (!selectedKit.minimum_use_default_commission && selectedKit.minimum_custom_commission !== null) {
            commission = selectedKit.minimum_custom_commission;
            isCustomCommission = true;
          }
          break;
        case 'custom':
          unitPrice = customPrice;
          // For custom price, calculate proportional commission based on where the price falls
          const minPrice = selectedKit.minimum_price_cents || selectedKit.regular_price_cents;
          const maxPrice = selectedKit.regular_price_cents;
          const minCommission = selectedKit.minimum_use_default_commission 
            ? sellerDefaultCommission 
            : (selectedKit.minimum_custom_commission || sellerDefaultCommission);
          const maxCommission = selectedKit.regular_use_default_commission 
            ? sellerDefaultCommission 
            : (selectedKit.regular_custom_commission || sellerDefaultCommission);
          
          if (maxPrice > minPrice) {
            const ratio = Math.max(0, Math.min(1, (customPrice - minPrice) / (maxPrice - minPrice)));
            commission = minCommission + (maxCommission - minCommission) * ratio;
          } else {
            commission = maxCommission;
          }
          isCustomCommission = commission !== sellerDefaultCommission;
          break;
      }

      return { quantity, unitPrice, commission, isCustomCommission };
    }

    // Legacy system
    return {
      quantity: legacyQuantity,
      unitPrice: legacyUnitPrice,
      commission: sellerDefaultCommission,
      isCustomCommission: false,
    };
  };

  const { quantity, unitPrice, commission, isCustomCommission } = getSelectedValues();
  const subtotal = unitPrice * quantity;
  
  let discountCents = 0;
  if (!isManipulado) {
    if (discountType === 'percentage' && discountValue > 0) {
      discountCents = Math.round(subtotal * (discountValue / 100));
    } else if (discountType === 'fixed') {
      discountCents = discountValue;
    }
  }
  
  const total = subtotal - discountCents;
  const commissionValue = calculateCommissionValue(total, commission);
  
  // Validation - check if below minimum (considering discounts)
  const minPriceForKit = selectedKit?.minimum_price_cents || 0;
  const effectiveUnitPrice = quantity > 0 ? Math.round(total / quantity) : unitPrice;
  
  // Check if below minimum: either custom price is below minimum, OR total after discount is below minimum
  const isBelowMinimum = usesKitSystem && minPriceForKit > 0 && (
    (selectedPriceType === 'custom' && customPrice < minPriceForKit) ||
    (discountCents > 0 && effectiveUnitPrice < minPriceForKit)
  );
  const needsAuthorization = isBelowMinimum && !authorizationId;
  
  const isValidPrice = isManipulado 
    ? manipuladoPrice > 0 
    : usesKitSystem
      ? (!isBelowMinimum || authorizationId)
      : (unitPrice >= (product.minimum_price || 0) || (product.minimum_price || 0) === 0);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getCommissionComparison = (): CommissionComparison => {
    if (!isCustomCommission) return 'equal';
    if (commission > sellerDefaultCommission) return 'higher';
    if (commission < sellerDefaultCommission) return 'lower';
    return 'equal';
  };

  const CommissionBadge = ({ comparison, value }: { comparison: CommissionComparison; value: number }) => {
    if (comparison === 'higher') {
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1">
          🤩 <TrendingUp className="w-3 h-3" /> {formatPrice(value)}
        </Badge>
      );
    }
    if (comparison === 'lower') {
      return (
        <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1">
          ☹️ <TrendingDown className="w-3 h-3" /> {formatPrice(value)}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Coins className="w-3 h-3" /> {formatPrice(value)}
      </Badge>
    );
  };

  const handleConfirm = () => {
    // If below minimum and not yet authorized, show authorization dialog
    if (needsAuthorization) {
      setShowAuthDialog(true);
      return;
    }

    // Save answers if they were modified and we have a lead
    if (leadId && answersModified && (answer1 || answer2 || answer3)) {
      upsertAnswer.mutate({
        lead_id: leadId,
        product_id: product.id,
        answer_1: answer1 || null,
        answer_2: answer2 || null,
        answer_3: answer3 || null,
      });
    }

    onConfirm({
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price_cents: unitPrice,
      discount_cents: discountCents,
      requisition_number: isManipulado ? requisitionNumber : null,
    });
    onOpenChange(false);
    // Reset state
    setSelectedKitId('');
    setSelectedPriceType('regular');
    setCustomPrice(0);
    setLegacyQuantity(1);
    setLegacyUnitPrice(0);
    setDiscountValue(0);
    setAnswer1('');
    setAnswer2('');
    setAnswer3('');
    setAnswersModified(false);
    setRequisitionNumber('');
    setManipuladoPrice(0);
    setManipuladoQuantity(1);
    setPendingBelowMinimum(false);
    setAuthorizedBy(null);
    setAuthorizationId(null);
  };

  const handleAuthorizationSuccess = (authId: string, authorizedByName: string) => {
    setAuthorizationId(authId);
    setAuthorizedBy(authorizedByName);
    setShowAuthDialog(false);
  };

  const handleSaveAnswers = () => {
    if (!leadId) return;
    upsertAnswer.mutate({
      lead_id: leadId,
      product_id: product.id,
      answer_1: answer1 || null,
      answer_2: answer2 || null,
      answer_3: answer3 || null,
    }, {
      onSuccess: () => setAnswersModified(false),
    });
  };

  const hasKeyQuestions = product.key_question_1 || product.key_question_2 || product.key_question_3;

  // Render kit option with commission info
  const renderKitPriceOption = (
    kit: ProductPriceKit,
    type: PriceType,
    label: string,
    priceCents: number | null,
    useDefault: boolean,
    customCommission: number | null
  ) => {
    if (!priceCents) return null;

    const effectiveCommission = useDefault ? sellerDefaultCommission : (customCommission || sellerDefaultCommission);
    const commissionComparison = compareCommission(customCommission, sellerDefaultCommission, useDefault);
    const commissionValueForPrice = calculateCommissionValue(priceCents * kit.quantity, effectiveCommission);

    return (
      <label 
        key={`${kit.id}-${type}`}
        className={cn(
          "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all",
          selectedKitId === kit.id && selectedPriceType === type
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "hover:border-primary/50"
        )}
        onClick={() => {
          setSelectedKitId(kit.id);
          setSelectedPriceType(type);
        }}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
            selectedKitId === kit.id && selectedPriceType === type
              ? "border-primary"
              : "border-muted-foreground"
          )}>
            {selectedKitId === kit.id && selectedPriceType === type && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          <div>
            <p className="font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">
              {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">{formatPrice(priceCents)}</p>
          <CommissionBadge comparison={commissionComparison} value={commissionValueForPrice} />
        </div>
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informações do Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {product.description && (
                <p className="text-sm">{product.description}</p>
              )}
              
              {product.sales_script && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Script de Vendas:</p>
                  <p className="text-sm whitespace-pre-wrap">{product.sales_script}</p>
                </div>
              )}

              {/* Key Questions with Answers (only show if leadId is provided) */}
              {hasKeyQuestions && leadId && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      Perguntas Chave - Respostas do Cliente
                    </p>
                    {answersModified && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveAnswers}
                        disabled={upsertAnswer.isPending}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Salvar
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {product.key_question_1 && (
                      <div className="space-y-1">
                        <Label className="text-xs">{product.key_question_1}</Label>
                        <Textarea
                          value={answer1}
                          onChange={(e) => {
                            setAnswer1(e.target.value);
                            setAnswersModified(true);
                          }}
                          placeholder="Resposta do cliente..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    )}
                    {product.key_question_2 && (
                      <div className="space-y-1">
                        <Label className="text-xs">{product.key_question_2}</Label>
                        <Textarea
                          value={answer2}
                          onChange={(e) => {
                            setAnswer2(e.target.value);
                            setAnswersModified(true);
                          }}
                          placeholder="Resposta do cliente..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    )}
                    {product.key_question_3 && (
                      <div className="space-y-1">
                        <Label className="text-xs">{product.key_question_3}</Label>
                        <Textarea
                          value={answer3}
                          onChange={(e) => {
                            setAnswer3(e.target.value);
                            setAnswersModified(true);
                          }}
                          placeholder="Resposta do cliente..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Key Questions display-only (no lead selected) */}
              {hasKeyQuestions && !leadId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {product.key_question_1 && (
                    <div className="p-2 bg-primary/5 rounded border border-primary/10">
                      <p className="text-xs font-medium text-primary">Pergunta 1:</p>
                      <p className="text-sm">{product.key_question_1}</p>
                    </div>
                  )}
                  {product.key_question_2 && (
                    <div className="p-2 bg-primary/5 rounded border border-primary/10">
                      <p className="text-xs font-medium text-primary">Pergunta 2:</p>
                      <p className="text-sm">{product.key_question_2}</p>
                    </div>
                  )}
                  {product.key_question_3 && (
                    <div className="p-2 bg-primary/5 rounded border border-primary/10">
                      <p className="text-xs font-medium text-primary">Pergunta 3:</p>
                      <p className="text-sm">{product.key_question_3}</p>
                    </div>
                  )}
                </div>
              )}

              {product.usage_period_days > 0 && (
                <Badge variant="secondary">
                  Período de uso: {product.usage_period_days} dias
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Manipulado: Requisição e Preço Manual */}
          {isManipulado ? (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800">
                  Dados do Manipulado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-amber-900">Número da Requisição *</Label>
                  <Input
                    value={requisitionNumber}
                    onChange={(e) => setRequisitionNumber(e.target.value)}
                    placeholder="Ex: REQ-12345"
                    className="mt-1"
                  />
                  <p className="text-xs text-amber-700 mt-1">
                    Informe o número da requisição da farmácia de manipulação
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-amber-900">Quantidade</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setManipuladoQuantity(Math.max(1, manipuladoQuantity - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={manipuladoQuantity}
                        onChange={(e) => setManipuladoQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setManipuladoQuantity(manipuladoQuantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-amber-900">Valor da Requisição *</Label>
                    <CurrencyInput
                      value={manipuladoPrice}
                      onChange={setManipuladoPrice}
                      className="mt-1"
                    />
                    <p className="text-xs text-amber-700 mt-1">
                      Valor informado pela farmácia
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : usesKitSystem && priceKits.length > 0 ? (
            /* Progressive Kit System for produto_pronto, print_on_demand, dropshipping */
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Selecione o Kit e Valor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {leadId ? (
                  /* Progressive selection for sales with lead */
                  <ProgressiveKitSelector
                    kits={priceKits}
                    selectedKitId={selectedKitId}
                    selectedPriceType={selectedPriceType}
                    onSelectKit={(kitId, priceType) => {
                      setSelectedKitId(kitId);
                      setSelectedPriceType(priceType);
                    }}
                    rejectedKitIds={rejectedKitIds}
                    onRejectKit={handleRejectKit}
                    sellerDefaultCommission={sellerDefaultCommission}
                  />
                ) : (
                  /* Standard kit selection without progressive reveal (no lead) */
                  priceKits.sort((a, b) => a.position - b.position).map((kit) => (
                    <div key={kit.id} className="space-y-2">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Badge variant="outline" className="font-bold">
                          {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 ml-2">
                        {/* Promotional Price (Venda por:) */}
                        {kit.promotional_price_cents && renderKitPriceOption(
                          kit, 
                          'promotional', 
                          'Venda por:', 
                          kit.promotional_price_cents,
                          kit.promotional_use_default_commission,
                          kit.promotional_custom_commission
                        )}
                        
                        {/* Fallback to regular if no promotional */}
                        {!kit.promotional_price_cents && renderKitPriceOption(
                          kit, 
                          'regular', 
                          'Venda por:', 
                          kit.regular_price_cents,
                          kit.regular_use_default_commission,
                          kit.regular_custom_commission
                        )}
                      </div>
                    </div>
                  ))
                )}
                      
                {/* Seller Commission Info */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Sua comissão padrão:</p>
                  <p className="font-medium">{sellerDefaultCommission}%</p>
                </div>
              </CardContent>
            </Card>
                      )}
                      
                      {/* Promotional Price 2 */}
                      {kit.promotional_price_2_cents && renderKitPriceOption(
                        kit, 
                        'promotional_2', 
                        'Preço Promocional 2', 
                        kit.promotional_price_2_cents,
                        kit.promotional_2_use_default_commission,
                        kit.promotional_2_custom_commission
                      )}
                      
                      {/* Minimum Price */}
                      {kit.minimum_price_cents && renderKitPriceOption(
                        kit, 
                        'minimum', 
                        'Preço Mínimo', 
                        kit.minimum_price_cents,
                        kit.minimum_use_default_commission,
                        kit.minimum_custom_commission
                      )}
                    </div>
                  </div>
                ))}

                {/* Custom Value Option */}
                {selectedKit && selectedKit.minimum_price_cents && (
                  <div className="mt-4 pt-4 border-t">
                    <label 
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all",
                        selectedPriceType === 'custom'
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      )}
                      onClick={() => setSelectedPriceType('custom')}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          selectedPriceType === 'custom'
                            ? "border-primary"
                            : "border-muted-foreground"
                        )}>
                          {selectedPriceType === 'custom' && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">Valor Personalizado</p>
                          <p className="text-sm text-muted-foreground">
                            Entre {formatPrice(selectedKit.minimum_price_cents)} e {formatPrice(selectedKit.regular_price_cents)}
                          </p>
                        </div>
                      </div>
                    </label>
                    
                    {selectedPriceType === 'custom' && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
                        <div>
                          <Label>Valor por unidade</Label>
                          <CurrencyInput
                            value={customPrice}
                            onChange={setCustomPrice}
                            className="mt-1"
                          />
                        </div>
                        <Slider
                          value={[customPrice]}
                          min={selectedKit.minimum_price_cents}
                          max={selectedKit.regular_price_cents}
                          step={100}
                          onValueChange={(value) => setCustomPrice(value[0])}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Mín: {formatPrice(selectedKit.minimum_price_cents)}</span>
                          <span>Máx: {formatPrice(selectedKit.regular_price_cents)}</span>
                        </div>
                        {customPrice < selectedKit.minimum_price_cents && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800 flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              ⚠️ Valor abaixo do mínimo - requer autorização de gerente
                            </p>
                            {authorizationId && authorizedBy && (
                              <Badge className="mt-2 bg-green-500 text-white">
                                ✓ Autorizado por {authorizedBy}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Seller Commission Info */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Sua comissão padrão:</p>
                  <p className="font-medium">{sellerDefaultCommission}%</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Legacy Price Selection - for other categories without kits */
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Quantidade e Preço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantidade</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setLegacyQuantity(Math.max(1, legacyQuantity - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={legacyQuantity}
                        onChange={(e) => setLegacyQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setLegacyQuantity(legacyQuantity + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Preço Unitário</Label>
                    <CurrencyInput
                      value={legacyUnitPrice}
                      onChange={setLegacyUnitPrice}
                      className="mt-1"
                    />
                  </div>
                </div>
                {product.minimum_price > 0 && legacyUnitPrice < product.minimum_price && (
                  <p className="text-xs text-destructive mt-2">
                    ⚠️ Preço mínimo: {formatPrice(product.minimum_price)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Discount - Hide for Manipulado */}
          {!isManipulado && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Desconto no Produto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        variant={discountType === 'fixed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('fixed')}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        R$
                      </Button>
                      <Button
                        type="button"
                        variant={discountType === 'percentage' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscountType('percentage')}
                      >
                        <Percent className="w-4 h-4 mr-1" />
                        %
                      </Button>
                    </div>
                    {discountType === 'fixed' ? (
                      <CurrencyInput
                        value={discountValue}
                        onChange={setDiscountValue}
                        placeholder="Valor do desconto"
                      />
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Math.min(100, parseInt(e.target.value) || 0))}
                        placeholder="% de desconto"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="space-y-2">
                {isManipulado && requisitionNumber && (
                  <div className="flex justify-between text-sm text-amber-700">
                    <span>Requisição</span>
                    <span className="font-medium">{requisitionNumber}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({quantity} x {formatPrice(unitPrice)})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discountCents > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>- {formatPrice(discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
                
                {/* Commission Display */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Sua comissão ({commission.toFixed(1)}%)</span>
                  <CommissionBadge comparison={getCommissionComparison()} value={commissionValue} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning for below minimum price */}
          {needsAuthorization && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                ⚠️ O valor final ({formatPrice(effectiveUnitPrice)}/un) está abaixo do mínimo ({formatPrice(minPriceForKit)}/un) - requer autorização de gerente
              </p>
              {authorizationId && authorizedBy && (
                <Badge className="mt-2 bg-green-500 text-white">
                  ✓ Autorizado por {authorizedBy}
                </Badge>
              )}
            </div>
          )}

          {!isValidPrice && !needsAuthorization && (
            <p className="text-sm text-destructive text-center">
              ⚠️ Valor inválido ou abaixo do mínimo permitido
            </p>
          )}

          {isManipulado && !requisitionNumber && (
            <p className="text-sm text-amber-600 text-center">
              ⚠️ Informe o número da requisição
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={total <= 0 || (isManipulado && !requisitionNumber) || (!isValidPrice && !needsAuthorization)}
            >
              {needsAuthorization ? (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Solicitar Autorização
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Adicionar à Venda
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Authorization Dialog */}
      <DiscountAuthorizationDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        productName={product?.name || ''}
        productId={product?.id || ''}
        minimumPriceCents={minPriceForKit}
        requestedPriceCents={effectiveUnitPrice}
        onAuthorized={handleAuthorizationSuccess}
      />
    </Dialog>
  );
}
