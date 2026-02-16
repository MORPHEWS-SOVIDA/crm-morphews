import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare, Send, Inbox, Users, UserPlus, Bot, Instagram, Phone, 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus, BarChart3,
  Link2, Filter,
} from "lucide-react";

type Period = "7" | "14" | "30" | "60";
type ChannelFilter = "all" | "whatsapp" | "instagram";

export function MessagingMetricsDashboard() {
  const { tenantId } = useTenant();
  const [period, setPeriod] = useState<Period>("30");
  const [channel, setChannel] = useState<ChannelFilter>("all");

  // Fetch real-time stats from conversations and messages
  const { data: stats, isLoading } = useQuery({
    queryKey: ["messaging-metrics", tenantId, period, channel],
    queryFn: async () => {
      if (!tenantId) return null;
      const startDate = subDays(new Date(), parseInt(period)).toISOString();

      // Messages count
      let msgQuery = supabase
        .from("whatsapp_messages")
        .select("id, direction, is_from_bot, created_at, conversation_id, instance_id", { count: "exact" })
        .gte("created_at", startDate);

      // Conversations
      let convQuery = supabase
        .from("whatsapp_conversations")
        .select("id, lead_id, status, channel_type, created_at, closed_at, instance_id, contact_name, assigned_user_id")
        .eq("organization_id", tenantId);

      if (channel !== "all") {
        convQuery = convQuery.eq("channel_type", channel);
      }

      const [{ data: messages }, { data: conversations }] = await Promise.all([
        msgQuery,
        convQuery,
      ]);

      // Filter messages by instance_ids from filtered conversations
      const convIds = new Set((conversations || []).map(c => c.id));
      const filteredMsgs = (messages || []).filter((m: any) => {
        if (channel === "all") return true;
        // We need to check if the message belongs to a conversation with the right channel
        return convIds.has(m.conversation_id);
      });

      const sent = filteredMsgs.filter((m: any) => m.direction === "outbound").length;
      const received = filteredMsgs.filter((m: any) => m.direction === "inbound").length;
      const fromBot = filteredMsgs.filter((m: any) => m.is_from_bot).length;

      // Conversations in period
      const convsInPeriod = (conversations || []).filter(
        (c: any) => new Date(c.created_at) >= new Date(startDate)
      );
      const totalConvs = convsInPeriod.length;
      const closedConvs = convsInPeriod.filter((c: any) => c.closed_at).length;
      const linkedToLead = convsInPeriod.filter((c: any) => c.lead_id).length;

      // Channel breakdown
      const whatsappConvs = convsInPeriod.filter((c: any) => !c.channel_type || c.channel_type === "whatsapp").length;
      const instagramConvs = convsInPeriod.filter((c: any) => c.channel_type === "instagram").length;

      // Daily breakdown
      const days = parseInt(period);
      const dailyData: Record<string, { sent: number; received: number; bot: number; convs: number; linked: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        dailyData[d] = { sent: 0, received: 0, bot: 0, convs: 0, linked: 0 };
      }

      filteredMsgs.forEach((m: any) => {
        const d = format(new Date(m.created_at), "yyyy-MM-dd");
        if (dailyData[d]) {
          if (m.direction === "outbound") dailyData[d].sent++;
          if (m.direction === "inbound") dailyData[d].received++;
          if (m.is_from_bot) dailyData[d].bot++;
        }
      });

      convsInPeriod.forEach((c: any) => {
        const d = format(new Date(c.created_at), "yyyy-MM-dd");
        if (dailyData[d]) {
          dailyData[d].convs++;
          if (c.lead_id) dailyData[d].linked++;
        }
      });

      const daily = Object.entries(dailyData).map(([date, v]) => ({
        date,
        label: format(new Date(date), days > 14 ? "dd/MM" : "EEE dd", { locale: ptBR }),
        ...v,
      }));

      // Lead links log
      const { data: leadLinks } = await supabase
        .from("conversation_lead_links")
        .select("*")
        .eq("organization_id", tenantId)
        .gte("linked_at", startDate)
        .order("linked_at", { ascending: false })
        .limit(50);

      return {
        sent,
        received,
        fromBot,
        totalConvs,
        closedConvs,
        linkedToLead,
        whatsappConvs,
        instagramConvs,
        daily,
        leadLinks: leadLinks || [],
      };
    },
    enabled: !!tenantId,
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--destructive))"];

  const channelPieData = [
    { name: "WhatsApp", value: stats?.whatsappConvs || 0, fill: "#25D366" },
    { name: "Instagram", value: stats?.instagramConvs || 0, fill: "#E1306C" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Métricas de Mensagens
          </h2>
          <p className="text-sm text-muted-foreground">
            WhatsApp + Instagram — conversas, leads e funil
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={channel} onValueChange={(v) => setChannel(v as ChannelFilter)}>
            <SelectTrigger className="w-36">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos canais</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Enviadas</span>
            </div>
            <p className="text-2xl font-bold">{(stats?.sent || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Recebidas</span>
            </div>
            <p className="text-2xl font-bold">{(stats?.received || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Bot IA</span>
            </div>
            <p className="text-2xl font-bold">{(stats?.fromBot || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Conversas</span>
            </div>
            <p className="text-2xl font-bold">{(stats?.totalConvs || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Vinculadas a Lead</span>
            </div>
            <p className="text-2xl font-bold">{(stats?.linkedToLead || 0).toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Taxa Vínculo</span>
            </div>
            <p className="text-2xl font-bold">
              {stats?.totalConvs ? `${Math.round((stats.linkedToLead / stats.totalConvs) * 100)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages per day */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mensagens por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="received" name="Recebidas" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="sent" name="Enviadas" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} stackId="a" />
                  <Bar dataKey="bot" name="Bot IA" fill="#a855f7" radius={[2, 2, 0, 0]} stackId="b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            {channelPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Sem dados no período</p>
              </div>
            )}
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-green-500" />
                <span>WhatsApp: {stats?.whatsappConvs || 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Instagram className="h-4 w-4 text-pink-500" />
                <span>Instagram: {stats?.instagramConvs || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Linked + Conversions per day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-5 w-5 text-amber-500" />
            Conversas Vinculadas a Lead (por dia)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="convs" name="Conversas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="linked" name="Vinculadas" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Lead Links */}
      {stats?.leadLinks && stats.leadLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              Últimas Vinculações Lead ↔ Conversa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Username/WhatsApp</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.leadLinks.slice(0, 15).map((link: any) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.lead_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={link.channel_type === "instagram" ? "destructive" : "default"} className="text-xs">
                        {link.channel_type === "instagram" ? "📸 Instagram" : "📱 WhatsApp"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {link.linked_by === "auto_username" ? "Auto (username)"
                          : link.linked_by === "auto_phone" ? "Auto (telefone)"
                          : link.linked_by === "bot" ? "Bot IA"
                          : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {link.instagram_username ? `@${link.instagram_username}` : link.lead_whatsapp || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(link.linked_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
