import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Textarea } from '@/components/ui/textarea';
import { Package, Check, Minus, Plus, Percent, DollarSign, HelpCircle, Save } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { useLeadProductAnswer, useUpsertLeadProductAnswer } from '@/hooks/useLeadProductAnswers';

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

type PriceOption = '1' | '3' | '6' | '12' | 'custom';

export function ProductSelectionDialog({
  open,
  onOpenChange,
  product,
  leadId,
  onConfirm,
}: ProductSelectionDialogProps) {
  const [selectedPriceOption, setSelectedPriceOption] = useState<PriceOption>('1');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnitPrice, setCustomUnitPrice] = useState(0);
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
  const [answersModified, setAnswersModified] = useState(false);

  // Fetch existing answers for this lead-product combination
  const { data: existingAnswer } = useLeadProductAnswer(leadId || undefined, product?.id);
  const upsertAnswer = useUpsertLeadProductAnswer();

  // Check if product is manipulado
  const isManipulado = product?.category === 'manipulado';

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

  // Reset manipulado fields when product changes
  useEffect(() => {
    setRequisitionNumber('');
    setManipuladoPrice(0);
    setManipuladoQuantity(1);
  }, [product?.id]);

  if (!product) return null;

  const getPriceForOption = (option: PriceOption): number => {
    switch (option) {
      case '1': return product.price_1_unit;
      case '3': return product.price_3_units;
      case '6': return product.price_6_units;
      case '12': return product.price_12_units;
      case 'custom': return customUnitPrice;
      default: return product.price_1_unit;
    }
  };

  const getQuantityForOption = (option: PriceOption): number => {
    switch (option) {
      case '1': return 1;
      case '3': return 3;
      case '6': return 6;
      case '12': return 12;
      case 'custom': return customQuantity;
      default: return 1;
    }
  };

  // For manipulado, use the manual price and quantity
  const unitPrice = isManipulado ? manipuladoPrice : getPriceForOption(selectedPriceOption);
  const quantity = isManipulado ? manipuladoQuantity : getQuantityForOption(selectedPriceOption);
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
  const isValidPrice = isManipulado 
    ? manipuladoPrice > 0 
    : (unitPrice >= product.minimum_price || product.minimum_price === 0);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const handleConfirm = () => {
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
    setSelectedPriceOption('1');
    setCustomQuantity(1);
    setCustomUnitPrice(0);
    setDiscountValue(0);
    setAnswer1('');
    setAnswer2('');
    setAnswer3('');
    setAnswersModified(false);
    setRequisitionNumber('');
    setManipuladoPrice(0);
    setManipuladoQuantity(1);
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

  const priceOptions = [
    { key: '1' as PriceOption, label: '1 un', price: product.price_1_unit },
    { key: '3' as PriceOption, label: '3 un', price: product.price_3_units },
    { key: '6' as PriceOption, label: '6 un', price: product.price_6_units },
    { key: '12' as PriceOption, label: '12 un', price: product.price_12_units },
  ].filter(opt => opt.price > 0);

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

              {product.minimum_price > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  Preço mínimo: {formatPrice(product.minimum_price)}
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
          ) : (
            /* Price Selection for non-manipulado products */
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Selecione a Quantidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedPriceOption} onValueChange={(v) => setSelectedPriceOption(v as PriceOption)}>
                  <TabsList className="w-full grid grid-cols-5 mb-4">
                    {priceOptions.map(opt => (
                      <TabsTrigger key={opt.key} value={opt.key} className="text-xs">
                        {opt.label}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value="custom" className="text-xs">
                      Outro
                    </TabsTrigger>
                  </TabsList>

                  {priceOptions.map(opt => (
                    <TabsContent key={opt.key} value={opt.key} className="mt-0">
                      <div className="text-center py-4">
                        <p className="text-3xl font-bold text-primary">
                          {formatPrice(opt.price)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          por unidade ({parseInt(opt.key)} {parseInt(opt.key) === 1 ? 'unidade' : 'unidades'})
                        </p>
                      </div>
                    </TabsContent>
                  ))}

                  <TabsContent value="custom" className="mt-0">
                    <div className="grid grid-cols-2 gap-4 py-4">
                      <div>
                        <Label>Quantidade</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCustomQuantity(Math.max(1, customQuantity - 1))}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={customQuantity}
                            onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setCustomQuantity(customQuantity + 1)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Preço Unitário</Label>
                        <CurrencyInput
                          value={customUnitPrice}
                          onChange={setCustomUnitPrice}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
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
              </div>
            </CardContent>
          </Card>

          {!isValidPrice && !isManipulado && product.minimum_price > 0 && (
            <p className="text-sm text-destructive text-center">
              ⚠️ O preço unitário está abaixo do mínimo permitido ({formatPrice(product.minimum_price)})
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
              disabled={!isValidPrice || total <= 0 || (isManipulado && !requisitionNumber)}
            >
              <Check className="w-4 h-4 mr-2" />
              Adicionar à Venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
