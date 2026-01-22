import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Zap, DollarSign, Cpu, Image, Mic, FileText, Brain, Edit2, Save, Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AIModelCost {
  id: string;
  model_key: string;
  model_name: string;
  provider: string;
  input_cost_per_million_tokens: number;
  output_cost_per_million_tokens: number;
  fixed_cost_usd: number;
  energy_per_1000_tokens: number;
  energy_per_call: number;
  margin_multiplier: number;
  is_active: boolean;
  supports_vision: boolean;
  supports_audio: boolean;
  notes: string | null;
}

interface AIActionCost {
  id: string;
  action_key: string;
  action_name: string;
  description: string | null;
  base_energy_cost: number;
  default_model_key: string | null;
  is_fixed_cost: boolean;
  estimated_real_cost_usd: number;
  is_active: boolean;
}

// Calcular custo real aproximado para 10.000 energia
function calculateRealCostFor10kEnergy(
  energyPerUnit: number,
  realCostUsd: number
): number {
  if (energyPerUnit <= 0 || realCostUsd <= 0) return 0;
  // Se 1 chamada custa X energia e Y USD real
  // 10.000 energia = (10000 / X) chamadas = (10000 / X) * Y USD
  const calls = 10000 / energyPerUnit;
  return calls * realCostUsd;
}

// Calcular valor de venda para margem 500%
function calculateSalePrice(realCost: number, margin: number): number {
  return realCost * margin;
}

export function AIModelCostsTab() {
  const queryClient = useQueryClient();
  const [editingModel, setEditingModel] = useState<AIModelCost | null>(null);
  const [editingAction, setEditingAction] = useState<AIActionCost | null>(null);

  // Fetch models
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ["ai-model-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_model_costs")
        .select("*")
        .order("provider", { ascending: true })
        .order("model_name", { ascending: true });
      if (error) throw error;
      return data as AIModelCost[];
    },
  });

  // Fetch actions
  const { data: actions, isLoading: actionsLoading } = useQuery({
    queryKey: ["ai-action-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_action_costs")
        .select("*")
        .order("action_name", { ascending: true });
      if (error) throw error;
      return data as AIActionCost[];
    },
  });

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ["ai-usage-stats"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from("energy_usage_log")
        .select("action_type, energy_consumed, model_used, real_cost_usd")
        .gte("created_at", thirtyDaysAgo.toISOString());
      
      if (error) throw error;
      
      // Aggregate by action type
      const stats: Record<string, { count: number; totalEnergy: number; totalRealCost: number }> = {};
      data?.forEach((log: any) => {
        const key = log.action_type || "unknown";
        if (!stats[key]) {
          stats[key] = { count: 0, totalEnergy: 0, totalRealCost: 0 };
        }
        stats[key].count++;
        stats[key].totalEnergy += log.energy_consumed || 0;
        stats[key].totalRealCost += log.real_cost_usd || 0;
      });
      
      return stats;
    },
  });

  // Update model mutation
  const updateModelMutation = useMutation({
    mutationFn: async (model: Partial<AIModelCost> & { id: string }) => {
      const { error } = await supabase
        .from("ai_model_costs")
        .update({
          energy_per_1000_tokens: model.energy_per_1000_tokens,
          energy_per_call: model.energy_per_call,
          margin_multiplier: model.margin_multiplier,
          is_active: model.is_active,
        })
        .eq("id", model.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-model-costs"] });
      toast.success("Modelo atualizado!");
      setEditingModel(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  // Update action mutation
  const updateActionMutation = useMutation({
    mutationFn: async (action: Partial<AIActionCost> & { id: string }) => {
      const { error } = await supabase
        .from("ai_action_costs")
        .update({
          base_energy_cost: action.base_energy_cost,
          is_active: action.is_active,
        })
        .eq("id", action.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-action-costs"] });
      toast.success("Ação atualizada!");
      setEditingAction(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });

  // Calculate totals
  const totalRealCostMonth = usageStats 
    ? Object.values(usageStats).reduce((sum, s) => sum + s.totalRealCost, 0)
    : 0;
  const totalEnergyMonth = usageStats
    ? Object.values(usageStats).reduce((sum, s) => sum + s.totalEnergy, 0)
    : 0;
  
  // Estimate revenue (assuming $10 per 10k energy as base)
  const estimatedRevenue = (totalEnergyMonth / 10000) * 10; // $10 per 10k energy pack
  const grossMargin = estimatedRevenue > 0 ? ((estimatedRevenue - totalRealCostMonth) / estimatedRevenue * 100) : 0;

  if (modelsLoading || actionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo Real (30d)</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalRealCostMonth.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Gasto com APIs de IA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Energia Consumida</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalEnergyMonth.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Estimada</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${estimatedRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Base: $10/10k energia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Margem Bruta</CardTitle>
            <Calculator className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${grossMargin >= 80 ? "text-green-600" : grossMargin >= 50 ? "text-yellow-600" : "text-red-600"}`}>
              {grossMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Meta: &gt;80% (500%+)</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Reference Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Referência de Preço: 10.000 Energia
          </CardTitle>
          <CardDescription>
            Configure o preço de venda baseado na margem desejada de 500%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-sm text-muted-foreground">Custo Real Médio</p>
              <p className="text-2xl font-bold text-red-600">
                ${totalEnergyMonth > 0 ? ((totalRealCostMonth / totalEnergyMonth) * 10000).toFixed(2) : "2.00"}
              </p>
              <p className="text-xs text-muted-foreground">Por 10k energia</p>
            </div>
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-sm text-muted-foreground">Preço Sugerido (500%)</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {(totalEnergyMonth > 0 ? ((totalRealCostMonth / totalEnergyMonth) * 10000 * 5 * 5) : 50).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">~$10 USD = R$50</p>
            </div>
            <div className="p-4 bg-background rounded-lg border">
              <p className="text-sm text-muted-foreground">Lucro por 10k Energia</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {(totalEnergyMonth > 0 ? ((totalRealCostMonth / totalEnergyMonth) * 10000 * 4 * 5) : 40).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">80% margem</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="models" className="w-full">
        <TabsList>
          <TabsTrigger value="models" className="gap-2">
            <Cpu className="h-4 w-4" />
            Modelos de IA
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-2">
            <Brain className="h-4 w-4" />
            Custos por Ação
          </TabsTrigger>
          <TabsTrigger value="usage" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Uso por Ação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Modelos de IA Disponíveis</CardTitle>
              <CardDescription>
                Configure energia cobrada e margem para cada modelo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Custo In/Out (USD/1M)</TableHead>
                    <TableHead className="text-right">Energia/1k Tokens</TableHead>
                    <TableHead className="text-right">Energia Fixa</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead>Recursos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models?.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{model.model_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{model.model_key}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={model.provider === "google" ? "default" : "secondary"}>
                          {model.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${model.input_cost_per_million_tokens} / ${model.output_cost_per_million_tokens}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{model.energy_per_1000_tokens}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {model.energy_per_call > 0 ? (
                          <Badge variant="secondary">{model.energy_per_call}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-green-600 font-medium">{model.margin_multiplier}x</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {model.supports_vision && (
                            <span title="Vision"><Image className="h-4 w-4 text-blue-500" /></span>
                          )}
                          {model.supports_audio && (
                            <span title="Audio"><Mic className="h-4 w-4 text-purple-500" /></span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={model.is_active ? "default" : "secondary"}>
                          {model.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingModel(model)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Modelo: {model.model_name}</DialogTitle>
                            </DialogHeader>
                            {editingModel?.id === model.id && (
                              <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Energia por 1k Tokens</Label>
                                    <Input
                                      type="number"
                                      value={editingModel.energy_per_1000_tokens}
                                      onChange={(e) => setEditingModel({
                                        ...editingModel,
                                        energy_per_1000_tokens: parseInt(e.target.value) || 0
                                      })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Energia Fixa por Chamada</Label>
                                    <Input
                                      type="number"
                                      value={editingModel.energy_per_call}
                                      onChange={(e) => setEditingModel({
                                        ...editingModel,
                                        energy_per_call: parseInt(e.target.value) || 0
                                      })}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Multiplicador de Margem</Label>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    value={editingModel.margin_multiplier}
                                    onChange={(e) => setEditingModel({
                                      ...editingModel,
                                      margin_multiplier: parseFloat(e.target.value) || 5
                                    })}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    5 = 500% de margem sobre custo real
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={editingModel.is_active}
                                    onCheckedChange={(checked) => setEditingModel({
                                      ...editingModel,
                                      is_active: checked
                                    })}
                                  />
                                  <Label>Modelo Ativo</Label>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button
                                onClick={() => editingModel && updateModelMutation.mutate(editingModel)}
                                disabled={updateModelMutation.isPending}
                              >
                                {updateModelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                <Save className="h-4 w-4 mr-2" />
                                Salvar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Custos por Tipo de Ação</CardTitle>
              <CardDescription>
                Energia fixa cobrada para cada tipo de operação de IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Modelo Padrão</TableHead>
                    <TableHead className="text-right">Energia Base</TableHead>
                    <TableHead className="text-right">Custo Real (USD)</TableHead>
                    <TableHead className="text-right">Custo/10k Energia</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions?.map((action) => {
                    const costPer10k = calculateRealCostFor10kEnergy(
                      action.base_energy_cost,
                      action.estimated_real_cost_usd
                    );
                    return (
                      <TableRow key={action.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {action.action_key.includes("audio") && <Mic className="h-4 w-4 text-purple-500" />}
                            {action.action_key.includes("image") && <Image className="h-4 w-4 text-blue-500" />}
                            {action.action_key.includes("document") && <FileText className="h-4 w-4 text-orange-500" />}
                            {action.action_key.includes("text") && <Brain className="h-4 w-4 text-green-500" />}
                            <span className="font-medium">{action.action_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {action.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {action.default_model_key?.split("/")[1] || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-lg">
                            {action.base_energy_cost}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          ${action.estimated_real_cost_usd.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${costPer10k.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={action.is_fixed_cost ? "default" : "outline"}>
                            {action.is_fixed_cost ? "Fixo" : "Variável"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingAction(action)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar: {action.action_name}</DialogTitle>
                              </DialogHeader>
                              {editingAction?.id === action.id && (
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label>Energia Base por Chamada</Label>
                                    <Input
                                      type="number"
                                      value={editingAction.base_energy_cost}
                                      onChange={(e) => setEditingAction({
                                        ...editingAction,
                                        base_energy_cost: parseInt(e.target.value) || 0
                                      })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Custo real: ${action.estimated_real_cost_usd.toFixed(4)} USD
                                    </p>
                                  </div>
                                  
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm font-medium">Simulação de Margem:</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Se 10k energia = R$50 (~$10), e esta ação custa{" "}
                                      <strong>{editingAction.base_energy_cost}</strong> energia:
                                    </p>
                                    <p className="text-sm mt-1">
                                      • Você recebe: R${((editingAction.base_energy_cost / 10000) * 50).toFixed(2)}
                                    </p>
                                    <p className="text-sm">
                                      • Custo real: R${(action.estimated_real_cost_usd * 5).toFixed(2)}
                                    </p>
                                    <p className={`text-sm font-bold ${((editingAction.base_energy_cost / 10000) * 50) > (action.estimated_real_cost_usd * 5 * 5) ? "text-green-600" : "text-red-600"}`}>
                                      • Margem: {(((editingAction.base_energy_cost / 10000) * 50) / (action.estimated_real_cost_usd * 5) * 100).toFixed(0)}%
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={editingAction.is_active}
                                      onCheckedChange={(checked) => setEditingAction({
                                        ...editingAction,
                                        is_active: checked
                                      })}
                                    />
                                    <Label>Ação Ativa</Label>
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button
                                  onClick={() => editingAction && updateActionMutation.mutate(editingAction)}
                                  disabled={updateActionMutation.isPending}
                                >
                                  {updateActionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                  <Save className="h-4 w-4 mr-2" />
                                  Salvar
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Uso por Tipo de Ação (30 dias)</CardTitle>
              <CardDescription>
                Consumo de energia e custo real por tipo de operação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Ação</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Energia Total</TableHead>
                    <TableHead className="text-right">Custo Real (USD)</TableHead>
                    <TableHead className="text-right">Receita Estimada</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageStats && Object.entries(usageStats)
                    .sort(([, a], [, b]) => b.totalEnergy - a.totalEnergy)
                    .map(([actionType, stats]) => {
                      const revenue = (stats.totalEnergy / 10000) * 10; // $10 per 10k
                      const margin = revenue > 0 ? ((revenue - stats.totalRealCost) / revenue * 100) : 0;
                      const actionInfo = actions?.find(a => a.action_key === actionType);
                      
                      return (
                        <TableRow key={actionType}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {actionInfo?.action_name || actionType}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {actionType}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {stats.count.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {stats.totalEnergy.toLocaleString("pt-BR")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            ${stats.totalRealCost.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            ${revenue.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {stats.totalRealCost > 0 ? (
                              <Badge variant={margin >= 80 ? "default" : margin >= 50 ? "secondary" : "destructive"}>
                                {margin.toFixed(0)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
              
              {(!usageStats || Object.keys(usageStats).length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum uso de IA registrado nos últimos 30 dias</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
