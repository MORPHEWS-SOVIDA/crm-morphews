import { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, CalendarIcon, Instagram, Users, MessageSquare,
  UserCheck, CalendarCheck, PhoneCall, TrendingUp, Download,
  Filter, BarChart3, Star
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

const ACTIVITY_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  message_sent:    { label: 'Mensagens Enviadas', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: <MessageSquare className="h-4 w-4" /> },
  reply_received:  { label: 'Responderam',        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: <MessageSquare className="h-4 w-4" /> },
  whatsapp_shared: { label: 'WhatsApp Obtido',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: <UserCheck className="h-4 w-4" /> },
  call_scheduled:  { label: 'Calls Agendadas',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <CalendarCheck className="h-4 w-4" /> },
  call_done:       { label: 'Calls Realizadas',   color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300', icon: <PhoneCall className="h-4 w-4" /> },
};

function KpiCard({ label, value, sub, icon, colorClass }: {
  label: string; value: number | string; sub?: string; icon: React.ReactNode; colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', colorClass)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialSellingReport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const orgId = profile?.organization_id;

  const [preset, setPreset] = useState<PeriodPreset>('7d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo]     = useState<Date | undefined>();
  const [sellerFilter, setSellerFilter]   = useState<string>('all');
  const [profileFilter, setProfileFilter] = useState<string>('all');

  // Date range computation
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    if (preset === 'today')     return { dateFrom: startOfDay(now), dateTo: endOfDay(now) };
    if (preset === 'yesterday') { const y = subDays(now, 1); return { dateFrom: startOfDay(y), dateTo: endOfDay(y) }; }
    if (preset === '7d')        return { dateFrom: startOfDay(subDays(now, 6)), dateTo: endOfDay(now) };
    if (preset === '30d')       return { dateFrom: startOfDay(subDays(now, 29)), dateTo: endOfDay(now) };
    if (preset === 'custom' && customFrom && customTo)
      return { dateFrom: startOfDay(customFrom), dateTo: endOfDay(customTo) };
    return { dateFrom: startOfDay(subDays(now, 6)), dateTo: endOfDay(now) };
  }, [preset, customFrom, customTo]);

  // Fetch all activities in range
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['ss-report-activities', orgId, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_activities')
        .select(`
          id, activity_type, created_at, lead_id, instagram_username,
          seller_id, profile_id,
          social_sellers(name),
          social_selling_profiles(instagram_username)
        `)
        .eq('organization_id', orgId!)
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString())
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch sellers & profiles for filter dropdowns
  const { data: sellers = [] } = useQuery({
    queryKey: ['social-sellers', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('social_sellers').select('id, name').eq('organization_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: igProfiles = [] } = useQuery({
    queryKey: ['social-selling-profiles', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('social_selling_profiles').select('id, instagram_username').eq('organization_id', orgId!);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Apply filters
  const filtered = useMemo(() => {
    return activities.filter((a: any) => {
      if (sellerFilter !== 'all' && a.seller_id !== sellerFilter) return false;
      if (profileFilter !== 'all' && a.profile_id !== profileFilter) return false;
      return true;
    });
  }, [activities, sellerFilter, profileFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const sent        = filtered.filter((a: any) => a.activity_type === 'message_sent');
    const replied     = filtered.filter((a: any) => a.activity_type === 'reply_received');
    const whatsapp    = filtered.filter((a: any) => a.activity_type === 'whatsapp_shared');
    const scheduled   = filtered.filter((a: any) => a.activity_type === 'call_scheduled');
    const done        = filtered.filter((a: any) => a.activity_type === 'call_done');

    const sentLeads    = new Set(sent.map((a: any) => a.lead_id));
    const repliedLeads = new Set(replied.map((a: any) => a.lead_id));
    const waLeads      = new Set(whatsapp.map((a: any) => a.lead_id));

    return {
      totalSent:      sentLeads.size,
      totalReplied:   repliedLeads.size,
      totalWhatsApp:  waLeads.size,
      totalScheduled: scheduled.length,
      totalDone:      done.length,
      replyRate:  sentLeads.size > 0 ? ((repliedLeads.size / sentLeads.size) * 100).toFixed(1) : '0',
      waRate:     sentLeads.size > 0 ? ((waLeads.size / sentLeads.size) * 100).toFixed(1) : '0',
    };
  }, [filtered]);

  // Breakdown by seller
  const bySeller = useMemo(() => {
    const map: Record<string, { name: string; sent: Set<string>; replied: Set<string>; whatsapp: Set<string>; scheduled: number; done: number }> = {};
    filtered.forEach((a: any) => {
      const sid = a.seller_id || 'unknown';
      const name = a.social_sellers?.name || 'Desconhecido';
      if (!map[sid]) map[sid] = { name, sent: new Set(), replied: new Set(), whatsapp: new Set(), scheduled: 0, done: 0 };
      if (a.activity_type === 'message_sent')    map[sid].sent.add(a.lead_id);
      if (a.activity_type === 'reply_received')  map[sid].replied.add(a.lead_id);
      if (a.activity_type === 'whatsapp_shared') map[sid].whatsapp.add(a.lead_id);
      if (a.activity_type === 'call_scheduled')  map[sid].scheduled++;
      if (a.activity_type === 'call_done')        map[sid].done++;
    });
    return Object.values(map).sort((a, b) => b.sent.size - a.sent.size);
  }, [filtered]);

  // Breakdown by profile
  const byProfile = useMemo(() => {
    const map: Record<string, { username: string; sent: Set<string>; replied: Set<string>; whatsapp: Set<string> }> = {};
    filtered.forEach((a: any) => {
      const pid = a.profile_id || 'unknown';
      const username = a.social_selling_profiles?.instagram_username || '?';
      if (!map[pid]) map[pid] = { username, sent: new Set(), replied: new Set(), whatsapp: new Set() };
      if (a.activity_type === 'message_sent')    map[pid].sent.add(a.lead_id);
      if (a.activity_type === 'reply_received')  map[pid].replied.add(a.lead_id);
      if (a.activity_type === 'whatsapp_shared') map[pid].whatsapp.add(a.lead_id);
    });
    return Object.values(map).sort((a, b) => b.sent.size - a.sent.size);
  }, [filtered]);

  // Daily breakdown
  const byDay = useMemo(() => {
    const map: Record<string, { sent: Set<string>; replied: Set<string>; whatsapp: Set<string>; scheduled: number; done: number }> = {};
    filtered.forEach((a: any) => {
      const day = a.created_at.slice(0, 10);
      if (!map[day]) map[day] = { sent: new Set(), replied: new Set(), whatsapp: new Set(), scheduled: 0, done: 0 };
      if (a.activity_type === 'message_sent')    map[day].sent.add(a.lead_id);
      if (a.activity_type === 'reply_received')  map[day].replied.add(a.lead_id);
      if (a.activity_type === 'whatsapp_shared') map[day].whatsapp.add(a.lead_id);
      if (a.activity_type === 'call_scheduled')  map[day].scheduled++;
      if (a.activity_type === 'call_done')        map[day].done++;
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const exportCSV = () => {
    const rows = [
      ['Data', 'Abordados', 'Responderam', 'WhatsApp Obtido', 'Calls Agendadas', 'Calls Feitas'],
      ...byDay.map(([day, d]) => [
        day, d.sent.size, d.replied.size, d.whatsapp.size, d.scheduled, d.done
      ])
    ];
    const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'relatorio-social-selling.csv'; a.click();
  };

  const presetLabel: Record<PeriodPreset, string> = {
    today: 'Hoje', yesterday: 'Ontem', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', custom: 'Personalizado'
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/instagram/social-selling')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-pink-500" />
              Relatório Social Selling
            </h1>
            <p className="text-sm text-muted-foreground">Análise de prospecção ativa no Instagram</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Period Preset */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Período</p>
                <div className="flex gap-1 flex-wrap">
                  {(['today','yesterday','7d','30d','custom'] as PeriodPreset[]).map(p => (
                    <Button
                      key={p}
                      size="sm"
                      variant={preset === p ? 'default' : 'outline'}
                      className="h-8 text-xs"
                      onClick={() => setPreset(p)}
                    >
                      {presetLabel[p]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom date pickers */}
              {preset === 'custom' && (
                <div className="flex gap-2 items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">De</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs w-32">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Até</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs w-32">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {customTo ? format(customTo, 'dd/MM/yyyy') : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              <Separator orientation="vertical" className="h-8 hidden md:block" />

              {/* Seller filter */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Vendedor</p>
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Profile filter */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Perfil</p>
                <Select value={profileFilter} onValueChange={setProfileFilter}>
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {igProfiles.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>@{p.instagram_username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              📅 {format(dateFrom, "dd 'de' MMM", { locale: ptBR })} → {format(dateTo, "dd 'de' MMM yyyy", { locale: ptBR })}
              {!isLoading && <span className="ml-2 text-foreground font-medium">· {filtered.length} atividades</span>}
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Abordados"
            value={kpis.totalSent}
            sub="leads únicos"
            icon={<Instagram className="h-4 w-4" />}
            colorClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30"
          />
          <KpiCard
            label="Responderam"
            value={kpis.totalReplied}
            sub={`${kpis.replyRate}% de resposta`}
            icon={<MessageSquare className="h-4 w-4" />}
            colorClass="bg-green-100 text-green-600 dark:bg-green-900/30"
          />
          <KpiCard
            label="WhatsApp Obtido"
            value={kpis.totalWhatsApp}
            sub={`${kpis.waRate}% conversão`}
            icon={<UserCheck className="h-4 w-4" />}
            colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/30"
          />
          <KpiCard
            label="Calls Agendadas"
            value={kpis.totalScheduled}
            icon={<CalendarCheck className="h-4 w-4" />}
            colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/30"
          />
          <KpiCard
            label="Calls Feitas"
            value={kpis.totalDone}
            icon={<PhoneCall className="h-4 w-4" />}
            colorClass="bg-pink-100 text-pink-600 dark:bg-pink-900/30"
          />
        </div>

        {/* Daily breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Por Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {byDay.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Data</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Abordados</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Responderam</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">WhatsApp</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Call Agendada</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Call Feita</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">Taxa Resp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map(([day, d]) => {
                      const rate = d.sent.size > 0 ? ((d.replied.size / d.sent.size) * 100).toFixed(0) : '0';
                      const dateObj = parseISO(day);
                      const label = format(dateObj, "EEE, dd/MM", { locale: ptBR });
                      return (
                        <tr key={day} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-medium capitalize">{label}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold">{d.sent.size}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-semibold">{d.replied.size}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-semibold">{d.whatsapp.size}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-semibold">{d.scheduled}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 font-semibold">{d.done}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground text-xs font-medium">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Seller */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Por Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bySeller.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Sem dados</p>
              ) : bySeller.map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.sent.size} abord.</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap pl-9">
                    <span className="text-[11px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">
                      {s.replied.size} resp.
                    </span>
                    <span className="text-[11px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                      {s.whatsapp.size} whats.
                    </span>
                    <span className="text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                      {s.scheduled} ag.
                    </span>
                    <span className="text-[11px] bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-1.5 py-0.5 rounded font-medium">
                      {s.done} call
                    </span>
                    {s.sent.size > 0 && (
                      <span className="text-[11px] text-muted-foreground px-1.5 py-0.5">
                        {((s.replied.size / s.sent.size) * 100).toFixed(0)}% taxa
                      </span>
                    )}
                  </div>
                  {i < bySeller.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* By Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                Por Perfil de Origem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {byProfile.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Sem dados</p>
              ) : byProfile.map((p, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Instagram className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                      <span className="text-sm font-medium">@{p.username}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{p.sent.size} abord.</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap pl-5">
                    <span className="text-[11px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">
                      {p.replied.size} resp.
                    </span>
                    <span className="text-[11px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium">
                      {p.whatsapp.size} whats.
                    </span>
                    {p.sent.size > 0 && (
                      <span className="text-[11px] text-muted-foreground px-1.5 py-0.5">
                        {((p.replied.size / p.sent.size) * 100).toFixed(0)}% taxa
                      </span>
                    )}
                  </div>
                  {i < byProfile.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
