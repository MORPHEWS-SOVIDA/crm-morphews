import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { MultiSelect } from '@/components/MultiSelect';
import { AddressFields } from '@/components/AddressFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { useLead, useUpdateLead } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { useLeadSources, useLeadProducts } from '@/hooks/useConfigOptions';

export default function EditLead() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading: isLoadingLead } = useLead(id);
  const updateLead = useUpdateLead();
  const { data: users = [] } = useUsers();
  const { data: leadSources = [] } = useLeadSources();
  const { data: leadProducts = [] } = useLeadProducts();
  
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    instagram: '',
    followers: '',
    whatsapp: '',
    secondary_phone: '',
    email: '',
    stage: 'prospect' as FunnelStage,
    stars: 3,
    assigned_to: '',
    whatsapp_group: '',
    desired_products: '',
    negotiated_value: '',
    paid_value: '',
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
    // Address fields
    cep: '',
    street: '',
    street_number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (lead) {
      const cep = (lead as any).cep || '';
      setFormData({
        name: lead.name || '',
        specialty: lead.specialty || '',
        instagram: lead.instagram || '',
        followers: lead.followers?.toString() || '',
        whatsapp: lead.whatsapp || '',
        secondary_phone: (lead as any).secondary_phone || '',
        email: lead.email || '',
        stage: lead.stage,
        stars: lead.stars,
        assigned_to: lead.assigned_to || '',
        whatsapp_group: lead.whatsapp_group || '',
        desired_products: lead.desired_products || '',
        negotiated_value: lead.negotiated_value?.toString() || '',
        paid_value: lead.paid_value?.toString() || '',
        observations: lead.observations || '',
        meeting_date: lead.meeting_date || '',
        meeting_time: lead.meeting_time || '',
        meeting_link: lead.meeting_link || '',
        recorded_call_link: (lead as any).recorded_call_link || '',
        linkedin: (lead as any).linkedin || '',
        cpf_cnpj: (lead as any).cpf_cnpj || '',
        site: (lead as any).site || '',
        lead_source: (lead as any).lead_source || '',
        products: (lead as any).products || [],
        // Address fields
        cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep,
        street: (lead as any).street || '',
        street_number: (lead as any).street_number || '',
        complement: (lead as any).complement || '',
        neighborhood: (lead as any).neighborhood || '',
        city: (lead as any).city || '',
        state: (lead as any).state || '',
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) return;

    await updateLead.mutateAsync({
      id,
      name: formData.name,
      specialty: formData.specialty || null,
      instagram: formData.instagram,
      followers: formData.followers ? parseInt(formData.followers) : null,
      whatsapp: formData.whatsapp,
      secondary_phone: formData.secondary_phone || null,
      email: formData.email || null,
      stage: formData.stage,
      stars: formData.stars,
      assigned_to: formData.assigned_to,
      whatsapp_group: formData.whatsapp_group || null,
      desired_products: formData.desired_products || null,
      negotiated_value: formData.negotiated_value ? parseFloat(formData.negotiated_value) : null,
      paid_value: formData.paid_value ? parseFloat(formData.paid_value) : null,
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
      // Address fields
      cep: formData.cep.replace(/\D/g, '') || null,
      street: formData.street || null,
      street_number: formData.street_number || null,
      complement: formData.complement || null,
      neighborhood: formData.neighborhood || null,
      city: formData.city || null,
      state: formData.state || null,
    });
    
    navigate(`/leads/${id}`);
  };

  const updateField = (field: string, value: string | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoadingLead) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Editar Lead</h1>
            <p className="text-muted-foreground">{lead?.name}</p>
          </div>
          <Button type="submit" className="gap-2" disabled={updateLead.isPending}>
            {updateLead.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Alterações
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="bg-card rounded-xl p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informações Básicas</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ex: Dr. João Silva"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Empresa ou Especialidade</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => updateField('specialty', e.target.value)}
                placeholder="Ex: Dermatologista ou Nome da Empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram *</Label>
                <Input
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => updateField('instagram', e.target.value)}
                  placeholder="@usuario"
                  required
                />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => updateField('whatsapp', e.target.value.replace(/\D/g, ''))}
                  placeholder="5511999999999"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_phone">Telefone Secundário</Label>
                <Input
                  id="secondary_phone"
                  value={formData.secondary_phone}
                  onChange={(e) => updateField('secondary_phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="5511999999999"
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

            <div className="grid grid-cols-2 gap-4">
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
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-card rounded-xl p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Endereço</h2>
            <AddressFields
              cep={formData.cep}
              street={formData.street}
              streetNumber={formData.street_number}
              complement={formData.complement}
              neighborhood={formData.neighborhood}
              city={formData.city}
              state={formData.state}
              onFieldChange={updateField}
            />
          </div>

          {/* Status & Classification */}
          <div className="bg-card rounded-xl p-6 shadow-card space-y-4">
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
                <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="paid_value">Valor Pago (R$)</Label>
                <Input
                  id="paid_value"
                  type="number"
                  step="0.01"
                  value={formData.paid_value}
                  onChange={(e) => updateField('paid_value', e.target.value)}
                  placeholder="Ex: 25000"
                />
              </div>
            </div>
          </div>

          {/* Meeting Info */}
          <div className="lg:col-span-2 bg-card rounded-xl p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Reunião</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                  placeholder="Link do vídeo"
                />
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="lg:col-span-2 bg-card rounded-xl p-6 shadow-card space-y-4">
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
