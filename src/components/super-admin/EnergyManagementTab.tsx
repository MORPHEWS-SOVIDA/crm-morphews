import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Zap, Plus, RefreshCw, TrendingUp, Battery, Gift } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationEnergy {
  id: string;
  organization_id: string;
  included_energy: number;
  bonus_energy: number;
  used_energy: number;
  reset_at: string;
}

interface EnergyUsageLog {
  id: string;
  organization_id: string;
  action_type: string;
  energy_consumed: number;
  created_at: string;
  bot_id: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_energy: number;
}

export function EnergyManagementTab() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [bonusAmount, setBonusAmount] = useState("100");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  // Fetch organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["super-admin-orgs-energy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Organization[];
    },
  });

  // Fetch all organization energy
  const { data: energyData, isLoading: energyLoading } = useQuery({
    queryKey: ["super-admin-energy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_energy")
        .select("*");
      if (error) throw error;
      return data as OrganizationEnergy[];
    },
  });

  // Fetch usage logs for selected month
  const { data: usageLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["super-admin-usage-logs", filterMonth],
    queryFn: async () => {
      const startDate = `${filterMonth}-01`;
      const endDate = new Date(filterMonth + "-01");
      endDate.setMonth(endDate.getMonth() + 1);
      
      const { data, error } = await supabase
        .from("energy_usage_log")
        .select("*")
        .gte("created_at", startDate)
        .lt("created_at", endDate.toISOString().split("T")[0])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EnergyUsageLog[];
    },
  });

  // Fetch plans for energy reference
  const { data: plans } = useQuery({
    queryKey: ["super-admin-plans-energy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, monthly_energy")
        .order("monthly_energy");
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Add bonus energy mutation
  const addBonusMutation = useMutation({
    mutationFn: async ({ orgId, amount }: { orgId: string; amount: number }) => {
      const { error } = await supabase.rpc("add_bonus_energy", {
        org_id: orgId,
        amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-energy"] });
      toast({ title: "Energia bônus adicionada!" });
      setShowAddDialog(false);
      setSelectedOrgId("");
      setBonusAmount("100");
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Reset energy mutation
  const resetEnergyMutation = useMutation({
    mutationFn: async (orgId: string) => {
      // Get org's plan energy
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(monthly_energy)")
        .eq("organization_id", orgId)
        .single();
      
      const planEnergy = (sub?.subscription_plans as any)?.monthly_energy || 1000;
      
      const { error } = await supabase.rpc("initialize_organization_energy", {
        org_id: orgId,
        plan_energy: planEnergy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-energy"] });
      toast({ title: "Energia resetada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const getOrgName = (orgId: string) => {
    return organizations?.find(o => o.id === orgId)?.name || "Desconhecida";
  };

  const getEnergyForOrg = (orgId: string) => {
    return energyData?.find(e => e.organization_id === orgId);
  };

  const getUsageByOrg = () => {
    const usage: Record<string, number> = {};
    usageLogs?.forEach(log => {
      usage[log.organization_id] = (usage[log.organization_id] || 0) + log.energy_consumed;
    });
    return usage;
  };

  // Stats
  const totalIncluded = energyData?.reduce((sum, e) => sum + e.included_energy, 0) || 0;
  const totalBonus = energyData?.reduce((sum, e) => sum + e.bonus_energy, 0) || 0;
  const totalUsed = energyData?.reduce((sum, e) => sum + e.used_energy, 0) || 0;
  const usageByOrg = getUsageByOrg();
  const monthUsage = Object.values(usageByOrg).reduce((sum, v) => sum + v, 0);

  if (orgsLoading || energyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Incluída</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalIncluded.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">Energia dos planos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Bônus</CardTitle>
            <Gift className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{totalBonus.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">Energia extra concedida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Consumida</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalUsed.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">Período atual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Uso em {format(new Date(filterMonth + "-01"), "MMM/yyyy", { locale: ptBR })}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{monthUsage.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">{usageLogs?.length || 0} ações</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans Energy Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Energia por Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {plans?.map(plan => (
              <div key={plan.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Badge variant="outline">{plan.name}</Badge>
                <span className="font-bold">{plan.monthly_energy?.toLocaleString("pt-BR") || 0}</span>
                <span className="text-sm text-muted-foreground">energia/mês</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Energia por Organização</CardTitle>
          <div className="flex gap-2">
            <Input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-40"
            />
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Bônus
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Energia Bônus</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Organização</Label>
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations?.map(org => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade de Energia</Label>
                    <Input
                      type="number"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      min="1"
                    />
                  </div>
                  <Button
                    onClick={() => addBonusMutation.mutate({ 
                      orgId: selectedOrgId, 
                      amount: parseInt(bonusAmount) 
                    })}
                    disabled={!selectedOrgId || !bonusAmount || addBonusMutation.isPending}
                    className="w-full"
                  >
                    {addBonusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead className="text-right">Incluída</TableHead>
                <TableHead className="text-right">Bônus</TableHead>
                <TableHead className="text-right">Usada</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Renova em</TableHead>
                <TableHead className="text-right">Uso Mês</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map(org => {
                const energy = getEnergyForOrg(org.id);
                const total = (energy?.included_energy || 0) + (energy?.bonus_energy || 0);
                const available = total - (energy?.used_energy || 0);
                const usedPercent = total > 0 ? ((energy?.used_energy || 0) / total) * 100 : 0;
                const monthOrgUsage = usageByOrg[org.id] || 0;

                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-right">
                      {(energy?.included_energy || 0).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {energy?.bonus_energy ? (
                        <Badge variant="secondary" className="text-yellow-600">
                          +{energy.bonus_energy.toLocaleString("pt-BR")}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {(energy?.used_energy || 0).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span className={available < total * 0.2 ? "text-red-500" : "text-green-600"}>
                        {available.toLocaleString("pt-BR")}
                      </span>
                    </TableCell>
                    <TableCell className="w-32">
                      <Progress 
                        value={100 - usedPercent} 
                        className="h-2"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {energy?.reset_at ? format(new Date(energy.reset_at), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{monthOrgUsage.toLocaleString("pt-BR")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedOrgId(org.id);
                            setShowAddDialog(true);
                          }}
                          title="Adicionar bônus"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => resetEnergyMutation.mutate(org.id)}
                          disabled={resetEnergyMutation.isPending}
                          title="Resetar energia"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Usage Logs */}
      {logsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : usageLogs && usageLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas Ações ({format(new Date(filterMonth + "-01"), "MMMM yyyy", { locale: ptBR })})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Energia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageLogs.slice(0, 50).map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getOrgName(log.organization_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action_type}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      -{log.energy_consumed}
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
