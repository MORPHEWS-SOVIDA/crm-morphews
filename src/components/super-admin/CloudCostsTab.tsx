import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Cloud, DollarSign, Zap, Activity, TrendingUp, TrendingDown, 
  Server, Clock, AlertTriangle, BarChart3, Cpu, MessageSquare 
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Period = "7" | "14" | "30" | "60";

export function CloudCostsTab() {
  const [period, setPeriod] = useState<Period>("30");

  // 1. Energy usage by tenant
  const { data: tenantCosts, isLoading: loadingTenants } = useQuery({
    queryKey: ["cloud-costs-tenants", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_costs_by_tenant" as any, {
        p_days: parseInt(period),
      });
      if (error) {
        // Fallback to direct query
        const { data: fallback, error: fallbackErr } = await supabase
          .from("energy_usage_log")
          .select("organization_id, energy_consumed, real_cost_usd, action_type, model_used, created_at")
          .gte("created_at", subDays(new Date(), parseInt(period)).toISOString());
        
        if (fallbackErr) throw fallbackErr;

        // Group by org manually
        const byOrg: Record<string, { energy: number; cost: number; calls: number; orgId: string }> = {};
        (fallback || []).forEach((row: any) => {
          const key = row.organization_id;
          if (!byOrg[key]) byOrg[key] = { energy: 0, cost: 0, calls: 0, orgId: key };
          byOrg[key].energy += row.energy_consumed || 0;
          byOrg[key].cost += parseFloat(row.real_cost_usd) || 0;
          byOrg[key].calls += 1;
        });

        // Get org names
        const orgIds = Object.keys(byOrg);
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);

        const orgMap: Record<string, string> = {};
        (orgs || []).forEach((o: any) => { orgMap[o.id] = o.name; });

        return Object.values(byOrg)
          .map(v => ({ ...v, orgName: orgMap[v.orgId] || "Desconhecido" }))
          .sort((a, b) => b.cost - a.cost);
      }
      return data;
    },
  });

  // 2. Costs by action type
  const { data: actionCosts, isLoading: loadingActions } = useQuery({
    queryKey: ["cloud-costs-actions", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_usage_log")
        .select("action_type, energy_consumed, real_cost_usd, model_used")
        .gte("created_at", subDays(new Date(), parseInt(period)).toISOString());

      if (error) throw error;

      const byAction: Record<string, { energy: number; cost: number; calls: number; models: Set<string> }> = {};
      (data || []).forEach((row: any) => {
        const key = row.action_type || "unknown";
        if (!byAction[key]) byAction[key] = { energy: 0, cost: 0, calls: 0, models: new Set() };
        byAction[key].energy += row.energy_consumed || 0;
        byAction[key].cost += parseFloat(row.real_cost_usd) || 0;
        byAction[key].calls += 1;
        if (row.model_used) byAction[key].models.add(row.model_used);
      });

      return Object.entries(byAction)
        .map(([action, v]) => ({
          action,
          energy: v.energy,
          cost: v.cost,
          calls: v.calls,
          models: Array.from(v.models).join(", "),
          avgCost: v.calls > 0 ? v.cost / v.calls : 0,
        }))
        .sort((a, b) => b.cost - a.cost);
    },
  });

  // 3. Daily trend
  const { data: dailyTrend, isLoading: loadingTrend } = useQuery({
    queryKey: ["cloud-costs-daily", period],
    queryFn: async () => {
      const days = parseInt(period);
      const { data, error } = await supabase
        .from("energy_usage_log")
        .select("created_at, energy_consumed, real_cost_usd")
        .gte("created_at", subDays(new Date(), days).toISOString());

      if (error) throw error;

      const byDay: Record<string, { energy: number; cost: number; calls: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        byDay[d] = { energy: 0, cost: 0, calls: 0 };
      }

      (data || []).forEach((row: any) => {
        const d = format(new Date(row.created_at), "yyyy-MM-dd");
        if (byDay[d]) {
          byDay[d].energy += row.energy_consumed || 0;
          byDay[d].cost += parseFloat(row.real_cost_usd) || 0;
          byDay[d].calls += 1;
        }
      });

      return Object.entries(byDay).map(([date, v]) => ({
        date,
        label: format(new Date(date), days > 14 ? "dd/MM" : "EEE dd", { locale: ptBR }),
        ...v,
      }));
    },
  });

  // 4. Model usage breakdown
  const { data: modelCosts, isLoading: loadingModels } = useQuery({
    queryKey: ["cloud-costs-models", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("energy_usage_log")
        .select("model_used, energy_consumed, real_cost_usd, tokens_used")
        .gte("created_at", subDays(new Date(), parseInt(period)).toISOString());

      if (error) throw error;

      const byModel: Record<string, { energy: number; cost: number; calls: number; tokens: number }> = {};
      (data || []).forEach((row: any) => {
        const key = row.model_used || "unknown";
        if (!byModel[key]) byModel[key] = { energy: 0, cost: 0, calls: 0, tokens: 0 };
        byModel[key].energy += row.energy_consumed || 0;
        byModel[key].cost += parseFloat(row.real_cost_usd) || 0;
        byModel[key].calls += 1;
        byModel[key].tokens += row.tokens_used || 0;
      });

      return Object.entries(byModel)
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.cost - a.cost);
    },
  });

  const totalCostUsd = tenantCosts?.reduce((s: number, t: any) => s + (t.cost || 0), 0) || 0;
  const totalEnergy = tenantCosts?.reduce((s: number, t: any) => s + (t.energy || 0), 0) || 0;
  const totalCalls = tenantCosts?.reduce((s: number, t: any) => s + (t.calls || 0), 0) || 0;

  // Calculate trend
  const halfIdx = Math.floor((dailyTrend?.length || 0) / 2);
  const recentHalf = dailyTrend?.slice(halfIdx) || [];
  const previousHalf = dailyTrend?.slice(0, halfIdx) || [];
  const recentCost = recentHalf.reduce((s, d) => s + d.cost, 0);
  const previousCost = previousHalf.reduce((s, d) => s + d.cost, 0);
  const costTrend = previousCost > 0 ? ((recentCost - previousCost) / previousCost * 100) : 0;

  const COLORS = [
    "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", 
    "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--destructive))",
    "#6366f1", "#06b6d4", "#f59e0b", "#84cc16"
  ];

  const ACTION_LABELS: Record<string, string> = {
    ai_response: "Resposta IA",
    voice_tts_long: "Voz TTS (longo)",
    voice_tts_medium: "Voz TTS (médio)", 
    voice_tts_short: "Voz TTS (curto)",
    audio_transcription: "Transcrição Áudio",
    image_analysis: "Análise Imagem",
    document_analysis: "Análise Documento",
    welcome_message: "Msg Boas-vindas",
    avatar_generation: "Geração Avatar",
    recipe_reading: "Leitura Receita",
    lead_memory: "Memória Lead",
    rag_search: "Busca RAG",
    bot_routing: "Roteamento Bot",
    initial_qualification: "Qualificação Inicial",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
            <Cloud className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Custos Cloud</h2>
            <p className="text-sm text-muted-foreground">
              Monitoramento de gastos por tenant, processo e modelo
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-orange-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custo Real (USD)</p>
                <p className="text-2xl font-bold text-orange-500">
                  ${totalCostUsd.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-500/30" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              {costTrend > 0 ? (
                <><TrendingUp className="h-3 w-3 text-red-500" /><span className="text-red-500">+{costTrend.toFixed(0)}% vs período anterior</span></>
              ) : costTrend < 0 ? (
                <><TrendingDown className="h-3 w-3 text-green-500" /><span className="text-green-500">{costTrend.toFixed(0)}% vs período anterior</span></>
              ) : (
                <span className="text-muted-foreground">Sem dados anteriores</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Energia Total</p>
                <p className="text-2xl font-bold">{totalEnergy.toLocaleString("pt-BR")}</p>
              </div>
              <Zap className="h-8 w-8 text-primary/30" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ~R$ {(totalEnergy / 200).toFixed(2)} em créditos vendidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chamadas IA</p>
                <p className="text-2xl font-bold">{totalCalls.toLocaleString("pt-BR")}</p>
              </div>
              <Cpu className="h-8 w-8 text-purple-500/30" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Custo médio: ${totalCalls > 0 ? (totalCostUsd / totalCalls).toFixed(4) : "0"}/chamada
            </p>
          </CardContent>
        </Card>

        <Card className={totalCostUsd > 5 ? "border-red-500/30 bg-red-500/5" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Margem Estimada</p>
                <p className="text-2xl font-bold">
                  {totalCostUsd > 0 
                    ? `${(((totalEnergy / 200) - totalCostUsd) / (totalEnergy / 200) * 100).toFixed(0)}%`
                    : "—"
                  }
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-500/30" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lucro: R$ {((totalEnergy / 200) - totalCostUsd).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Custo Diário (USD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTrend ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(4)}`, "Custo USD"]}
                    labelFormatter={(label) => `Dia: ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))">
                    {dailyTrend?.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.cost > (totalCostUsd / (dailyTrend?.length || 1)) * 1.5
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--primary))"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-500" />
              Custo por Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTenants ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Custo USD</TableHead>
                    <TableHead className="text-right">Energia</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantCosts?.map((t: any, i: number) => (
                    <TableRow key={t.orgId} className={i === 0 && t.cost > 0 ? "bg-orange-500/5" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {i === 0 && t.cost > 0 && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                          {t.orgName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${t.cost.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right">{t.energy.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{t.calls}</TableCell>
                    </TableRow>
                  ))}
                  {(!tenantCosts || tenantCosts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Sem dados no período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* By Action Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-500" />
              Custo por Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingActions ? (
              <Skeleton className="h-48 w-full" />
            ) : (
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
                  {actionCosts?.map((a, i) => (
                    <TableRow key={a.action} className={i === 0 && a.cost > 0 ? "bg-orange-500/5" : ""}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{ACTION_LABELS[a.action] || a.action}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{a.models}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">${a.cost.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{a.calls}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ${a.avgCost.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Consumo por Modelo de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingModels ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modelCosts?.map((m, i) => ({
                        name: m.model.split("/").pop() || m.model,
                        value: m.cost,
                        fill: COLORS[i % COLORS.length],
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(4)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Custo USD</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelCosts?.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-medium text-sm">
                        <Badge variant="outline" className="font-mono text-xs">
                          {m.model.split("/").pop() || m.model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">${m.cost.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{m.tokens.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{m.calls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights / Alerts */}
      {actionCosts && actionCosts.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Insights de Otimização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {actionCosts.filter(a => a.avgCost > 0.01).map(a => (
                <div key={a.action} className="flex items-start gap-2 p-2 rounded-lg bg-background/60">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{ACTION_LABELS[a.action] || a.action}</span>
                    {" — "}Custo médio alto: <span className="font-mono text-amber-600">${a.avgCost.toFixed(4)}</span>/chamada 
                    ({a.calls} chamadas = <span className="font-mono">${a.cost.toFixed(4)}</span> total).
                    {a.models.includes("pro") && " Considere usar modelo Flash para reduzir custos."}
                  </div>
                </div>
              ))}
              {modelCosts?.filter(m => m.model.includes("pro") && m.calls > 5).map(m => (
                <div key={m.model} className="flex items-start gap-2 p-2 rounded-lg bg-background/60">
                  <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{m.model}</span>
                    {" — "}{m.calls} chamadas usando modelo Pro. Migrar para Flash pode economizar ~60% dos custos.
                  </div>
                </div>
              ))}
              {totalCalls > 0 && totalCostUsd / totalCalls > 0.005 && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60">
                  <DollarSign className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    Custo médio geral <span className="font-mono text-red-500">${(totalCostUsd / totalCalls).toFixed(4)}</span>/chamada 
                    está acima do ideal ($0.005). Revisar processos mais caros.
                  </div>
                </div>
              )}
              {actionCosts.filter(a => a.avgCost > 0.01).length === 0 && 
               (!modelCosts || modelCosts.filter(m => m.model.includes("pro") && m.calls > 5).length === 0) &&
               (totalCalls === 0 || totalCostUsd / totalCalls <= 0.005) && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10">
                  <TrendingDown className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div>Custos dentro do esperado. Nenhum alerta de otimização no momento.</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
