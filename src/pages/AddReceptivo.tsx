import { useState, useEffect } from 'react';
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
  Plus,
  Calendar
} from 'lucide-react';
import { 
  useReceptiveModuleAccess, 
  useSearchLeadByPhone, 
  useCreateReceptiveAttendance,
  useUpdateReceptiveAttendance,
  CONVERSATION_MODES 
} from '@/hooks/useReceptiveModule';
import { useLeadSources } from '@/hooks/useConfigOptions';
import { useProducts } from '@/hooks/useProducts';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AddressFields } from '@/components/AddressFields';

type FlowStep = 'phone' | 'lead_info' | 'conversation' | 'product' | 'questions' | 'script' | 'address' | 'sale_or_reason';

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
  const searchLead = useSearchLeadByPhone();
  const createAttendance = useCreateReceptiveAttendance();
  const updateAttendance = useUpdateReceptiveAttendance();

  const [currentStep, setCurrentStep] = useState<FlowStep>('phone');
  const [phoneInput, setPhoneInput] = useState('55');
  const [leadData, setLeadData] = useState<LeadData>(initialLeadData);
  const [conversationMode, setConversationMode] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productAnswers, setProductAnswers] = useState<Record<string, string>>({});
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [isCreatingSale, setIsCreatingSale] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sourceHistory, setSourceHistory] = useState<Array<{
    id: string;
    source_name: string;
    recorded_at: string;
  }>>([]);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedReason = nonPurchaseReasons.find(r => r.id === selectedReasonId);

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
            Entre em contato com o administrador.
          </p>
        </div>
      </Layout>
    );
  }

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


  const handleGoToConversation = () => {
    setCurrentStep('conversation');
  };

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

  const handleGoToScript = () => {
    setCurrentStep('script');
  };

  const handleGoToAddress = () => {
    setCurrentStep('address');
  };

  const handleGoToSaleOrReason = () => {
    setCurrentStep('sale_or_reason');
  };

  const handleCreateSale = async () => {
    setIsCreatingSale(true);
    
    try {
      // First, ensure lead exists
      let leadId = leadData.id;
      
      if (!leadId && tenantId && user) {
        // Create the lead
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
        // Update existing lead with new data
        const { error: updateError } = await supabase
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

        if (updateError) throw updateError;
      }

      // Save product answers to lead_product_answers table
      if (leadId && selectedProductId && tenantId && Object.keys(productAnswers).length > 0) {
        const { error: answersError } = await supabase
          .from('lead_product_answers')
          .upsert({
            lead_id: leadId,
            product_id: selectedProductId,
            organization_id: tenantId,
            answer_1: productAnswers.answer_1 || null,
            answer_2: productAnswers.answer_2 || null,
            answer_3: productAnswers.answer_3 || null,
          }, {
            onConflict: 'lead_id,product_id',
          });
        
        if (answersError) {
          console.error('Erro ao salvar respostas:', answersError);
        }
      }

      // Save source to history if a source was selected
      if (leadId && selectedSourceId && tenantId && user) {
        await supabase.from('lead_source_history').insert({
          lead_id: leadId,
          organization_id: tenantId,
          source_id: selectedSourceId,
          recorded_by: user.id,
        });
      }

      // Update attendance
      if (attendanceId) {
        await updateAttendance.mutateAsync({
          id: attendanceId,
          updates: {
            lead_id: leadId,
            product_id: selectedProductId || null,
            product_answers: Object.keys(productAnswers).length > 0 ? productAnswers : null,
          },
        });
      }

      // Navigate to new sale page with lead pre-selected
      navigate(`/vendas/nova?leadId=${leadId}&productId=${selectedProductId}`);
    } catch (error: any) {
      toast({ title: 'Erro ao preparar venda', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreatingSale(false);
    }
  };

  const handleSelectReason = async (reasonId: string) => {
    setSelectedReasonId(reasonId);
    setIsSaving(true);

    try {
      const reason = nonPurchaseReasons.find(r => r.id === reasonId);
      
      // Ensure lead exists
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
            stage: 'prospect',
          })
          .select()
          .single();

        if (leadError) throw leadError;
        leadId = newLead.id;
      }

      // Save product answers to lead_product_answers table
      if (leadId && selectedProductId && tenantId && Object.keys(productAnswers).length > 0) {
        const { error: answersError } = await supabase
          .from('lead_product_answers')
          .upsert({
            lead_id: leadId,
            product_id: selectedProductId,
            organization_id: tenantId,
            answer_1: productAnswers.answer_1 || null,
            answer_2: productAnswers.answer_2 || null,
            answer_3: productAnswers.answer_3 || null,
          }, {
            onConflict: 'lead_id,product_id',
          });
        
        if (answersError) {
          console.error('Erro ao salvar respostas:', answersError);
        }
      }

      // Save source to history if a source was selected
      if (leadId && selectedSourceId && tenantId && user) {
        await supabase.from('lead_source_history').insert({
          lead_id: leadId,
          organization_id: tenantId,
          source_id: selectedSourceId,
          recorded_by: user.id,
        });
      }
      if (reason?.target_stage_id && leadId) {
        const targetStage = funnelStages.find(s => s.id === reason.target_stage_id);
        if (targetStage) {
          // We need to map the custom stage back to the enum
          // For now, we'll update only if we can find a matching enum value
          // This is a limitation - custom stages aren't directly supported in the enum yet
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
        description: `Motivo: ${reason?.name}. ${reason?.followup_hours ? `Follow-up em ${reason.followup_hours}h` : ''}` 
      });
      
      // Navigate back to dashboard or leads
      navigate('/');
    } catch (error: any) {
      toast({ title: 'Erro ao finalizar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'phone', label: 'Telefone', icon: Phone },
      { key: 'lead_info', label: 'Cliente', icon: User },
      { key: 'conversation', label: 'Conversa', icon: MessageSquare },
      { key: 'product', label: 'Produto', icon: Package },
      { key: 'questions', label: 'Entrevista', icon: ClipboardList },
      { key: 'script', label: 'Script', icon: FileText },
      { key: 'address', label: 'Endereço', icon: MapPin },
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
              <div 
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : isPast 
                      ? 'bg-green-500/20 text-green-600' 
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isPast ? <CheckCircle className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Navigation buttons component
  const renderNavButtons = (onBack?: () => void, onNext?: () => void, nextDisabled?: boolean, nextLabel?: string) => (
    <div className="flex justify-between gap-2">
      {onBack ? (
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
      ) : <div />}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel || 'Continuar'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );

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
              <CardDescription>
                Digite o DDD + número do cliente
              </CardDescription>
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
                  {searchLead.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
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
              {/* Top navigation */}
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
                    <Input
                      value={leadData.whatsapp}
                      disabled
                      className="bg-muted"
                    />
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

              {/* Address */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Endereço
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={leadData.cep}
                      onChange={(e) => setLeadData(prev => ({ ...prev, cep: e.target.value }))}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Rua</Label>
                    <Input
                      value={leadData.street}
                      onChange={(e) => setLeadData(prev => ({ ...prev, street: e.target.value }))}
                      placeholder="Nome da rua"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={leadData.street_number}
                      onChange={(e) => setLeadData(prev => ({ ...prev, street_number: e.target.value }))}
                      placeholder="123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={leadData.complement}
                      onChange={(e) => setLeadData(prev => ({ ...prev, complement: e.target.value }))}
                      placeholder="Apto, sala, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={leadData.neighborhood}
                      onChange={(e) => setLeadData(prev => ({ ...prev, neighborhood: e.target.value }))}
                      placeholder="Bairro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={leadData.city}
                      onChange={(e) => setLeadData(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={leadData.state}
                      onChange={(e) => setLeadData(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="UF"
                      maxLength={2}
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

              {/* Bottom navigation */}
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
              {/* Top navigation */}
              {renderNavButtons(() => setCurrentStep('lead_info'), handleGoToProduct, !conversationMode)}

              <Separator />

              {/* Conversation Mode */}
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

              {/* Lead Source */}
              <div className="space-y-2">
                <Label>Origem deste Atendimento</Label>
                
                {/* Show source history if lead existed */}
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
                          {index === 0 && (
                            <Badge variant="secondary" className="text-xs">Mais recente</Badge>
                          )}
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
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Separator />

              {/* Bottom navigation */}
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
              {/* Top navigation */}
              {renderNavButtons(() => setCurrentStep('conversation'), handleGoToQuestions, !selectedProductId)}

              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((product) => (
                  <Button
                    key={product.id}
                    variant={selectedProductId === product.id ? 'default' : 'outline'}
                    className="h-auto p-4 flex flex-col items-start text-left"
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    <span className="font-medium">{product.name}</span>
                    {product.description && (
                      <span className="text-xs opacity-70 mt-1 line-clamp-2">
                        {product.description}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {products.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum produto cadastrado. Cadastre produtos nas Configurações.
                </p>
              )}

              <Separator />

              {/* Bottom navigation */}
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
                Faça as perguntas-chave para entender a necessidade do cliente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Top navigation */}
              {renderNavButtons(() => setCurrentStep('product'), handleGoToScript)}

              <Separator />
              {selectedProduct.key_question_1 && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    1. {selectedProduct.key_question_1}
                  </Label>
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
                  <Label className="text-base font-medium">
                    2. {selectedProduct.key_question_2}
                  </Label>
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
                  <Label className="text-base font-medium">
                    3. {selectedProduct.key_question_3}
                  </Label>
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

              <Separator />

              {/* Bottom navigation */}
              {renderNavButtons(() => setCurrentStep('product'), handleGoToScript)}
            </CardContent>
          </Card>
        )}

        {/* Script Step */}
        {currentStep === 'script' && selectedProduct && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Script de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Top navigation */}
              {renderNavButtons(() => setCurrentStep('questions'), handleGoToAddress)}

              <Separator />
              {selectedProduct.sales_script ? (
                <div className="p-4 rounded-lg bg-muted/50 border whitespace-pre-wrap">
                  {selectedProduct.sales_script}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Este produto não tem script de vendas cadastrado.
                </p>
              )}

              <Separator />

              {/* Prices */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Valores e Kits
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedProduct.price_1_unit > 0 && (
                    <div className="p-3 rounded-lg bg-primary/10 text-center">
                      <p className="text-xs text-muted-foreground">1 unidade</p>
                      <p className="font-bold text-lg">
                        R$ {(selectedProduct.price_1_unit / 100).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {selectedProduct.price_3_units > 0 && (
                    <div className="p-3 rounded-lg bg-primary/10 text-center">
                      <p className="text-xs text-muted-foreground">3 unidades</p>
                      <p className="font-bold text-lg">
                        R$ {(selectedProduct.price_3_units / 100).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {selectedProduct.price_6_units > 0 && (
                    <div className="p-3 rounded-lg bg-primary/10 text-center">
                      <p className="text-xs text-muted-foreground">6 unidades</p>
                      <p className="font-bold text-lg">
                        R$ {(selectedProduct.price_6_units / 100).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {selectedProduct.price_12_units > 0 && (
                    <div className="p-3 rounded-lg bg-primary/10 text-center">
                      <p className="text-xs text-muted-foreground">12 unidades</p>
                      <p className="font-bold text-lg">
                        R$ {(selectedProduct.price_12_units / 100).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Observations */}
              <div className="space-y-2">
                <Label>Observações do Atendimento</Label>
                <Textarea
                  value={leadData.observations}
                  onChange={(e) => setLeadData(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Anotações sobre o atendimento..."
                  rows={3}
                />
              </div>

              <Separator />

              {/* Bottom navigation */}
              {renderNavButtons(() => setCurrentStep('questions'), handleGoToAddress)}
            </CardContent>
          </Card>
        )}

        {/* Address Step */}
        {currentStep === 'address' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço de Entrega
              </CardTitle>
              <CardDescription>
                {leadData.cep ? 'Confirme ou atualize o endereço' : 'Preencha o endereço para entrega'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Top navigation */}
              {renderNavButtons(() => setCurrentStep('script'), handleGoToSaleOrReason)}

              <Separator />

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

              <Separator />

              {/* Bottom navigation */}
              {renderNavButtons(() => setCurrentStep('script'), handleGoToSaleOrReason)}
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
                  Cliente quer comprar? Crie o romaneio agora!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  size="lg" 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleCreateSale}
                  disabled={isCreatingSale}
                >
                  {isCreatingSale ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <ShoppingCart className="w-5 h-5 mr-2" />
                  )}
                  Criar Venda / Romaneio
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
                <CardDescription>
                  Selecione o motivo para acompanhamento futuro
                </CardDescription>
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
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {reason.followup_hours > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            Follow-up: {reason.followup_hours}h
                          </Badge>
                        )}
                      </div>
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

            <Button variant="outline" onClick={() => setCurrentStep('address')} className="w-full">
              Voltar
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
