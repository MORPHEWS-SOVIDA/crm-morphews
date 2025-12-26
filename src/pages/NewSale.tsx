import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Trash2, 
  Save, 
  Percent, 
  DollarSign,
  ShoppingCart,
  User,
  Eye,
  Pencil,
  AlertTriangle,
  MapPin,
  Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCreateSale, formatCurrency, DeliveryType } from '@/hooks/useSales';
import { LeadSearchSelect } from '@/components/sales/LeadSearchSelect';
import { ProductSelectionDialog } from '@/components/sales/ProductSelectionDialog';
import { DeliveryTypeSelector } from '@/components/sales/DeliveryTypeSelector';

interface SelectedItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
}

interface SelectedLead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  cep: string | null;
  delivery_region_id: string | null;
}

interface DeliveryConfig {
  type: DeliveryType;
  regionId: string | null;
  scheduledDate: Date | null;
  scheduledShift: 'morning' | 'afternoon' | 'full_day' | null;
  carrierId: string | null;
  shippingCost: number;
}

export default function NewSale() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadIdFromUrl = searchParams.get('leadId');
  
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const createSale = useCreateSale();
  
  const [selectedLead, setSelectedLead] = useState<SelectedLead | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Delivery configuration
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
    type: 'pickup',
    regionId: null,
    scheduledDate: null,
    scheduledShift: null,
    carrierId: null,
    shippingCost: 0,
  });

  // Calculate totals
  const subtotal = selectedItems.reduce((sum, item) => {
    return sum + (item.unit_price_cents * item.quantity) - item.discount_cents;
  }, 0);

  let totalDiscount = 0;
  if (discountType === 'percentage' && discountValue > 0) {
    totalDiscount = Math.round(subtotal * (discountValue / 100));
  } else if (discountType === 'fixed') {
    totalDiscount = discountValue;
  }

  const shippingCost = deliveryConfig.shippingCost;
  const total = subtotal - totalDiscount + shippingCost;

  const handleLeadChange = (leadId: string | null, lead: SelectedLead | null) => {
    setSelectedLead(lead);
  };

  const handleOpenProductDialog = (product: Product) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  const handleAddItem = (item: SelectedItem) => {
    // Check if product already exists
    const existingIndex = selectedItems.findIndex(i => i.product_id === item.product_id);
    if (existingIndex >= 0) {
      // Replace existing item
      const newItems = [...selectedItems];
      newItems[existingIndex] = item;
      setSelectedItems(newItems);
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (!selectedLead) {
      toast.error('Selecione um cliente');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    // Validate motoboy delivery requires region
    if (deliveryConfig.type === 'motoboy' && !deliveryConfig.regionId) {
      toast.error('Selecione uma região de entrega para envio por motoboy');
      return;
    }

    if (deliveryConfig.type === 'motoboy' && !deliveryConfig.scheduledDate) {
      toast.error('Selecione uma data de entrega');
      return;
    }

    if (deliveryConfig.type === 'carrier' && !deliveryConfig.carrierId) {
      toast.error('Selecione uma transportadora');
      return;
    }

    try {
      const sale = await createSale.mutateAsync({
        lead_id: selectedLead.id,
        items: selectedItems,
        discount_type: discountValue > 0 ? discountType : null,
        discount_value: discountValue,
        delivery_type: deliveryConfig.type,
        delivery_region_id: deliveryConfig.regionId,
        scheduled_delivery_date: deliveryConfig.scheduledDate?.toISOString().split('T')[0] || null,
        scheduled_delivery_shift: deliveryConfig.scheduledShift,
        shipping_carrier_id: deliveryConfig.carrierId,
        shipping_cost_cents: deliveryConfig.shippingCost,
      });

      navigate(`/vendas`);
    } catch (error) {
      console.error('Error creating sale:', error);
    }
  };

  const activeProducts = products.filter(p => p.is_active);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/vendas')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nova Venda</h1>
              <p className="text-muted-foreground">Crie uma nova venda para um cliente</p>
            </div>
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedLead || selectedItems.length === 0 || createSale.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {createSale.isPending ? 'Salvando...' : 'Criar Venda'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label>Selecione o cliente</Label>
                <LeadSearchSelect
                  value={selectedLead?.id || leadIdFromUrl}
                  onChange={handleLeadChange}
                  placeholder="Buscar cliente por nome ou telefone..."
                />
                
                {selectedLead && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/leads/${selectedLead.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar Cliente
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/leads/${selectedLead.id}/edit`)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar Cliente
                      </Button>
                    </div>

                    {/* Address Warning */}
                    {!selectedLead.street && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                            Endereço não preenchido
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-500">
                            Este cliente não possui endereço cadastrado. Clique em "Editar Cliente" para adicionar.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Client Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">WhatsApp</p>
                        <p className="font-medium">{selectedLead.whatsapp}</p>
                      </div>
                      {selectedLead.email && (
                        <div>
                          <p className="text-muted-foreground">Email</p>
                          <p className="font-medium">{selectedLead.email}</p>
                        </div>
                      )}
                      {selectedLead.street && (
                        <div className="col-span-2">
                          <div className="flex items-center gap-1 text-muted-foreground mb-1">
                            <MapPin className="w-3 h-3" />
                            <span>Endereço</span>
                          </div>
                          <p className="font-medium">
                            {selectedLead.street}, {selectedLead.street_number}
                            {selectedLead.complement && ` - ${selectedLead.complement}`}
                            <br />
                            {selectedLead.neighborhood} - {selectedLead.city}/{selectedLead.state}
                            {selectedLead.cep && ` - CEP: ${selectedLead.cep}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Products Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label>Adicionar Produto</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                    {productsLoading ? (
                      <p className="col-span-full text-sm text-muted-foreground">Carregando produtos...</p>
                    ) : activeProducts.length === 0 ? (
                      <p className="col-span-full text-sm text-muted-foreground">
                        Nenhum produto cadastrado. 
                        <Button variant="link" className="p-0 h-auto ml-1" onClick={() => navigate('/produtos')}>
                          Cadastrar produtos
                        </Button>
                      </p>
                    ) : (
                      activeProducts.map(product => (
                        <Button
                          key={product.id}
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={() => handleOpenProductDialog(product)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {product.name}
                        </Button>
                      ))
                    )}
                  </div>
                </div>

                {selectedItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-right">Preço Un.</TableHead>
                          <TableHead className="text-right">Desconto</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((item) => {
                          const itemTotal = (item.unit_price_cents * item.quantity) - item.discount_cents;
                          return (
                            <TableRow key={item.product_id}>
                              <TableCell className="font-medium">{item.product_name}</TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unit_price_cents)}</TableCell>
                              <TableCell className="text-right text-green-600">
                                {item.discount_cents > 0 ? `-${formatCurrency(item.discount_cents)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(itemTotal)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleRemoveItem(item.product_id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Total Discount */}
            {selectedItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    Desconto Total da Venda
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
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
                    <div className="flex-1 max-w-[200px]">
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

            {/* Delivery Type Selection */}
            {selectedItems.length > 0 && (
              <DeliveryTypeSelector
                leadRegionId={selectedLead?.delivery_region_id || null}
                value={deliveryConfig}
                onChange={setDeliveryConfig}
              />
            )}
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLead ? (
                  <div className="pb-4 border-b">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedLead.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedLead.whatsapp}</p>
                  </div>
                ) : (
                  <div className="pb-4 border-b">
                    <p className="text-sm text-muted-foreground">Nenhum cliente selecionado</p>
                  </div>
                )}

                <div className="pb-4 border-b">
                  <p className="text-sm text-muted-foreground mb-2">Produtos ({selectedItems.length})</p>
                  {selectedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum produto adicionado</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedItems.map(item => (
                        <div key={item.product_id} className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span>{formatCurrency((item.unit_price_cents * item.quantity) - item.discount_cents)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto</span>
                      <span>- {formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(total)}</span>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!selectedLead || selectedItems.length === 0 || createSale.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createSale.isPending ? 'Salvando...' : 'Criar Venda'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ProductSelectionDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        leadId={selectedLead?.id}
        onConfirm={handleAddItem}
      />
    </Layout>
  );
}
