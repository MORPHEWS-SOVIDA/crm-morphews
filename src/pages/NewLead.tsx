import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, MapPin, Cake, Users, Heart } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { MultiSelect } from '@/components/MultiSelect';
import { LeadTransferDialog } from '@/components/LeadTransferDialog';
import { LeadAddressForm } from '@/components/leads/LeadAddressForm';
import { LeadFiscalRegistrationFields } from '@/components/leads/LeadFiscalRegistrationFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFunnelStages, getStageEnumValue } from '@/hooks/useFunnelStages';
import { useDefaultStageForSource } from '@/hooks/useDefaultFunnelStages';
import { useCreateLead } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useLeadSources, useLeadProducts } from '@/hooks/useConfigOptions';
import { useCreateLeadAddress, LeadAddress } from '@/hooks/useLeadAddresses';
import { leadSchema } from '@/lib/validations';
import { getFriendlyError } from '@/lib/errorMessages';
import { toast } from '@/hooks/use-toast';
import { checkLeadExistsForOtherUser, ExistingLeadWithOwner } from '@/hooks/useLeadOwnership';

// Brazilian football teams
const BRAZILIAN_TEAMS = [
  'Flamengo', 'Corinthians', 'São Paulo', 'Palmeiras', 'Santos',
  'Grêmio', 'Internacional', 'Cruzeiro', 'Atlético-MG', 'Fluminense',
  'Vasco', 'Botafogo', 'Bahia', 'Sport', 'Fortaleza',
  'Ceará', 'Athletico-PR', 'Coritiba', 'Goiás', 'Vitória',
  'Não torço', 'Outro'
];

const GENDER_OPTIONS = [
  { value: 'masculino', label: 'Masculino', emoji: '👨' },
  { value: 'feminino', label: 'Feminino', emoji: '👩' },
  { value: 'outro', label: 'Outro', emoji: '🧑' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar', emoji: '🤐' },
];

// Translate field names for user-friendly validation messages
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  name: 'Nome',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  stage: 'Etapa',
  assigned_to: 'Responsável',
  instagram: 'Instagram',
  specialty: 'Empresa/Especialidade',
  followers: 'Seguidores',
  secondary_phone: 'Telefone Secundário',
  cpf_cnpj: 'CPF/CNPJ',
  site: 'Site',
  linkedin: 'LinkedIn',
  meeting_link: 'Link da Reunião',
  recorded_call_link: 'Link da Chamada',
};

function getFieldDisplayName(field: string): string {
  return FIELD_DISPLAY_NAMES[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function NewLead() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const createLead = useCreateLead();
  const { data: users = [] } = useUsers();
  const { data: leadSources = [] } = useLeadSources();
  const { data: leadProducts = [] } = useLeadProducts();
  const { data: funnelStages = [] } = useFunnelStages();
  const defaultStageId = useDefaultStageForSource('new_lead');
  const createAddress = useCreateLeadAddress();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingLeadForTransfer, setExistingLeadForTransfer] = useState<ExistingLeadWithOwner | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedFunnelStageId, setSelectedFunnelStageId] = useState<string>('');
  
  // Address management state
  const [pendingAddresses, setPendingAddresses] = useState<Omit<LeadAddress, 'id' | 'lead_id' | 'organization_id' | 'created_at' | 'updated_at'>[]>([]);
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  
  // Permission check
  const canCreateLead = permissions?.leads_create;
  
  // Redirect if no permission
  if (!permissionsLoading && !canCreateLead) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">Você não tem permissão para criar leads.</p>
          <Button onClick={() => navigate('/')}>Voltar ao Dashboard</Button>
        </div>
      </Layout>
    );
  }
  
  // Pre-fill from URL params (from WhatsApp chat)
  const urlWhatsapp = searchParams.get('whatsapp') || '';
  const urlName = searchParams.get('name') || '';
  
  // Default assigned_to to current user's name
  const defaultAssignedTo = profile ? `${profile.first_name} ${profile.last_name}` : '';
  
  const [formData, setFormData] = useState({
    name: urlName,
    specialty: '',
    instagram: '',
    followers: '',
    whatsapp: urlWhatsapp,
    secondary_phone: '',
    email: '',
    stars: 0,
    assigned_to: defaultAssignedTo,
    whatsapp_group: '',
    desired_products: '',
    negotiated_value: '',
    observations: '',
    meeting_date: '',
    meeting_time: '',
    meeting_link: '',
    recorded_call_link: '',
    linkedin: '',
    cpf_cnpj: '',
    site: '',
    lead_source: '',
    products: [] as string[],
    birth_date: '',
    gender: '',
    favorite_team: '',
    inscricao_estadual: '',
    inscricao_estadual_isento: true,
    inscricao_municipal: '',
    inscricao_municipal_isento: true,
  });

  // Get selectable stages (funnel and cloud, not trash)
  const selectableStages = funnelStages
    .filter(s => s.stage_type !== 'trash')
    .sort((a, b) => a.position - b.position);

  // Set default stage when configuration or stages load
  useEffect(() => {
    if (selectableStages.length > 0 && !selectedFunnelStageId) {
      const stageId = defaultStageId || selectableStages.find(s => s.stage_type === 'funnel')?.id || selectableStages[0]?.id || '';
      setSelectedFunnelStageId(stageId);
    }
  }, [defaultStageId, selectableStages.length, selectedFunnelStageId]);

  // Update formData when URL params or profile changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      name: urlName || prev.name,
      whatsapp: urlWhatsapp || prev.whatsapp,
      assigned_to: prev.assigned_to || (profile ? `${profile.first_name} ${profile.last_name}` : ''),
    }));
  }, [urlWhatsapp, urlName, profile]);

  const handleAddAddress = (addressData: any) => {
    setPendingAddresses(prev => [...prev, {
      ...addressData,
      is_primary: prev.length === 0
    }]);
    setIsAddressFormOpen(false);
    toast({
      title: 'Endereço adicionado',
      description: 'O endereço será salvo junto com o lead.',
    });
  };

  const handleRemoveAddress = (index: number) => {
    setPendingAddresses(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some(a => a.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  const formatAddressDisplay = (addr: typeof pendingAddresses[0]) => {
    const parts = [addr.street, addr.street_number, addr.neighborhood, addr.city, addr.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Endereço incompleto';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const selectedStage = selectableStages.find(s => s.id === selectedFunnelStageId);
    const stageEnumValue = selectedStage ? getStageEnumValue(selectedStage) : '';
    const result = leadSchema.safeParse({ ...formData, stage: stageEnumValue });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const friendlyMessages: string[] = [];
      
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        const fieldName = getFieldDisplayName(field);
        const message = err.message;
        fieldErrors[field] = message;
        friendlyMessages.push(`${fieldName}: ${message}`);
      });
      
      setErrors(fieldErrors);
      toast({
        title: 'Campos precisam de atenção',
        description: friendlyMessages.length === 1 
          ? friendlyMessages[0] 
          : `${friendlyMessages.length} campos precisam ser corrigidos: ${friendlyMessages.slice(0, 2).join('; ')}${friendlyMessages.length > 2 ? '...' : ''}`,
        variant: 'destructive',
      });
      return;
    }

    const existingLead = await checkLeadExistsForOtherUser(formData.whatsapp.trim());
    if (existingLead) {
      setExistingLeadForTransfer(existingLead);
      setShowTransferDialog(true);
      return;
    }
    
    try {

      const newLead = await createLead.mutateAsync({
        name: formData.name.trim(),
        specialty: formData.specialty.trim() || null,
        instagram: formData.instagram.trim() || '',
        followers: formData.followers ? parseInt(formData.followers) : null,
        whatsapp: formData.whatsapp.trim(),
        secondary_phone: formData.secondary_phone.trim() || null,
        email: formData.email || null,
        stage: stageEnumValue,
        funnel_stage_id: selectedFunnelStageId || null,
        stars: formData.stars,
        assigned_to: formData.assigned_to.trim(),
        whatsapp_group: formData.whatsapp_group || null,
        desired_products: formData.desired_products || null,
        negotiated_value: formData.negotiated_value ? parseFloat(formData.negotiated_value) : null,
        observations: formData.observations || null,
        meeting_date: formData.meeting_date || null,
        meeting_time: formData.meeting_time || null,
        meeting_link: formData.meeting_link || null,
        recorded_call_link: formData.recorded_call_link || null,
        linkedin: formData.linkedin || null,
        cpf_cnpj: formData.cpf_cnpj || null,
        site: formData.site || null,
        lead_source: formData.lead_source || null,
        products: formData.products.length > 0 ? formData.products : null,
        birth_date: formData.birth_date || null,
        gender: formData.gender || null,
        favorite_team: formData.favorite_team || null,
        inscricao_estadual: formData.inscricao_estadual || null,
        inscricao_estadual_isento: formData.inscricao_estadual_isento,
        inscricao_municipal: formData.inscricao_municipal || null,
        inscricao_municipal_isento: formData.inscricao_municipal_isento,
      } as any);
      
      if (pendingAddresses.length > 0 && newLead?.id) {
        for (const addr of pendingAddresses) {
          await createAddress.mutateAsync({
            lead_id: newLead.id,
            label: addr.label || 'Principal',
            is_primary: addr.is_primary,
            cep: addr.cep || null,
            street: addr.street || null,
            street_number: addr.street_number || null,
            complement: addr.complement || null,
            neighborhood: addr.neighborhood || null,
            city: addr.city || null,
            state: addr.state || null,
            delivery_notes: addr.delivery_notes || null,
            google_maps_link: addr.google_maps_link || null,
            delivery_region_id: addr.delivery_region_id || null,
          });
        }
      }
      
      if (newLead?.id) {
        navigate(`/leads/${newLead.id}`);
      } else {
        navigate('/leads');
      }
    } catch (error: any) {
      console.error('Lead creation failed:', error);
      if (error?.message === 'DUPLICATE_WHATSAPP') {
        const existingLead = await checkLeadExistsForOtherUser(formData.whatsapp.trim());
        if (existingLead) {
          setExistingLeadForTransfer(existingLead);
          setShowTransferDialog(true);
        } else {
          toast({
            title: 'WhatsApp já cadastrado',
            description: 'Este número já está vinculado a um lead existente na organização.',
            variant: 'destructive',
          });
        }
      }
    }
  };

  const updateField = (field: string, value: string | number | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectedStage = selectableStages.find(s => s.id === selectedFunnelStageId);
  const stageColor = selectedStage?.color || '#9b87f5';
  const stageTextColor = selectedStage?.text_color || '#ffffff';

  return (
    <Layout>
      <LeadTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        existingLead={existingLeadForTransfer}
        reason="cadastro"
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header - styled like LeadDetail */}
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Nome do Lead *"
                className={`text-2xl lg:text-3xl font-bold bg-transparent border-dashed border-muted-foreground/30 h-auto py-1 px-2 max-w-xs lg:max-w-md ${errors.name ? 'border-destructive' : ''}`}
              />
              <StarRating
                rating={formData.stars as 0 | 1 | 2 | 3 | 4 | 5}
                size="lg"
                interactive
                onChange={(stars) => updateField('stars', stars)}
              />
            </div>
            <Input
              value={formData.specialty}
              onChange={(e) => updateField('specialty', e.target.value)}
              placeholder="Empresa ou Especialidade"
              className="text-muted-foreground bg-transparent border-dashed border-muted-foreground/30 h-auto py-1 px-2 mt-1 max-w-md"
            />
          </div>
          <Button type="submit" className="gap-2" disabled={createLead.isPending}>
            {createLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        </div>

        {/* Main Content - 3 column grid like LeadDetail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stage Card */}
            <div className="rounded-xl p-6 shadow-card" style={{ backgroundColor: stageColor }}>
              <p className="text-sm font-medium opacity-80" style={{ color: stageTextColor }}>Etapa inicial *</p>
              <Select value={selectedFunnelStageId} onValueChange={setSelectedFunnelStageId}>
                <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto text-2xl font-bold hover:bg-white/10 rounded" style={{ color: stageTextColor }}>
                  <SelectValue placeholder="Selecione...">{selectedStage?.name || 'Selecione a etapa'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {selectableStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <span className="w-3 h-3 rounded-full inline-block mr-2" style={{ backgroundColor: stage.color }} />
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Personal Profile Section */}
            <div className="bg-gradient-to-r from-purple-50/50 via-pink-50/50 to-orange-50/50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-orange-950/20 rounded-xl p-6 border-2 border-dashed border-purple-200 dark:border-purple-800 shadow-card">
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-4 flex items-center gap-2">✨ Conheça melhor seu cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5 text-pink-600 dark:text-pink-400"><Cake className="w-3.5 h-3.5" />Data de Nascimento</Label>
                  <Input type="date" value={formData.birth_date} onChange={(e) => updateField('birth_date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5 text-purple-600 dark:text-purple-400"><Users className="w-3.5 h-3.5" />Gênero</Label>
                  <Select value={formData.gender} onValueChange={(v) => updateField('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}><span className="flex items-center gap-2"><span>{opt.emoji}</span><span>{opt.label}</span></span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5 text-orange-600 dark:text-orange-400"><Heart className="w-3.5 h-3.5" />Time do Coração</Label>
                  <Select value={formData.favorite_team} onValueChange={(v) => updateField('favorite_team', v)}>
                    <SelectTrigger><SelectValue placeholder="Qual time?" /></SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_TEAMS.map(team => (
                        <SelectItem key={team} value={team}>{team === 'Flamengo' ? '🔴⚫ ' : team === 'Corinthians' ? '⚫⚪ ' : team === 'Palmeiras' ? '💚 ' : '⚽ '}{team}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Info Card */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Informações de Contato</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* WhatsApp */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">WhatsApp *</p>
                    <Input value={formData.whatsapp} onChange={(e) => updateField('whatsapp', e.target.value.replace(/\D/g, ''))} placeholder="5551999984646" className={errors.whatsapp ? 'border-destructive' : ''} />
                    {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp}</p>}
                  </div>
                </div>

                {/* Secondary Phone */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-muted">
                    <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">Telefone Secundário</p>
                    <Input value={formData.secondary_phone} onChange={(e) => updateField('secondary_phone', e.target.value.replace(/\D/g, ''))} placeholder="5551999984646" />
                  </div>
                </div>

                {/* Instagram */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                    <svg className="w-5 h-5 text-pink-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">Instagram</p>
                    <div className="flex gap-2">
                      <Input value={formData.instagram} onChange={(e) => updateField('instagram', e.target.value)} placeholder="@usuario" className="flex-1" />
                      <Input type="number" value={formData.followers} onChange={(e) => updateField('followers', e.target.value)} placeholder="Seguidores" className="w-28" />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-600/10">
                  <div className="p-2 rounded-lg bg-blue-600/20">
                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">LinkedIn</p>
                    <Input value={formData.linkedin} onChange={(e) => updateField('linkedin', e.target.value)} placeholder="https://linkedin.com/in/usuario" />
                  </div>
                </div>

                {/* Site */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-500/10">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">Site</p>
                    <Input value={formData.site} onChange={(e) => updateField('site', e.target.value)} placeholder="https://..." />
                  </div>
                </div>

                {/* CPF/CNPJ */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-slate-500/10">
                    <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                    <Input value={formData.cpf_cnpj} onChange={(e) => updateField('cpf_cnpj', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                </div>

                {/* Fiscal Registration Fields */}
                <LeadFiscalRegistrationFields
                  data={{
                    inscricao_estadual: formData.inscricao_estadual,
                    inscricao_estadual_isento: formData.inscricao_estadual_isento,
                    inscricao_municipal: formData.inscricao_municipal,
                    inscricao_municipal_isento: formData.inscricao_municipal_isento,
                  }}
                  onChange={(field, value) => updateField(field, value)}
                />

                {/* Lead Source */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-teal-500/10">
                  <div className="p-2 rounded-lg bg-teal-500/20">
                    <MapPin className="w-5 h-5 text-teal-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">Origem do Lead</p>
                    <Select value={formData.lead_source} onValueChange={(v) => updateField('lead_source', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {leadSources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Addresses Section */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><MapPin className="w-5 h-5" />Endereços</h2>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddressFormOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Adicionar</Button>
              </div>
              {pendingAddresses.length > 0 ? (
                <div className="space-y-3">
                  {pendingAddresses.map((addr, index) => (
                    <div key={index} className="flex items-start justify-between p-4 rounded-lg bg-muted/50 border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{addr.label || 'Endereço'}</span>
                          {addr.is_primary && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Principal</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{formatAddressDisplay(addr)}</p>
                        {addr.cep && <p className="text-xs text-muted-foreground">CEP: {addr.cep}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAddress(index)} className="text-destructive hover:text-destructive">Remover</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum endereço adicionado</p>
                </div>
              )}
            </div>

            {/* Products & Observations */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">📦 Produtos & Observações</h2>
              <div className="space-y-4">
                <div>
                  <Label>Produtos Negociados</Label>
                  <div className="mt-1">
                    <MultiSelect options={leadProducts.map((p) => ({ value: p.name, label: p.name }))} selected={formData.products} onChange={(selected) => updateField('products', selected)} placeholder="Selecione os produtos" />
                  </div>
                </div>
                <div>
                  <Label>Notas sobre Interesse</Label>
                  <Textarea value={formData.desired_products} onChange={(e) => updateField('desired_products', e.target.value)} placeholder="Anotações sobre interesse do lead..." rows={3} className="mt-1" />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={formData.observations} onChange={(e) => updateField('observations', e.target.value)} placeholder="Observações sobre o cliente..." rows={3} className="mt-1" />
                </div>
                <div>
                  <Label>Grupo de WhatsApp</Label>
                  <Input value={formData.whatsapp_group} onChange={(e) => updateField('whatsapp_group', e.target.value)} placeholder="Ex: Grupo João - Negociação" className="mt-1" />
                </div>
              </div>
            </div>

            {/* Meeting Info */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">📅 Reunião</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data</Label><Input type="date" value={formData.meeting_date} onChange={(e) => updateField('meeting_date', e.target.value)} /></div>
                <div className="space-y-2"><Label>Hora</Label><Input type="time" value={formData.meeting_time} onChange={(e) => updateField('meeting_time', e.target.value)} /></div>
                <div className="space-y-2"><Label>Link da Reunião</Label><Input value={formData.meeting_link} onChange={(e) => updateField('meeting_link', e.target.value)} placeholder="https://..." /></div>
                <div className="space-y-2"><Label>Link da Gravação</Label><Input value={formData.recorded_call_link} onChange={(e) => updateField('recorded_call_link', e.target.value)} placeholder="Link do vídeo" /></div>
              </div>
            </div>
          </div>

          {/* Right Column - Financial & Actions */}
          <div className="space-y-6">
            {/* Financial */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">💰 Valores</h2>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Valor Negociado</p>
                <Input type="number" step="0.01" value={formData.negotiated_value} onChange={(e) => updateField('negotiated_value', e.target.value)} placeholder="R$ 0,00" className="text-2xl font-bold border-0 bg-transparent p-0 h-auto mt-1" />
              </div>
            </div>

            {/* Assignment */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Responsável *</h2>
              <Select value={formData.assigned_to} onValueChange={(v) => updateField('assigned_to', v)}>
                <SelectTrigger className={errors.assigned_to ? 'border-destructive' : ''}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={`${user.first_name} ${user.last_name}`}>{user.first_name} {user.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assigned_to && <p className="text-sm text-destructive mt-1">{errors.assigned_to}</p>}
            </div>

            {/* Quick Save */}
            <Button type="submit" className="w-full gap-2" size="lg" disabled={createLead.isPending}>
              {createLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Lead
            </Button>
          </div>
        </div>

        {/* Address Form Dialog */}
        <Dialog open={isAddressFormOpen} onOpenChange={setIsAddressFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Adicionar Endereço</DialogTitle></DialogHeader>
            <LeadAddressForm leadId="" onSuccess={handleAddAddress} onCancel={() => setIsAddressFormOpen(false)} isNewLeadMode={true} />
          </DialogContent>
        </Dialog>
      </form>
    </Layout>
  );
}
