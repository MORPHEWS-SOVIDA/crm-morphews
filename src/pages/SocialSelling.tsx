import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import {
  Instagram, Users, Target, TrendingUp, Camera, BarChart3,
  ArrowRight, MessageSquare, Phone, Send, UserCheck, Loader2,
  CalendarCheck, PhoneCall
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

export default function SocialSelling() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [periodFilter, setPeriodFilter] = useState<'today' | '7d' | '30d' | 'all'>('7d');

  const orgId = profile?.organization_id;

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

  // Fetch profiles
  const { data: igProfiles } = useQuery({
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

  // Fetch activities with period filter
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['social-selling-activities', orgId, periodFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('social_selling_activities')
        .select('*, social_sellers(name), social_selling_profiles(instagram_username)')
        .eq('organization_id', orgId!);

      if (periodFilter !== 'all') {
        const now = new Date();
        let start: Date;
        if (periodFilter === 'today') {
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (periodFilter === '7d') {
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        query = query.gte('created_at', start.toISOString());
      }

      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch imports
  const { data: imports } = useQuery({
    queryKey: ['social-selling-imports', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_imports')
        .select('*, social_sellers(name), social_selling_profiles(instagram_username)')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch funnel stages for lead counts
  const { data: funnelStages } = useFunnelStages();

  // Fetch lead counts per stage
  const { data: leadCounts } = useQuery({
    queryKey: ['social-selling-lead-counts', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('leads')
        .select('stage, id')
        .eq('organization_id', orgId!)
        .eq('source', 'social_selling');
      
      const counts: Record<string, number> = {};
      (data || []).forEach(l => {
        counts[l.stage] = (counts[l.stage] || 0) + 1;
      });
      return counts;
    },
    enabled: !!orgId,
  });

  // Helper: count unique lead_ids for a given activity type
  const uniqueCount = (acts: any[], type: string) =>
    new Set(acts.filter(a => a.activity_type === type).map(a => a.lead_id)).size;

  // Compute metrics — únicos por lead_id
  const totalMessages = uniqueCount(activities || [], 'message_sent');
  const totalReplies = uniqueCount(activities || [], 'reply_received');
  const totalWhatsapp = uniqueCount(activities || [], 'whatsapp_shared');
  const totalCallScheduled = uniqueCount(activities || [], 'call_scheduled');
  const totalCallDone = uniqueCount(activities || [], 'call_done');

  // Per seller metrics — únicos por lead_id
  const sellerMetrics = (sellers || []).map(seller => {
    const sa = (activities || []).filter(a => a.seller_id === seller.id);
    return {
      ...seller,
      messages: uniqueCount(sa, 'message_sent'),
      replies: uniqueCount(sa, 'reply_received'),
      whatsapp: uniqueCount(sa, 'whatsapp_shared'),
      callScheduled: uniqueCount(sa, 'call_scheduled'),
      callDone: uniqueCount(sa, 'call_done'),
    };
  });

  // Per profile metrics — únicos por lead_id
  const profileMetrics = (igProfiles || []).map(p => {
    const pa = (activities || []).filter(a => a.profile_id === p.id);
    const msgs = uniqueCount(pa, 'message_sent');
    const replies = uniqueCount(pa, 'reply_received');
    return {
      ...p,
      messages: msgs,
      replies,
      whatsapp: uniqueCount(pa, 'whatsapp_shared'),
      callScheduled: uniqueCount(pa, 'call_scheduled'),
      callDone: uniqueCount(pa, 'call_done'),
      conversionRate: msgs > 0
        ? ((replies / msgs) * 100).toFixed(1)
        : '0',
    };
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              Social Selling
            </h1>
            <p className="text-muted-foreground mt-1">
              Prospecção ativa via Instagram — métricas de produtividade por seller e perfil
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate('/instagram/social-selling/evolucao')}>
              <TrendingUp className="h-4 w-4 mr-1" />
              Evolução
            </Button>
            <Button variant="outline" onClick={() => navigate('/instagram/social-selling/relatorio')}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Relatório
            </Button>
            <Button onClick={() => navigate('/instagram/social-selling/importar-print')}>
              <Camera className="h-4 w-4 mr-1" />
              Importar Prints
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Send className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold text-foreground">{totalMessages}</p>
              <p className="text-xs text-muted-foreground">Msgs Enviadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <MessageSquare className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-foreground">{totalReplies}</p>
              <p className="text-xs text-muted-foreground">Respostas</p>
              {totalMessages > 0 && (
                <p className="text-xs text-green-600 font-medium">
                  {((totalReplies / totalMessages) * 100).toFixed(1)}% taxa
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <UserCheck className="h-5 w-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold text-foreground">{totalWhatsapp}</p>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CalendarCheck className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-2xl font-bold text-foreground">{totalCallScheduled}</p>
              <p className="text-xs text-muted-foreground">Call Agendada</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <PhoneCall className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-2xl font-bold text-foreground">{totalCallDone}</p>
              <p className="text-xs text-muted-foreground">Call Feita</p>
            </CardContent>
          </Card>
        </div>

        {/* Seller Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Performance por Social Seller
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : sellerMetrics.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum seller cadastrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b">
                       <th className="text-left py-2 px-2 font-medium text-muted-foreground">Seller</th>
                       <th className="text-center py-2 px-2 font-medium text-muted-foreground">Msgs Enviadas</th>
                       <th className="text-center py-2 px-2 font-medium text-muted-foreground">Respostas</th>
                       <th className="text-center py-2 px-2 font-medium text-muted-foreground">Taxa</th>
                       <th className="text-center py-2 px-2 font-medium text-muted-foreground">WhatsApp</th>
                       <th className="text-center py-2 px-2 font-medium text-muted-foreground">Call Agendada</th>
                       <th className="text-center py-2 px-2 font-medium text-muted-foreground">Call Feita</th>
                     </tr>
                   </thead>
                   <tbody>
                     {sellerMetrics.map(s => (
                       <tr key={s.id} className="border-b last:border-0">
                         <td className="py-3 px-2 font-medium">{s.name}</td>
                         <td className="py-3 px-2 text-center">
                           <Badge variant="secondary">{s.messages}</Badge>
                         </td>
                         <td className="py-3 px-2 text-center">{s.replies}</td>
                         <td className="py-3 px-2 text-center">
                           <span className={s.messages > 0 && (s.replies / s.messages) > 0.1 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                             {s.messages > 0 ? ((s.replies / s.messages) * 100).toFixed(1) : 0}%
                           </span>
                         </td>
                         <td className="py-3 px-2 text-center">{s.whatsapp}</td>
                         <td className="py-3 px-2 text-center">{s.callScheduled}</td>
                         <td className="py-3 px-2 text-center">{s.callDone}</td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-500" />
              Performance por Perfil do Instagram
            </CardTitle>
            <CardDescription>Qual perfil gera mais conexão e leva mais gente para calls</CardDescription>
          </CardHeader>
          <CardContent>
            {profileMetrics.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhum perfil cadastrado</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {profileMetrics.map(p => (
                  <Card key={p.id} className="border">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                          <Instagram className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">@{p.instagram_username}</p>
                          {p.display_name && <p className="text-xs text-muted-foreground">{p.display_name}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="font-bold">{p.messages}</p>
                          <p className="text-xs text-muted-foreground">Enviadas</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="font-bold">{p.replies}</p>
                          <p className="text-xs text-muted-foreground">Respostas</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="font-bold">{p.whatsapp}</p>
                          <p className="text-xs text-muted-foreground">WhatsApp</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="font-bold">{p.callScheduled}</p>
                          <p className="text-xs text-muted-foreground">Call Agend.</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="font-bold">{p.callDone}</p>
                          <p className="text-xs text-muted-foreground">Call Feita</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2 text-center">
                          <p className="font-bold text-green-600">{p.conversionRate}%</p>
                          <p className="text-xs text-muted-foreground">Conversão</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funnel Overview */}
        {funnelStages && leadCounts && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Funil Social Selling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {funnelStages.map(stage => (
                  <div key={stage.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${stage.color}`}>
                    <span className={`text-xs font-medium ${stage.text_color}`}>{stage.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {leadCounts[stage.enum_value || ''] || 0}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Imports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Últimas Importações de Prints
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(imports || []).length === 0 ? (
              <div className="text-center py-8">
                <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Nenhuma importação ainda</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => navigate('/instagram/social-selling/importar-print')}
                >
                  Importar Primeiro Print
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {(imports || []).map(imp => (
                  <div key={imp.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {(imp as any).social_sellers?.name} via @{(imp as any).social_selling_profiles?.instagram_username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(imp.period_start).toLocaleDateString('pt-BR')} — {imp.screenshot_urls?.length || 0} prints
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        imp.status === 'completed' ? 'default' :
                        imp.status === 'processing' ? 'secondary' :
                        imp.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {imp.status === 'completed' ? `${imp.leads_created_count} leads` :
                         imp.status === 'processing' ? 'Processando...' :
                         imp.status === 'failed' ? 'Erro' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
