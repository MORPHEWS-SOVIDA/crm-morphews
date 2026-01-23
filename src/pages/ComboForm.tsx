import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Package, Plus, Trash2, DollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProductCombo,
  useCreateProductCombo,
  useUpdateProductCombo,
  useSaveComboItems,
  useSaveComboPrices,
  type ProductComboPrice,
} from '@/hooks/useProductCombos';
import { useProducts } from '@/hooks/useProducts';
import { CurrencyInput } from '@/components/ui/currency-input';

interface ComboItem {
  product_id: string;
  quantity: number;
  productName?: string;
  productPrice?: number;
}

interface ComboMultiplier {
  multiplier: number;
  regular_price_cents: number;
  regular_use_default_commission: boolean;
  regular_custom_commission: number | null;
  promotional_price_cents: number | null;
  promotional_2_price_cents: number | null;
  minimum_price_cents: number | null;
  points: number;
  sales_hack: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export default function ComboForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id && id !== 'novo';

  const { data: combo, isLoading: loadingCombo } = useProductCombo(isEditing ? id : undefined);
  const { data: products = [] } = useProducts();
  const createCombo = useCreateProductCombo();
  const updateCombo = useUpdateProductCombo();
  const saveItems = useSaveComboItems();
  const savePrices = useSaveComboPrices();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<ComboItem[]>([]);
  const [multipliers, setMultipliers] = useState<ComboMultiplier[]>([
    {
      multiplier: 1,
      regular_price_cents: 0,
      regular_use_default_commission: true,
      regular_custom_commission: null,
      promotional_price_cents: null,
      promotional_2_price_cents: null,
      minimum_price_cents: null,
      points: 0,
      sales_hack: '',
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Load data when editing
  useEffect(() => {
    if (combo) {
      setName(combo.name);
      setDescription(combo.description || '');
      setSku(combo.sku || '');
      setIsActive(combo.is_active);
      
      // Load items
      const loadedItems = combo.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        productName: (item.product as any)?.name,
        productPrice: (item.product as any)?.base_price_cents || 0,
      }));
      setItems(loadedItems);

      // Load multipliers
      if (combo.prices.length > 0) {
        setMultipliers(combo.prices.map(p => ({
          multiplier: p.multiplier,
          regular_price_cents: p.regular_price_cents,
          regular_use_default_commission: p.regular_use_default_commission,
          regular_custom_commission: p.regular_custom_commission,
          promotional_price_cents: p.promotional_price_cents,
          promotional_2_price_cents: p.promotional_price_2_cents,
          minimum_price_cents: p.minimum_price_cents,
          points: p.points,
          sales_hack: p.sales_hack || '',
        })));
      }
    }
  }, [combo]);

  // Calculate base price from items
  const calculatedBasePrice = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id);
    const price = (product as any)?.base_price_cents || 0;
    return sum + price * item.quantity;
  }, 0);

  // Update multiplier prices when items change
  useEffect(() => {
    if (items.length > 0) {
      setMultipliers(prev => prev.map(m => ({
        ...m,
        regular_price_cents: calculatedBasePrice * m.multiplier,
      })));
    }
  }, [calculatedBasePrice]);

  // Available products (not already in combo)
  const availableProducts = products.filter(
    p => p.is_active && !items.some(item => item.product_id === p.id)
  );

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setItems([
      ...items,
      {
        product_id: productId,
        quantity: 1,
        productName: product.name,
        productPrice: (product as any).base_price_cents || 0,
      },
    ]);
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, quantity);
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addMultiplier = () => {
    const maxMultiplier = Math.max(...multipliers.map(m => m.multiplier), 0);
    setMultipliers([
      ...multipliers,
      {
        multiplier: maxMultiplier + 1,
        regular_price_cents: calculatedBasePrice * (maxMultiplier + 1),
        regular_use_default_commission: true,
        regular_custom_commission: null,
        promotional_price_cents: null,
        promotional_2_price_cents: null,
        minimum_price_cents: null,
        points: 0,
        sales_hack: '',
      },
    ]);
  };

  const updateMultiplier = (index: number, updates: Partial<ComboMultiplier>) => {
    const newMultipliers = [...multipliers];
    newMultipliers[index] = { ...newMultipliers[index], ...updates };
    setMultipliers(newMultipliers);
  };

  const removeMultiplier = (index: number) => {
    setMultipliers(multipliers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do combo é obrigatório');
      return;
    }
    if (items.length < 2) {
      toast.error('Um combo precisa de pelo menos 2 produtos');
      return;
    }

    setIsSaving(true);
    try {
      let comboId = id;

      if (isEditing) {
        await updateCombo.mutateAsync({
          id: id!,
          name,
          description: description || null,
          sku: sku || null,
          is_active: isActive,
        });
      } else {
        const newCombo = await createCombo.mutateAsync({
          name,
          description: description || undefined,
          sku: sku || undefined,
          is_active: isActive,
        });
        comboId = newCombo.id;
      }

      // Save items
      await saveItems.mutateAsync({
        comboId: comboId!,
        items: items.map((item, index) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          position: index,
        })),
      });

      // Save prices
      await savePrices.mutateAsync({
        comboId: comboId!,
        prices: multipliers.map((m, index) => ({
          multiplier: m.multiplier,
          regular_price_cents: m.regular_price_cents,
          regular_use_default_commission: m.regular_use_default_commission,
          regular_custom_commission: m.regular_custom_commission,
          promotional_price_cents: m.promotional_price_cents,
          promotional_price_2_cents: m.promotional_2_price_cents,
          minimum_price_cents: m.minimum_price_cents,
          points: m.points,
          sales_hack: m.sales_hack || null,
          position: index,
        })),
      });

      toast.success(isEditing ? 'Combo atualizado!' : 'Combo criado!');
      navigate('/produtos/combos');
    } catch (error) {
      console.error('Error saving combo:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing && loadingCombo) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produtos/combos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditing ? 'Editar Combo' : 'Novo Combo'}
            </h1>
            <p className="text-muted-foreground text-sm">
              Configure os produtos e preços do combo
            </p>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Combo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Kit Completo Cabelos"
                />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="COMBO-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do combo..."
                className="min-h-[80px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label>Combo ativo</Label>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos do Combo
            </CardTitle>
            <CardDescription>
              Adicione os produtos que compõem este combo. O preço base será calculado automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add product */}
            <div className="flex gap-2">
              <Select onValueChange={addItem}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Adicionar produto..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                      {(product as any).base_price_cents > 0 && (
                        <span className="text-muted-foreground ml-2">
                          ({formatCurrency((product as any).base_price_cents)})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items list */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Adicione pelo menos 2 produtos ao combo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => {
                  const product = products.find(p => p.id === item.product_id);
                  const price = (product as any)?.base_price_cents || 0;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{product?.name || item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(price)} / un
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Qtd:</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-16 h-8"
                        />
                      </div>
                      <div className="text-right min-w-[80px]">
                        <p className="font-medium text-sm">
                          {formatCurrency(price * item.quantity)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                
                {/* Total */}
                <div className="flex justify-end pt-2 border-t">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Preço base do combo:</p>
                    <p className="text-lg font-bold">{formatCurrency(calculatedBasePrice)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multipliers */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Multiplicadores de Preço
                </CardTitle>
                <CardDescription>
                  Configure preços para Combo ×1, ×2, ×3, etc.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addMultiplier}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {multipliers.map((mult, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    Combo ×{mult.multiplier}
                  </Badge>
                  {multipliers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMultiplier(index)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Preço Normal</Label>
                    <CurrencyInput
                      value={mult.regular_price_cents}
                      onChange={(value) => updateMultiplier(index, { regular_price_cents: value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sugerido: {formatCurrency(calculatedBasePrice * mult.multiplier)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Preço Promocional</Label>
                    <CurrencyInput
                      value={mult.promotional_price_cents || 0}
                      onChange={(value) => updateMultiplier(index, { promotional_price_cents: value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Preço Promocional 2</Label>
                    <CurrencyInput
                      value={mult.promotional_2_price_cents || 0}
                      onChange={(value) => updateMultiplier(index, { promotional_2_price_cents: value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Preço Mínimo</Label>
                    <CurrencyInput
                      value={mult.minimum_price_cents || 0}
                      onChange={(value) => updateMultiplier(index, { minimum_price_cents: value || null })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Pontos de Campanha</Label>
                    <Input
                      type="number"
                      min="0"
                      value={mult.points}
                      onChange={(e) => updateMultiplier(index, { points: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Hack para Vender Mais</Label>
                    <Input
                      value={mult.sales_hack}
                      onChange={(e) => updateMultiplier(index, { sales_hack: e.target.value })}
                      placeholder="Dicas de venda..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/produtos/combos')}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Salvar Alterações' : 'Criar Combo'}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
