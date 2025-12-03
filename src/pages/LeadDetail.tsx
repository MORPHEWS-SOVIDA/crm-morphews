import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Instagram, 
  Mail, 
  Users, 
  Calendar,
  MessageSquare,
  DollarSign,
  User,
  Edit
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { mockLeads } from '@/data/mockLeads';
import { FUNNEL_STAGES } from '@/types/lead';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const lead = mockLeads.find((l) => l.id === id);

  if (!lead) {
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

  const formatFollowers = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'Não definido';
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
              <h1 className="text-3xl font-bold text-foreground">{lead.name}</h1>
              <StarRating rating={lead.stars} size="lg" />
            </div>
            <p className="text-muted-foreground">{lead.specialty}</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Edit className="w-4 h-4" />
            Editar
          </Button>
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
                  <p className={cn('text-2xl font-bold', stageInfo.textColor)}>
                    {stageInfo.label}
                  </p>
                </div>
                <Badge className="bg-white/20 text-inherit border-0 text-lg px-4 py-2">
                  {formatFollowers(lead.followers)} seguidores
                </Badge>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Informações de Contato</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <Instagram className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Instagram</p>
                    <a 
                      href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-pink-500 hover:underline"
                    >
                      {lead.instagram}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <WhatsAppButton phone={lead.whatsapp} variant="icon" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <p className="font-medium">{lead.whatsapp}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <a 
                      href={`mailto:${lead.email}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Responsável</p>
                    <p className="font-medium">{lead.assignedTo}</p>
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
                  <p className="mt-1 p-3 rounded-lg bg-muted/50 text-foreground">
                    {lead.desiredProducts || 'Nenhum produto especificado ainda'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Observações
                  </label>
                  <p className="mt-1 p-3 rounded-lg bg-muted/50 text-foreground">
                    {lead.observations || 'Nenhuma observação'}
                  </p>
                </div>

                {lead.whatsappGroup && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Grupo de WhatsApp
                    </label>
                    <p className="mt-1 p-3 rounded-lg bg-green-500/10 text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-500" />
                      {lead.whatsappGroup}
                    </p>
                  </div>
                )}
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
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(lead.negotiatedValue)}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-funnel-success/20">
                  <p className="text-sm text-funnel-success-foreground">Valor Pago</p>
                  <p className="text-2xl font-bold text-funnel-success-foreground">
                    {formatCurrency(lead.paidValue)}
                  </p>
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
                
                <Button variant="outline" className="w-full gap-2">
                  <Calendar className="w-4 h-4" />
                  Agendar Call
                </Button>
                
                <Button variant="outline" className="w-full gap-2">
                  <Users className="w-4 h-4" />
                  Criar Grupo WhatsApp
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Agenda
              </h2>
              
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Em breve:</span> Integração com Google Calendar para ver e agendar compromissos diretamente aqui.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
