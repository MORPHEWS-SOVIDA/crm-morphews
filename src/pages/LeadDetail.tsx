import { useState } from 'react';
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
  Video,
  Linkedin,
  Globe,
  FileText,
  MapPin,
  Package,
  Phone,
  Home
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { InlineEdit } from '@/components/InlineEdit';
import { InlineSelect } from '@/components/InlineSelect';
import { MultiSelect } from '@/components/MultiSelect';
import { DeleteLeadDialog } from '@/components/DeleteLeadDialog';
import { LeadStageTimeline } from '@/components/LeadStageTimeline';
import { StageChangeDialog } from '@/components/StageChangeDialog';
import { LeadProductAnswersSection } from '@/components/leads/LeadProductAnswersSection';
import { LeadSalesSection } from '@/components/leads/LeadSalesSection';
import { LeadPostSaleHistory } from '@/components/leads/LeadPostSaleHistory';
import { LeadSacSection } from '@/components/leads/LeadSacSection';
import { LeadAddressesManager } from '@/components/leads/LeadAddressesManager';
import { LeadFollowupsSection } from '@/components/leads/LeadFollowupsSection';
import { LeadReceptiveHistorySection } from '@/components/leads/LeadReceptiveHistorySection';
import { LeadStandardQuestionsSection } from '@/components/leads/LeadStandardQuestionsSection';
import { useLead, useUpdateLead, useDeleteLead } from '@/hooks/useLeads';
import { useAddStageHistory } from '@/hooks/useLeadStageHistory';
import { useUsers } from '@/hooks/useUsers';
import { useLeadSources, useLeadProducts } from '@/hooks/useConfigOptions';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
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
import { getInstagramProfileUrl, normalizeInstagramHandle } from '@/lib/instagram';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { data: lead, isLoading, error } = useLead(id);
  const { data: users = [] } = useUsers();
  const { data: leadSources = [] } = useLeadSources();
  const { data: leadProducts = [] } = useLeadProducts();
  const { user, isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const addStageHistory = useAddStageHistory();
  
  // Permission checks
  const canEditLead = permissions?.leads_edit;
  const canDeleteLead = permissions?.leads_delete;
  
  // State for stage change dialog
  const [stageChangeDialog, setStageChangeDialog] = useState<{
    open: boolean;
    newStage: FunnelStage | null;
  }>({ open: false, newStage: null });
  
  // Check if current user can see sensitive data (CPF/CNPJ)
  const canSeeSensitiveData = isAdmin || (user && lead?.created_by === user.id);
  
  const userOptions = users.map((user) => ({
    value: `${user.first_name} ${user.last_name}`,
    label: `${user.first_name} ${user.last_name}`,
  }));

  const sourceOptions = leadSources.map((source) => ({
    value: source.name,
    label: source.name,
  }));

  const productOptions = leadProducts.map((product) => ({
    value: product.name,
    label: product.name,
  }));

  const handleUpdate = (field: string, value: string | number | null) => {
    if (!id) return;
    
    // If changing stage, open dialog instead
    if (field === 'stage' && lead && value !== lead.stage) {
      setStageChangeDialog({ open: true, newStage: value as FunnelStage });
      return;
    }
    
    updateLead.mutate({ id, [field]: value });
  };

  const handleStageChange = async (reason: string | null) => {
    if (!id || !lead || !stageChangeDialog.newStage) return;
    
    try {
      // Update the lead stage
      await updateLead.mutateAsync({ id, stage: stageChangeDialog.newStage });
      
      // Record the stage change in history
      await addStageHistory.mutateAsync({
        lead_id: id,
        organization_id: lead.organization_id!,
        stage: stageChangeDialog.newStage,
        previous_stage: lead.stage,
        reason,
        changed_by: user?.id || null,
      });
      
      setStageChangeDialog({ open: false, newStage: null });
    } catch (error) {
      console.error('Error changing stage:', error);
    }
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
  const instagramUrl = getInstagramProfileUrl(lead.instagram);
  const instagramHandle = normalizeInstagramHandle(lead.instagram);

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
                rating={lead.stars as 0 | 1 | 2 | 3 | 4 | 5} 
                size="lg" 
                interactive
                onChange={(stars) => handleUpdate('stars', stars)}
              />
            </div>
            <InlineEdit
              value={lead.specialty}
              onSave={(value) => handleUpdate('specialty', value)}
              displayClassName="text-muted-foreground"
              placeholder="Especialidade do cliente"
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
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Informações de Contato</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instagram with followers */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  {instagramUrl ? (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 transition-colors"
                    >
                      <Instagram className="w-5 h-5 text-pink-500" />
                    </a>
                  ) : (
                    <div className="p-2 rounded-lg bg-pink-500/10">
                      <Instagram className="w-5 h-5 text-pink-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Instagram</p>
                    <div className="flex items-center gap-2">
                      <InlineEdit
                        value={lead.instagram}
                        onSave={(value) => handleUpdate('instagram', value)}
                        displayClassName="font-medium text-pink-500"
                        placeholder="@usuario"
                      />
                      {instagramUrl && instagramHandle && (
                        <a
                          href={instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-500 hover:text-pink-600"
                          aria-label={`Abrir Instagram de @${instagramHandle}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    {/* Followers inline with Instagram */}
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <InlineEdit
                        value={lead.followers}
                        onSave={(value) => handleUpdate('followers', value ? parseInt(value) : null)}
                        type="number"
                        formatDisplay={(v) => `${formatFollowers(v as number | null)} seguidores`}
                        displayClassName="text-xs text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* TikTok */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-slate-900/10 dark:bg-white/10">
                    <Video className="w-5 h-5 text-slate-900 dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">TikTok</p>
                    <div className="flex items-center gap-2">
                      <InlineEdit
                        value={lead.tiktok}
                        onSave={(value) => handleUpdate('tiktok', value || null)}
                        displayClassName="font-medium"
                        placeholder="@usuario"
                      />
                      {lead.tiktok && (
                        <a
                          href={`https://tiktok.com/@${lead.tiktok?.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
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
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Phone className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Tel. Secundário</p>
                    <InlineEdit
                      value={lead.secondary_phone}
                      onSave={(value) => handleUpdate('secondary_phone', value || null)}
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

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <a
                    href={lead.linkedin || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 transition-colors"
                  >
                    <Linkedin className="w-5 h-5 text-blue-600" />
                  </a>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">LinkedIn</p>
                    <div className="flex items-center gap-2">
                      <InlineEdit
                        value={lead.linkedin}
                        onSave={(value) => handleUpdate('linkedin', value || null)}
                        type="url"
                        displayClassName="font-medium text-blue-600"
                        placeholder="https://linkedin.com/in/usuario"
                      />
                      {lead.linkedin && (
                        <a
                          href={lead.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Globe className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Site</p>
                    <div className="flex items-center gap-2">
                      <InlineEdit
                        value={lead.site}
                        onSave={(value) => handleUpdate('site', value || null)}
                        type="url"
                        displayClassName="font-medium text-orange-500"
                        placeholder="https://..."
                      />
                      {lead.site && (
                        <a
                          href={lead.site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-500 hover:text-orange-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {canSeeSensitiveData && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-lg bg-slate-500/10">
                      <FileText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                      <InlineEdit
                        value={lead.cpf_cnpj}
                        onSave={(value) => handleUpdate('cpf_cnpj', value || null)}
                        displayClassName="font-medium"
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-teal-500/10">
                    <MapPin className="w-5 h-5 text-teal-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Origem do Lead</p>
                    <InlineSelect
                      value={lead.lead_source}
                      options={sourceOptions}
                      onSave={(value) => handleUpdate('lead_source', value)}
                      displayClassName="font-medium"
                      placeholder="Selecione a origem"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Endereços */}
            {id && <LeadAddressesManager leadId={id} />}

            {/* Produtos Negociados & Observações */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Produtos Negociados & Observações
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Produtos Negociados
                  </label>
                  <div className="mt-1">
                    <MultiSelect
                      options={productOptions}
                      selected={lead.products || []}
                      onChange={(selected) => handleUpdate('products', selected as any)}
                      placeholder="Selecione os produtos"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Notas sobre Interesse
                  </label>
                  <div className="mt-1 p-3 rounded-lg bg-muted/50">
                    <InlineEdit
                      value={lead.desired_products}
                      onSave={(value) => handleUpdate('desired_products', value || null)}
                      type="textarea"
                      placeholder="Anotações sobre interesse do lead..."
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
                      placeholder="Observações sobre o cliente..."
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
                      placeholder="Ex: Grupo João - Negociação"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lead Sales */}
            <LeadSalesSection leadId={id!} leadName={lead.name} />

            {/* Standard Questions - Perguntas Padrão */}
            <LeadStandardQuestionsSection leadId={id!} />

            {/* Lead Product Answers - Key Questions */}
            <LeadProductAnswersSection leadId={id!} />

            {/* Post-Sale History */}
            <LeadPostSaleHistory leadId={id!} />

            {/* SAC - Chamados */}
            <LeadSacSection leadId={id!} />

            {/* Follow-ups */}
            <LeadFollowupsSection leadId={id!} />

            {/* Histórico Receptivo */}
            <LeadReceptiveHistorySection leadId={id!} />

            {/* Stage History Timeline */}
            <LeadStageTimeline leadId={id!} currentStage={lead.stage} />
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
                
                {canDeleteLead && (
                  <DeleteLeadDialog
                    leadName={lead.name}
                    onConfirm={handleDelete}
                    isDeleting={deleteLead.isPending}
                  />
                )}
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

      {/* Stage Change Dialog */}
      {lead && stageChangeDialog.newStage && (
        <StageChangeDialog
          open={stageChangeDialog.open}
          onOpenChange={(open) => !open && setStageChangeDialog({ open: false, newStage: null })}
          previousStage={lead.stage}
          newStage={stageChangeDialog.newStage}
          onConfirm={handleStageChange}
          isLoading={updateLead.isPending || addStageHistory.isPending}
        />
      )}
    </Layout>
  );
}
