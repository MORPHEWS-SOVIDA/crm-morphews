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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Truck,
  UserCheck,
  CreditCard,
  Banknote,
  Calendar,
  Upload,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useProducts, Product } from '@/hooks/useProducts';
import { useCreateSale, formatCurrency, DeliveryType } from '@/hooks/useSales';
import { LeadSearchSelect } from '@/components/sales/LeadSearchSelect';
import { ProductSelectionDialog } from '@/components/sales/ProductSelectionDialog';
import { ProductSelectorForSale } from '@/components/products/ProductSelectorForSale';
import { DeliveryTypeSelector } from '@/components/sales/DeliveryTypeSelector';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useActivePaymentMethods, PaymentMethod, PAYMENT_TIMING_LABELS } from '@/hooks/usePaymentMethods';
import { supabase } from '@/integrations/supabase/client';

interface SelectedItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  requisition_number?: string | null;
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
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: paymentMethods = [] } = useActivePaymentMethods();
  const { user } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const createSale = useCreateSale();
  
  // Permission check
  const canCreateSale = permissions?.sales_create;
  
  // Redirect if no permission
  if (!permissionsLoading && !canCreateSale) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para criar vendas.</p>
          <Button onClick={() => navigate('/vendas')}>Voltar para Vendas</Button>
        </div>
      </Layout>
    );
  }
  
  const [selectedLead, setSelectedLead] = useState<SelectedLead | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);
  
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Set current user as default seller
  useEffect(() => {
    if (user?.id && !sellerUserId) {
      setSellerUserId(user.id);
    }
  }, [user?.id, sellerUserId]);

  // Delivery configuration
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
    type: 'pickup',
    regionId: null,
    scheduledDate: null,
    scheduledShift: null,
    carrierId: null,
    shippingCost: 0,
  });

  // Payment method selection
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  
  // Payment status at creation
  const [paymentStatus, setPaymentStatus] = useState<'not_paid' | 'will_pay_before' | 'paid_now'>('not_paid');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
  
  // Calculate available installments based on total and min_installment_value
  const getAvailableInstallments = () => {
    if (!selectedPaymentMethod || selectedPaymentMethod.payment_timing !== 'installments') return [1];
    const maxByValue = selectedPaymentMethod.min_installment_value_cents > 0
      ? Math.floor(total / selectedPaymentMethod.min_installment_value_cents)
      : selectedPaymentMethod.max_installments;
    const maxInstallments = Math.min(selectedPaymentMethod.max_installments, maxByValue);
    return Array.from({ length: Math.max(1, maxInstallments) }, (_, i) => i + 1);
  };

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

    // Validate payment proof if paid_now is selected
    if (paymentStatus === 'paid_now' && !paymentProofFile) {
      toast.error('Anexe o comprovante de pagamento');
      return;
    }

    try {
      let uploadedProofUrl: string | null = null;
      
      // Upload payment proof if provided
      if (paymentProofFile && paymentStatus === 'paid_now') {
        setIsUploadingProof(true);
        const fileExt = paymentProofFile.name.split('.').pop();
        const fileName = `payment_proof_${Date.now()}.${fileExt}`;
        const filePath = `temp/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('sales-documents')
          .upload(filePath, paymentProofFile);
        
        if (uploadError) {
          toast.error('Erro ao fazer upload do comprovante');
          setIsUploadingProof(false);
          return;
        }
        
        uploadedProofUrl = filePath;
        setIsUploadingProof(false);
      }

      const sale = await createSale.mutateAsync({
        lead_id: selectedLead.id,
        seller_user_id: sellerUserId,
        items: selectedItems,
        discount_type: discountValue > 0 ? discountType : null,
        discount_value: discountValue,
        delivery_type: deliveryConfig.type,
        delivery_region_id: deliveryConfig.regionId,
        scheduled_delivery_date: deliveryConfig.scheduledDate?.toISOString().split('T')[0] || null,
        scheduled_delivery_shift: deliveryConfig.scheduledShift,
        shipping_carrier_id: deliveryConfig.carrierId,
        shipping_cost_cents: deliveryConfig.shippingCost,
        payment_method_id: selectedPaymentMethodId,
        payment_installments: selectedInstallments,
        payment_status: paymentStatus,
        payment_proof_url: uploadedProofUrl,
      });

      navigate(`/vendas`);
    } catch (error) {
      console.error('Error creating sale:', error);
    }
  };

  

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
              <CardContent className="space-y-4">
                <div>
                  <Label>Selecione o cliente</Label>
                  <LeadSearchSelect
                    value={selectedLead?.id || leadIdFromUrl}
                    onChange={handleLeadChange}
                    placeholder="Buscar cliente por nome ou telefone..."
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Vendedor responsável pela venda
                  </Label>
                  <Select
                    value={sellerUserId || ''}
                    onValueChange={(value) => setSellerUserId(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o vendedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
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
                  <div className="mt-2">
                    <ProductSelectorForSale
                      products={products}
                      isLoading={productsLoading}
                      onSelect={handleOpenProductDialog}
                      placeholder="Buscar produto por nome..."
                      emptyAction={() => navigate('/produtos')}
                    />
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
                              <TableCell className="font-medium">
                                {item.product_name}
                                {item.requisition_number && (
                                  <span className="block text-xs text-amber-600">
                                    Req: {item.requisition_number}
                                  </span>
                                )}
                              </TableCell>
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

            {/* Payment Method Selection */}
            {selectedItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Forma de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma forma de pagamento cadastrada.</p>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto" 
                        onClick={() => navigate('/configuracoes')}
                      >
                        Cadastrar formas de pagamento
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {paymentMethods.map((pm) => (
                          <Button
                            key={pm.id}
                            type="button"
                            variant={selectedPaymentMethodId === pm.id ? 'default' : 'outline'}
                            className="h-auto py-3 px-4 flex flex-col items-start gap-1"
                            onClick={() => {
                              setSelectedPaymentMethodId(pm.id);
                              setSelectedInstallments(1);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {pm.payment_timing === 'cash' && <Banknote className="w-4 h-4" />}
                              {pm.payment_timing === 'term' && <Calendar className="w-4 h-4" />}
                              {pm.payment_timing === 'installments' && <CreditCard className="w-4 h-4" />}
                              <span className="font-medium">{pm.name}</span>
                            </div>
                            <span className="text-xs opacity-70">
                              {PAYMENT_TIMING_LABELS[pm.payment_timing]}
                              {pm.payment_timing === 'installments' && ` até ${pm.max_installments}x`}
                            </span>
                          </Button>
                        ))}
                      </div>

                      {/* Installments selector */}
                      {selectedPaymentMethod?.payment_timing === 'installments' && (
                        <div className="pt-2 border-t">
                          <Label>Número de Parcelas</Label>
                          <Select
                            value={String(selectedInstallments)}
                            onValueChange={(value) => setSelectedInstallments(Number(value))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableInstallments().map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}x de {formatCurrency(Math.ceil(total / n))}
                                  {n === 1 ? ' (à vista)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedPaymentMethod.min_installment_value_cents > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Parcela mínima: {formatCurrency(selectedPaymentMethod.min_installment_value_cents)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Payment method details */}
                      {selectedPaymentMethod && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {selectedPaymentMethod.fee_percentage > 0 && (
                            <Badge variant="outline">
                              Taxa: {selectedPaymentMethod.fee_percentage}%
                            </Badge>
                          )}
                          {selectedPaymentMethod.settlement_days > 0 && (
                            <Badge variant="outline">
                              Compensação: {selectedPaymentMethod.settlement_days} dias
                            </Badge>
                          )}
                          {selectedPaymentMethod.requires_proof && (
                            <Badge variant="outline">
                              Exige comprovante
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment Status at Creation */}
            {selectedItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Venda está paga?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {/* Option 1: Not paid */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="not_paid"
                        checked={paymentStatus === 'not_paid'}
                        onChange={() => {
                          setPaymentStatus('not_paid');
                          setPaymentProofFile(null);
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Não</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Cliente ainda não efetuou o pagamento
                        </p>
                      </div>
                    </label>

                    {/* Option 2: Will pay before receiving */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="will_pay_before"
                        checked={paymentStatus === 'will_pay_before'}
                        onChange={() => {
                          setPaymentStatus('will_pay_before');
                          setPaymentProofFile(null);
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="font-medium">Cliente vai pagar antes de receber</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Expedição só poderá enviar após comprovante anexado
                        </p>
                      </div>
                    </label>

                    {/* Option 3: Paid now - attach proof */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="radio"
                        name="paymentStatus"
                        value="paid_now"
                        checked={paymentStatus === 'paid_now'}
                        onChange={() => setPaymentStatus('paid_now')}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium">Sim, anexar comprovante agora</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Cliente já pagou - anexe o comprovante
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* File upload for paid_now option */}
                  {paymentStatus === 'paid_now' && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <Label className="flex items-center gap-2 mb-2">
                        <Upload className="w-4 h-4" />
                        Comprovante de Pagamento *
                      </Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      {paymentProofFile && (
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {paymentProofFile.name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Warning for will_pay_before */}
                  {paymentStatus === 'will_pay_before' && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                          Atenção
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-500">
                          A expedição não poderá despachar esta venda sem o comprovante de pagamento anexado.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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
