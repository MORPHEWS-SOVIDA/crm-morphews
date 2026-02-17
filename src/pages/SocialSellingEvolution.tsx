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
  ArrowLeft, Search, MessageSquare, Phone, UserCheck, Loader2,
  CheckCircle2, Instagram, Send
} from 'lucide-react';

type ActivityType = 'reply_received' | 'whatsapp_shared' | 'call_scheduled' | 'call_done';

const ACTIVITY_BUTTONS: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'reply_received', label: 'Respondeu', icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' },
  { type: 'whatsapp_shared', label: 'WhatsApp', icon: <UserCheck className="h-3.5 w-3.5" />, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400' },
  { type: 'call_scheduled', label: 'Call', icon: <Phone className="h-3.5 w-3.5" />, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
];

export default function SocialSellingEvolution() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [search, setSearch] = useState('');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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

  // Fetch social selling leads with their activities
  const { data: leads, isLoading } = useQuery({
    queryKey: ['social-selling-leads', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('leads')
        .select('id, name, instagram, stage, assigned_to, created_at')
        .eq('organization_id', orgId!)
        .eq('source', 'social_selling')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch all activities for these leads
  const { data: activities } = useQuery({
    queryKey: ['social-selling-all-activities', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_activities')
        .select('lead_id, activity_type, seller_id, created_at')
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
    return result;
  }, [leads, search, sellerFilter, activities]);

  // Mutation to log activity
  const logActivity = useMutation({
    mutationFn: async ({ leadId, activityType }: { leadId: string; activityType: ActivityType }) => {
      const meta = leadMetaMap[leadId];
      if (!meta) throw new Error('Lead sem dados de social selling');

      // Check for duplicate
      const existing = (activities || []).find(
        (a: any) => a.lead_id === leadId && a.activity_type === activityType
      );
      if (existing) throw new Error('Atividade já registrada para este lead');

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
    },
    onSuccess: (_, { activityType }) => {
      const labels: Record<string, string> = {
        reply_received: 'Resposta registrada!',
        whatsapp_shared: 'WhatsApp registrado!',
        call_scheduled: 'Call registrada!',
        call_done: 'Call feita registrada!',
      };
      toast.success(labels[activityType] || 'Registrado!');
      queryClient.invalidateQueries({ queryKey: ['social-selling-all-activities'] });
      queryClient.invalidateQueries({ queryKey: ['social-selling-activities'] });
      setPendingAction(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao registrar');
      setPendingAction(null);
    },
  });

  const handleAction = (leadId: string, type: ActivityType) => {
    setPendingAction(`${leadId}-${type}`);
    logActivity.mutate({ leadId, activityType: type });
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
              Marque a evolução: respondeu, passou WhatsApp, agendou call
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
                          {(done.has('call_scheduled') || done.has('call_done')) && (
                            <Badge className="text-[10px] h-4 px-1 gap-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                              <Phone className="h-2.5 w-2.5" />
                              Call
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ACTIVITY_BUTTONS.map(btn => {
                          const isDone = done.has(btn.type);
                          const isLoading = pendingAction === `${lead.id}-${btn.type}`;
                          return (
                            <Button
                              key={btn.type}
                              variant="ghost"
                              size="sm"
                              disabled={isDone || isLoading}
                              onClick={() => handleAction(lead.id, btn.type)}
                              className={`h-7 px-2 text-xs gap-1 ${isDone ? 'opacity-40 cursor-default' : btn.color}`}
                              title={isDone ? `${btn.label} já registrado` : `Marcar: ${btn.label}`}
                            >
                              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : btn.icon}
                              {btn.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
