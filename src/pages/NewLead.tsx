import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, MapPin, Info } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { MultiSelect } from '@/components/MultiSelect';
import { LeadTransferDialog } from '@/components/LeadTransferDialog';
import { LeadAddressForm } from '@/components/leads/LeadAddressForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { useCreateLead } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useLeadSources, useLeadProducts } from '@/hooks/useConfigOptions';
import { useCreateLeadAddress, LeadAddress } from '@/hooks/useLeadAddresses';
import { leadSchema } from '@/lib/validations';
import { toast } from '@/hooks/use-toast';
import { checkLeadExistsForOtherUser, ExistingLeadWithOwner } from '@/hooks/useLeadOwnership';

export default function NewLead() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: permissions, isLoading: permissionsLoading } = useMyPermissions();
  const createLead = useCreateLead();
  const { data: users = [] } = useUsers();
  const { data: leadSources = [] } = useLeadSources();
  const { data: leadProducts = [] } = useLeadProducts();
  const createAddress = useCreateLeadAddress();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingLeadForTransfer, setExistingLeadForTransfer] = useState<ExistingLeadWithOwner | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  
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
    stage: 'prospect' as FunnelStage,
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
  });

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
      is_primary: prev.length === 0 // First address is primary
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
      // If we removed the primary, make first one primary
      if (updated.length > 0 && !updated.some(a => a.is_primary)) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  const formatAddressDisplay = (addr: typeof pendingAddresses[0]) => {
    const parts = [
      addr.street,
      addr.street_number,
      addr.neighborhood,
      addr.city,
      addr.state
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Endereço incompleto';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationData = { ...formData };

    const result = leadSchema.safeParse(validationData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const errorMessages: string[] = [];
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
        errorMessages.push(`${field}: ${err.message}`);
      });
      setErrors(fieldErrors);
      console.log('Validation errors:', fieldErrors);
      toast({
        title: 'Erro de validação',
        description: errorMessages.slice(0, 3).join(', '),
        variant: 'destructive',
      });
      return;
    }

    // Check if lead exists for another user (for transfer option)
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
        stage: formData.stage,
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
      } as any);
      
      // Create addresses for the new lead
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
      
      // Navigate to lead detail page
      if (newLead?.id) {
        navigate(`/leads/${newLead.id}`);
      } else {
        navigate('/leads');
      }
    } catch (error) {
      // Error already handled by mutation
      console.error('Lead creation failed:', error);
    }
  };

  const updateField = (field: string, value: string | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <LeadTransferDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        existingLead={existingLeadForTransfer}
        reason="cadastro"
      />
      <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="self-start">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Novo Lead</h1>
            <p className="text-muted-foreground text-sm lg:text-base">Adicione um novo lead ao seu CRM</p>
          </div>
          <Button type="submit" className="gap-2 w-full sm:w-auto" disabled={createLead.isPending}>
            {createLead.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Lead
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Basic Info */}
          <div className="bg-card rounded-xl p-4 lg:p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informações Básicas</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ex: Dr. João Silva"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Empresa ou Especialidade</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => updateField('specialty', e.target.value)}
                placeholder="Ex: Dermatologista ou Nome da Empresa"
                className={errors.specialty ? 'border-destructive' : ''}
              />
              {errors.specialty && <p className="text-sm text-destructive">{errors.specialty}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">Telefone/WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => updateField('whatsapp', e.target.value.replace(/\D/g, ''))}
                  placeholder="5551999984646"
                  className={errors.whatsapp ? 'border-destructive' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  DDI + DDD + número. Ex: 5551999984646
                </p>
                {errors.whatsapp && <p className="text-sm text-destructive">{errors.whatsapp}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_phone">Telefone Secundário</Label>
                <Input
                  id="secondary_phone"
                  value={formData.secondary_phone}
                  onChange={(e) => updateField('secondary_phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="5551999984646"
                />
                <p className="text-xs text-muted-foreground">
                  Telefone alternativo para contato
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => updateField('instagram', e.target.value)}
                  placeholder="@usuario"
                  className={errors.instagram ? 'border-destructive' : ''}
                />
                {errors.instagram && <p className="text-sm text-destructive">{errors.instagram}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="followers">Seguidores</Label>
                <Input
                  id="followers"
                  type="number"
                  value={formData.followers}
                  onChange={(e) => updateField('followers', e.target.value)}
                  placeholder="Ex: 50000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input
                id="linkedin"
                value={formData.linkedin}
                onChange={(e) => updateField('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/usuario"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                <Input
                  id="cpf_cnpj"
                  value={formData.cpf_cnpj}
                  onChange={(e) => updateField('cpf_cnpj', e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="site">Site</Label>
                <Input
                  id="site"
                  value={formData.site}
                  onChange={(e) => updateField('site', e.target.value)}
                  placeholder="https://..."
                  className={errors.site ? 'border-destructive' : ''}
                />
                {errors.site && <p className="text-sm text-destructive">{errors.site}</p>}
              </div>
            </div>
          </div>

          {/* Addresses Section */}
          <div className="bg-card rounded-xl p-4 lg:p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereços
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddressFormOpen(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Endereço
              </Button>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Adicione os endereços do lead clicando no botão acima. Você pode adicionar múltiplos endereços e gerenciá-los na página do lead.
              </AlertDescription>
            </Alert>

            {pendingAddresses.length > 0 ? (
              <div className="space-y-3">
                {pendingAddresses.map((addr, index) => (
                  <div 
                    key={index} 
                    className="flex items-start justify-between p-4 rounded-lg bg-muted/50 border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{addr.label || 'Endereço'}</span>
                        {addr.is_primary && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Principal
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{formatAddressDisplay(addr)}</p>
                      {addr.cep && <p className="text-xs text-muted-foreground">CEP: {addr.cep}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAddress(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum endereço adicionado ainda</p>
                <p className="text-sm">Clique em "Adicionar Endereço" para cadastrar</p>
              </div>
            )}
          </div>

          {/* Address Form Dialog */}
          <Dialog open={isAddressFormOpen} onOpenChange={setIsAddressFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Endereço</DialogTitle>
              </DialogHeader>
              <LeadAddressForm
                leadId=""
                onSuccess={handleAddAddress}
                onCancel={() => setIsAddressFormOpen(false)}
                isNewLeadMode={true}
              />
            </DialogContent>
          </Dialog>

          {/* Status & Classification */}
          <div className="bg-card rounded-xl p-4 lg:p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Status & Classificação</h2>
            
            <div className="space-y-2">
              <Label>Importância do Lead</Label>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <StarRating
                  rating={formData.stars as 1 | 2 | 3 | 4 | 5}
                  onChange={(stars) => updateField('stars', stars)}
                  size="lg"
                  interactive
                />
                <span className="text-sm text-muted-foreground">
                  {formData.stars === 5 && 'Top Priority - Lead muito importante'}
                  {formData.stars === 4 && 'Alta Prioridade'}
                  {formData.stars === 3 && 'Prioridade Média'}
                  {formData.stars === 2 && 'Baixa Prioridade'}
                  {formData.stars === 1 && 'Lead Iniciante'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Etapa do Funil *</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => updateField('stage', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNNEL_STAGES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Responsável *</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => updateField('assigned_to', value)}
              >
                <SelectTrigger className={errors.assigned_to ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={`${user.first_name} ${user.last_name}`}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assigned_to && <p className="text-sm text-destructive">{errors.assigned_to}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lead_source">Origem do Lead</Label>
              <Select
                value={formData.lead_source}
                onValueChange={(value) => updateField('lead_source', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {leadSources.map((source) => (
                    <SelectItem key={source.id} value={source.name}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produtos Negociados</Label>
              <MultiSelect
                options={leadProducts.map((p) => ({ value: p.name, label: p.name }))}
                selected={formData.products}
                onChange={(selected) => updateField('products', selected)}
                placeholder="Selecione os produtos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_group">Nome do Grupo WhatsApp</Label>
              <Input
                id="whatsapp_group"
                value={formData.whatsapp_group}
                onChange={(e) => updateField('whatsapp_group', e.target.value)}
                placeholder="Ex: Grupo João - Negociação"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="negotiated_value">Valor Negociado (R$)</Label>
              <Input
                id="negotiated_value"
                type="number"
                step="0.01"
                value={formData.negotiated_value}
                onChange={(e) => updateField('negotiated_value', e.target.value)}
                placeholder="Ex: 25000"
              />
            </div>
          </div>

          {/* Meeting Info */}
          <div className="lg:col-span-2 bg-card rounded-xl p-4 lg:p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Reunião</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meeting_date">Data da Reunião</Label>
                <Input
                  id="meeting_date"
                  type="date"
                  value={formData.meeting_date}
                  onChange={(e) => updateField('meeting_date', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting_time">Hora</Label>
                <Input
                  id="meeting_time"
                  type="time"
                  value={formData.meeting_time}
                  onChange={(e) => updateField('meeting_time', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting_link">Link da Reunião</Label>
                <Input
                  id="meeting_link"
                  value={formData.meeting_link}
                  onChange={(e) => updateField('meeting_link', e.target.value)}
                  placeholder="https://calendar.app.google/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recorded_call_link">Link da Gravação</Label>
                <Input
                  id="recorded_call_link"
                  value={formData.recorded_call_link}
                  onChange={(e) => updateField('recorded_call_link', e.target.value)}
                  placeholder="Link do vídeo da call gravada"
                />
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="lg:col-span-2 bg-card rounded-xl p-4 lg:p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informações Adicionais</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="desired_products">Notas sobre Interesse</Label>
                <Textarea
                  id="desired_products"
                  value={formData.desired_products}
                  onChange={(e) => updateField('desired_products', e.target.value)}
                  placeholder="Anotações sobre interesse do lead..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) => updateField('observations', e.target.value)}
                  placeholder="Anotações importantes sobre o lead..."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
}
