import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  ArrowLeft, Search, MessageSquare, Phone, UserCheck, Loader2,
  CheckCircle2, Instagram, Send, CalendarCheck, PhoneCall, ExternalLink
} from 'lucide-react';

type ActivityType = 'reply_received' | 'whatsapp_shared' | 'call_scheduled' | 'call_done';

const ACTIVITY_BUTTONS: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'reply_received', label: 'Respondeu', icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' },
  { type: 'whatsapp_shared', label: 'WhatsApp', icon: <UserCheck className="h-3.5 w-3.5" />, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400' },
  { type: 'call_scheduled', label: 'Call Agendada', icon: <CalendarCheck className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  { type: 'call_done', label: 'Call Feita', icon: <PhoneCall className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
];

// Map activity types to funnel stage NAMES for automatic progression
const STAGE_MAP: Partial<Record<ActivityType, string>> = {
  reply_received: 'Respondeu Prospecção Ativa',
  whatsapp_shared: 'Lead não entrou no grupo',
};

export default function SocialSellingEvolution() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [search, setSearch] = useState('');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // WhatsApp dialog state
  const [whatsappDialog, setWhatsappDialog] = useState<{ leadId: string; leadName: string } | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Fetch sellers
  const { data: sellers } = useQuery({
    queryKey: ['social-sellers', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_sellers')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch social selling profiles
  const { data: profiles } = useQuery({
    queryKey: ['social-selling-profiles', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_profiles')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch funnel stages for this org
  const { data: funnelStages } = useQuery({
    queryKey: ['funnel-stages-org', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_funnel_stages')
        .select('id, name, position, enum_value')
        .eq('organization_id', orgId!)
        .order('position', { ascending: true });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch social selling leads
  const { data: leads, isLoading } = useQuery({
    queryKey: ['social-selling-leads', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('leads')
        .select('id, name, instagram, stage, whatsapp, assigned_to, created_at')
        .eq('organization_id', orgId!)
        .eq('source', 'social_selling')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch all activities for these leads (include profile_id and seller_id)
  const { data: activities } = useQuery({
    queryKey: ['social-selling-all-activities', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_activities')
        .select('lead_id, activity_type, seller_id, profile_id, created_at')
        .eq('organization_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Group activities by lead
  const activityMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    (activities || []).forEach((a: any) => {
      if (!a.lead_id) return;
      if (!map[a.lead_id]) map[a.lead_id] = new Set();
      map[a.lead_id].add(a.activity_type);
    });
    return map;
  }, [activities]);

  // Get seller_id and profile_id for a lead from their first activity
  const leadMetaMap = useMemo(() => {
    const map: Record<string, { seller_id: string; profile_id: string }> = {};
    (activities || []).forEach((a: any) => {
      if (a.lead_id && !map[a.lead_id]) {
        map[a.lead_id] = { seller_id: a.seller_id, profile_id: a.profile_id || '' };
      }
    });
    return map;
  }, [activities]);

  // Create lookup maps for display names
  const sellerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (sellers || []).forEach((s: any) => { map[s.id] = s.name; });
    return map;
  }, [sellers]);

  const profileNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { map[p.id] = p.instagram_username; });
    return map;
  }, [profiles]);

  // Find stage ID by name
  const findStageId = (stageName: string) => {
    return (funnelStages || []).find((s: any) => s.name === stageName)?.id;
  };

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = leads || [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l: any) =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.instagram || '').toLowerCase().includes(q)
      );
    }
    if (sellerFilter !== 'all') {
      const leadsWithSeller = new Set(
        (activities || [])
          .filter((a: any) => a.seller_id === sellerFilter)
          .map((a: any) => a.lead_id)
      );
      result = result.filter((l: any) => leadsWithSeller.has(l.id));
    }
    if (profileFilter !== 'all') {
      const leadsWithProfile = new Set(
        (activities || [])
          .filter((a: any) => a.profile_id === profileFilter)
          .map((a: any) => a.lead_id)
      );
      result = result.filter((l: any) => leadsWithProfile.has(l.id));
    }
    return result;
  }, [leads, search, sellerFilter, profileFilter, activities]);

  // Mutation to log activity + update lead stage
  const logActivity = useMutation({
    mutationFn: async ({ leadId, activityType, whatsapp }: { leadId: string; activityType: ActivityType; whatsapp?: string }) => {
      const meta = leadMetaMap[leadId];
      if (!meta) throw new Error('Lead sem dados de social selling');

      // Check for duplicate
      const existing = (activities || []).find(
        (a: any) => a.lead_id === leadId && a.activity_type === activityType
      );
      if (existing) throw new Error('Atividade já registrada para este lead');

      // Insert activity
      const { error } = await (supabase as any)
        .from('social_selling_activities')
        .insert({
          organization_id: orgId!,
          lead_id: leadId,
          activity_type: activityType,
          seller_id: meta.seller_id,
          profile_id: meta.profile_id,
          instagram_username: (leads || []).find((l: any) => l.id === leadId)?.instagram || null,
        });
      if (error) throw error;

      // Update lead funnel stage if mapped
      const targetStageName = STAGE_MAP[activityType];
      if (targetStageName) {
        const targetStage = (funnelStages || []).find((s: any) => 
          s.name.toLowerCase() === targetStageName.toLowerCase()
        );
        if (targetStage) {
          const updateData: any = { funnel_stage_id: targetStage.id };
          if (targetStage.enum_value) {
            updateData.stage = targetStage.enum_value;
          }
          await supabase
            .from('leads')
            .update(updateData)
            .eq('id', leadId);
        }
      }

      // If whatsapp provided, update lead's whatsapp
      if (whatsapp) {
        await supabase
          .from('leads')
          .update({ whatsapp } as any)
          .eq('id', leadId);
      }
    },
    onSuccess: (_, { activityType }) => {
      const labels: Record<string, string> = {
        reply_received: 'Resposta registrada! Lead movido para "Respondeu Prospecção Ativa"',
        whatsapp_shared: 'WhatsApp salvo! Lead movido para "Lead não entrou no grupo"',
        call_scheduled: 'Call agendada registrada!',
        call_done: 'Call feita registrada!',
      };
      toast.success(labels[activityType] || 'Registrado!');
      queryClient.invalidateQueries({ queryKey: ['social-selling-all-activities'] });
      queryClient.invalidateQueries({ queryKey: ['social-selling-activities'] });
      queryClient.invalidateQueries({ queryKey: ['social-selling-lead-activities'] });
      setPendingAction(null);
      setWhatsappDialog(null);
      setWhatsappNumber('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao registrar');
      setPendingAction(null);
    },
  });

  const handleAction = (leadId: string, type: ActivityType, leadName?: string) => {
    if (type === 'whatsapp_shared') {
      // Open WhatsApp dialog instead of immediate action
      setWhatsappDialog({ leadId, leadName: leadName || 'Lead' });
      return;
    }
    setPendingAction(`${leadId}-${type}`);
    logActivity.mutate({ leadId, activityType: type });
  };

  const handleWhatsappSubmit = () => {
    if (!whatsappDialog) return;
    if (!whatsappNumber.trim()) {
      toast.error('Preencha o número do WhatsApp');
      return;
    }
    setPendingAction(`${whatsappDialog.leadId}-whatsapp_shared`);
    logActivity.mutate({
      leadId: whatsappDialog.leadId,
      activityType: 'whatsapp_shared',
      whatsapp: whatsappNumber.trim(),
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/instagram/social-selling')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              Evolução dos Leads
            </h1>
            <p className="text-muted-foreground text-sm">
              Marque a evolução: respondeu, passou WhatsApp, agendou/fez call
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou @instagram..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos os sellers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os sellers</SelectItem>
              {(sellers || []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos os perfis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              {(profiles || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>@{p.instagram_username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lead List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Leads de Social Selling</span>
              <Badge variant="secondary">{filteredLeads.length} leads</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Instagram className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {search ? 'Nenhum lead encontrado' : 'Importe prints para começar'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLeads.map((lead: any) => {
                  const done = activityMap[lead.id] || new Set();
                  const meta = leadMetaMap[lead.id];
                  const profileUsername = meta?.profile_id ? profileNameMap[meta.profile_id] : null;
                  const sellerName = meta?.seller_id ? sellerNameMap[meta.seller_id] : null;

                  return (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                    >
                      {/* Lead info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {lead.name || lead.instagram || 'Sem nome'}
                          </p>
                          {lead.instagram && (
                            <span className="text-xs text-muted-foreground">
                              @{lead.instagram.replace(/^@/, '')}
                            </span>
                          )}
                        </div>
                        {/* Profile + Seller info */}
                        <div className="flex items-center gap-2 mt-0.5">
                          {profileUsername && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 border-pink-200 text-pink-600 dark:border-pink-800 dark:text-pink-400">
                              <Instagram className="h-2.5 w-2.5" />
                              @{profileUsername}
                            </Badge>
                          )}
                          {sellerName && (
                            <span className="text-[10px] text-muted-foreground">
                              por {sellerName}
                            </span>
                          )}
                        </div>
                        {/* Progress indicators */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                            <Send className="h-2.5 w-2.5" />
                            Enviada
                          </Badge>
                          {done.has('reply_received') && (
                            <Badge className="text-[10px] h-4 px-1 gap-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                              <MessageSquare className="h-2.5 w-2.5" />
                              Respondeu
                            </Badge>
                          )}
                          {done.has('whatsapp_shared') && (
                            <Badge className="text-[10px] h-4 px-1 gap-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0">
                              <UserCheck className="h-2.5 w-2.5" />
                              WhatsApp
                            </Badge>
                          )}
                          {done.has('call_scheduled') && (
                            <Badge className="text-[10px] h-4 px-1 gap-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                              <CalendarCheck className="h-2.5 w-2.5" />
                              Call Agendada
                            </Badge>
                          )}
                          {done.has('call_done') && (
                            <Badge className="text-[10px] h-4 px-1 gap-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                              <PhoneCall className="h-2.5 w-2.5" />
                              Call Feita
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ACTIVITY_BUTTONS.map(btn => {
                          const isDone = done.has(btn.type);
                          const isPending = pendingAction === `${lead.id}-${btn.type}`;
                          return (
                            <Button
                              key={btn.type}
                              variant="ghost"
                              size="sm"
                              disabled={isDone || isPending}
                              onClick={() => handleAction(lead.id, btn.type, lead.name)}
                              className={`h-7 px-2 text-xs gap-1 ${isDone ? 'opacity-40 cursor-default' : btn.color}`}
                              title={isDone ? `${btn.label} já registrado` : `Marcar: ${btn.label}`}
                            >
                              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : btn.icon}
                              {btn.label}
                            </Button>
                          );
                        })}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => window.open(`/leads/${lead.id}`, '_blank')}
                          title="Ver lead em nova aba"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver Lead
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Input Dialog */}
      <Dialog open={!!whatsappDialog} onOpenChange={(open) => { if (!open) { setWhatsappDialog(null); setWhatsappNumber(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-purple-600" />
              WhatsApp de {whatsappDialog?.leadName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Preencha o número do WhatsApp que o lead compartilhou. Ele será salvo no cadastro do lead e o status será atualizado para "Lead Enviou seu WhatsApp".
            </p>
            <Input
              placeholder="Ex: 11999998888"
              value={whatsappNumber}
              onChange={e => setWhatsappNumber(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleWhatsappSubmit(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWhatsappDialog(null); setWhatsappNumber(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleWhatsappSubmit}
              disabled={!whatsappNumber.trim() || pendingAction?.includes('whatsapp_shared')}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {pendingAction?.includes('whatsapp_shared') ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              Salvar WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
