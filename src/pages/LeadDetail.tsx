import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Instagram, 
  Mail, 
  Calendar,
  MessageSquare,
  DollarSign,
  User,
  Loader2,
  ExternalLink,
  Clock,
  Video
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { InlineEdit } from '@/components/InlineEdit';
import { InlineSelect } from '@/components/InlineSelect';
import { DeleteLeadDialog } from '@/components/DeleteLeadDialog';
import { useLead, useUpdateLead, useDeleteLead } from '@/hooks/useLeads';
import { useUsers } from '@/hooks/useUsers';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { data: lead, isLoading, error } = useLead(id);
  const { data: users = [] } = useUsers();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  
  const userOptions = users.map((user) => ({
    value: `${user.first_name} ${user.last_name}`,
    label: `${user.first_name} ${user.last_name}`,
  }));

  const handleUpdate = (field: string, value: string | number | null) => {
    if (!id) return;
    updateLead.mutate({ id, [field]: value });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteLead.mutate(id, {
      onSuccess: () => navigate('/leads'),
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !lead) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <User className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Lead não encontrado</h1>
          <p className="text-muted-foreground mb-4">O lead que você procura não existe.</p>
          <Button onClick={() => navigate('/')}>Voltar ao Dashboard</Button>
        </div>
      </Layout>
    );
  }

  const stageInfo = FUNNEL_STAGES[lead.stage];

  const formatFollowers = (num: number | null) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return 'Clique para definir';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <InlineEdit
                value={lead.name}
                onSave={(value) => handleUpdate('name', value)}
                displayClassName="text-3xl font-bold text-foreground"
              />
              <StarRating 
                rating={lead.stars as 1 | 2 | 3 | 4 | 5} 
                size="lg" 
                interactive
                onChange={(stars) => handleUpdate('stars', stars)}
              />
            </div>
            <InlineEdit
              value={lead.specialty}
              onSave={(value) => handleUpdate('specialty', value)}
              displayClassName="text-muted-foreground"
              placeholder="Clique para adicionar especialidade"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stage Card */}
            <div className={cn(
              'rounded-xl p-6 shadow-card',
              stageInfo.color
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium opacity-80', stageInfo.textColor)}>
                    Etapa atual
                  </p>
                  <Select
                    value={lead.stage}
                    onValueChange={(value) => handleUpdate('stage', value as FunnelStage)}
                  >
                    <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto text-2xl font-bold hover:bg-white/10 rounded">
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
                <div className="flex items-center gap-2">
                  <InlineEdit
                    value={lead.followers}
                    onSave={(value) => handleUpdate('followers', value ? parseInt(value) : null)}
                    type="number"
                    formatDisplay={(v) => `${formatFollowers(v as number | null)} seguidores`}
                    displayClassName="bg-white/20 text-inherit border-0 text-lg px-4 py-2 rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Informações de Contato</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <a
                    href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
                  >
                    <Instagram className="w-5 h-5 text-pink-500" />
                  </a>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Instagram</p>
                    <div className="flex items-center gap-2">
                      <InlineEdit
                        value={lead.instagram}
                        onSave={(value) => handleUpdate('instagram', value)}
                        displayClassName="font-medium text-pink-500"
                        placeholder="@usuario"
                      />
                      <a
                        href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-500 hover:text-pink-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <WhatsAppButton phone={lead.whatsapp} variant="icon" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <InlineEdit
                      value={lead.whatsapp}
                      onSave={(value) => handleUpdate('whatsapp', value)}
                      displayClassName="font-medium"
                      placeholder="5511999999999"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <InlineEdit
                      value={lead.email}
                      onSave={(value) => handleUpdate('email', value || null)}
                      type="email"
                      displayClassName="font-medium text-primary"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Responsável</p>
                    <InlineSelect
                      value={lead.assigned_to}
                      options={userOptions}
                      onSave={(value) => handleUpdate('assigned_to', value)}
                      displayClassName="font-medium"
                      placeholder="Selecione o responsável"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Products & Notes */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Produtos & Observações</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Produtos de interesse
                  </label>
                  <div className="mt-1 p-3 rounded-lg bg-muted/50">
                    <InlineEdit
                      value={lead.desired_products}
                      onSave={(value) => handleUpdate('desired_products', value || null)}
                      type="textarea"
                      placeholder="Clique para adicionar produtos de interesse"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Observações
                  </label>
                  <div className="mt-1 p-3 rounded-lg bg-muted/50">
                    <InlineEdit
                      value={lead.observations}
                      onSave={(value) => handleUpdate('observations', value || null)}
                      type="textarea"
                      placeholder="Clique para adicionar observações"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Grupo de WhatsApp
                  </label>
                  <div className="mt-1 p-3 rounded-lg bg-green-500/10 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                    <InlineEdit
                      value={lead.whatsapp_group}
                      onSave={(value) => handleUpdate('whatsapp_group', value || null)}
                      placeholder="Clique para adicionar nome do grupo"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Financial & Actions */}
          <div className="space-y-6">
            {/* Financial */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-funnel-success" />
                Valores
              </h2>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Valor Negociado</p>
                  <InlineEdit
                    value={lead.negotiated_value}
                    onSave={(value) => handleUpdate('negotiated_value', value ? parseFloat(value) : null)}
                    type="number"
                    formatDisplay={formatCurrency}
                    displayClassName="text-2xl font-bold text-foreground"
                  />
                </div>

                <div className="p-4 rounded-lg bg-funnel-success/20">
                  <p className="text-sm text-funnel-success-foreground">Valor Pago</p>
                  <InlineEdit
                    value={lead.paid_value}
                    onSave={(value) => handleUpdate('paid_value', value ? parseFloat(value) : null)}
                    type="number"
                    formatDisplay={formatCurrency}
                    displayClassName="text-2xl font-bold text-funnel-success-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
              
              <div className="space-y-3">
                <WhatsAppButton 
                  phone={lead.whatsapp} 
                  message={`Olá ${lead.name.split(' ')[0]}!`}
                  className="w-full justify-center"
                />
                
                <DeleteLeadDialog
                  leadName={lead.name}
                  onConfirm={handleDelete}
                  isDeleting={deleteLead.isPending}
                />
              </div>
            </div>

            {/* Meeting Info */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Reunião
              </h2>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="w-4 h-4 text-muted-foreground mt-1" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <InlineEdit
                        value={lead.meeting_date}
                        onSave={(value) => handleUpdate('meeting_date', value || null)}
                        type="date"
                        formatDisplay={(v) => v ? new Date(v as string).toLocaleDateString('pt-BR') : 'Clique para definir'}
                        displayClassName="font-medium"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Hora</p>
                      <InlineEdit
                        value={lead.meeting_time}
                        onSave={(value) => handleUpdate('meeting_time', value || null)}
                        type="time"
                        formatDisplay={(v) => v ? (v as string).slice(0, 5) : 'Clique para definir'}
                        displayClassName="font-medium"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="flex items-center gap-2 mb-1">
                    <ExternalLink className="w-4 h-4 text-primary" />
                    <p className="text-sm text-muted-foreground">Link da Reunião</p>
                  </div>
                  <InlineEdit
                    value={lead.meeting_link}
                    onSave={(value) => handleUpdate('meeting_link', value || null)}
                    type="url"
                    placeholder="Cole o link aqui"
                    displayClassName="font-medium text-primary break-all"
                  />
                  {lead.meeting_link && (
                    <a
                      href={lead.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
                    >
                      Abrir link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Recorded Call Link */}
                <div className="p-3 rounded-lg bg-accent/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Video className="w-4 h-4 text-accent" />
                    <p className="text-sm text-muted-foreground">Link da Gravação</p>
                  </div>
                  <InlineEdit
                    value={lead.recorded_call_link}
                    onSave={(value) => handleUpdate('recorded_call_link', value || null)}
                    type="url"
                    placeholder="Cole o link da gravação aqui"
                    displayClassName="font-medium text-accent break-all"
                  />
                  {lead.recorded_call_link && (
                    <a
                      href={lead.recorded_call_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-sm text-accent hover:underline"
                    >
                      Assistir gravação <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
