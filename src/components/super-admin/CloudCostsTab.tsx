import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Cloud, DollarSign, Zap, Activity, TrendingUp, TrendingDown,
  Server, AlertTriangle, BarChart3, Cpu, MessageSquare,
  HardDrive, Database, Phone, ChevronDown, ChevronRight,
  Info, Wifi, Bot, Image, Mic, FileText
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, ComposedChart, Area } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = "7" | "14" | "30" | "60";

const ACTION_LABELS: Record<string, string> = {
  ai_response: "Resposta IA (Chat)",
  voice_tts_long: "Voz TTS (longo)",
  voice_tts_medium: "Voz TTS (médio)",
  voice_tts_short: "Voz TTS (curto)",
  audio_transcription: "Transcrição Áudio",
  image_analysis: "Análise de Imagem",
  document_analysis: "Análise Documento",
  welcome_message: "Msg Boas-vindas",
  avatar_generation: "Geração Avatar",
  recipe_reading: "Leitura Receita",
  lead_memory: "Memória Lead",
  rag_search: "Busca RAG",
  bot_routing: "Roteamento Bot",
  initial_qualification: "Qualificação Inicial",
};

const ACTION_ICONS: Record<string, typeof Cpu> = {
  ai_response: MessageSquare,
  voice_tts_long: Mic,
  voice_tts_medium: Mic,
  voice_tts_short: Mic,
  audio_transcription: Mic,
  image_analysis: Image,
  document_analysis: FileText,
  welcome_message: Bot,
};

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--destructive))",
  "#6366f1", "#06b6d4", "#f59e0b", "#84cc16"
];

function formatUSD(val: number) {
  return `$${val.toFixed(val < 1 ? 4 : 2)}`;
}

function formatNumber(val: number) {
  return val.toLocaleString("pt-BR");
}

function formatMB(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

// Lovable Cloud pricing estimates (approximate)
const PRICING = {
  database_compute_per_hour: 0.01344, // ~$10/month for small instance
  edge_function_per_invocation: 0.000002, // $2 per million
  edge_function_per_gb_second: 0.00002,
  storage_per_gb_month: 0.021,
  realtime_per_message: 0.0000025,
  bandwidth_per_gb: 0.09,
};

export function CloudCostsTab() {
  const [period, setPeriod] = useState<Period>("30");
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cloud-infra-summary", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_infrastructure_summary" as any, {
        p_days: parseInt(period),
      });
      if (error) throw error;
      return data as any;
    },
  });

  const totals = data?.totals || {};
  const tenants = data?.tenants || [];
  const storageSummary = data?.storage_summary || [];
  const aiByAction = data?.ai_by_action || [];
  const aiByModel = data?.ai_by_model || [];
  const aiDailyTrend = data?.ai_daily_trend || [];
  const messagesDailyTrend = data?.messages_daily_trend || [];
  const aiByTenantAction = data?.ai_by_tenant_action || [];

  // Estimate infrastructure costs
  const days = parseInt(period);
  const estDatabaseCost = PRICING.database_compute_per_hour * 24 * days;
  const estEdgeFunctionCost = (totals.total_messages || 0) * 3 * PRICING.edge_function_per_invocation; // ~3 functions per message
  const estStorageCost = ((totals.total_storage_mb || 0) / 1024) * PRICING.storage_per_gb_month * (days / 30);
  const estRealtimeCost = (totals.total_messages || 0) * 2 * PRICING.realtime_per_message; // broadcast to ~2 subscribers
  const estBandwidthCost = ((totals.total_storage_mb || 0) * 0.1 / 1024) * PRICING.bandwidth_per_gb; // rough 10% served
  const totalAiCost = parseFloat(totals.total_ai_cost_usd) || 0;
  const estTotalInfra = estDatabaseCost + estEdgeFunctionCost + estStorageCost + estRealtimeCost + estBandwidthCost;

  // Merge daily trends
  const mergedDaily = (() => {
    const map: Record<string, { day: string; label: string; aiCost: number; messages: number; aiCalls: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      map[d] = {
        day: d,
        label: format(new Date(d), days > 14 ? "dd/MM" : "EEE dd", { locale: ptBR }),
        aiCost: 0, messages: 0, aiCalls: 0
      };
    }
    aiDailyTrend.forEach((d: any) => {
      const key = d.day?.substring(0, 10);
      if (map[key]) { map[key].aiCost = parseFloat(d.cost) || 0; map[key].aiCalls = d.calls || 0; }
    });
    messagesDailyTrend.forEach((d: any) => {
      const key = d.day?.substring(0, 10);
      if (map[key]) { map[key].messages = d.total_messages || 0; }
    });
    return Object.values(map);
  })();

  // Get tenant-specific AI breakdown
  const getTenantAIBreakdown = (orgId: string) => {
    return aiByTenantAction.filter((t: any) => t.org_id === orgId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
            <Cloud className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Custos Cloud — Visão Completa</h2>
            <p className="text-sm text-muted-foreground">
              Infraestrutura + IA + Storage — tudo que gera custo no Lovable Cloud
            </p>
          </div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Explainer Alert */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-amber-600">O que compõe o custo do Lovable Cloud?</p>
              <p className="text-muted-foreground">
                O Lovable Cloud cobra por <strong>infraestrutura</strong> (banco de dados 24/7, execuções de edge functions, storage, realtime, bandwidth)
                e <strong>IA</strong> (modelos GPT/Gemini/ElevenLabs). Abaixo estimamos cada componente com base no uso real medido.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === SECTION 1: Infrastructure Cost Breakdown === */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-blue-500" />
          1. Estimativa de Custos de Infraestrutura
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfraCostCard
            title="Banco de Dados (Compute)"
            description={`Servidor PostgreSQL rodando 24/7 (${days} dias)`}
            estimatedCost={estDatabaseCost}
            icon={Database}
            detail="Custo fixo principal. Roda mesmo sem tráfego."
            color="text-blue-500"
            bg="bg-blue-500/10"
            percentage={estTotalInfra > 0 ? (estDatabaseCost / estTotalInfra) * 100 : 0}
          />
          <InfraCostCard
            title="Edge Functions"
            description={`~${formatNumber((totals.total_messages || 0) * 3)} invocações estimadas`}
            estimatedCost={estEdgeFunctionCost}
            icon={Zap}
            detail={`${formatNumber(totals.total_messages || 0)} msgs × ~3 functions/msg`}
            color="text-purple-500"
            bg="bg-purple-500/10"
            percentage={estTotalInfra > 0 ? (estEdgeFunctionCost / estTotalInfra) * 100 : 0}
          />
          <InfraCostCard
            title="Storage (Armazenamento)"
            description={`${formatMB(totals.total_storage_mb || 0)} em ${formatNumber(totals.total_storage_files || 0)} arquivos`}
            estimatedCost={estStorageCost}
            icon={HardDrive}
            detail="Mídias do WhatsApp, documentos, imagens"
            color="text-green-500"
            bg="bg-green-500/10"
            percentage={estTotalInfra > 0 ? (estStorageCost / estTotalInfra) * 100 : 0}
          />
          <InfraCostCard
            title="Realtime (WebSocket)"
            description={`~${formatNumber((totals.total_messages || 0) * 2)} broadcasts estimados`}
            estimatedCost={estRealtimeCost}
            icon={Wifi}
            detail="Conexões ativas para chat ao vivo"
            color="text-cyan-500"
            bg="bg-cyan-500/10"
            percentage={estTotalInfra > 0 ? (estRealtimeCost / estTotalInfra) * 100 : 0}
          />
          <InfraCostCard
            title="Bandwidth (Tráfego)"
            description="Dados transferidos (download/upload)"
            estimatedCost={estBandwidthCost}
            icon={Activity}
            detail="Inclui mídia servida, API responses"
            color="text-orange-500"
            bg="bg-orange-500/10"
            percentage={estTotalInfra > 0 ? (estBandwidthCost / estTotalInfra) * 100 : 0}
          />
          <InfraCostCard
            title="IA (Modelos + TTS)"
            description={`${formatNumber(totals.total_ai_calls || 0)} chamadas, ${formatNumber(totals.total_tokens || 0)} tokens`}
            estimatedCost={totalAiCost}
            icon={Cpu}
            detail="GPT, Gemini, ElevenLabs, Whisper"
            color="text-red-500"
            bg="bg-red-500/10"
            percentage={estTotalInfra > 0 ? (totalAiCost / estTotalInfra) * 100 : 0}
          />
        </div>

        {/* Total estimated */}
        <Card className="mt-4 border-primary/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Estimado (apenas componentes mensuráveis)</p>
                  <p className="text-2xl font-bold">{formatUSD(estTotalInfra + totalAiCost)}</p>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground max-w-xs">
                <p className="font-medium text-amber-500">⚠️ Esta é uma estimativa parcial</p>
                <p>O Lovable Cloud pode incluir custos adicionais como auth requests, cron jobs, conexões persistentes e overhead de plataforma que não conseguimos medir aqui.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* === SECTION 2: Usage Volume Metrics === */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          2. Volume de Uso (o que gera custo)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Mensagens WhatsApp" value={formatNumber(totals.total_messages || 0)} sub={`${days} dias`} icon={MessageSquare} />
          <MetricCard label="Conversas Abertas" value={formatNumber(totals.total_conversations || 0)} sub={`${days} dias`} icon={Phone} />
          <MetricCard label="Chamadas de IA" value={formatNumber(totals.total_ai_calls || 0)} sub={formatUSD(totalAiCost)} icon={Cpu} />
          <MetricCard label="Instâncias WhatsApp" value={`${totals.connected_instances || 0}/${totals.total_instances || 0}`} sub="conectadas/total" icon={Wifi} />
          <MetricCard label="Storage Total" value={formatMB(totals.total_storage_mb || 0)} sub={`${formatNumber(totals.total_storage_files || 0)} arquivos`} icon={HardDrive} />
        </div>
      </div>

      {/* === SECTION 3: Daily Trend Chart === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Tendência Diária — Mensagens e Custo IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mergedDaily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "messages") return [formatNumber(value), "Mensagens"];
                    if (name === "aiCost") return [`$${value.toFixed(4)}`, "Custo IA (USD)"];
                    return [value, name];
                  }}
                />
                <Legend formatter={(v) => v === "messages" ? "Mensagens" : v === "aiCost" ? "Custo IA (USD)" : v} />
                <Bar yAxisId="left" dataKey="messages" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" opacity={0.6} name="messages" />
                <Line yAxisId="right" type="monotone" dataKey="aiCost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="aiCost" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* === SECTION 4: Per-Tenant Breakdown === */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-blue-500" />
          3. Consumo Detalhado por Tenant
        </h3>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Mensagens</TableHead>
                  <TableHead className="text-right">Bot Msgs</TableHead>
                  <TableHead className="text-right">Instâncias</TableHead>
                  <TableHead className="text-right">Storage</TableHead>
                  <TableHead className="text-right">IA Calls</TableHead>
                  <TableHead className="text-right">Custo IA</TableHead>
                  <TableHead className="text-right">Energia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t: any, i: number) => {
                  const isExpanded = expandedTenant === t.org_id;
                  const breakdown = getTenantAIBreakdown(t.org_id);
                  return (
                    <>
                      <TableRow
                        key={t.org_id}
                        className={`cursor-pointer hover:bg-muted/50 ${i === 0 ? "bg-orange-500/5" : ""}`}
                        onClick={() => setExpandedTenant(isExpanded ? null : t.org_id)}
                      >
                        <TableCell className="w-8 pr-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i === 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">TOP</Badge>}
                            <span className="font-medium">{t.org_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(t.total_messages)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(t.bot_messages)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {t.connected_count}/{t.instance_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatMB(t.storage_mb || 0)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(t.ai_calls)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {formatUSD(parseFloat(t.ai_cost_usd) || 0)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatNumber(t.total_energy)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${t.org_id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <p className="text-sm font-semibold text-muted-foreground">
                                Detalhamento de IA — {t.org_name}
                              </p>
                              {breakdown.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Processo</TableHead>
                                      <TableHead>Modelo</TableHead>
                                      <TableHead className="text-right">Chamadas</TableHead>
                                      <TableHead className="text-right">Custo USD</TableHead>
                                      <TableHead className="text-right">Energia</TableHead>
                                      <TableHead className="text-right">$/chamada</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {breakdown.map((b: any, bi: number) => (
                                      <TableRow key={bi}>
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            {(() => {
                                              const IconComp = ACTION_ICONS[b.action_type] || Cpu;
                                              return <IconComp className="h-3.5 w-3.5 text-muted-foreground" />;
                                            })()}
                                            <span className="text-sm">{ACTION_LABELS[b.action_type] || b.action_type}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="font-mono text-[10px]">
                                            {(b.model || "—").split("/").pop()}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">{b.calls}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">{formatUSD(parseFloat(b.cost) || 0)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">{formatNumber(b.energy)}</TableCell>
                                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                          {b.calls > 0 ? formatUSD(parseFloat(b.cost) / b.calls) : "—"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-sm text-muted-foreground">Nenhuma chamada de IA no período</p>
                              )}
                              <div className="grid grid-cols-3 gap-4 pt-2">
                                <div className="text-sm">
                                  <p className="text-muted-foreground">Impacto em Edge Functions</p>
                                  <p className="font-mono font-medium">~{formatNumber(t.total_messages * 3)} invocações</p>
                                  <p className="text-xs text-muted-foreground">({formatNumber(t.total_messages)} msgs × 3 funcs)</p>
                                </div>
                                <div className="text-sm">
                                  <p className="text-muted-foreground">Impacto em Realtime</p>
                                  <p className="font-mono font-medium">~{formatNumber(t.total_messages * 2)} broadcasts</p>
                                </div>
                                <div className="text-sm">
                                  <p className="text-muted-foreground">Conversas no Período</p>
                                  <p className="font-mono font-medium">{formatNumber(t.conversations_count)}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Sem dados no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* === SECTION 5: AI Details === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Action */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-500" />
              Custo IA por Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead className="text-right">Custo USD</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">$/chamada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiByAction.map((a: any, i: number) => (
                  <TableRow key={a.action_type} className={i === 0 && parseFloat(a.cost) > 0 ? "bg-orange-500/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const IC = ACTION_ICONS[a.action_type] || Cpu;
                          return <IC className="h-3.5 w-3.5 text-muted-foreground" />;
                        })()}
                        <span className="font-medium text-sm">{ACTION_LABELS[a.action_type] || a.action_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatUSD(parseFloat(a.cost) || 0)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{a.calls}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {a.calls > 0 ? formatUSD(parseFloat(a.cost) / a.calls) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By Model */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              Custo IA por Modelo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={aiByModel.map((m: any, i: number) => ({
                        name: (m.model || "unknown").split("/").pop(),
                        value: parseFloat(m.cost) || 0,
                        fill: COLORS[i % COLORS.length],
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    />
                    <Tooltip formatter={(value: number) => formatUSD(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiByModel.map((m: any) => (
                    <TableRow key={m.model}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {(m.model || "unknown").split("/").pop()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatUSD(parseFloat(m.cost) || 0)}</TableCell>
                      <TableCell className="text-right text-sm">{formatNumber(m.tokens || 0)}</TableCell>
                      <TableCell className="text-right text-sm">{m.calls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* === SECTION 6: Storage Breakdown === */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-green-500" />
            4. Storage — Detalhamento por Bucket
          </CardTitle>
          <CardDescription>
            Cada GB armazenado custa ~$0.021/mês. Total: {formatMB(totals.total_storage_mb || 0)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">Arquivos</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead className="text-right">Custo Est./mês</TableHead>
                <TableHead className="text-right">% do Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storageSummary.map((s: any) => {
                const sizeMb = parseFloat(s.size_mb) || 0;
                const costEst = (sizeMb / 1024) * PRICING.storage_per_gb_month;
                const pct = (totals.total_storage_mb || 0) > 0 ? (sizeMb / totals.total_storage_mb) * 100 : 0;
                return (
                  <TableRow key={s.bucket_id} className={pct > 50 ? "bg-orange-500/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {pct > 50 && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                        <span className="font-medium">{s.bucket_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatNumber(s.file_count)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatMB(sizeMb)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatUSD(costEst)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={pct > 50 ? "destructive" : "outline"} className="text-xs">
                        {pct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Optimization Insights */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Insights de Otimização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {(totals.total_storage_mb || 0) > 4000 && (
              <InsightRow icon={HardDrive} color="text-orange-500">
                <strong>Storage alto ({formatMB(totals.total_storage_mb)}):</strong> Considere limpar mídias antigas do WhatsApp
                para economizar ~{formatUSD(((totals.total_storage_mb - 2000) / 1024) * PRICING.storage_per_gb_month)}/mês.
              </InsightRow>
            )}
            {tenants.length > 0 && tenants[0].total_messages > 10000 && (
              <InsightRow icon={MessageSquare} color="text-blue-500">
                <strong>{tenants[0].org_name}</strong> gerou {formatNumber(tenants[0].total_messages)} mensagens no período
                — é o maior gerador de invocações de edge functions (~{formatNumber(tenants[0].total_messages * 3)} calls).
              </InsightRow>
            )}
            {aiByModel.find((m: any) => m.model?.includes("pro") && m.calls > 5) && (
              <InsightRow icon={Cpu} color="text-purple-500">
                Modelos <strong>Pro</strong> em uso. Migrar para Flash pode reduzir custos de IA em ~60%.
              </InsightRow>
            )}
            {(totals.total_instances || 0) > 20 && (
              <InsightRow icon={Wifi} color="text-cyan-500">
                <strong>{totals.total_instances} instâncias</strong> WhatsApp cadastradas.
                Cada instância conectada consome polling e realtime. Desativar as não usadas reduz custos.
              </InsightRow>
            )}
            {(totals.total_storage_mb || 0) <= 4000 && 
             (!tenants[0] || tenants[0].total_messages <= 10000) &&
             !aiByModel.find((m: any) => m.model?.includes("pro") && m.calls > 5) &&
             (totals.total_instances || 0) <= 20 && (
              <InsightRow icon={TrendingDown} color="text-green-500">
                Custos dentro do esperado. Nenhum alerta de otimização no momento.
              </InsightRow>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfraCostCard({ title, description, estimatedCost, icon: Icon, detail, color, bg, percentage }: {
  title: string; description: string; estimatedCost: number; icon: typeof Cpu;
  detail: string; color: string; bg: string; percentage: number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`p-2 rounded-lg ${bg}`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
        </div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xl font-bold font-mono mt-1">{formatUSD(estimatedCost)}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{detail}</p>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: {
  label: string; value: string; sub: string; icon: typeof Cpu;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <Icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function InsightRow({ icon: Icon, color, children }: {
  icon: typeof Cpu; color: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60">
      <Icon className={`h-4 w-4 ${color} mt-0.5 shrink-0`} />
      <div>{children}</div>
    </div>
  );
}
