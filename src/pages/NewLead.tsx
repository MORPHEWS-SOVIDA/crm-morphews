import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { MultiSelect } from '@/components/MultiSelect';
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
import { useCreateLead } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { useLeadSources, useLeadProducts } from '@/hooks/useConfigOptions';
import { leadSchema } from '@/lib/validations';
import { toast } from '@/hooks/use-toast';

export default function NewLead() {
  const navigate = useNavigate();
  const createLead = useCreateLead();
  const { data: users = [] } = useUsers();
  const { data: leadSources = [] } = useLeadSources();
  const { data: leadProducts = [] } = useLeadProducts();
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    instagram: '',
    followers: '',
    whatsapp: '',
    email: '',
    stage: 'prospect' as FunnelStage,
    stars: 3,
    assigned_to: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = leadSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      toast({
        title: 'Erro de validação',
        description: 'Verifique os campos destacados.',
        variant: 'destructive',
      });
      return;
    }
    
    await createLead.mutateAsync({
      name: formData.name.trim(),
      specialty: formData.specialty.trim() || null,
      instagram: formData.instagram.trim() || '',
      followers: formData.followers ? parseInt(formData.followers) : null,
      whatsapp: formData.whatsapp.trim(),
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
    });
    
    navigate('/leads');
  };

  const updateField = (field: string, value: string | number | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
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
                Apenas números: DDI + DDD + número. Ex: 5551999984646 (55 para Brasil)
              </p>
              {errors.whatsapp && <p className="text-sm text-destructive">{errors.whatsapp}</p>}
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
