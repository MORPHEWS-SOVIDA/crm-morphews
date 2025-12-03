import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
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
import { useToast } from '@/hooks/use-toast';

export default function NewLead() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    instagram: '',
    followers: '',
    whatsapp: '',
    email: '',
    stage: 'prospect' as FunnelStage,
    stars: 3 as 1 | 2 | 3 | 4 | 5,
    assignedTo: '',
    whatsappGroup: '',
    desiredProducts: '',
    negotiatedValue: '',
    observations: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would save to database
    toast({
      title: 'Lead criado com sucesso!',
      description: `${formData.name} foi adicionado ao seu CRM.`,
    });
    
    navigate('/leads');
  };

  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Novo Lead</h1>
            <p className="text-muted-foreground">Adicione um novo lead ao seu CRM</p>
          </div>
          <Button type="submit" className="gap-2">
            <Save className="w-4 h-4" />
            Salvar Lead
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
              <Label htmlFor="specialty">Especialidade *</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => updateField('specialty', e.target.value)}
                placeholder="Ex: Dermatologista"
                required
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

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => updateField('whatsapp', e.target.value)}
                placeholder="5511999999999"
                required
              />
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
          </div>

          {/* Status & Classification */}
          <div className="bg-card rounded-xl p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Status & Classificação</h2>
            
            <div className="space-y-2">
              <Label>Importância do Lead</Label>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <StarRating
                  rating={formData.stars}
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
              <Label htmlFor="assignedTo">Responsável *</Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => updateField('assignedTo', e.target.value)}
                placeholder="Nome do responsável"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappGroup">Nome do Grupo WhatsApp</Label>
              <Input
                id="whatsappGroup"
                value={formData.whatsappGroup}
                onChange={(e) => updateField('whatsappGroup', e.target.value)}
                placeholder="Ex: Grupo João - Negociação"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="negotiatedValue">Valor Negociado (R$)</Label>
              <Input
                id="negotiatedValue"
                type="number"
                value={formData.negotiatedValue}
                onChange={(e) => updateField('negotiatedValue', e.target.value)}
                placeholder="Ex: 25000"
              />
            </div>
          </div>

          {/* Additional Info */}
          <div className="lg:col-span-2 bg-card rounded-xl p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Informações Adicionais</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="desiredProducts">Produtos de Interesse</Label>
                <Textarea
                  id="desiredProducts"
                  value={formData.desiredProducts}
                  onChange={(e) => updateField('desiredProducts', e.target.value)}
                  placeholder="Quais produtos o lead demonstrou interesse?"
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
