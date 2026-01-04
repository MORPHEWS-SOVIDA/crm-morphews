import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  Search, 
  Loader2, 
  User, 
  MessageSquare, 
  Package, 
  ClipboardList,
  FileText,
  DollarSign,
  MapPin,
  ShoppingCart,
  ThumbsDown,
  CheckCircle,
  ArrowRight,
  Calendar,
  Coins,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  UserCheck,
  CreditCard,
  Clock,
  Upload,
  Truck,
  Check,
  ChevronDown,
  ChevronUp,
  Star,
  Plus,
  Trash2,
  Gift
} from 'lucide-react';
import { 
  useReceptiveModuleAccess, 
  useSearchLeadByPhone, 
  useCreateReceptiveAttendance,
  useUpdateReceptiveAttendance,
  CONVERSATION_MODES 
} from '@/hooks/useReceptiveModule';
import { useLeadSources } from '@/hooks/useConfigOptions';
import { useProducts, Product } from '@/hooks/useProducts';
import { ProductSelectorForSale } from '@/components/products/ProductSelectorForSale';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useProductPriceKits } from '@/hooks/useProductPriceKits';
import { useKitRejections, useCreateKitRejection } from '@/hooks/useKitRejections';
import { useLeadProductAnswer } from '@/hooks/useLeadProductAnswers';
import { useMyCommission } from '@/hooks/useSellerCommission';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useUsers } from '@/hooks/useUsers';
import { useActivePaymentMethods, PAYMENT_TIMING_LABELS } from '@/hooks/usePaymentMethods';
import { useCreateSale, DeliveryType } from '@/hooks/useSales';
import { DeliveryTypeSelector } from '@/components/sales/DeliveryTypeSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddressFields } from '@/components/AddressFields';

type FlowStep = 'phone' | 'lead_info' | 'conversation' | 'product' | 'questions' | 'offer' | 'address' | 'payment' | 'sale_or_reason';

interface LeadData {
  id?: string;
  name: string;
  whatsapp: string;
  email: string;
  instagram: string;
  specialty: string;
  lead_source: string;
  observations: string;
  cep: string;
  street: string;
  street_number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  secondary_phone: string;
  cpf_cnpj: string;
  existed: boolean;
  created_at?: string;
  delivery_region_id?: string | null;
}

interface DeliveryConfig {
  type: DeliveryType;
  regionId: string | null;
  scheduledDate: Date | null;
  scheduledShift: 'morning' | 'afternoon' | 'full_day' | null;
  carrierId: string | null;
  shippingCost: number;
}

interface CartItem {
  productId: string;
  productName: string;
  productCategory: string;
  kitId: string | null;
  priceType: 'regular' | 'promotional' | 'promotional_2' | 'minimum' | 'custom';
  quantity: number;
  unitPriceCents: number;
  commissionPercentage: number;
  commissionCents: number;
  requisitionNumber?: string;
}

const initialLeadData: LeadData = {
  name: '',
  whatsapp: '',
  email: '',
  instagram: '',
  specialty: '',
  lead_source: '',
  observations: '',
  cep: '',
  street: '',
  street_number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  secondary_phone: '',
  cpf_cnpj: '',
  existed: false,
};

export default function AddReceptivo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { data: accessInfo, isLoading: loadingAccess } = useReceptiveModuleAccess();
  const { data: leadSources = [] } = useLeadSources();
  const { data: products = [] } = useProducts();
  const { data: nonPurchaseReasons = [] } = useNonPurchaseReasons();
  const { data: funnelStages = [] } = useFunnelStages();
  const { data: users = [] } = useUsers();
  const { data: paymentMethods = [] } = useActivePaymentMethods();
  const { data: myCommission } = useMyCommission();
  const searchLead = useSearchLeadByPhone();
  const createAttendance = useCreateReceptiveAttendance();
  const updateAttendance = useUpdateReceptiveAttendance();
  const createSale = useCreateSale();

  const [currentStep, setCurrentStep] = useState<FlowStep>('phone');
  const [phoneInput, setPhoneInput] = useState('55');
  const [leadData, setLeadData] = useState<LeadData>(initialLeadData);
  const [conversationMode, setConversationMode] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productAnswers, setProductAnswers] = useState<Record<string, string>>({});
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sourceHistory, setSourceHistory] = useState<Array<{
    id: string;
    source_name: string;
    recorded_at: string;
  }>>([]);

  // Cart state (multiple products)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Kit selection state
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [selectedPriceType, setSelectedPriceType] = useState<'regular' | 'promotional' | 'promotional_2' | 'minimum'>('promotional');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [rejectedKitIds, setRejectedKitIds] = useState<string[]>([]);
  const [showPromo2, setShowPromo2] = useState(false);
  const [showMinimum, setShowMinimum] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  
  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);
  
  // Manipulado fields
  const [requisitionNumber, setRequisitionNumber] = useState('');
  const [manipuladoPrice, setManipuladoPrice] = useState<number>(0);
  const [manipuladoQuantity, setManipuladoQuantity] = useState<number>(1);

  // Delivery config
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
    type: 'pickup',
    regionId: null,
    scheduledDate: null,
    scheduledShift: null,
    carrierId: null,
    shippingCost: 0,
  });

  // Payment config
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  const [paymentStatus, setPaymentStatus] = useState<'not_paid' | 'will_pay_before' | 'paid_now'>('not_paid');
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
  
  // Fetch price kits for the selected product
  const { data: productPriceKits = [] } = useProductPriceKits(selectedProductId || undefined);
  const sortedKits = useMemo(() => [...productPriceKits].sort((a, b) => a.position - b.position), [productPriceKits]);

  // Fetch kit rejections for this lead/product
  const { data: existingRejections = [] } = useKitRejections(leadData.id, selectedProductId || undefined);
  const createKitRejection = useCreateKitRejection();
  
  // Fetch existing product answers
  const { data: existingAnswers } = useLeadProductAnswer(leadData.id, selectedProductId || undefined);

  // Set default seller
  useEffect(() => {
    if (user?.id && !sellerUserId) {
      setSellerUserId(user.id);
    }
  }, [user?.id, sellerUserId]);

  // Load existing answers when product changes
  useEffect(() => {
    if (existingAnswers) {
      setProductAnswers({
        answer_1: existingAnswers.answer_1 || '',
        answer_2: existingAnswers.answer_2 || '',
        answer_3: existingAnswers.answer_3 || '',
      });
    } else {
      setProductAnswers({});
    }
  }, [existingAnswers]);

  // Load existing rejections
  useEffect(() => {
    if (existingRejections.length > 0) {
      setRejectedKitIds(existingRejections.map(r => r.kit_id));
    }
  }, [existingRejections]);

  // Auto-select first non-rejected kit
  useEffect(() => {
    if (sortedKits.length > 0 && !selectedKitId) {
      const firstAvailable = sortedKits.find(k => !rejectedKitIds.includes(k.id));
      if (firstAvailable) {
        setSelectedKitId(firstAvailable.id);
        // Default to promotional if available, else regular
        if (firstAvailable.promotional_price_cents) {
          setSelectedPriceType('promotional');
        } else {
          setSelectedPriceType('regular');
        }
      }
    }
  }, [sortedKits, rejectedKitIds, selectedKitId]);

  // Load source history when lead is found
  useEffect(() => {
    if (leadData.id && tenantId) {
      loadSourceHistory(leadData.id);
    }
  }, [leadData.id, tenantId]);

  const loadSourceHistory = async (leadId: string) => {
    const { data, error } = await supabase
      .from('lead_source_history')
      .select(`
        id,
        recorded_at,
        lead_sources!inner(name)
      `)
      .eq('lead_id', leadId)
      .order('recorded_at', { ascending: false })
      .limit(5);
    
    if (!error && data) {
      setSourceHistory(data.map((entry: any) => ({
        id: entry.id,
        source_name: entry.lead_sources?.name || 'Desconhecido',
        recorded_at: entry.recorded_at,
      })));
    }
  };

  // Check access
  if (loadingAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!accessInfo?.hasAccess) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <ThumbsDown className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso não disponível</h1>
          <p className="text-muted-foreground max-w-md">
            O módulo "Add Receptivo" não está habilitado para sua organização ou você não tem permissão de acesso.
          </p>
        </div>
      </Layout>
    );
  }

  // Calculate selected values
  const getSelectedValues = () => {
    if (selectedProduct?.category === 'manipulado') {
      return {
        quantity: manipuladoQuantity,
        unitPrice: manipuladoPrice,
        commission: myCommission?.commissionPercentage || 0,
      };
    }

    const selectedKit = sortedKits.find(k => k.id === selectedKitId);
    if (!selectedKit) {
      return { quantity: 1, unitPrice: 0, commission: 0 };
    }

    let price = selectedKit.regular_price_cents;
    let commission = myCommission?.commissionPercentage || 0;
    let useDefault = selectedKit.regular_use_default_commission;
    let customComm = selectedKit.regular_custom_commission;

    switch (selectedPriceType) {
      case 'promotional':
        price = selectedKit.promotional_price_cents || selectedKit.regular_price_cents;
        useDefault = selectedKit.promotional_use_default_commission;
        customComm = selectedKit.promotional_custom_commission;
        break;
      case 'promotional_2':
        price = selectedKit.promotional_price_2_cents || selectedKit.regular_price_cents;
        useDefault = selectedKit.promotional_2_use_default_commission;
        customComm = selectedKit.promotional_2_custom_commission;
        break;
      case 'minimum':
        price = selectedKit.minimum_price_cents || selectedKit.regular_price_cents;
        useDefault = selectedKit.minimum_use_default_commission;
        customComm = selectedKit.minimum_custom_commission;
        break;
    }

    if (!useDefault && customComm !== null) {
      commission = customComm;
    }

    return {
      quantity: selectedKit.quantity,
      unitPrice: customPrice > 0 ? customPrice : price,
      commission,
    };
  };

  const { quantity, unitPrice, commission } = getSelectedValues();
  
  // Calculate cart totals
  const cartSubtotal = cartItems.reduce((acc, item) => acc + (item.unitPriceCents * item.quantity), 0);
  const currentItemSubtotal = unitPrice * quantity;
  const subtotal = cartSubtotal + currentItemSubtotal;
  
  let totalDiscount = 0;
  if (discountType === 'percentage' && discountValue > 0) {
    totalDiscount = Math.round(subtotal * (discountValue / 100));
  } else if (discountType === 'fixed') {
    totalDiscount = discountValue;
  }

  const shippingCost = deliveryConfig.shippingCost;
  const total = subtotal - totalDiscount + shippingCost;
  
  // Calculate total commission from cart + current item
  const cartCommission = cartItems.reduce((acc, item) => acc + item.commissionCents, 0);
  const currentCommissionValue = Math.round(currentItemSubtotal * (commission / 100));
  const totalCommissionValue = cartCommission + currentCommissionValue;

  // Get available installments
  const getAvailableInstallments = () => {
    if (!selectedPaymentMethod || selectedPaymentMethod.payment_timing !== 'installments') return [1];
    const maxByValue = selectedPaymentMethod.min_installment_value_cents > 0
      ? Math.floor(total / selectedPaymentMethod.min_installment_value_cents)
      : selectedPaymentMethod.max_installments;
    const maxInstallments = Math.min(selectedPaymentMethod.max_installments, maxByValue);
    return Array.from({ length: Math.max(1, maxInstallments) }, (_, i) => i + 1);
  };

  const formatPrice = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  // Add current product to cart
  const handleAddToCart = () => {
    if (!selectedProduct || !unitPrice) return;
    
    const newItem: CartItem = {
      productId: selectedProductId,
      productName: selectedProduct.name,
      productCategory: selectedProduct.category,
      kitId: selectedKitId,
      priceType: customPrice > 0 ? 'custom' : selectedPriceType,
      quantity: selectedProduct.category === 'manipulado' ? manipuladoQuantity : quantity,
      unitPriceCents: unitPrice,
      commissionPercentage: commission,
      commissionCents: Math.round((unitPrice * quantity) * (commission / 100)),
      requisitionNumber: selectedProduct.category === 'manipulado' ? requisitionNumber : undefined,
    };
    
    setCartItems(prev => [...prev, newItem]);
    
    // Reset for new product selection
    setSelectedProductId('');
    setSelectedKitId(null);
    setRejectedKitIds([]);
    setShowPromo2(false);
    setShowMinimum(false);
    setCustomPrice(0);
    setRequisitionNumber('');
    setManipuladoPrice(0);
    setManipuladoQuantity(1);
    setShowAddProduct(false);
    
    toast({ title: 'Produto adicionado ao carrinho!' });
  };

  // Remove item from cart
  const handleRemoveFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  // Get cross-sell products for the selected product
  const getCrossSellProducts = () => {
    if (!selectedProduct) return [];
    const crossSellIds = [
      selectedProduct.crosssell_product_1_id,
      selectedProduct.crosssell_product_2_id
    ].filter(Boolean);
    
    // Also include cross-sell from cart items
    cartItems.forEach(item => {
      const cartProduct = products.find(p => p.id === item.productId);
      if (cartProduct) {
        if (cartProduct.crosssell_product_1_id) crossSellIds.push(cartProduct.crosssell_product_1_id);
        if (cartProduct.crosssell_product_2_id) crossSellIds.push(cartProduct.crosssell_product_2_id);
      }
    });
    
    // Filter out products already in cart or currently selected
    const inCartIds = cartItems.map(item => item.productId);
    return products.filter(p => 
      crossSellIds.includes(p.id) && 
      p.id !== selectedProductId && 
      !inCartIds.includes(p.id) &&
      p.is_active
    );
  };

  const handlePhoneSearch = async () => {
    if (phoneInput.length < 12) {
      toast({ title: 'Digite um telefone válido', variant: 'destructive' });
      return;
    }

    try {
      const result = await searchLead.mutateAsync(phoneInput);
      
      if (result.lead) {
        setLeadData({
          id: result.lead.id,
          name: result.lead.name || '',
          whatsapp: result.lead.whatsapp || '',
          email: result.lead.email || '',
          instagram: result.lead.instagram || '',
          specialty: result.lead.specialty || '',
          lead_source: result.lead.lead_source || '',
          observations: result.lead.observations || '',
          cep: result.lead.cep || '',
          street: result.lead.street || '',
          street_number: result.lead.street_number || '',
          complement: result.lead.complement || '',
          neighborhood: result.lead.neighborhood || '',
          city: result.lead.city || '',
          state: result.lead.state || '',
          secondary_phone: result.lead.secondary_phone || '',
          cpf_cnpj: result.lead.cpf_cnpj || '',
          existed: true,
          created_at: result.lead.created_at,
        });
        setSelectedSourceId(result.lead.lead_source || '');
        toast({ title: 'Lead encontrado!', description: result.lead.name });
      } else {
        setLeadData({
          ...initialLeadData,
          whatsapp: result.phoneSearched,
          existed: false,
        });
        toast({ title: 'Novo lead', description: 'Cliente não encontrado no sistema' });
      }
      
      setCurrentStep('lead_info');
    } catch (error: any) {
      toast({ title: 'Erro na busca', description: error.message, variant: 'destructive' });
    }
  };

  const handleGoToConversation = () => setCurrentStep('conversation');

  const handleGoToProduct = async () => {
    if (!conversationMode) {
      toast({ title: 'Selecione o modo de conversa', variant: 'destructive' });
      return;
    }

    // Create attendance record
    if (!attendanceId && tenantId && user) {
      try {
        const result = await createAttendance.mutateAsync({
          organization_id: tenantId,
          user_id: user.id,
          lead_id: leadData.id || null,
          phone_searched: leadData.whatsapp,
          lead_existed: leadData.existed,
          conversation_mode: conversationMode,
          product_id: null,
          product_answers: null,
          sale_id: null,
          non_purchase_reason_id: null,
          completed: false,
        });
        setAttendanceId(result.id);
      } catch (error) {
        // Continue anyway
      }
    }

    setCurrentStep('product');
  };

  const handleGoToQuestions = () => {
    if (!selectedProductId) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    setCurrentStep('questions');
  };

  const handleGoToOffer = () => setCurrentStep('offer');
  const handleGoToAddress = () => setCurrentStep('address');
  const handleGoToPayment = () => {
    // Validate delivery config
    if (deliveryConfig.type === 'motoboy' && !deliveryConfig.regionId) {
      toast({ title: 'Selecione uma região de entrega', variant: 'destructive' });
      return;
    }
    if (deliveryConfig.type === 'motoboy' && !deliveryConfig.scheduledDate) {
      toast({ title: 'Selecione uma data de entrega', variant: 'destructive' });
      return;
    }
    if (deliveryConfig.type === 'carrier' && !deliveryConfig.carrierId) {
      toast({ title: 'Selecione uma transportadora', variant: 'destructive' });
      return;
    }
    setCurrentStep('payment');
  };
  const handleGoToSaleOrReason = () => setCurrentStep('sale_or_reason');

  const handleRejectKit = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' });
      return;
    }

    const currentKit = sortedKits.find(k => k.id === selectedKitId);
    if (!currentKit || !leadData.id) return;

    try {
      await createKitRejection.mutateAsync({
        lead_id: leadData.id,
        product_id: selectedProductId,
        kit_id: currentKit.id,
        kit_quantity: currentKit.quantity,
        kit_price_cents: unitPrice,
        rejection_reason: rejectionReason,
      });

      setRejectedKitIds(prev => [...prev, currentKit.id]);
      setRejectionReason('');
      setShowRejectionInput(false);
      setSelectedKitId(null);
      setShowPromo2(false);
      setShowMinimum(false);
      
      toast({ title: 'Kit rejeitado', description: 'Próxima oferta disponível' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const ensureLeadExists = async (): Promise<string | null> => {
    let leadId = leadData.id;
    
    if (!leadId && tenantId && user) {
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          organization_id: tenantId,
          assigned_to: user.id,
          created_by: user.id,
          name: leadData.name || 'Novo Cliente',
          whatsapp: leadData.whatsapp,
          email: leadData.email || null,
          instagram: leadData.instagram || null,
          specialty: leadData.specialty || null,
          lead_source: selectedSourceId || null,
          observations: leadData.observations || null,
          cep: leadData.cep || null,
          street: leadData.street || null,
          street_number: leadData.street_number || null,
          complement: leadData.complement || null,
          neighborhood: leadData.neighborhood || null,
          city: leadData.city || null,
          state: leadData.state || null,
          secondary_phone: leadData.secondary_phone || null,
          cpf_cnpj: leadData.cpf_cnpj || null,
          stage: 'prospect',
        })
        .select()
        .single();

      if (leadError) throw leadError;
      leadId = newLead.id;
      setLeadData(prev => ({ ...prev, id: leadId }));
    } else if (leadId) {
      // Update existing lead
      await supabase
        .from('leads')
        .update({
          name: leadData.name,
          email: leadData.email || null,
          instagram: leadData.instagram || null,
          specialty: leadData.specialty || null,
          lead_source: selectedSourceId || leadData.lead_source || null,
          observations: leadData.observations || null,
          cep: leadData.cep || null,
          street: leadData.street || null,
          street_number: leadData.street_number || null,
          complement: leadData.complement || null,
          neighborhood: leadData.neighborhood || null,
          city: leadData.city || null,
          state: leadData.state || null,
          secondary_phone: leadData.secondary_phone || null,
          cpf_cnpj: leadData.cpf_cnpj || null,
        })
        .eq('id', leadId);
    }

    return leadId || null;
  };

  const saveProductAnswers = async (leadId: string) => {
    if (selectedProductId && tenantId && Object.values(productAnswers).some(v => v)) {
      await supabase
        .from('lead_product_answers')
        .upsert({
          lead_id: leadId,
          product_id: selectedProductId,
          organization_id: tenantId,
          answer_1: productAnswers.answer_1 || null,
          answer_2: productAnswers.answer_2 || null,
          answer_3: productAnswers.answer_3 || null,
          updated_by: user?.id || null,
        }, {
          onConflict: 'lead_id,product_id',
        });
    }
  };

  const handleCreateSale = async () => {
    setIsSaving(true);
    
    try {
      const leadId = await ensureLeadExists();
      if (!leadId) throw new Error('Erro ao criar lead');

      await saveProductAnswers(leadId);

      // Save source to history
      if (selectedSourceId && tenantId && user) {
        await supabase.from('lead_source_history').insert({
          lead_id: leadId,
          organization_id: tenantId,
          source_id: selectedSourceId,
          recorded_by: user.id,
        });
      }

      // Build all sale items from cart + current selection
      const allItems = [];
      
      // Add cart items
      for (const cartItem of cartItems) {
        allItems.push({
          product_id: cartItem.productId,
          product_name: cartItem.productName,
          quantity: cartItem.quantity,
          unit_price_cents: cartItem.unitPriceCents,
          discount_cents: 0,
          requisition_number: cartItem.requisitionNumber || null,
          commission_percentage: cartItem.commissionPercentage,
          commission_cents: cartItem.commissionCents,
        });
      }

      // Add current item if selected
      if (selectedProductId && unitPrice > 0) {
        allItems.push({
          product_id: selectedProductId,
          product_name: selectedProduct?.name || 'Produto',
          quantity,
          unit_price_cents: unitPrice,
          discount_cents: allItems.length === 0 ? totalDiscount : 0, // Apply total discount to first item
          requisition_number: selectedProduct?.category === 'manipulado' ? requisitionNumber : null,
          commission_percentage: commission,
          commission_cents: currentCommissionValue,
        });
      }

      if (allItems.length === 0) {
        throw new Error('Nenhum produto selecionado');
      }

      const sale = await createSale.mutateAsync({
        lead_id: leadId,
        seller_user_id: sellerUserId,
        items: allItems,
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
        payment_proof_url: null,
      });

      // Update attendance
      if (attendanceId) {
        await updateAttendance.mutateAsync({
          id: attendanceId,
          updates: {
            lead_id: leadId,
            product_id: selectedProductId || cartItems[0]?.productId || null,
            product_answers: Object.keys(productAnswers).length > 0 ? productAnswers : null,
            sale_id: sale.id,
            completed: true,
          },
        });
      }

      toast({ 
        title: 'Venda criada com sucesso!', 
        description: `Romaneio #${sale.romaneio_number}` 
      });
      
      navigate(`/vendas/${sale.id}`);
    } catch (error: any) {
      toast({ title: 'Erro ao criar venda', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectReason = async (reasonId: string) => {
    setSelectedReasonId(reasonId);
    setIsSaving(true);

    try {
      const reason = nonPurchaseReasons.find(r => r.id === reasonId);
      const leadId = await ensureLeadExists();
      
      if (leadId) {
        await saveProductAnswers(leadId);

        // Save source to history
        if (selectedSourceId && tenantId && user) {
          await supabase.from('lead_source_history').insert({
            lead_id: leadId,
            organization_id: tenantId,
            source_id: selectedSourceId,
            recorded_by: user.id,
          });
        }
      }

      // Update attendance
      if (attendanceId) {
        await updateAttendance.mutateAsync({
          id: attendanceId,
          updates: {
            lead_id: leadId,
            product_id: selectedProductId || null,
            product_answers: Object.keys(productAnswers).length > 0 ? productAnswers : null,
            non_purchase_reason_id: reasonId,
            completed: true,
          },
        });
      }

      toast({ 
        title: 'Atendimento finalizado', 
        description: `Motivo: ${reason?.name}` 
      });
      
      navigate('/');
    } catch (error: any) {
      toast({ title: 'Erro ao finalizar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Get the current visible kit (first non-rejected)
  const currentVisibleKit = sortedKits.find(k => !rejectedKitIds.includes(k.id));
  const hasMoreKits = sortedKits.filter(k => !rejectedKitIds.includes(k.id)).length > 1;
  const allKitsRejected = sortedKits.every(k => rejectedKitIds.includes(k.id));

  const renderStepIndicator = () => {
    const steps = [
      { key: 'phone', label: 'Telefone', icon: Phone },
      { key: 'lead_info', label: 'Cliente', icon: User },
      { key: 'conversation', label: 'Conversa', icon: MessageSquare },
      { key: 'product', label: 'Produto', icon: Package },
      { key: 'questions', label: 'Entrevista', icon: ClipboardList },
      { key: 'offer', label: 'Oferta', icon: DollarSign },
      { key: 'address', label: 'Entrega', icon: Truck },
      { key: 'payment', label: 'Pagamento', icon: CreditCard },
      { key: 'sale_or_reason', label: 'Finalizar', icon: ShoppingCart },
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isPast = index < currentIndex;
          
          return (
            <div key={step.key} className="flex items-center">
              <button 
                onClick={() => isPast && setCurrentStep(step.key as FlowStep)}
                disabled={!isPast}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : isPast 
                      ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30 cursor-pointer' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isPast ? <CheckCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderNavButtons = (onBack?: () => void, onNext?: () => void, nextDisabled?: boolean, nextLabel?: string) => (
    <div className="flex justify-between gap-2">
      {onBack ? (
        <Button variant="outline" onClick={onBack}>Voltar</Button>
      ) : <div />}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel || 'Continuar'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );

  // Commission badge component
  const CommissionBadge = ({ value }: { value: number }) => {
    const defaultComm = myCommission?.commissionPercentage || 0;
    const isGood = value >= defaultComm;
    return (
      <Badge variant="outline" className={`text-xs ${isGood ? 'text-green-600 border-green-600' : 'text-amber-600 border-amber-600'}`}>
        {isGood ? '🤩' : '☹️'} {value}%
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Add Receptivo</h1>
          <p className="text-muted-foreground mt-1">Atendimento guiado para novos leads</p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Phone Step */}
        {currentStep === 'phone' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Telefone do Cliente
              </CardTitle>
              <CardDescription>Digite o DDD + número do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="5551999999999"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handlePhoneSearch()}
                  className="text-lg font-mono"
                  autoFocus
                />
                <Button 
                  onClick={handlePhoneSearch} 
                  disabled={searchLead.isPending || phoneInput.length < 12}
                >
                  {searchLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Formato: 55 (DDI) + DDD + Número. Ex: 5551999887766
              </p>
            </CardContent>
          </Card>
        )}

        {/* Lead Info Step */}
        {currentStep === 'lead_info' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Dados do Cliente
                {leadData.existed && (
                  <Badge variant="secondary">
                    Cadastrado em {leadData.created_at && format(new Date(leadData.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderNavButtons(undefined, handleGoToConversation)}
              <Separator />

              {/* Basic Info */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      value={leadData.name}
                      onChange={(e) => setLeadData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input value={leadData.whatsapp} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone Secundário</Label>
                    <Input
                      value={leadData.secondary_phone}
                      onChange={(e) => setLeadData(prev => ({ ...prev, secondary_phone: e.target.value }))}
                      placeholder="Outro telefone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={leadData.email}
                      onChange={(e) => setLeadData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram</Label>
                    <Input
                      value={leadData.instagram}
                      onChange={(e) => setLeadData(prev => ({ ...prev, instagram: e.target.value }))}
                      placeholder="@usuario"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Especialidade/Área</Label>
                    <Input
                      value={leadData.specialty}
                      onChange={(e) => setLeadData(prev => ({ ...prev, specialty: e.target.value }))}
                      placeholder="Ex: Dermatologia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Input
                      value={leadData.cpf_cnpj}
                      onChange={(e) => setLeadData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Observations */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Observações
                </h3>
                <Textarea
                  value={leadData.observations}
                  onChange={(e) => setLeadData(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Notas sobre o cliente..."
                  rows={3}
                />
              </div>

              <Separator />
              {renderNavButtons(undefined, handleGoToConversation)}
            </CardContent>
          </Card>
        )}

        {/* Conversation Step */}
        {currentStep === 'conversation' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Modo de Conversa e Origem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderNavButtons(() => setCurrentStep('lead_info'), handleGoToProduct, !conversationMode)}
              <Separator />

              <div className="space-y-2">
                <Label>Como está conversando com o cliente? *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {CONVERSATION_MODES.map((mode) => (
                    <Button
                      key={mode.value}
                      variant={conversationMode === mode.value ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => setConversationMode(mode.value)}
                    >
                      {mode.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Origem deste Atendimento</Label>
                
                {leadData.existed && sourceHistory.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Histórico de origens:</p>
                    <div className="space-y-1">
                      {sourceHistory.map((entry, index) => (
                        <div key={entry.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {format(new Date(entry.recorded_at), "dd/MM/yy", { locale: ptBR })}
                          </Badge>
                          <span>{entry.source_name}</span>
                          {index === 0 && <Badge variant="secondary" className="text-xs">Mais recente</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Como o cliente nos encontrou <strong>desta vez</strong>?
                </p>
                <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem deste contato" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />
              {renderNavButtons(() => setCurrentStep('lead_info'), handleGoToProduct, !conversationMode)}
            </CardContent>
          </Card>
        )}

        {/* Product Step */}
        {currentStep === 'product' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Produto de Interesse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderNavButtons(() => setCurrentStep('conversation'), handleGoToQuestions, !selectedProductId)}
              <Separator />
              
              <ProductSelectorForSale
                products={products}
                isLoading={false}
                onSelect={(product) => {
                  setSelectedProductId(product.id);
                  // Reset kit selection
                  setSelectedKitId(null);
                  setRejectedKitIds([]);
                  setShowPromo2(false);
                  setShowMinimum(false);
                }}
                placeholder="Buscar produto por nome..."
              />

              {selectedProduct && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {selectedProduct.is_featured && <Star className="w-4 h-4 text-amber-500" />}
                    <span className="font-medium">{selectedProduct.name}</span>
                    <Badge variant="outline">{selectedProduct.category}</Badge>
                  </div>
                  {selectedProduct.description && (
                    <p className="text-sm text-muted-foreground mt-2">{selectedProduct.description}</p>
                  )}
                </div>
              )}

              <Separator />
              {renderNavButtons(() => setCurrentStep('conversation'), handleGoToQuestions, !selectedProductId)}
            </CardContent>
          </Card>
        )}

        {/* Questions Step */}
        {currentStep === 'questions' && selectedProduct && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Entrevista - {selectedProduct.name}
              </CardTitle>
              <CardDescription>
                {existingAnswers ? (
                  <Badge variant="secondary" className="mt-1">
                    <Clock className="w-3 h-3 mr-1" />
                    Respostas já registradas - {format(new Date(existingAnswers.updated_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </Badge>
                ) : (
                  'Faça as perguntas-chave para entender a necessidade do cliente'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderNavButtons(() => setCurrentStep('product'), handleGoToOffer)}
              <Separator />
              
              {selectedProduct.key_question_1 && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">1. {selectedProduct.key_question_1}</Label>
                  <Textarea
                    value={productAnswers.answer_1 || ''}
                    onChange={(e) => setProductAnswers(prev => ({ ...prev, answer_1: e.target.value }))}
                    placeholder="Resposta do cliente..."
                    rows={2}
                  />
                </div>
              )}

              {selectedProduct.key_question_2 && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">2. {selectedProduct.key_question_2}</Label>
                  <Textarea
                    value={productAnswers.answer_2 || ''}
                    onChange={(e) => setProductAnswers(prev => ({ ...prev, answer_2: e.target.value }))}
                    placeholder="Resposta do cliente..."
                    rows={2}
                  />
                </div>
              )}

              {selectedProduct.key_question_3 && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">3. {selectedProduct.key_question_3}</Label>
                  <Textarea
                    value={productAnswers.answer_3 || ''}
                    onChange={(e) => setProductAnswers(prev => ({ ...prev, answer_3: e.target.value }))}
                    placeholder="Resposta do cliente..."
                    rows={2}
                  />
                </div>
              )}

              {!selectedProduct.key_question_1 && !selectedProduct.key_question_2 && !selectedProduct.key_question_3 && (
                <p className="text-muted-foreground text-center py-4">
                  Este produto não tem perguntas-chave cadastradas.
                </p>
              )}

              {/* Sales Script */}
              {selectedProduct.sales_script && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Script de Vendas
                    </h3>
                    <div className="p-4 rounded-lg bg-primary/5 border whitespace-pre-wrap text-sm">
                      {selectedProduct.sales_script}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              {renderNavButtons(() => setCurrentStep('product'), handleGoToOffer)}
            </CardContent>
          </Card>
        )}

        {/* Offer Step - Progressive Kit Selection */}
        {currentStep === 'offer' && selectedProduct && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Oferta - {selectedProduct.name}
              </CardTitle>
              <CardDescription>
                {selectedProduct.category === 'manipulado' 
                  ? 'Informe o valor e requisição' 
                  : 'Selecione o kit e preço para o cliente'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderNavButtons(() => setCurrentStep('questions'), handleGoToAddress, !unitPrice)}
              <Separator />

              {/* MANIPULADO */}
              {selectedProduct.category === 'manipulado' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Número da Requisição *</Label>
                    <Input
                      value={requisitionNumber}
                      onChange={(e) => setRequisitionNumber(e.target.value)}
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
                        onChange={(e) => setManipuladoQuantity(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor Total (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={(manipuladoPrice / 100).toFixed(2)}
                        onChange={(e) => setManipuladoPrice(Math.round(parseFloat(e.target.value) * 100) || 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Kit Selection with Progressive Reveal */}
              {selectedProduct.category !== 'manipulado' && sortedKits.length > 0 && currentVisibleKit && (
                <div className="space-y-4">
                  {/* Current Kit */}
                  <div className={`p-5 rounded-lg border-2 ${selectedKitId === currentVisibleKit.id ? 'border-primary bg-primary/5' : 'border-muted'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-lg px-3 py-1">
                          {currentVisibleKit.quantity} {currentVisibleKit.quantity === 1 ? 'unidade' : 'unidades'}
                        </Badge>
                        <Badge variant="outline">Oferta {sortedKits.findIndex(k => k.id === currentVisibleKit.id) + 1}</Badge>
                      </div>
                    </div>

                    {/* Price Options */}
                    <div className="space-y-3">
                      {/* Promotional (Venda por) - Main option */}
                      {currentVisibleKit.promotional_price_cents && (
                        <button
                          onClick={() => {
                            setSelectedKitId(currentVisibleKit.id);
                            setSelectedPriceType('promotional');
                            setCustomPrice(0);
                          }}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            selectedKitId === currentVisibleKit.id && selectedPriceType === 'promotional'
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                              : 'border-muted hover:border-muted-foreground/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-lg">Venda por:</p>
                              <p className="text-2xl font-bold text-green-600">
                                {formatPrice(currentVisibleKit.promotional_price_cents)}
                              </p>
                            </div>
                            <CommissionBadge value={
                              currentVisibleKit.promotional_use_default_commission 
                                ? (myCommission?.commissionPercentage || 0)
                                : (currentVisibleKit.promotional_custom_commission || 0)
                            } />
                          </div>
                        </button>
                      )}

                      {/* Regular */}
                      <button
                        onClick={() => {
                          setSelectedKitId(currentVisibleKit.id);
                          setSelectedPriceType('regular');
                          setCustomPrice(0);
                        }}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          selectedKitId === currentVisibleKit.id && selectedPriceType === 'regular'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-muted hover:border-muted-foreground/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">Valor Normal</p>
                            <p className="text-xl font-bold">{formatPrice(currentVisibleKit.regular_price_cents)}</p>
                          </div>
                          <CommissionBadge value={
                            currentVisibleKit.regular_use_default_commission 
                              ? (myCommission?.commissionPercentage || 0)
                              : (currentVisibleKit.regular_custom_commission || 0)
                          } />
                        </div>
                      </button>

                      {/* Promotional 2 - Hidden behind button */}
                      {currentVisibleKit.promotional_price_2_cents && (
                        <>
                          {!showPromo2 ? (
                            <Button 
                              variant="ghost" 
                              className="w-full text-muted-foreground"
                              onClick={() => setShowPromo2(true)}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Ver Valor Promocional 2
                            </Button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedKitId(currentVisibleKit.id);
                                setSelectedPriceType('promotional_2');
                                setCustomPrice(0);
                              }}
                              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                selectedKitId === currentVisibleKit.id && selectedPriceType === 'promotional_2'
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                                  : 'border-muted hover:border-muted-foreground/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-amber-700">Promocional 2</p>
                                  <p className="text-xl font-bold text-amber-600">
                                    {formatPrice(currentVisibleKit.promotional_price_2_cents)}
                                  </p>
                                </div>
                                <CommissionBadge value={
                                  currentVisibleKit.promotional_2_use_default_commission 
                                    ? (myCommission?.commissionPercentage || 0)
                                    : (currentVisibleKit.promotional_2_custom_commission || 0)
                                } />
                              </div>
                            </button>
                          )}
                        </>
                      )}

                      {/* Minimum - Hidden behind button */}
                      {currentVisibleKit.minimum_price_cents && (
                        <>
                          {!showMinimum ? (
                            <Button 
                              variant="ghost" 
                              className="w-full text-muted-foreground"
                              onClick={() => setShowMinimum(true)}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Ver Valor Mínimo
                            </Button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedKitId(currentVisibleKit.id);
                                setSelectedPriceType('minimum');
                                setCustomPrice(0);
                              }}
                              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                                selectedKitId === currentVisibleKit.id && selectedPriceType === 'minimum'
                                  ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                                  : 'border-muted hover:border-muted-foreground/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-red-700">Valor Mínimo</p>
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  </div>
                                  <p className="text-xl font-bold text-red-600">
                                    {formatPrice(currentVisibleKit.minimum_price_cents)}
                                  </p>
                                </div>
                                <CommissionBadge value={
                                  currentVisibleKit.minimum_use_default_commission 
                                    ? (myCommission?.commissionPercentage || 0)
                                    : (currentVisibleKit.minimum_custom_commission || 0)
                                } />
                              </div>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reject Kit Button */}
                  {hasMoreKits && leadData.id && (
                    <div className="space-y-2">
                      {!showRejectionInput ? (
                        <Button
                          variant="outline"
                          className="w-full border-amber-500 text-amber-700 hover:bg-amber-50"
                          onClick={() => setShowRejectionInput(true)}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          NÃO CONSEGUI VENDER ESSE
                        </Button>
                      ) : (
                        <div className="p-4 border border-amber-500 rounded-lg bg-amber-50 dark:bg-amber-950/30 space-y-3">
                          <Label className="text-amber-700">Por que o cliente não aceitou?</Label>
                          <Textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Ex: Achou caro, quer menos quantidade..."
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowRejectionInput(false);
                                setRejectionReason('');
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleRejectKit}
                              disabled={!rejectionReason.trim() || createKitRejection.isPending}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              {createKitRejection.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              Ver Próxima Oferta
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* All kits rejected */}
              {selectedProduct.category !== 'manipulado' && allKitsRejected && (
                <div className="p-6 border-2 border-dashed border-amber-500 rounded-lg text-center">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <p className="font-semibold text-lg">Todas as ofertas foram rejeitadas</p>
                  <p className="text-muted-foreground mt-1">
                    Finalize o atendimento selecionando um motivo de não compra
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setCurrentStep('sale_or_reason')}
                  >
                    Ir para Motivos
                  </Button>
                </div>
              )}

              {/* Cart Items Display */}
              {cartItems.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Itens no Carrinho ({cartItems.length})
                    </h4>
                    {cartItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <span className="font-medium">{item.quantity}x {item.productName}</span>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.unitPriceCents * item.quantity)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFromCart(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Add more products button */}
              {unitPrice > 0 && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleAddToCart}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar ao Carrinho e Selecionar Outro
                    </Button>
                  </div>
                </>
              )}

              {/* Cross-sell Products */}
              {getCrossSellProducts().length > 0 && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-3">
                      <Gift className="w-4 h-4" />
                      Venda Casada - Sugira para o Cliente!
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {getCrossSellProducts().map((crossProduct) => (
                        <Button
                          key={crossProduct.id}
                          variant="outline"
                          className="justify-start h-auto p-3 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          onClick={() => {
                            // Add current to cart first if valid
                            if (unitPrice > 0) {
                              handleAddToCart();
                            }
                            // Select the cross-sell product
                            setSelectedProductId(crossProduct.id);
                            setSelectedKitId(null);
                            setRejectedKitIds([]);
                            setShowPromo2(false);
                            setShowMinimum(false);
                          }}
                        >
                          <div className="text-left">
                            <p className="font-medium">{crossProduct.name}</p>
                            <p className="text-xs text-muted-foreground">{crossProduct.category}</p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Order Summary */}
              {(unitPrice > 0 || cartItems.length > 0) && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <h4 className="font-semibold">Resumo do Pedido</h4>
                    
                    {/* Cart items */}
                    {cartItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.productName}</span>
                        <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
                      </div>
                    ))}
                    
                    {/* Current item */}
                    {unitPrice > 0 && selectedProduct && (
                      <div className="flex justify-between text-sm">
                        <span>{quantity}x {selectedProduct.name}</span>
                        <span>{formatPrice(currentItemSubtotal)}</span>
                      </div>
                    )}
                    
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto</span>
                        <span>-{formatPrice(totalDiscount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Sua comissão total</span>
                      <span>{formatPrice(totalCommissionValue)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Non-Purchase Reasons in Offer step */}
              <Separator />
              <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                <h4 className="font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-3">
                  <ThumbsDown className="w-4 h-4" />
                  Não Fechou a Venda
                </h4>
                <p className="text-sm text-muted-foreground mb-3">Selecione o motivo para acompanhamento futuro</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {nonPurchaseReasons.slice(0, 4).map((reason) => (
                    <Button
                      key={reason.id}
                      variant="outline"
                      size="sm"
                      className={`justify-start h-auto p-3 ${
                        selectedReasonId === reason.id ? 'border-amber-500 bg-amber-500/10' : ''
                      }`}
                      onClick={() => handleSelectReason(reason.id)}
                      disabled={isSaving}
                    >
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{reason.name}</p>
                        {reason.followup_hours > 0 && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            Follow-up: {reason.followup_hours}h
                          </Badge>
                        )}
                      </div>
                      {isSaving && selectedReasonId === reason.id && (
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      )}
                    </Button>
                  ))}
                </div>
                {nonPurchaseReasons.length > 4 && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2 text-amber-700"
                    onClick={() => setCurrentStep('sale_or_reason')}
                  >
                    Ver todos os motivos ({nonPurchaseReasons.length})
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>

              <Separator />
              {renderNavButtons(() => setCurrentStep('questions'), handleGoToAddress, !(unitPrice > 0 || cartItems.length > 0))}
            </CardContent>
          </Card>
        )}

        {/* Address/Delivery Step */}
        {currentStep === 'address' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderNavButtons(() => setCurrentStep('offer'), handleGoToPayment)}
              <Separator />

              <DeliveryTypeSelector
                value={deliveryConfig}
                onChange={setDeliveryConfig}
                leadRegionId={leadData.delivery_region_id || null}
              />

              {/* Address */}
              {(deliveryConfig.type === 'motoboy' || deliveryConfig.type === 'carrier') && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço de Entrega
                    </h3>
                    <AddressFields
                      cep={leadData.cep}
                      street={leadData.street}
                      streetNumber={leadData.street_number}
                      complement={leadData.complement}
                      neighborhood={leadData.neighborhood}
                      city={leadData.city}
                      state={leadData.state}
                      onFieldChange={(field, value) => {
                        const fieldMap: Record<string, keyof LeadData> = {
                          cep: 'cep',
                          street: 'street',
                          street_number: 'street_number',
                          complement: 'complement',
                          neighborhood: 'neighborhood',
                          city: 'city',
                          state: 'state',
                        };
                        setLeadData(prev => ({ ...prev, [fieldMap[field] || field]: value }));
                      }}
                    />
                  </div>
                </>
              )}

              <Separator />
              {renderNavButtons(() => setCurrentStep('offer'), handleGoToPayment)}
            </CardContent>
          </Card>
        )}

        {/* Payment Step */}
        {currentStep === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderNavButtons(() => setCurrentStep('address'), handleGoToSaleOrReason)}
              <Separator />

              {/* Seller Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Vendedor responsável
                </Label>
                <Select value={sellerUserId || ''} onValueChange={setSellerUserId}>
                  <SelectTrigger>
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

              <Separator />

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={selectedPaymentMethodId || ''} onValueChange={setSelectedPaymentMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name} ({PAYMENT_TIMING_LABELS[pm.payment_timing]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Installments */}
              {selectedPaymentMethod?.payment_timing === 'installments' && (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select 
                    value={selectedInstallments.toString()} 
                    onValueChange={(v) => setSelectedInstallments(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableInstallments().map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}x de {formatPrice(Math.ceil(total / n))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Payment Status */}
              <div className="space-y-2">
                <Label>Status do Pagamento</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={paymentStatus === 'not_paid' ? 'default' : 'outline'}
                    onClick={() => setPaymentStatus('not_paid')}
                    className="justify-start"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Não pago
                  </Button>
                  <Button
                    type="button"
                    variant={paymentStatus === 'will_pay_before' ? 'default' : 'outline'}
                    onClick={() => setPaymentStatus('will_pay_before')}
                    className="justify-start"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Vai pagar antes
                  </Button>
                  <Button
                    type="button"
                    variant={paymentStatus === 'paid_now' ? 'default' : 'outline'}
                    onClick={() => setPaymentStatus('paid_now')}
                    className="justify-start"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Já pagou
                  </Button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-lg bg-primary/10 space-y-2">
                <h4 className="font-semibold text-lg">Total a Pagar</h4>
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
                {shippingCost > 0 && (
                  <p className="text-sm text-muted-foreground">
                    (inclui {formatPrice(shippingCost)} de frete)
                  </p>
                )}
              </div>

              <Separator />
              {renderNavButtons(() => setCurrentStep('address'), handleGoToSaleOrReason)}
            </CardContent>
          </Card>
        )}

        {/* Sale or Reason Step */}
        {currentStep === 'sale_or_reason' && (
          <div className="space-y-6">
            {/* Create Sale */}
            <Card className="border-green-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <ShoppingCart className="w-5 h-5" />
                  Fechar Venda
                </CardTitle>
                <CardDescription>
                  {formatPrice(total)} • {cartItems.length + (unitPrice > 0 ? 1 : 0)} produto(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 space-y-2 text-sm">
                  {/* Cart items */}
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{item.quantity}x {item.productName}</span>
                      <span className="font-medium">{formatPrice(item.unitPriceCents * item.quantity)}</span>
                    </div>
                  ))}
                  
                  {/* Current item */}
                  {unitPrice > 0 && selectedProduct && (
                    <div className="flex justify-between">
                      <span>{quantity}x {selectedProduct.name}</span>
                      <span className="font-medium">{formatPrice(currentItemSubtotal)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span>Entrega</span>
                    <span className="font-medium capitalize">{deliveryConfig.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pagamento</span>
                    <span className="font-medium">{selectedPaymentMethod?.name || 'Não selecionado'}</span>
                  </div>
                  {shippingCost > 0 && (
                    <div className="flex justify-between">
                      <span>Frete</span>
                      <span className="font-medium">+ {formatPrice(shippingCost)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto</span>
                      <span className="font-medium">- {formatPrice(totalDiscount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-green-600">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Sua comissão</span>
                    <span>{formatPrice(totalCommissionValue)}</span>
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleCreateSale}
                  disabled={isSaving || (cartItems.length === 0 && !unitPrice)}
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 mr-2" />
                  )}
                  Criar Venda Agora
                </Button>
              </CardContent>
            </Card>

            {/* Non-Purchase Reasons */}
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <ThumbsDown className="w-5 h-5" />
                  Não Fechou a Venda
                </CardTitle>
                <CardDescription>Selecione o motivo para acompanhamento futuro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {nonPurchaseReasons.map((reason) => (
                  <Button
                    key={reason.id}
                    variant="outline"
                    className={`w-full justify-start h-auto p-4 ${
                      selectedReasonId === reason.id ? 'border-amber-500 bg-amber-500/10' : ''
                    }`}
                    onClick={() => handleSelectReason(reason.id)}
                    disabled={isSaving}
                  >
                    <div className="flex-1 text-left">
                      <p className="font-medium">{reason.name}</p>
                      {reason.followup_hours > 0 && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          Follow-up: {reason.followup_hours}h
                        </Badge>
                      )}
                    </div>
                    {isSaving && selectedReasonId === reason.id && (
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    )}
                  </Button>
                ))}

                {nonPurchaseReasons.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum motivo cadastrado. Configure em Configurações.
                  </p>
                )}
              </CardContent>
            </Card>

            <Button variant="outline" onClick={() => setCurrentStep('payment')} className="w-full">
              Voltar
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
