import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  ArrowLeft,
  Calendar,
  Coins,
  XCircle,
  AlertTriangle,
  UserCheck,
  CreditCard,
  Clock,
  Truck,
  Star,
  Plus,
  Trash2,
  Gift,
  ExternalLink,
  Eye,
  History
} from 'lucide-react';
import { 
  useReceptiveModuleAccess, 
  useSearchLeadByPhone, 
  useCreateReceptiveAttendance,
  useUpdateReceptiveAttendance,
  CONVERSATION_MODES 
} from '@/hooks/useReceptiveModule';
import { useSearchLeadByName } from '@/hooks/useSearchLeadByName';
import { useLeadSources } from '@/hooks/useConfigOptions';
import { useProducts, Product } from '@/hooks/useProducts';
import { useProductBrands } from '@/hooks/useProductBrands';
import { ProductSelectorForSale } from '@/components/products/ProductSelectorForSale';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages, getStageEnumValue } from '@/hooks/useFunnelStages';
import { useDefaultStageForSource } from '@/hooks/useDefaultFunnelStages';
import { useProductPriceKits } from '@/hooks/useProductPriceKits';
import { useKitRejections, useCreateKitRejection } from '@/hooks/useKitRejections';
import { useLeadProductAnswer } from '@/hooks/useLeadProductAnswers';
import { useScheduleMessages } from '@/hooks/useScheduleMessages';
import { useLeadProductQuestionAnswers, useProductQuestions } from '@/hooks/useProductQuestions';
import { useLeadStandardAnswers } from '@/hooks/useStandardQuestions';
import { useMyCommission } from '@/hooks/useSellerCommission';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useUsers } from '@/hooks/useUsers';
import { useActivePaymentMethods, PAYMENT_TIMING_LABELS } from '@/hooks/usePaymentMethods';
import { useCreateSale, DeliveryType, useLeadSales, formatCurrency, getStatusLabel, getStatusColor } from '@/hooks/useSales';
import { DeliveryTypeSelector } from '@/components/sales/DeliveryTypeSelector';
import { LeadStageTimeline } from '@/components/LeadStageTimeline';
import { LeadFollowupsSection } from '@/components/leads/LeadFollowupsSection';
import { LeadReceptiveHistorySection } from '@/components/leads/LeadReceptiveHistorySection';
import { LeadSacSection } from '@/components/leads/LeadSacSection';
import { LeadAddressesManager } from '@/components/leads/LeadAddressesManager';
import { LeadStandardQuestionsSection } from '@/components/leads/LeadStandardQuestionsSection';
import { LeadTransferDialog } from '@/components/LeadTransferDialog';
import { checkLeadExistsForOtherUser, ExistingLeadWithOwner } from '@/hooks/useLeadOwnership';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-message';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddressSelector } from '@/components/sales/AddressSelector';
import { LeadAddress } from '@/hooks/useLeadAddresses';
import { ProductOfferCard } from '@/components/receptive/ProductOfferCard';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { LeadProfilePrompt } from '@/components/leads/LeadProfilePrompt';
import { useUpdateLead } from '@/hooks/useLeads';
import { FollowupDateTimeEditor } from '@/components/leads/FollowupDateTimeEditor';
import { QuickFollowupDialog } from '@/components/receptive/QuickFollowupDialog';
import { PaymentActionsBar } from '@/components/payment-links/PaymentActionsBar';
import { SplitPaymentEditor, PaymentLine } from '@/components/sales/SplitPaymentEditor';
import { useSaveSalePayments } from '@/hooks/useSalePayments';

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
  stage?: FunnelStage;
  stars?: number;
  negotiated_value?: number;
  paid_value?: number;
  birth_date?: string | null;
  gender?: string | null;
  favorite_team?: string | null;
}

interface DeliveryConfig {
  type: DeliveryType;
  regionId: string | null;
  scheduledDate: Date | null;
  scheduledShift: 'morning' | 'afternoon' | 'full_day' | null;
  carrierId: string | null;
  shippingCost: number;
  freeShipping?: boolean; // Seller offered free shipping to client
  shippingCostReal?: number; // Real cost when free shipping is enabled
  selectedQuoteServiceId?: string | null; // Correios service code when using integrated quote
}

interface OfferItem {
  productId: string;
  productName: string;
  productCategory: string;
  kitId: string | null;
  priceType: 'regular' | 'promotional' | 'promotional_2' | 'minimum' | 'custom' | 'negotiated';
  quantity: number;
  unitPriceCents: number;
  commissionPercentage: number;
  commissionCents: number;
  requisitionNumber?: string;
  answers: Record<string, string>;
  dynamicAnswers: Record<string, string>; // Answers for product_questions
  negotiatedInstallments?: number; // For negotiated prices
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { data: accessInfo, isLoading: loadingAccess } = useReceptiveModuleAccess();
  const { data: orgFeatures } = useOrgFeatures();
  const { data: leadSources = [] } = useLeadSources();
  const { data: products = [] } = useProducts();
  const { data: productBrands = [] } = useProductBrands();
  const { data: nonPurchaseReasons = [] } = useNonPurchaseReasons();
  const { data: funnelStages = [] } = useFunnelStages();
  const defaultStageId = useDefaultStageForSource('receptivo');
  const { data: users = [] } = useUsers();
  const { data: paymentMethods = [] } = useActivePaymentMethods();
  const { data: myCommission } = useMyCommission();
  const searchLead = useSearchLeadByPhone();
  const createAttendance = useCreateReceptiveAttendance();
  const updateAttendance = useUpdateReceptiveAttendance();
  const createSale = useCreateSale();
  const { scheduleMessagesForReason } = useScheduleMessages();
  const updateLead = useUpdateLead();

  // Selectable funnel stages (not trash)
  const selectableStages = useMemo(() => 
    funnelStages
      .filter(s => s.stage_type !== 'trash')
      .sort((a, b) => a.position - b.position),
    [funnelStages]
  );

  // Selected funnel stage for new leads
  const [selectedFunnelStageId, setSelectedFunnelStageId] = useState<string>('');

  // ========= SESSION STORAGE PERSISTENCE (survive F5) =========
  const SESSION_KEY = 'add-receptivo-state';
  const isRestoringRef = useRef(false);

  // Helper to get initial state from sessionStorage
  const getSessionState = () => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };

  const savedSession = useRef(getSessionState());

  const [currentStep, setCurrentStep] = useState<FlowStep>(() => savedSession.current?.currentStep || 'phone');
  const [phoneInput, setPhoneInput] = useState(() => savedSession.current?.phoneInput || '55');
  const [nameSearchInput, setNameSearchInput] = useState('');
  const [leadData, setLeadData] = useState<LeadData>(() => savedSession.current?.leadData || initialLeadData);
  
  // Name search results
  const { data: nameSearchResults = [], isLoading: isSearchingByName } = useSearchLeadByName(nameSearchInput);
  const [conversationMode, setConversationMode] = useState(() => savedSession.current?.conversationMode || '');
  const [selectedSourceId, setSelectedSourceId] = useState(() => savedSession.current?.selectedSourceId || '');
  const [attendanceId, setAttendanceId] = useState<string | null>(() => savedSession.current?.attendanceId || null);
  const [attendanceStartedAt, setAttendanceStartedAt] = useState<string | null>(() => savedSession.current?.attendanceStartedAt || null);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [pendingReasonId, setPendingReasonId] = useState<string | null>(null);
  const [customFollowupDate, setCustomFollowupDate] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [sourceHistory, setSourceHistory] = useState<Array<{
    id: string;
    source_name: string;
    recorded_at: string;
  }>>([]);

  // Multi-product offer items (inline, not cart)
  const [offerItems, setOfferItems] = useState<OfferItem[]>(() => savedSession.current?.offerItems || []);
  const [showAddProduct, setShowAddProduct] = useState(true);

  // Current product being configured
  const [currentProductId, setCurrentProductId] = useState(() => savedSession.current?.currentProductId || '');
  const [currentKitId, setCurrentKitId] = useState<string | null>(() => savedSession.current?.currentKitId || null);
  const [currentPriceType, setCurrentPriceType] = useState<'regular' | 'promotional' | 'promotional_2' | 'minimum' | 'negotiated'>(() => savedSession.current?.currentPriceType || 'promotional');
  const [currentCustomPrice, setCurrentCustomPrice] = useState<number>(0);
  const [currentRejectedKitIds, setCurrentRejectedKitIds] = useState<string[]>(() => savedSession.current?.currentRejectedKitIds || []);
  const [showPromo2, setShowPromo2] = useState(false);
  const [showMinimum, setShowMinimum] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const dynamicAnswersInitKeyRef = useRef<string>('');
  
  // Negotiation state
  const [negotiatedPriceCents, setNegotiatedPriceCents] = useState<number | undefined>();
  const [negotiatedInstallments, setNegotiatedInstallments] = useState<number>(12);
  const [negotiatedCommission, setNegotiatedCommission] = useState<number | undefined>();
  
  const [requisitionNumber, setRequisitionNumber] = useState('');
  const [manipuladoPrice, setManipuladoPrice] = useState<number>(0);
  const [manipuladoQuantity, setManipuladoQuantity] = useState<number>(1);

  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState(0);

  // Delivery config
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
    type: 'pickup',
    regionId: null,
    scheduledDate: null,
    scheduledShift: null,
    carrierId: null,
    shippingCost: 0,
    freeShipping: false,
    shippingCostReal: 0,
    selectedQuoteServiceId: null,
  });

  // Payment config
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
  const [paymentStatus, setPaymentStatus] = useState<'not_paid' | 'will_pay_before' | 'paid_now'>('not_paid');
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);
  const [purchasePotential, setPurchasePotential] = useState<number>(0);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [splitPaymentLines, setSplitPaymentLines] = useState<PaymentLine[]>([]);
  const saveSalePayments = useSaveSalePayments();
  
  // Delivery observation
  const [deliveryObservation, setDeliveryObservation] = useState('');
  
  // Selected address for delivery
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<LeadAddress | null>(null);
  
  // Handle address selection
  const handleAddressChange = (addressId: string | null, address: LeadAddress | null) => {
    setSelectedAddressId(addressId);
    setSelectedAddress(address);
    // Update delivery region from selected address if available
    if (address?.delivery_region_id) {
      setDeliveryConfig(prev => ({
        ...prev,
        regionId: address.delivery_region_id || prev.regionId,
      }));
    }
  };

  // Lead transfer dialog state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [existingLeadForTransfer, setExistingLeadForTransfer] = useState<ExistingLeadWithOwner | null>(null);
  
  // Quick followup dialog state
  const [showQuickFollowupDialog, setShowQuickFollowupDialog] = useState(false);

  const currentProduct = products.find(p => p.id === currentProductId);
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
  
  // Fetch lead sales for history
  const { data: leadSales = [] } = useLeadSales(leadData.id || '');
  
  // Fetch price kits for the current product
  const { data: productPriceKits = [] } = useProductPriceKits(currentProductId || undefined);
  const sortedKits = useMemo(() => [...productPriceKits].sort((a, b) => a.position - b.position), [productPriceKits]);

  // Fetch kit rejections for this lead/product
  const { data: existingRejections = [] } = useKitRejections(leadData.id, currentProductId || undefined);
  const createKitRejection = useCreateKitRejection();
  
  // Fetch existing product answers (legacy key_question_1/2/3)
  const { data: existingAnswers } = useLeadProductAnswer(leadData.id, currentProductId || undefined);
  
  // Fetch existing dynamic product question answers
  const { data: existingDynamicAnswers = [], isLoading: loadingDynamicAnswers } = useLeadProductQuestionAnswers(leadData.id, currentProductId || undefined);
  
  // Fetch product questions to know which are standard
  const { data: currentProductQuestions = [], isLoading: loadingProductQuestions } = useProductQuestions(currentProductId || undefined);
  
  // Fetch existing standard question answers for the lead
  const { data: existingStandardAnswers = [], isLoading: loadingStandardAnswers } = useLeadStandardAnswers(leadData.id);

  // ========= SAVE STATE TO SESSION STORAGE =========
  useEffect(() => {
    // Don't save if we're on the initial phone step with no data
    if (currentStep === 'phone' && !leadData.id) return;
    
    const stateToSave = {
      currentStep,
      phoneInput,
      leadData,
      conversationMode,
      selectedSourceId,
      attendanceId,
      attendanceStartedAt,
      currentProductId,
      currentKitId,
      currentPriceType,
      currentRejectedKitIds,
      offerItems,
    };
    
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
    } catch {}
  }, [currentStep, phoneInput, leadData, conversationMode, selectedSourceId, attendanceId, attendanceStartedAt, currentProductId, currentKitId, currentPriceType, currentRejectedKitIds, offerItems]);

  // Clear session when navigating away (not on refresh)
  useEffect(() => {
    return () => {
      // This fires on unmount (navigation away), not on F5
      // We want to keep the data on F5 but clear on navigation
    };
  }, []);

  useEffect(() => {
    if (user?.id && !sellerUserId) {
      setSellerUserId(user.id);
    }
  }, [user?.id, sellerUserId]);

  // Set default funnel stage when configuration or stages load
  useEffect(() => {
    if (selectableStages.length > 0 && !selectedFunnelStageId) {
      // Priority: configured default → first funnel stage
      const stageId = defaultStageId || selectableStages.find(s => s.stage_type === 'funnel')?.id || selectableStages[0]?.id || '';
      setSelectedFunnelStageId(stageId);
    }
  }, [defaultStageId, selectableStages, selectedFunnelStageId]);

  // Auto-fill phone from URL query parameters (VoIP integration)
  useEffect(() => {
    const telefoneParam = searchParams.get('telefone') || searchParams.get('whatsapp') || searchParams.get('fone_cliente');
    if (telefoneParam && phoneInput === '55') {
      // Normalize: remove non-digits, ensure starts with 55
      let normalized = telefoneParam.replace(/\D/g, '');
      if (!normalized.startsWith('55') && normalized.length >= 10) {
        normalized = '55' + normalized;
      }
      if (normalized.length >= 12) {
        setPhoneInput(normalized);
      }
    }
  }, [searchParams, phoneInput]);

  // Load existing legacy answers when product changes
  useEffect(() => {
    if (existingAnswers) {
      setCurrentAnswers({
        answer_1: existingAnswers.answer_1 || '',
        answer_2: existingAnswers.answer_2 || '',
        answer_3: existingAnswers.answer_3 || '',
      });
    } else {
      setCurrentAnswers({});
    }
  }, [existingAnswers, currentProductId]);

  // Load existing dynamic answers when product changes - merge standard and product-specific answers
  // IMPORTANT: only initialize once per (leadId + product). Otherwise, background refetches can keep
  // overwriting user input and make the UI look "unclickable".
  useEffect(() => {
    if (!currentProductId) {
      setDynamicAnswers({});
      dynamicAnswersInitKeyRef.current = '';
      return;
    }

    // Use leadId in key so that when user assumes a lead, we reload answers
    const initKey = `${leadData.id || leadData.whatsapp}:${currentProductId}`;

    // Wait for queries to finish before initializing; otherwise we may lock-in empty state
    // and never pre-fill existing answers.
    // Only wait for standard answers if we have a leadId (existing lead)
    const waitingForQueries = loadingDynamicAnswers || loadingProductQuestions || (leadData.id ? loadingStandardAnswers : false);
    if (waitingForQueries) {
      return;
    }

    if (dynamicAnswersInitKeyRef.current === initKey) {
      return;
    }

    const answersMap: Record<string, string> = {};

    // First, load product-specific answers from lead_product_question_answers
    if (existingDynamicAnswers.length > 0) {
      existingDynamicAnswers.forEach((answer) => {
        if (answer.question_id && answer.answer_text) {
          answersMap[answer.question_id] = answer.answer_text;
        }
      });
    }

    // Then, for standard questions, load from lead_standard_question_answers
    // Map by standard_question_id to the product_question.id
    if (currentProductQuestions.length > 0 && existingStandardAnswers.length > 0) {
      currentProductQuestions.forEach((pq) => {
        if (pq.is_standard && pq.standard_question_id) {
          const stdAnswer = existingStandardAnswers.find((a) => a.question_id === pq.standard_question_id);
          if (stdAnswer) {
            // Convert selected_option_ids array to comma-separated string for compatibility
            if (stdAnswer.selected_option_ids && stdAnswer.selected_option_ids.length > 0) {
              answersMap[pq.id] = stdAnswer.selected_option_ids.join(',');
            } else if (stdAnswer.numeric_value !== null) {
              answersMap[pq.id] = String(stdAnswer.numeric_value);
            }
          }
        }
      });
    }

    setDynamicAnswers(answersMap);
    dynamicAnswersInitKeyRef.current = initKey;
  }, [
    leadData.id,
    leadData.whatsapp,
    currentProductId,
    existingDynamicAnswers,
    existingStandardAnswers,
    currentProductQuestions,
    loadingDynamicAnswers,
    loadingProductQuestions,
    loadingStandardAnswers,
  ]);


  // Load existing rejections - merge with local state to avoid overwriting during same session
  useEffect(() => {
    if (existingRejections.length > 0) {
      setCurrentRejectedKitIds(prev => {
        const dbIds = existingRejections.map(r => r.kit_id);
        // Merge: keep any local rejections that haven't synced to DB yet
        const merged = [...new Set([...dbIds, ...prev])];
        return merged;
      });
    }
  }, [existingRejections]);

  // Auto-select first non-rejected kit
  useEffect(() => {
    if (sortedKits.length > 0 && !currentKitId) {
      const firstAvailable = sortedKits.find(k => !currentRejectedKitIds.includes(k.id));
      if (firstAvailable) {
        setCurrentKitId(firstAvailable.id);
        if (firstAvailable.promotional_price_cents) {
          setCurrentPriceType('promotional');
        } else {
          setCurrentPriceType('regular');
        }
      }
    }
  }, [sortedKits, currentRejectedKitIds, currentKitId]);

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

  // ========= SAFETY NET: Save attendance on tab close / navigation away =========
  // Use refs so the beforeunload handler always sees fresh values
  const attendanceIdRef = useRef(attendanceId);
  const leadDataRef = useRef(leadData);
  const currentStepRef = useRef(currentStep);
  const conversationModeRef = useRef(conversationMode);
  const attendanceStartedAtRef = useRef(attendanceStartedAt);
  const currentProductIdRef = useRef(currentProductId);

  useEffect(() => { attendanceIdRef.current = attendanceId; }, [attendanceId]);
  useEffect(() => { leadDataRef.current = leadData; }, [leadData]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { attendanceStartedAtRef.current = attendanceStartedAt; }, [attendanceStartedAt]);
  useEffect(() => { currentProductIdRef.current = currentProductId; }, [currentProductId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      // Only fire if we have a lead identified but the attendance wasn't completed
      const ld = leadDataRef.current;
      const aid = attendanceIdRef.current;
      const step = currentStepRef.current;

      if (step === 'phone') return; // Nothing started yet

      if (!ld.id && !ld.whatsapp) return; // No lead identified

      // Use sendBeacon for reliable fire-and-forget on tab close
      const payload: Record<string, any> = {
        organization_id: tenantId,
        user_id: user?.id,
        lead_id: ld.id || null,
        phone_searched: ld.whatsapp || '',
        lead_existed: ld.existed,
        conversation_mode: conversationModeRef.current || 'receptive_call',
        product_id: currentProductIdRef.current || null,
        completed: false,
        started_at: attendanceStartedAtRef.current || new Date().toISOString(),
        step_abandoned: step,
      };

      if (aid) {
        // Update existing attendance marking it as incomplete
        payload.attendance_id = aid;
      }

      // sendBeacon with supabase REST API for reliability
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/receptive_attendances`;
      const headers = {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      };

      if (aid) {
        // Use PATCH via fetch (sendBeacon only supports POST)
        // For updates, we use a simple fetch with keepalive
        fetch(`${url}?id=eq.${aid}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ 
            completed: false,
            product_id: currentProductIdRef.current || null,
          }),
          keepalive: true,
        }).catch(() => {});
      } else if (tenantId && user?.id) {
        // Create new attendance via sendBeacon
        const blob = new Blob([JSON.stringify({
          organization_id: tenantId,
          user_id: user.id,
          lead_id: ld.id || null,
          phone_searched: ld.whatsapp || '',
          lead_existed: ld.existed,
          conversation_mode: conversationModeRef.current || 'receptive_call',
          product_id: currentProductIdRef.current || null,
          completed: false,
          started_at: attendanceStartedAtRef.current || new Date().toISOString(),
        })], { type: 'application/json' });
        
        // sendBeacon doesn't support custom headers, so we fall back to keepalive fetch
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            organization_id: tenantId,
            user_id: user.id,
            lead_id: ld.id || null,
            phone_searched: ld.whatsapp || '',
            lead_existed: ld.existed,
            conversation_mode: conversationModeRef.current || 'receptive_call',
            product_id: currentProductIdRef.current || null,
            completed: false,
            started_at: attendanceStartedAtRef.current || new Date().toISOString(),
          }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tenantId, user?.id]);

  // Check access
  if (loadingAccess) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!accessInfo?.hasAccess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-center">
        <ThumbsDown className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso não disponível</h1>
        <p className="text-muted-foreground max-w-md">
          O módulo "Add Receptivo" não está habilitado para sua organização ou você não tem permissão de acesso.
        </p>
      </div>
    );
  }

  // Calculate current product values
  const getCurrentProductValues = () => {
    if (currentProduct?.category === 'manipulado') {
      return {
        quantity: manipuladoQuantity,
        unitPrice: manipuladoPrice,
        commission: myCommission?.commissionPercentage || 0,
      };
    }

    const selectedKit = sortedKits.find(k => k.id === currentKitId);
    if (!selectedKit) {
      // BUG FIX: When no kit is selected, still use the seller's default commission
      // Previously returned commission: 0 which caused incorrect commission calculations
      return { quantity: 1, unitPrice: 0, commission: myCommission?.commissionPercentage || 0 };
    }

    // If negotiated price is set, use it
    if (negotiatedPriceCents !== undefined && negotiatedPriceCents > 0) {
      return {
        quantity: selectedKit.quantity,
        unitPrice: negotiatedPriceCents,
        commission: negotiatedCommission ?? myCommission?.commissionPercentage ?? 0,
      };
    }

    let price = selectedKit.regular_price_cents;
    let commission = myCommission?.commissionPercentage || 0;
    let useDefault = selectedKit.regular_use_default_commission;
    let customComm = selectedKit.regular_custom_commission;

    switch (currentPriceType) {
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
      unitPrice: currentCustomPrice > 0 ? currentCustomPrice : price,
      commission,
    };
  };

  const { quantity: currentQuantity, unitPrice: currentUnitPrice, commission: currentCommission } = getCurrentProductValues();
  
  // Calculate totals from offer items + current product
  // For kit-based products: unitPriceCents is already the TOTAL kit price (not per-unit)
  // So we don't multiply by quantity for kit items
  const offerItemsSubtotal = offerItems.reduce((acc, item) => {
    const isKitBasedCategory = ['produto_pronto', 'print_on_demand', 'dropshipping'].includes(item.productCategory);
    // For kit-based: unitPriceCents is already total kit price, don't multiply
    // For legacy/manipulado: unitPriceCents is per-unit, multiply by quantity
    return acc + (isKitBasedCategory ? item.unitPriceCents : (item.unitPriceCents * item.quantity));
  }, 0);
  
  // For current product being configured
  const isCurrentKitBased = currentProduct?.category && ['produto_pronto', 'print_on_demand', 'dropshipping'].includes(currentProduct.category);
  const currentProductSubtotal = isCurrentKitBased ? currentUnitPrice : (currentUnitPrice * currentQuantity);
  const subtotal = offerItemsSubtotal + (currentProductId ? currentProductSubtotal : 0);
  
  let totalDiscount = 0;
  if (discountType === 'percentage' && discountValue > 0) {
    totalDiscount = Math.round(subtotal * (discountValue / 100));
  } else if (discountType === 'fixed') {
    totalDiscount = discountValue;
  }

  const shippingCost = deliveryConfig.shippingCost;
  const total = subtotal - totalDiscount + shippingCost;
  
  // Calculate total commission
  const offerItemsCommission = offerItems.reduce((acc, item) => acc + item.commissionCents, 0);
  const currentCommissionValue = Math.round(currentProductSubtotal * (currentCommission / 100));
  const totalCommissionValue = offerItemsCommission + (currentProductId ? currentCommissionValue : 0);

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

  // Add current product to offer items list
  const handleAddProductToOffer = () => {
    // Allow price 0 for services - only block if no product selected or price is undefined/null
    if (!currentProduct || currentUnitPrice === undefined || currentUnitPrice === null) return;
    
    // Determine if this is a kit-based product
    const isKitBased = ['produto_pronto', 'print_on_demand', 'dropshipping'].includes(currentProduct.category);
    
    // For kit-based: unitPriceCents is already total kit price, so commission is calculated on that
    // For manipulado/legacy: unitPriceCents is per-unit, so multiply by quantity
    const itemTotal = isKitBased ? currentUnitPrice : (currentUnitPrice * currentQuantity);
    
    const newItem: OfferItem = {
      productId: currentProductId,
      productName: currentProduct.name,
      productCategory: currentProduct.category,
      kitId: currentKitId,
      priceType: negotiatedPriceCents ? 'negotiated' : (currentCustomPrice > 0 ? 'custom' : currentPriceType),
      quantity: currentProduct.category === 'manipulado' ? manipuladoQuantity : currentQuantity,
      unitPriceCents: currentUnitPrice,
      commissionPercentage: currentCommission,
      // Commission is based on itemTotal (already respects kit vs per-unit logic)
      commissionCents: Math.round(itemTotal * (currentCommission / 100)),
      requisitionNumber: currentProduct.category === 'manipulado' ? requisitionNumber : undefined,
      answers: { ...currentAnswers },
      dynamicAnswers: { ...dynamicAnswers },
      negotiatedInstallments: negotiatedPriceCents ? negotiatedInstallments : undefined,
    };
    
    setOfferItems(prev => [...prev, newItem]);
    
    // Reset for new product selection
    resetCurrentProduct();
    
    toast({ title: 'Produto adicionado!' });
  };

  const resetCurrentProduct = () => {
    setCurrentProductId('');
    setCurrentKitId(null);
    setCurrentRejectedKitIds([]);
    setShowPromo2(false);
    setShowMinimum(false);
    setCurrentCustomPrice(0);
    setRequisitionNumber('');
    setManipuladoPrice(0);
    setManipuladoQuantity(1);
    setCurrentAnswers({});
    setDynamicAnswers({});
    dynamicAnswersInitKeyRef.current = '';
    setShowAddProduct(true);
    // Reset negotiation state
    setNegotiatedPriceCents(undefined);
    setNegotiatedInstallments(12);
    setNegotiatedCommission(undefined);
    setCurrentPriceType('promotional');
  };

  // Remove item from offer
  const handleRemoveFromOffer = (index: number) => {
    setOfferItems(prev => prev.filter((_, i) => i !== index));
  };

  // Get cross-sell products
  const getCrossSellProducts = () => {
    const crossSellIds: string[] = [];
    
    if (currentProduct) {
      if (currentProduct.crosssell_product_1_id) crossSellIds.push(currentProduct.crosssell_product_1_id);
      if (currentProduct.crosssell_product_2_id) crossSellIds.push(currentProduct.crosssell_product_2_id);
    }
    
    offerItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        if (product.crosssell_product_1_id) crossSellIds.push(product.crosssell_product_1_id);
        if (product.crosssell_product_2_id) crossSellIds.push(product.crosssell_product_2_id);
      }
    });
    
    const inOfferIds = offerItems.map(item => item.productId);
    return products.filter(p => 
      crossSellIds.includes(p.id) && 
      p.id !== currentProductId && 
      !inOfferIds.includes(p.id) &&
      p.is_active
    );
  };

  const handlePhoneSearch = async () => {
    // Validate Brazilian phone format
    const { validateBrazilianPhone } = await import('@/lib/validations');
    const validation = validateBrazilianPhone(phoneInput);
    
    if (!validation.valid) {
      toast({ title: 'Telefone inválido', description: validation.message, variant: 'destructive' });
      return;
    }
    
    // Use the normalized phone for search
    const normalizedPhone = validation.normalized || phoneInput;

    try {
      // First, check if lead exists for another user (bypasses RLS visibility restrictions)
      const existingForOther = await checkLeadExistsForOtherUser(normalizedPhone);
      
      if (existingForOther) {
        // Lead exists but belongs to another user - show transfer dialog
        setExistingLeadForTransfer(existingForOther);
        setShowTransferDialog(true);
        return;
      }

      // Lead doesn't exist for another user, proceed with normal search
      // Record when the seller started searching (for duration tracking)
      setAttendanceStartedAt(new Date().toISOString());

      const result = await searchLead.mutateAsync(normalizedPhone);
      
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
          stage: result.lead.stage as FunnelStage,
          stars: result.lead.stars,
          birth_date: result.lead.birth_date || null,
          gender: result.lead.gender || null,
          favorite_team: result.lead.favorite_team || null,
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
      
      setCurrentStep('conversation');
    } catch (error: unknown) {
      toast({ title: 'Erro na busca', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  // Handle selecting a lead from name search results
  const handleSelectLeadFromNameSearch = async (leadId: string) => {
    try {
      const { data: leadFromDb, error } = await supabase
        .from('leads')
        .select(`
          id, name, whatsapp, email, instagram, specialty, 
          lead_source, stage, stars, observations,
          cep, street, street_number, complement, neighborhood, city, state,
          secondary_phone, cpf_cnpj, created_at,
          birth_date, gender, favorite_team
        `)
        .eq('id', leadId)
        .single();
      
      if (error) throw error;
      
      if (leadFromDb) {
        setLeadData({
          id: leadFromDb.id,
          name: leadFromDb.name || '',
          whatsapp: leadFromDb.whatsapp || '',
          email: leadFromDb.email || '',
          instagram: leadFromDb.instagram || '',
          specialty: leadFromDb.specialty || '',
          lead_source: leadFromDb.lead_source || '',
          observations: leadFromDb.observations || '',
          cep: leadFromDb.cep || '',
          street: leadFromDb.street || '',
          street_number: leadFromDb.street_number || '',
          complement: leadFromDb.complement || '',
          neighborhood: leadFromDb.neighborhood || '',
          city: leadFromDb.city || '',
          state: leadFromDb.state || '',
          secondary_phone: leadFromDb.secondary_phone || '',
          cpf_cnpj: leadFromDb.cpf_cnpj || '',
          existed: true,
          created_at: leadFromDb.created_at,
          stage: leadFromDb.stage as FunnelStage,
          stars: leadFromDb.stars,
          birth_date: leadFromDb.birth_date || null,
          gender: leadFromDb.gender || null,
          favorite_team: leadFromDb.favorite_team || null,
        });
        setSelectedSourceId(leadFromDb.lead_source || '');
        setPhoneInput(leadFromDb.whatsapp || '55');
        setNameSearchInput('');
        toast({ title: 'Lead encontrado!', description: leadFromDb.name });
        setCurrentStep('conversation');
      }
    } catch (error: unknown) {
      toast({ title: 'Erro ao buscar lead', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  // Handler when user assumes the lead from the transfer dialog
  const handleTransferComplete = async (leadId: string) => {
    // Reset dynamic answers init key to force reload of answers for the new lead
    dynamicAnswersInitKeyRef.current = '';
    setDynamicAnswers({});
    
    // After transfer, fetch the lead data and continue
    try {
      const { data: leadFromDb, error } = await supabase
        .from('leads')
        .select(`
          id, name, whatsapp, email, instagram, specialty, 
          lead_source, stage, stars, observations,
          cep, street, street_number, complement, neighborhood, city, state,
          secondary_phone, cpf_cnpj, created_at,
          birth_date, gender, favorite_team
        `)
        .eq('id', leadId)
        .single();

      if (error) throw error;

      if (leadFromDb) {
        setLeadData({
          id: leadFromDb.id,
          name: leadFromDb.name || '',
          whatsapp: leadFromDb.whatsapp || '',
          email: leadFromDb.email || '',
          instagram: leadFromDb.instagram || '',
          specialty: leadFromDb.specialty || '',
          lead_source: leadFromDb.lead_source || '',
          observations: leadFromDb.observations || '',
          cep: leadFromDb.cep || '',
          street: leadFromDb.street || '',
          street_number: leadFromDb.street_number || '',
          complement: leadFromDb.complement || '',
          neighborhood: leadFromDb.neighborhood || '',
          city: leadFromDb.city || '',
          state: leadFromDb.state || '',
          secondary_phone: leadFromDb.secondary_phone || '',
          cpf_cnpj: leadFromDb.cpf_cnpj || '',
          existed: true,
          created_at: leadFromDb.created_at,
          stage: leadFromDb.stage as FunnelStage,
          stars: leadFromDb.stars,
          birth_date: leadFromDb.birth_date || null,
          gender: leadFromDb.gender || null,
          favorite_team: leadFromDb.favorite_team || null,
        });
        setSelectedSourceId(leadFromDb.lead_source || '');
        toast({ title: 'Lead assumido!', description: `Você agora é responsável por ${leadFromDb.name}` });
        setCurrentStep('conversation');
      }
    } catch (error: unknown) {
      toast({ title: 'Erro ao carregar lead', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleGoToConversation = async () => {
    // For new leads, create the lead immediately so leadId is available for product questions
    if (!leadData.existed && !leadData.id && tenantId && user) {
      if (!leadData.name.trim()) {
        toast({ title: 'Informe o nome do cliente', variant: 'destructive' });
        return;
      }
      
      setIsCreatingLead(true);
      try {
        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            organization_id: tenantId,
            assigned_to: user.id,
            created_by: user.id,
            name: leadData.name,
            whatsapp: leadData.whatsapp,
            email: leadData.email || null,
            instagram: leadData.instagram || null,
            specialty: leadData.specialty || null,
            lead_source: selectedSourceId || null,
            observations: leadData.observations || null,
            secondary_phone: leadData.secondary_phone || null,
            cpf_cnpj: leadData.cpf_cnpj || null,
            stage: selectedFunnelStageId 
              ? getStageEnumValue(selectableStages.find(s => s.id === selectedFunnelStageId) || selectableStages[0])
              : 'prospect' as const,
            funnel_stage_id: selectedFunnelStageId || null,
          })
          .select()
          .single();

        if (leadError) throw leadError;
        
        // CRITICAL: Also create the lead_responsible entry so the user is tracked as responsible
        const { error: responsibleError } = await supabase
          .from('lead_responsibles')
          .insert({
            lead_id: newLead.id,
            user_id: user.id,
            organization_id: tenantId,
          });
        
        if (responsibleError) {
          console.error('Error creating lead responsible:', responsibleError);
        }

        // Record first ownership transfer in history
        try {
          await supabase.from('lead_ownership_transfers').insert({
            organization_id: tenantId,
            lead_id: newLead.id,
            from_user_id: null,
            to_user_id: user.id,
            transferred_by: user.id,
            transfer_reason: 'first_assignment',
            notes: 'Primeiro cadastro via Add Receptivo',
          });
        } catch (ownershipErr) {
          console.warn('Error recording first ownership:', ownershipErr);
        }

        // Record initial stage in history
        try {
          const stageEnum = selectedFunnelStageId 
            ? getStageEnumValue(selectableStages.find(s => s.id === selectedFunnelStageId) || selectableStages[0])
            : 'prospect';
          await supabase.from('lead_stage_history').insert({
            lead_id: newLead.id,
            organization_id: tenantId,
            stage: stageEnum,
            previous_stage: null,
            reason: 'Cadastro inicial via Add Receptivo',
            changed_by: user.id,
            source: 'manual',
          });
        } catch (stageErr) {
          console.warn('Error recording initial stage:', stageErr);
        }
        
        setLeadData(prev => ({ 
          ...prev, 
          id: newLead.id, 
          existed: true,
          created_at: newLead.created_at,
        }));
        
        toast({ title: 'Lead criado!', description: 'Cliente salvo no sistema' });
      } catch (error: unknown) {
        toast({ title: 'Erro ao criar lead', description: getErrorMessage(error), variant: 'destructive' });
        setIsCreatingLead(false);
        return;
      }
      setIsCreatingLead(false);
    }
    
    setCurrentStep('conversation');
    
    // Create attendance early so it's recorded even if seller exits
    if (!attendanceId && tenantId && user) {
      try {
        const result = await createAttendance.mutateAsync({
          organization_id: tenantId,
          user_id: user.id,
          lead_id: leadData.id || null,
          phone_searched: leadData.whatsapp || phoneInput,
          lead_existed: leadData.existed,
          conversation_mode: conversationMode || null,
          product_id: null,
          product_answers: null,
          sale_id: null,
          non_purchase_reason_id: null,
          purchase_potential_cents: null,
          completed: false,
          started_at: attendanceStartedAt || new Date().toISOString(),
          completed_at: null,
        });
        setAttendanceId(result.id);
      } catch (error) {
        console.warn('Error creating early attendance:', error);
      }
    }
  };

  const handleGoToProduct = async () => {
    if (!conversationMode) {
      toast({ title: 'Selecione o modo de conversa', variant: 'destructive' });
      return;
    }

    // Update attendance with conversation mode if it was created early without it
    if (attendanceId && conversationMode) {
      try {
        await updateAttendance.mutateAsync({
          id: attendanceId,
          updates: {
            conversation_mode: conversationMode,
            lead_id: leadData.id || null,
          },
        });
      } catch (error) {
        // Continue anyway
      }
    } else if (!attendanceId && tenantId && user) {
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
          purchase_potential_cents: null,
          completed: false,
          started_at: attendanceStartedAt || new Date().toISOString(),
          completed_at: null,
        });
        setAttendanceId(result.id);
      } catch (error) {
        // Continue anyway
      }
    }

    setCurrentStep('product');
  };

  const handleGoToOffer = () => {
    if (!currentProductId && offerItems.length === 0) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    setCurrentStep('offer');
  };

  const handleGoToAddress = () => setCurrentStep('address');
  const handleGoToPayment = () => {
    if (deliveryConfig.type === 'motoboy' && !deliveryConfig.regionId) {
      toast({ title: 'Selecione uma região de entrega', variant: 'destructive' });
      return;
    }
    if (deliveryConfig.type === 'motoboy' && !deliveryConfig.scheduledDate) {
      toast({ title: 'Selecione uma data de entrega', variant: 'destructive' });
      return;
    }
    // For carrier: manual flow doesn't require carrierId or quote selection
    // Only block if no carrier method was chosen at all (neither manual nor melhor_envio)
    // Manual flow is always valid - carrier selection and tracking code are optional
    setCurrentStep('payment');
  };
  const handleGoToSaleOrReason = () => {
    // Validate payment method is selected before proceeding
    if (!selectedPaymentMethodId) {
      toast({ 
        title: 'Selecione a forma de pagamento', 
        description: 'É obrigatório selecionar uma forma de pagamento antes de continuar.',
        variant: 'destructive' 
      });
      return;
    }
    setCurrentStep('sale_or_reason');
  };

  const handleRejectKit = async () => {
    if (!rejectionReason.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' });
      return;
    }

    const currentKit = sortedKits.find(k => k.id === currentKitId);
    if (!currentKit) {
      toast({ title: 'Erro', description: 'Kit não encontrado. Tente selecionar o kit novamente.', variant: 'destructive' });
      return;
    }
    
    if (!leadData.id) {
      toast({ title: 'Erro', description: 'Lead não identificado. Volte e pesquise o cliente novamente.', variant: 'destructive' });
      return;
    }

    try {
      await createKitRejection.mutateAsync({
        lead_id: leadData.id,
        product_id: currentProductId,
        kit_id: currentKit.id,
        kit_quantity: currentKit.quantity,
        kit_price_cents: currentUnitPrice,
        rejection_reason: rejectionReason,
      });

      const newRejected = [...currentRejectedKitIds, currentKit.id];
      setCurrentRejectedKitIds(newRejected);
      setRejectionReason('');
      setShowRejectionInput(false);
      setShowPromo2(false);
      setShowMinimum(false);
      
      // Auto-select next available kit instead of null
      const nextKit = sortedKits.find(k => !newRejected.includes(k.id));
      if (nextKit) {
        setCurrentKitId(nextKit.id);
        // Auto-select promotional price if available, otherwise regular
        setCurrentPriceType(nextKit.promotional_price_cents ? 'promotional' : 'regular');
      } else {
        setCurrentKitId(null);
      }
      
      toast({ title: 'Kit rejeitado', description: nextKit ? 'Próxima oferta disponível' : 'Todas ofertas rejeitadas' });
    } catch (error: any) {
      console.error('Kit rejection error:', error);
      toast({ title: 'Erro ao rejeitar kit', description: error.message || 'Tente novamente', variant: 'destructive' });
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
          stage: selectedFunnelStageId 
            ? getStageEnumValue(selectableStages.find(s => s.id === selectedFunnelStageId) || selectableStages[0])
            : 'prospect' as const,
          funnel_stage_id: selectedFunnelStageId || null,
        })
        .select()
        .single();

      if (leadError) throw leadError;
      leadId = newLead.id;
      setLeadData(prev => ({ ...prev, id: leadId }));
    } else if (leadId) {
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

  const saveProductAnswers = async (leadId: string, productQuestions: typeof currentProductQuestions) => {
    // Helper to save a single answer to the correct table
    const saveAnswer = async (
      productId: string,
      questionId: string,
      answerText: string,
      pQuestions: typeof currentProductQuestions
    ) => {
      if (!tenantId || !answerText) return;
      
      // Find the product question to check if it's standard
      const pq = pQuestions.find(q => q.id === questionId);
      
      if (pq?.is_standard && pq.standard_question_id) {
        // Save to lead_standard_question_answers
        // Parse the answer - could be comma-separated option IDs or a numeric value
        const optionIds = answerText.includes(',') || answerText.length === 36 
          ? answerText.split(',').filter(Boolean)
          : null;
        const numericValue = !optionIds && !isNaN(Number(answerText)) ? Number(answerText) : null;
        
        await supabase
          .from('lead_standard_question_answers')
          .upsert({
            lead_id: leadId,
            question_id: pq.standard_question_id,
            organization_id: tenantId,
            selected_option_ids: optionIds,
            numeric_value: numericValue,
            answered_by: user?.id || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'lead_id,question_id',
          });
      } else {
        // Save to lead_product_question_answers
        await supabase
          .from('lead_product_question_answers')
          .upsert({
            lead_id: leadId,
            product_id: productId,
            question_id: questionId,
            organization_id: tenantId,
            answer_text: answerText,
            updated_by: user?.id || null,
          }, {
            onConflict: 'lead_id,product_id,question_id',
          });
      }
    };

    // Save answers for all offer items
    for (const item of offerItems) {
      // Save legacy answers (key_question_1/2/3)
      if (Object.values(item.answers).some(v => v) && tenantId) {
        await supabase
          .from('lead_product_answers')
          .upsert({
            lead_id: leadId,
            product_id: item.productId,
            organization_id: tenantId,
            answer_1: item.answers.answer_1 || null,
            answer_2: item.answers.answer_2 || null,
            answer_3: item.answers.answer_3 || null,
            updated_by: user?.id || null,
          }, {
            onConflict: 'lead_id,product_id',
          });
      }
      
      // Save dynamic answers (product_questions) - need to fetch questions for each product
      if (Object.keys(item.dynamicAnswers).length > 0 && tenantId) {
        // Fetch product questions for this item
        const { data: itemQuestions = [] } = await supabase
          .from('product_questions')
          .select('id, is_standard, standard_question_id')
          .eq('product_id', item.productId);
        
        for (const [questionId, answerText] of Object.entries(item.dynamicAnswers)) {
          await saveAnswer(item.productId, questionId, answerText, itemQuestions as typeof currentProductQuestions);
        }
      }
    }
    
    // Save current product answers if any
    if (currentProductId && Object.values(currentAnswers).some(v => v) && tenantId) {
      await supabase
        .from('lead_product_answers')
        .upsert({
          lead_id: leadId,
          product_id: currentProductId,
          organization_id: tenantId,
          answer_1: currentAnswers.answer_1 || null,
          answer_2: currentAnswers.answer_2 || null,
          answer_3: currentAnswers.answer_3 || null,
          updated_by: user?.id || null,
        }, {
          onConflict: 'lead_id,product_id',
        });
    }
    
    // Save current product dynamic answers if any
    if (currentProductId && Object.keys(dynamicAnswers).length > 0 && tenantId) {
      for (const [questionId, answerText] of Object.entries(dynamicAnswers)) {
        await saveAnswer(currentProductId, questionId, answerText, productQuestions);
      }
    }
  };

  const handleCreateSale = async () => {
    setIsSaving(true);
    
    try {
      // Upload payment proof if provided
      let uploadedProofUrl: string | null = null;
      if (paymentProofFile && paymentStatus === 'paid_now') {
        const fileExt = paymentProofFile.name.split('.').pop();
        const fileName = `payment_proof_${Date.now()}.${fileExt}`;
        const filePath = `temp/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('sales-documents')
          .upload(filePath, paymentProofFile);
        
        if (uploadError) {
          toast({ title: 'Erro ao fazer upload do comprovante', variant: 'destructive' });
          setIsSaving(false);
          return;
        }
        
        uploadedProofUrl = filePath;
      }

      const leadId = await ensureLeadExists();
      if (!leadId) throw new Error('Erro ao criar lead');

      await saveProductAnswers(leadId, currentProductQuestions);

      if (selectedSourceId && tenantId && user) {
        await supabase.from('lead_source_history').insert({
          lead_id: leadId,
          organization_id: tenantId,
          source_id: selectedSourceId,
          recorded_by: user.id,
        });
      }

      // BUSINESS RULE: If any discount is applied, use default commission for all items
      const hasDiscount = totalDiscount > 0;
      const defaultCommission = myCommission?.commissionPercentage || 0;

      // Build all sale items
      const allItems = [];
      
      for (const item of offerItems) {
        // Calculate item total (for kit-based, unitPriceCents is already total kit price)
        const isKitBased = ['produto_pronto', 'print_on_demand', 'dropshipping'].includes(item.productCategory);
        const itemTotal = isKitBased ? item.unitPriceCents : (item.unitPriceCents * item.quantity);
        
        // If discount applied, use default commission
        const effectiveCommission = hasDiscount ? defaultCommission : item.commissionPercentage;
        const effectiveCommissionCents = Math.round(itemTotal * (effectiveCommission / 100));
        
        // CRITICAL: For kit-based products, unitPriceCents is the TOTAL kit price (e.g., R$1134 for 6 units)
        // We must save the PER-UNIT price so that: quantity × unit_price = correct total
        // Example: 6 units × R$189 per unit = R$1134 total
        const unitPriceForSale = isKitBased && item.quantity > 0
          ? Math.round(item.unitPriceCents / item.quantity)
          : item.unitPriceCents;
        
        allItems.push({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price_cents: unitPriceForSale,
          discount_cents: 0,
          requisition_number: item.requisitionNumber || null,
          commission_percentage: effectiveCommission,
          commission_cents: effectiveCommissionCents,
        });
      }

      // Add current product if valid (allow zero price for service products like "Buscar ALGO")
      if (currentProductId && currentQuantity > 0) {
        // Calculate effective commission for current product
        const effectiveCommission = hasDiscount ? defaultCommission : currentCommission;
        const effectiveCommissionCents = Math.round(currentProductSubtotal * (effectiveCommission / 100));
        
        // CRITICAL: For kit-based products, currentUnitPrice is the TOTAL kit price (e.g., R$1134 for 6 units)
        // We must save the PER-UNIT price so that: quantity × unit_price = correct total
        const isCurrentKitBasedForSale = currentProduct?.category && ['produto_pronto', 'print_on_demand', 'dropshipping'].includes(currentProduct.category);
        const unitPriceForCurrentSale = isCurrentKitBasedForSale && currentQuantity > 0
          ? Math.round(currentUnitPrice / currentQuantity)
          : currentUnitPrice;
        
        allItems.push({
          product_id: currentProductId,
          product_name: currentProduct?.name || 'Produto',
          quantity: currentQuantity,
          unit_price_cents: unitPriceForCurrentSale,
          discount_cents: allItems.length === 0 ? totalDiscount : 0,
          requisition_number: currentProduct?.category === 'manipulado' ? requisitionNumber : null,
          commission_percentage: effectiveCommission,
          commission_cents: effectiveCommissionCents,
        });
      }

      if (allItems.length === 0) {
        throw new Error('Nenhum produto selecionado');
      }

      // CRITICAL: Validate address for carrier delivery type
      if (deliveryConfig.type === 'carrier') {
        const hasSelectedAddress = selectedAddressId && selectedAddress;
        const hasLeadAddress = leadData.cep && leadData.street && leadData.city && leadData.state;
        
        if (!hasSelectedAddress && !hasLeadAddress) {
          toast({ 
            title: 'Endereço obrigatório', 
            description: 'Para entrega via transportadora, é necessário informar um endereço completo.', 
            variant: 'destructive' 
          });
          setIsSaving(false);
          return;
        }
      }

      const sale = await createSale.mutateAsync({
        lead_id: leadId,
        seller_user_id: sellerUserId,
        items: allItems,
        discount_type: discountValue > 0 ? discountType : null,
        discount_value: discountValue,
        delivery_type: deliveryConfig.type,
        delivery_region_id: deliveryConfig.regionId || selectedAddress?.delivery_region_id,
        scheduled_delivery_date: deliveryConfig.scheduledDate?.toISOString().split('T')[0] || null,
        scheduled_delivery_shift: deliveryConfig.scheduledShift,
        shipping_carrier_id: deliveryConfig.carrierId,
        shipping_cost_cents: deliveryConfig.shippingCost,
        shipping_cost_real_cents: deliveryConfig.shippingCostReal || deliveryConfig.shippingCost, // Real cost for free shipping tracking
        shipping_address_id: selectedAddressId, // Include selected address
        payment_method_id: useSplitPayment && splitPaymentLines.length > 0
          ? splitPaymentLines.reduce((a, b) => b.amount_cents > a.amount_cents ? b : a, splitPaymentLines[0]).payment_method_id
          : selectedPaymentMethodId,
        payment_installments: selectedInstallments,
        payment_status: paymentStatus,
        payment_proof_url: uploadedProofUrl,
        observation_1: deliveryObservation || null,
      });

      // Save split payment lines if used
      if (useSplitPayment && splitPaymentLines.length > 0) {
        await saveSalePayments.mutateAsync({
          saleId: sale.id,
          organizationId: sale.organization_id,
          payments: splitPaymentLines.map((l) => ({
            payment_method_id: l.payment_method_id,
            payment_method_name: l.payment_method_name,
            amount_cents: l.amount_cents,
          })),
        });
      }

      if (attendanceId) {
        await updateAttendance.mutateAsync({
          id: attendanceId,
          updates: {
            lead_id: leadId,
            product_id: currentProductId || offerItems[0]?.productId || null,
            product_answers: Object.keys(currentAnswers).length > 0 ? currentAnswers : null,
            sale_id: sale.id,
            completed: true,
            completed_at: new Date().toISOString(),
          },
        });
      }

      toast({ 
        title: 'Venda criada com sucesso!', 
        description: `Romaneio #${sale.romaneio_number}` 
      });
      
      sessionStorage.removeItem(SESSION_KEY);
      navigate(`/vendas/${sale.id}`);
    } catch (error: any) {
      toast({ title: 'Erro ao criar venda', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // When a reason is selected, check if it needs followup date confirmation
  const handleSelectReason = async (reasonId: string) => {
    if (purchasePotential <= 0) {
      toast({ title: 'Informe o potencial de compra', variant: 'destructive' });
      return;
    }
    
    const reason = nonPurchaseReasons.find(r => r.id === reasonId);
    
    // If reason has followup_hours, show the date picker first
    if (reason && reason.followup_hours > 0) {
      setPendingReasonId(reasonId);
      setCustomFollowupDate(null);
      return;
    }
    
    // Otherwise, confirm immediately
    await confirmReasonSelection(reasonId, null);
  };

  // When user confirms the followup date
  const handleFollowupConfirm = async (date: Date) => {
    if (!pendingReasonId) return;
    setCustomFollowupDate(date);
    await confirmReasonSelection(pendingReasonId, date);
  };

  // Cancel pending reason selection
  const handleCancelPendingReason = () => {
    setPendingReasonId(null);
    setCustomFollowupDate(null);
  };

  // Execute the actual reason confirmation (was handleSelectReason before)
  const confirmReasonSelection = async (reasonId: string, followupDate: Date | null) => {
    setSelectedReasonId(reasonId);
    setIsSaving(true);

    try {
      const reason = nonPurchaseReasons.find(r => r.id === reasonId);
      const leadId = await ensureLeadExists();
      
      if (leadId) {
        await saveProductAnswers(leadId, currentProductQuestions);

        if (selectedSourceId && tenantId && user) {
          await supabase.from('lead_source_history').insert({
            lead_id: leadId,
            organization_id: tenantId,
            source_id: selectedSourceId,
            recorded_by: user.id,
          });
        }

        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single();
        
        const currentNegotiated = lead?.negotiated_value || 0;
        const newNegotiated = currentNegotiated + (purchasePotential / 100);
        
        await supabase
          .from('leads')
          .update({ negotiated_value: newNegotiated })
          .eq('id', leadId);

        // Create followup with custom date if provided, otherwise calculate
        if (reason && reason.followup_hours > 0 && tenantId && user) {
          const followupDateTime = followupDate || new Date(Date.now() + reason.followup_hours * 60 * 60 * 1000);
          
          await supabase.from('lead_followups').insert({
            organization_id: tenantId,
            lead_id: leadId,
            user_id: user.id,
            scheduled_at: followupDateTime.toISOString(),
            reason: `Follow-up: ${reason.name}`,
            source_type: 'receptive',
            source_id: attendanceId,
          });
        }

        // Fire webhook if configured
        if (reason?.webhook_url) {
          console.log('Firing non-purchase webhook:', reason.webhook_url);
          try {
            await fetch(reason.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              mode: 'no-cors',
              body: JSON.stringify({
                event: 'non_purchase',
                reason_id: reason.id,
                reason_name: reason.name,
                lead_id: leadId,
                lead_name: lead?.name || leadData.name,
                lead_whatsapp: lead?.whatsapp || leadData.whatsapp,
                lead_email: lead?.email || leadData.email,
                purchase_potential_cents: purchasePotential,
                seller_user_id: sellerUserId,
                seller_name: user?.user_metadata?.name || user?.email,
                product_id: currentProductId,
                product_name: currentProduct?.name,
                followup_hours: reason.followup_hours,
                custom_followup_date: followupDate?.toISOString(),
                timestamp: new Date().toISOString(),
              }),
            });
            console.log('Non-purchase webhook sent successfully');
          } catch (webhookError) {
            console.error('Error sending non-purchase webhook:', webhookError);
          }
        }

        // Schedule automated messages for this reason
        const sellerUser = users.find(u => u.user_id === sellerUserId);
        const sellerName = sellerUser ? `${sellerUser.first_name || ''} ${sellerUser.last_name || ''}`.trim() : user?.user_metadata?.name || '';
        
        const productBrand = currentProduct?.brand_id 
          ? productBrands.find(b => b.id === currentProduct.brand_id)?.name 
          : undefined;
          
        const { scheduled, error: scheduleError } = await scheduleMessagesForReason({
          leadId,
          leadName: lead?.name || leadData.name,
          leadWhatsapp: lead?.whatsapp || leadData.whatsapp,
          reasonId,
          productId: currentProductId,
          productName: currentProduct?.name,
          productBrand,
          sellerName,
          customScheduledAt: followupDate || undefined,
        });

        if (scheduleError) {
          console.error('Error scheduling messages:', scheduleError);
        } else if (scheduled > 0) {
          console.log(`Scheduled ${scheduled} automated messages`);
        }
      }

      // Create attendance if it doesn't exist yet (e.g., "Sem Interesse" from early steps)
      let finalAttendanceId = attendanceId;
      if (!finalAttendanceId && tenantId && user) {
        try {
          const result = await createAttendance.mutateAsync({
            organization_id: tenantId,
            user_id: user.id,
            lead_id: leadId,
            phone_searched: leadData.whatsapp || phoneInput,
            lead_existed: leadData.existed,
            conversation_mode: conversationMode || 'receptive_call',
            product_id: currentProductId || null,
            product_answers: Object.keys(currentAnswers).length > 0 ? currentAnswers : null,
            sale_id: null,
            non_purchase_reason_id: reasonId,
            purchase_potential_cents: purchasePotential,
            completed: true,
            started_at: attendanceStartedAt || new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
          finalAttendanceId = result.id;
          setAttendanceId(result.id);
        } catch (err) {
          console.error('Error creating attendance for sem interesse:', err);
        }
      } else if (finalAttendanceId) {
        await updateAttendance.mutateAsync({
          id: finalAttendanceId,
          updates: {
            lead_id: leadId,
            product_id: currentProductId || null,
            product_answers: Object.keys(currentAnswers).length > 0 ? currentAnswers : null,
            non_purchase_reason_id: reasonId,
            purchase_potential_cents: purchasePotential,
            completed: true,
            completed_at: new Date().toISOString(),
          },
        });
      }

      toast({ 
        title: 'Atendimento finalizado', 
        description: `Motivo: ${reason?.name}` 
      });
      
      setPendingReasonId(null);
      setCustomFollowupDate(null);
      sessionStorage.removeItem(SESSION_KEY);
      navigate('/');
    } catch (error: any) {
      toast({ title: 'Erro ao finalizar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Get the current visible kit (first non-rejected)
  const currentVisibleKit = sortedKits.find(k => !currentRejectedKitIds.includes(k.id));
  const hasMoreKits = sortedKits.filter(k => !currentRejectedKitIds.includes(k.id)).length > 1;
  const allKitsRejected = sortedKits.every(k => currentRejectedKitIds.includes(k.id));

  // Spy buttons component
  const SpyButtons = () => {
    if (!leadData.id) return null;
    
    return (
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`/leads/${leadData.id}`, '_blank')}
        >
          <Eye className="w-4 h-4 mr-1" />
          Espiar Cliente
        </Button>
        {leadSales.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/leads/${leadData.id}`, '_blank')}
          >
            <History className="w-4 h-4 mr-1" />
            Espiar Vendas ({leadSales.length})
          </Button>
        )}
      </div>
    );
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'phone', label: 'Telefone', icon: Phone },
      { key: 'lead_info', label: 'Cliente', icon: User },
      { key: 'conversation', label: 'Conversa', icon: MessageSquare },
      { key: 'product', label: 'Produto', icon: Package },
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

  const renderNavButtons = (onBack?: () => void, onNext?: () => void, nextDisabled?: boolean, nextLabel?: string, isLoading?: boolean) => (
    <div className="flex justify-between gap-2">
      {onBack ? (
        <Button variant="outline" onClick={onBack} disabled={isLoading}>Voltar</Button>
      ) : <div />}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled || isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {nextLabel || 'Continuar'}
          {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
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

  // Helper: Render the left panel client data (always visible after phone step)
  const renderLeftPanel = () => (
    <div className="p-4 space-y-4">
      {/* Lead Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{leadData.name || 'Novo Cliente'}</h2>
          <p className="text-sm text-muted-foreground font-mono">{leadData.whatsapp}</p>
        </div>
        <SpyButtons />
      </div>

      {/* Stage & Stars for existing leads */}
      {leadData.existed && leadData.stage && (
        <div className="flex items-center gap-4 flex-wrap">
          <Badge className={FUNNEL_STAGES[leadData.stage]?.color}>
            {FUNNEL_STAGES[leadData.stage]?.label}
          </Badge>
          {leadData.stars !== undefined && leadData.stars > 0 && (
            <div className="flex items-center gap-1">
              {Array.from({ length: leadData.stars }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Funnel stage selector for new leads */}
      {!leadData.existed && selectableStages.length > 0 && (
        <div className="space-y-2">
          <Label>Etapa do Funil</Label>
          <Select value={selectedFunnelStageId} onValueChange={setSelectedFunnelStageId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {selectableStages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${stage.color.startsWith('bg-') ? stage.color : ''}`}
                      style={{ backgroundColor: !stage.color.startsWith('bg-') ? stage.color : undefined }}
                    />
                    {stage.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {/* Basic Info - Compact Editable Fields */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2 text-sm">
          <User className="w-4 h-4" />
          Informações do Cliente
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={leadData.name}
              onChange={(e) => setLeadData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do cliente"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">WhatsApp</Label>
            <Input value={leadData.whatsapp} disabled className="bg-muted h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tel. Secundário</Label>
            <Input
              value={leadData.secondary_phone}
              onChange={(e) => setLeadData(prev => ({ ...prev, secondary_phone: e.target.value }))}
              placeholder="Outro telefone"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={leadData.email}
              onChange={(e) => setLeadData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Instagram</Label>
            <Input
              value={leadData.instagram}
              onChange={(e) => setLeadData(prev => ({ ...prev, instagram: e.target.value }))}
              placeholder="@usuario"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Especialidade</Label>
            <Input
              value={leadData.specialty}
              onChange={(e) => setLeadData(prev => ({ ...prev, specialty: e.target.value }))}
              placeholder="Ex: Dermatologia"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF/CNPJ</Label>
            <Input
              value={leadData.cpf_cnpj}
              onChange={(e) => setLeadData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
              placeholder="000.000.000-00"
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-2">
          <FileText className="w-3 h-3" />
          Observações
        </Label>
        <Textarea
          value={leadData.observations}
          onChange={(e) => setLeadData(prev => ({ ...prev, observations: e.target.value }))}
          placeholder="Notas sobre o cliente..."
          rows={2}
          className="text-sm"
        />
      </div>

      {/* HISTORY SECTIONS - only for existing leads */}
      {leadData.existed && leadData.id && (
        <SectionErrorBoundary title="Histórico do lead">
          <>
            {/* Previous Sales */}
            {leadSales.length > 0 && (
              <Card className="border-green-500/30">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-green-600 text-sm">
                    <ShoppingCart className="w-4 h-4" />
                    Vendas Anteriores ({leadSales.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="space-y-2">
                    {leadSales.slice(0, 5).map((sale) => (
                      <div
                        key={sale.id}
                        className="p-2 rounded-lg border bg-muted/30 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getStatusColor(sale.status)}>
                              {getStatusLabel(sale.status)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="font-semibold text-primary text-sm mt-1">
                            {formatCurrency(sale.total_cents)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    {leadSales.length > 5 && (
                      <Button
                        variant="ghost"
                        className="w-full text-xs"
                        onClick={() => window.open(`/leads/${leadData.id}`, '_blank')}
                      >
                        Ver todas as {leadSales.length} vendas
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Addresses */}
            <LeadAddressesManager leadId={leadData.id} />

            {/* Standard Questions */}
            {orgFeatures?.standard_questions !== false && (
              <SectionErrorBoundary title="Perguntas Sovida">
                {leadData.id ? (
                  <LeadStandardQuestionsSection leadId={leadData.id} />
                ) : (
                  <Card className="bg-muted/30 border-dashed">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground text-center">
                        Finalize ou busque um lead para acessar as Perguntas Sovida
                      </p>
                    </CardContent>
                  </Card>
                )}
              </SectionErrorBoundary>
            )}

            {/* Follow-ups */}
            <LeadFollowupsSection leadId={leadData.id} />

            {/* SAC */}
            <LeadSacSection leadId={leadData.id} />

            {/* Receptive History */}
            <LeadReceptiveHistorySection leadId={leadData.id} />

            {/* Stage Timeline */}
            {leadData.stage && (
              <LeadStageTimeline leadId={leadData.id} currentStage={leadData.stage} />
            )}
          </>
        </SectionErrorBoundary>
      )}
    </div>
  );

  // Helper: Render right panel content based on current step
  const renderRightPanel = () => {
    switch (currentStep) {
      case 'lead_info':
        return (
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Dados do Cliente
                </CardTitle>
                <CardDescription>
                  Confira os dados ao lado e clique em continuar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Os dados do cliente estão visíveis no painel à esquerda. Edite conforme necessário e continue.
                </p>
                <div className="flex justify-end">
                  <Button 
                    onClick={handleGoToConversation} 
                    disabled={!leadData.name.trim() || isCreatingLead}
                    size="lg"
                  >
                    {isCreatingLead && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isCreatingLead ? 'Criando...' : 'Continuar'}
                    {!isCreatingLead && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'conversation':
        return (
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Modo de Conversa e Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderNavButtons(() => setCurrentStep('phone'), handleGoToProduct, !conversationMode)}
                <Separator />

                <div className="space-y-2">
                  <Label>Como está conversando com o cliente? *</Label>
                  <div className="grid grid-cols-2 gap-2">
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
                  {/* Lead sources as buttons instead of dropdown */}
                  <div className="grid grid-cols-2 gap-2">
                    {leadSources.map((source) => (
                      <Button
                        key={source.id}
                        variant={selectedSourceId === source.id ? 'default' : 'outline'}
                        className="justify-start text-sm h-auto py-2"
                        onClick={() => setSelectedSourceId(source.id)}
                      >
                        {source.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />
                {renderNavButtons(() => setCurrentStep('phone'), handleGoToProduct, !conversationMode)}
              </CardContent>
            </Card>
          </div>
        );

      case 'product':
        return (
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produto de Interesse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderNavButtons(() => setCurrentStep('conversation'), handleGoToOffer, !currentProductId && offerItems.length === 0)}
                <Separator />
                
                <ProductSelectorForSale
                  products={products}
                  isLoading={false}
                  onSelect={(product) => {
                    setCurrentProductId(product.id);
                    setCurrentKitId(null);
                    setCurrentRejectedKitIds([]);
                    setShowPromo2(false);
                    setShowMinimum(false);
                  }}
                  placeholder="Buscar produto por nome..."
                />

                {currentProduct && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {currentProduct.is_featured && <Star className="w-4 h-4 text-amber-500" />}
                      <span className="font-medium">{currentProduct.name}</span>
                      <Badge variant="outline">{currentProduct.category}</Badge>
                    </div>
                    {currentProduct.description && (
                      <p className="text-sm text-muted-foreground mt-2">{currentProduct.description}</p>
                    )}
                  </div>
                )}

                <Separator />
                {renderNavButtons(() => setCurrentStep('conversation'), handleGoToOffer, !currentProductId && offerItems.length === 0)}
              </CardContent>
            </Card>
          </div>
        );

      case 'offer':
        return (
          <div className="h-full flex flex-col">
            {/* Top: Product photo, FAQ, composition, questions, script */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Current Product Offer Card (photo, script, FAQ, questions) */}
                {currentProduct && (
                  <ProductOfferCard
                    product={currentProduct}
                    sortedKits={sortedKits}
                    currentKitId={currentKitId}
                    currentPriceType={currentPriceType}
                    currentRejectedKitIds={currentRejectedKitIds}
                    showPromo2={showPromo2}
                    showMinimum={showMinimum}
                    currentAnswers={currentAnswers}
                    dynamicAnswers={dynamicAnswers}
                    defaultCommission={myCommission?.commissionPercentage || 0}
                    requisitionNumber={requisitionNumber}
                    manipuladoPrice={manipuladoPrice}
                    manipuladoQuantity={manipuladoQuantity}
                    leadId={leadData.id}
                    showRejectionInput={showRejectionInput}
                    rejectionReason={rejectionReason}
                    isRejecting={createKitRejection.isPending}
                    negotiatedPriceCents={negotiatedPriceCents}
                    negotiatedInstallments={negotiatedInstallments}
                    negotiatedCommission={negotiatedCommission}
                    onNegotiate={(price, installments, commission) => {
                      setNegotiatedPriceCents(price);
                      setNegotiatedInstallments(installments);
                      setNegotiatedCommission(commission);
                    }}
                    onKitSelect={(kitId, priceType) => {
                      setCurrentKitId(kitId);
                      setCurrentPriceType(priceType);
                      setNegotiatedPriceCents(undefined);
                      setNegotiatedInstallments(12);
                      setNegotiatedCommission(undefined);
                    }}
                    onRevealPromo2={() => setShowPromo2(true)}
                    onRevealMinimum={() => setShowMinimum(true)}
                    onAnswersChange={setCurrentAnswers}
                    onDynamicAnswersChange={setDynamicAnswers}
                    onRequisitionChange={setRequisitionNumber}
                    onManipuladoPriceChange={setManipuladoPrice}
                    onManipuladoQuantityChange={setManipuladoQuantity}
                    onShowRejectionInput={setShowRejectionInput}
                    onRejectionReasonChange={setRejectionReason}
                    onRejectKit={handleRejectKit}
                    onAddProduct={handleAddProductToOffer}
                    onResetProduct={resetCurrentProduct}
                    currentUnitPrice={currentUnitPrice}
                    currentQuantity={currentQuantity}
                    currentCommission={currentCommission}
                  />
                )}

                {/* Add another product button */}
                {!currentProduct && showAddProduct && offerItems.length > 0 && (
                  <Card className="border-dashed">
                    <CardContent className="py-4">
                      <ProductSelectorForSale
                        products={products}
                        isLoading={false}
                        onSelect={(product) => {
                          setCurrentProductId(product.id);
                          setCurrentKitId(null);
                          setCurrentRejectedKitIds([]);
                          setShowPromo2(false);
                          setShowMinimum(false);
                          setShowAddProduct(false);
                        }}
                        placeholder="Adicionar outro produto..."
                      />
                    </CardContent>
                  </Card>
                )}

                {!currentProduct && !showAddProduct && offerItems.length > 0 && (
                  <Button variant="outline" onClick={() => setShowAddProduct(true)} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Produto
                  </Button>
                )}
              </div>
            </div>
            {/* ─── Divider ─── */}
            <div className="h-1 bg-border shrink-0 shadow-sm" />
            {/* Bottom: Values, confirmed products, summary, decision */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Already added products */}
                {offerItems.length > 0 && (
                  <Card className="border-green-500/30">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="flex items-center gap-2 text-green-700 text-sm">
                        <Package className="w-4 h-4" />
                        Produtos Confirmados ({offerItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-3">
                      {offerItems.map((item, index) => {
                        const itemTotal = item.unitPriceCents * item.quantity;
                        const installmentValue = Math.round(itemTotal / 10);
                        return (
                          <div key={index} className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold">{item.productName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">{item.quantity} un</Badge>
                                  {item.requisitionNumber && (
                                    <Badge variant="secondary" className="text-xs">Req: {item.requisitionNumber}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-700">{formatPrice(itemTotal)}</p>
                                <p className="text-xs text-muted-foreground">12x {formatPrice(installmentValue)}</p>
                              </div>
                            </div>
                            <div className="flex justify-between mt-2 text-xs">
                              <span className="text-green-600">Comissão: {formatPrice(item.commissionCents)}</span>
                              <Button variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => handleRemoveFromOffer(index)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Cross-sell */}
                {getCrossSellProducts().length > 0 && (
                  <Card className="border-amber-300">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="flex items-center gap-2 text-amber-700 text-sm">
                        <Gift className="w-4 h-4" />
                        Venda Casada
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="grid grid-cols-2 gap-2">
                        {getCrossSellProducts().map((crossProduct) => (
                          <Button
                            key={crossProduct.id}
                            variant="outline"
                            className="justify-start h-auto p-3 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                            onClick={() => {
                              if (currentUnitPrice > 0) {
                                handleAddProductToOffer();
                              }
                              setCurrentProductId(crossProduct.id);
                              setCurrentKitId(null);
                              setCurrentRejectedKitIds([]);
                              setShowPromo2(false);
                              setShowMinimum(false);
                            }}
                          >
                            <div className="text-left">
                              <p className="font-medium text-sm">{crossProduct.name}</p>
                              <p className="text-xs text-muted-foreground">{crossProduct.category}</p>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Order Summary */}
                {(currentUnitPrice > 0 || offerItems.length > 0) && (
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Resumo do Pedido</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2">
                      {offerItems.map((item, index) => {
                        const itemTotal = item.unitPriceCents * item.quantity;
                        const installmentValue = Math.round(itemTotal / 10);
                        return (
                          <div key={index} className="p-2 bg-muted/30 rounded-lg">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{item.quantity}x {item.productName}</span>
                              <span className="font-bold">{formatPrice(itemTotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>ou 12x de {formatPrice(installmentValue)}</span>
                              <span className="text-green-600">Ganhe {formatPrice(item.commissionCents)}</span>
                            </div>
                          </div>
                        );
                      })}
                      
                      {currentUnitPrice > 0 && currentProduct && (
                        <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{currentQuantity}x {currentProduct.name}</span>
                            <span className="font-bold">{formatPrice(currentProductSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>ou 12x de {formatPrice(Math.round(currentProductSubtotal / 10))}</span>
                            <span className="text-green-600">Ganhe {formatPrice(currentCommissionValue)}</span>
                          </div>
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
                        <div className="text-right">
                          <span>{formatPrice(total)}</span>
                          <p className="text-xs font-normal text-muted-foreground">
                            ou 12x de {formatPrice(Math.round(total / 10))}
                          </p>
                        </div>
                      </div>
                      <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-green-600" />
                            Sua comissão total:
                          </span>
                          <span className="font-bold text-green-600">
                            Ganhe {formatPrice(totalCommissionValue)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Non-Purchase Reasons */}
                <Card className="border-amber-500/30">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-amber-600 text-sm">
                      <ThumbsDown className="w-4 h-4" />
                      Não Fechou a Venda?
                    </CardTitle>
                    <CardDescription className="text-xs">Informe o potencial e selecione o motivo</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2 text-xs">
                        <Coins className="w-3 h-3 text-amber-500" />
                        Potencial de Compra *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none text-sm">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={purchasePotential > 0 ? (purchasePotential / 100).toFixed(2).replace('.', ',') : ''}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            if (!rawValue.trim()) {
                              setPurchasePotential(0);
                              return;
                            }
                            const onlyDigits = rawValue.replace(/\D/g, '');
                            const cents = parseInt(onlyDigits || '0', 10);
                            setPurchasePotential(cents);
                          }}
                          onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                          className="pl-10 text-right h-9"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Show FollowupDateTimeEditor if a reason with followup is pending */}
                    {pendingReasonId && (() => {
                      const pendingReason = nonPurchaseReasons.find(r => r.id === pendingReasonId);
                      if (!pendingReason) return null;
                      return (
                        <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                                Motivo: {pendingReason.name}
                              </p>
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                Confirme a data/hora do follow-up
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleCancelPendingReason}
                              disabled={isSaving}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                          <FollowupDateTimeEditor
                            suggestedHours={pendingReason.followup_hours}
                            onConfirm={handleFollowupConfirm}
                            disabled={isSaving}
                          />
                          {pendingReason.exclusivity_hours > 0 && (
                            <p className="text-xs text-amber-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Você terá {pendingReason.exclusivity_hours}h de exclusividade após o follow-up
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {!pendingReasonId && (
                      <>
                        <p className="text-xs text-muted-foreground">Selecione o motivo para acompanhamento futuro</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {nonPurchaseReasons.slice(0, 4).map((reason) => (
                            <Button
                              key={reason.id}
                              variant="outline"
                              size="sm"
                              className={`justify-start h-auto p-2 ${
                                selectedReasonId === reason.id ? 'border-amber-500 bg-amber-500/10' : ''
                              }`}
                              onClick={() => handleSelectReason(reason.id)}
                              disabled={isSaving || purchasePotential <= 0}
                            >
                              <div className="flex-1 text-left">
                                <p className="font-medium text-xs">{reason.name}</p>
                                {reason.followup_hours > 0 && (
                                  <Badge variant="secondary" className="text-[10px] mt-0.5">
                                    <Calendar className="w-2.5 h-2.5 mr-0.5" />
                                    {reason.followup_hours}h
                                  </Badge>
                                )}
                              </div>
                              {isSaving && selectedReasonId === reason.id && (
                                <Loader2 className="w-3 h-3 animate-spin ml-1" />
                              )}
                            </Button>
                          ))}
                        </div>
                        {purchasePotential <= 0 && (
                          <p className="text-[10px] text-destructive text-center">Informe o potencial de compra para selecionar um motivo</p>
                        )}
                        {nonPurchaseReasons.length > 4 && (
                          <Button
                            variant="ghost"
                            className="w-full text-xs text-amber-700"
                            onClick={() => setCurrentStep('sale_or_reason')}
                          >
                            Ver todos os followups ({nonPurchaseReasons.length})
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep('product')}>Voltar</Button>
                  <Button onClick={handleGoToAddress} disabled={!(currentProductId || offerItems.length > 0)}>
                    Continuar para Entrega
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'address':
        return (
          <div className="p-4 space-y-4">
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

                {leadData.id ? (
                  <AddressSelector
                    leadId={leadData.id}
                    value={selectedAddressId}
                    onChange={handleAddressChange}
                  />
                ) : (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Lead não salvo</p>
                      <p className="text-xs text-amber-700 dark:text-amber-500">
                        Volte à etapa anterior para salvar os dados do lead e poder gerenciar endereços.
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                <DeliveryTypeSelector
                  value={deliveryConfig}
                  onChange={setDeliveryConfig}
                  leadRegionId={selectedAddress?.delivery_region_id || leadData.delivery_region_id || null}
                  leadCpfCnpj={leadData.cpf_cnpj}
                  leadCep={selectedAddress?.cep || leadData.cep || null}
                  hasValidAddress={!!(selectedAddress?.cep && selectedAddress?.street && selectedAddress?.city && selectedAddress?.state)}
                  onUpdateCpf={(cpf) => setLeadData(prev => ({ ...prev, cpf_cnpj: cpf }))}
                />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observação para Entrega
                  </Label>
                  <Textarea
                    value={deliveryObservation}
                    onChange={(e) => setDeliveryObservation(e.target.value)}
                    placeholder="Ex: Colocar em embalagem de presente, será recebido pelo filho..."
                    className="min-h-[80px]"
                  />
                </div>

                {leadData.id && (
                  <LeadProfilePrompt
                    leadId={leadData.id}
                    leadName={leadData.name}
                    currentBirthDate={leadData.birth_date}
                    currentGender={leadData.gender}
                    currentFavoriteTeam={leadData.favorite_team}
                    onUpdate={async (updates) => {
                      await updateLead.mutateAsync({ id: leadData.id!, ...updates });
                      setLeadData(prev => ({ ...prev, ...updates }));
                    }}
                  />
                )}

                <Separator />
                {renderNavButtons(() => setCurrentStep('offer'), handleGoToPayment)}
              </CardContent>
            </Card>
          </div>
        );

      case 'payment':
        return (
          <div className="p-4 space-y-4">
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Forma de Pagamento</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setUseSplitPayment(!useSplitPayment);
                        if (!useSplitPayment) {
                          // Initialize split with current method if selected
                          if (selectedPaymentMethodId) {
                            const pm = paymentMethods.find(m => m.id === selectedPaymentMethodId);
                            setSplitPaymentLines([{
                              id: `split_init_${Date.now()}`,
                              payment_method_id: selectedPaymentMethodId,
                              payment_method_name: pm?.name || '',
                              amount_cents: total,
                            }]);
                          } else {
                            setSplitPaymentLines([]);
                          }
                        }
                      }}
                    >
                      {useSplitPayment ? 'Pagamento único' : '💳 Dividir pagamento'}
                    </Button>
                  </div>

                  {useSplitPayment ? (
                    <SplitPaymentEditor
                      totalCents={total}
                      lines={splitPaymentLines}
                      onChange={setSplitPaymentLines}
                    />
                  ) : (
                    <>
                      <Select value={selectedPaymentMethodId || ''} onValueChange={setSelectedPaymentMethodId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map((pm) => (
                            <SelectItem key={pm.id} value={pm.id}>
                              <div className="flex items-center gap-2">
                                <span>{pm.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {PAYMENT_TIMING_LABELS[pm.payment_timing] || pm.payment_timing}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedPaymentMethod?.payment_timing === 'installments' && (
                        <div className="space-y-2">
                          <Label>Parcelas</Label>
                          <Select value={String(selectedInstallments)} onValueChange={(v) => setSelectedInstallments(Number(v))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableInstallments().map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}x de {formatPrice(Math.round(total / n))}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Status do Pagamento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'not_paid', label: 'Não pagou' },
                      { value: 'will_pay_before', label: 'Pagará antes da entrega' },
                      { value: 'paid_now', label: 'Pagou agora' },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        variant={paymentStatus === opt.value ? 'default' : 'outline'}
                        className="text-xs h-auto py-2"
                        onClick={() => setPaymentStatus(opt.value as typeof paymentStatus)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {paymentStatus === 'paid_now' && (
                  <div className="space-y-2">
                    <Label>Comprovante de Pagamento</Label>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                    />
                  </div>
                )}

                {/* Payment Actions Bar - Always visible to encourage digital payments */}
                {leadData.id && total > 0 && (
                  <>
                    <Separator />
                    <PaymentActionsBar
                      amountCents={total}
                      customerName={leadData.name}
                      customerPhone={leadData.whatsapp}
                      customerEmail={leadData.email}
                      customerDocument={leadData.cpf_cnpj}
                      leadId={leadData.id}
                      productName={offerItems.length > 0 ? offerItems.map(i => i.productName).join(', ') : currentProduct?.name}
                    />
                  </>
                )}

                <Separator />
                {renderNavButtons(() => setCurrentStep('address'), handleGoToSaleOrReason)}
              </CardContent>
            </Card>
          </div>
        );

      case 'sale_or_reason':
        return (
          <div className="p-4 space-y-4">
            {/* Create Sale */}
            <Card className="border-green-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <ShoppingCart className="w-5 h-5" />
                  Fechar Venda
                </CardTitle>
                <CardDescription>
                  {formatPrice(total)} • {offerItems.length + (currentUnitPrice > 0 ? 1 : 0)} produto(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Editable Summary */}
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 space-y-3 text-sm">
                  {offerItems.map((item, index) => {
                    const isKitBased = ['produto_pronto', 'print_on_demand', 'dropshipping'].includes(item.productCategory);
                    const itemTotal = isKitBased ? item.unitPriceCents : (item.unitPriceCents * item.quantity);
                    return (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                if (item.quantity > 1) {
                                  setOfferItems(prev => prev.map((it, i) => 
                                    i === index ? { ...it, quantity: it.quantity - 1 } : it
                                  ));
                                }
                              }}
                              disabled={item.quantity <= 1}
                            >
                              <span className="text-lg">−</span>
                            </Button>
                            <span className="w-6 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setOfferItems(prev => prev.map((it, i) => 
                                  i === index ? { ...it, quantity: it.quantity + 1 } : it
                                ));
                              }}
                            >
                              <span className="text-lg">+</span>
                            </Button>
                          </div>
                          <span className="truncate">{item.productName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatPrice(itemTotal)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveFromOffer(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {currentUnitPrice > 0 && currentProduct && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              if (currentQuantity > 1) {
                                setManipuladoQuantity(prev => prev - 1);
                              }
                            }}
                            disabled={currentQuantity <= 1}
                          >
                            <span className="text-lg">−</span>
                          </Button>
                          <span className="w-6 text-center font-medium">{currentQuantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setManipuladoQuantity(prev => prev + 1);
                            }}
                          >
                            <span className="text-lg">+</span>
                          </Button>
                        </div>
                        <span className="truncate">{currentProduct.name}</span>
                      </div>
                      <span className="font-medium">{formatPrice(currentProductSubtotal)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  {/* Discount Section */}
                  <div className="space-y-2">
                    <Label className="text-xs">Desconto</Label>
                    <div className="flex gap-2">
                      <Select value={discountType} onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}>
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">R$</SelectItem>
                          <SelectItem value="percentage">%</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        placeholder="0"
                        className="h-8"
                      />
                    </div>
                  </div>

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
                    <div className="text-right">
                      <span className="text-green-600">{formatPrice(total)}</span>
                      <p className="text-sm font-normal text-muted-foreground">
                        ou 12x de {formatPrice(Math.round(total / 10))}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Sua comissão ({myCommission?.commissionPercentage || 0}%)</span>
                    {totalDiscount > 0 ? (
                      <span className="text-amber-600">
                        {formatPrice(Math.round(subtotal * ((myCommission?.commissionPercentage || 0) / 100)))}
                        <span className="text-xs ml-1">(padrão)</span>
                      </span>
                    ) : (
                      <span>{formatPrice(totalCommissionValue)}</span>
                    )}
                  </div>
                  {totalDiscount > 0 && (
                    <p className="text-xs text-amber-600 text-center mt-2">
                      ⚠️ Com desconto aplicado, a comissão é calculada pela taxa padrão
                    </p>
                  )}
                </div>

                {/* Delivery Observation */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Observação para Entrega
                  </Label>
                  <Textarea
                    value={deliveryObservation}
                    onChange={(e) => setDeliveryObservation(e.target.value)}
                    placeholder="Ex: Entregar após as 18h, portaria do prédio..."
                    rows={2}
                  />
                </div>

                <Button 
                  size="lg" 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleCreateSale}
                  disabled={isSaving || (offerItems.length === 0 && !currentProductId)}
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
                <CardDescription>Informe o potencial de compra e selecione o motivo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    Potencial de Compra *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">
                      R$
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={purchasePotential > 0 ? (purchasePotential / 100).toFixed(2).replace('.', ',') : ''}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (!rawValue.trim()) {
                          setPurchasePotential(0);
                          return;
                        }
                        const onlyDigits = rawValue.replace(/\D/g, '');
                        const cents = parseInt(onlyDigits || '0', 10);
                        setPurchasePotential(cents);
                      }}
                      onFocus={(e) => setTimeout(() => e.target.select(), 0)}
                      className="pl-10 text-right"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este valor será adicionado ao "Valor Negociado" do lead
                  </p>
                </div>

                <Separator />

                {pendingReasonId && (() => {
                  const pendingReason = nonPurchaseReasons.find(r => r.id === pendingReasonId);
                  if (!pendingReason) return null;
                  return (
                    <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-200">
                            Motivo: {pendingReason.name}
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Confirme a data/hora do follow-up
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleCancelPendingReason}
                          disabled={isSaving}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                      <FollowupDateTimeEditor
                        suggestedHours={pendingReason.followup_hours}
                        onConfirm={handleFollowupConfirm}
                        disabled={isSaving}
                      />
                      {pendingReason.exclusivity_hours > 0 && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Você terá {pendingReason.exclusivity_hours}h de exclusividade após o follow-up
                        </p>
                      )}
                    </div>
                  );
                })()}

                {!pendingReasonId && (
                  <div className="space-y-3">
                    {nonPurchaseReasons.map((reason) => (
                      <Button
                        key={reason.id}
                        variant="outline"
                        className={`w-full justify-start h-auto p-4 ${
                          selectedReasonId === reason.id ? 'border-amber-500 bg-amber-500/10' : ''
                        }`}
                        onClick={() => handleSelectReason(reason.id)}
                        disabled={isSaving || purchasePotential <= 0}
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium">{reason.name}</p>
                          {reason.followup_hours > 0 && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              <Calendar className="w-3 h-3 mr-1" />
                              Sugestão: {reason.followup_hours}h
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
                  </div>
                )}
              </CardContent>
            </Card>

            <Button variant="outline" onClick={() => setCurrentStep('payment')} className="w-full">
              Voltar
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="h-screen flex flex-col bg-background">
        {/* Top Bar - Compact Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { sessionStorage.removeItem(SESSION_KEY); navigate('/'); }}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-lg font-bold hidden sm:block">Add Receptivo</h1>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto">
            {renderStepIndicator()}
          </div>
          {/* Sem Interesse - Big Red Button, always visible after phone step */}
          {currentStep !== 'phone' && (
            <Button 
              variant="destructive" 
              size="lg"
              className="font-bold px-6 text-base shrink-0"
              onClick={() => setShowQuickFollowupDialog(true)}
              disabled={!leadData.name.trim() || isSaving}
            >
              <XCircle className="w-5 h-5 mr-2" />
              SEM INTERESSE
            </Button>
          )}
        </header>

        {/* Main Content */}
        {currentStep === 'phone' ? (
          /* Phone Step - Full Width */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
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
                    />
                    <Button onClick={handlePhoneSearch} disabled={searchLead.isPending}>
                      {searchLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: 55 (DDI) + DDD + Número. Ex: 5551999887766
                  </p>
                  
                  <Separator className="my-4" />
                  
                  {/* Name Search */}
                  <div className="space-y-3">
                    <div>
                      <Label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <User className="w-4 h-4" />
                        Ou buscar por nome
                      </Label>
                      <Input
                        type="text"
                        placeholder="Digite o nome do cliente..."
                        value={nameSearchInput}
                        onChange={(e) => setNameSearchInput(e.target.value)}
                        className="text-base"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Digite pelo menos 2 caracteres para buscar
                      </p>
                    </div>
                    
                    {nameSearchInput.length >= 2 && (
                      <div className="border rounded-lg overflow-hidden">
                        {isSearchingByName ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
                          </div>
                        ) : nameSearchResults.length === 0 ? (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            Nenhum cliente encontrado com esse nome
                          </div>
                        ) : (
                          <ScrollArea className="max-h-60">
                            <div className="divide-y">
                              {nameSearchResults.map((lead) => (
                                <div
                                  key={lead.id}
                                  className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer transition-colors"
                                  onClick={() => handleSelectLeadFromNameSearch(lead.id)}
                                >
                                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary font-semibold text-sm">
                                      {lead.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{lead.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Phone className="w-3 h-3" />
                                      <span className="font-mono">{lead.whatsapp}</span>
                                      {lead.city && (
                                        <>
                                          <span>•</span>
                                          <span>{lead.city}/{lead.state}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`w-3 h-3 ${i < lead.stars ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Split Layout - Left: Client Data | Right: Actions */
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            {/* Left Panel - Client Data & History */}
            <ResizablePanel defaultSize={40} minSize={25}>
              <ScrollArea className="h-full">
                {renderLeftPanel()}
              </ScrollArea>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            {/* Right Panel - Action Steps */}
            <ResizablePanel defaultSize={60} minSize={30}>
              {currentStep === 'offer' ? (
                /* Offer step handles its own dual-scroll layout */
                renderRightPanel()
              ) : (
                <ScrollArea className="h-full">
                  {renderRightPanel()}
                </ScrollArea>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Lead Transfer Dialog */}
      <LeadTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        existingLead={existingLeadForTransfer}
        reason="receptivo"
        onTransferComplete={handleTransferComplete}
      />

      {/* Quick Followup Dialog */}
      <QuickFollowupDialog
        open={showQuickFollowupDialog}
        onOpenChange={setShowQuickFollowupDialog}
        reasons={nonPurchaseReasons}
        purchasePotential={purchasePotential}
        onPurchasePotentialChange={setPurchasePotential}
        onSelectReason={async (reasonId, followupDate) => {
          await confirmReasonSelection(reasonId, followupDate || null);
        }}
        isSaving={isSaving}
      />
    </>
  );
}
