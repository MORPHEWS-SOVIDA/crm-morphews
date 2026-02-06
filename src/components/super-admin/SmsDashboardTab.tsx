import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Package, TrendingUp, Settings, DollarSign, Loader2, Plus, Pencil, Trash2, Building2, Copy } from "lucide-react";

interface SmsPackage {
  id: string;
  name: string;
  sms_count: number;
  price_cents: number;
  price_per_sms_cents: number;
  is_active: boolean;
  created_at: string;
}

export function SmsDashboardTab() {
  const queryClient = useQueryClient();
  const [editingPackage, setEditingPackage] = useState<SmsPackage | null>(null);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [packageForm, setPackageForm] = useState({
    name: "",
    sms_count: 100,
    price_cents: 1500,
  });
  
  // State for adjusting balance
  const [adjustBalanceOrg, setAdjustBalanceOrg] = useState<{ id: string; name: string; current: number } | null>(null);
  const [adjustBalanceValue, setAdjustBalanceValue] = useState(0);

  // Fetch SMS packages
  const { data: packages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ["sms-packages-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_packages")
        .select("*")
        .order("sms_count", { ascending: true });
      if (error) throw error;
      return data as SmsPackage[];
    },
  });

  // Fetch ALL organizations with their SMS balances
  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ["sms-balances-admin"],
    queryFn: async () => {
      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      
      if (orgsError) throw orgsError;
      
      // Fetch all balances
      const { data: balanceData, error: balanceError } = await supabase
        .from("sms_credits_balance")
        .select("organization_id, current_credits, total_purchased, total_used");
      
      if (balanceError) throw balanceError;
      
      // Create a map of balances
      const balanceMap = new Map(
        (balanceData || []).map((b: any) => [b.organization_id, b])
      );
      
      // Combine orgs with balances (show ALL orgs)
      return (orgs || []).map((org: any) => {
        const balance = balanceMap.get(org.id);
        return {
          organization_id: org.id,
          organization_name: org.name,
          current_credits: balance?.current_credits || 0,
          total_purchased: balance?.total_purchased || 0,
          total_used: balance?.total_used || 0,
        };
      }).sort((a: any, b: any) => b.current_credits - a.current_credits);
    },
  });

  // Fetch SMS purchases
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["sms-sales-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_credits_purchases")
        .select(`
          id,
          organization_id,
          package_id,
          credits_amount,
          price_cents,
          payment_method,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Fetch org and package names
      const orgIds = [...new Set((data || []).map((s: any) => s.organization_id))];
      const pkgIds = [...new Set((data || []).map((s: any) => s.package_id).filter(Boolean))];
      
      const [orgsRes, pkgsRes] = await Promise.all([
        supabase.from("organizations").select("id, name").in("id", orgIds),
        pkgIds.length > 0 ? supabase.from("sms_packages").select("id, name").in("id", pkgIds) : { data: [] },
      ]);
      
      const orgMap = new Map((orgsRes.data || []).map((o: any) => [o.id, o.name]));
      const pkgMap = new Map((pkgsRes.data || []).map((p: any) => [p.id, p.name]));
      
      return (data || []).map((s: any) => ({
        id: s.id,
        organization_id: s.organization_id,
        organization_name: orgMap.get(s.organization_id) || "Desconhecido",
        package_name: pkgMap.get(s.package_id) || "Manual",
        credits_amount: s.credits_amount,
        price_cents: s.price_cents,
        payment_method: s.payment_method,
        created_at: s.created_at,
      }));
    },
  });

  // Calculate totals
  const totalRevenue = sales.reduce((sum, s) => sum + (s.price_cents || 0), 0);
  const totalSmsSold = sales.reduce((sum, s) => sum + (s.credits_amount || 0), 0);
  const activeBalances = balances.filter((b: any) => b.current_credits > 0);

  // Mutations
  const createPackage = useMutation({
    mutationFn: async (pkg: typeof packageForm) => {
      const pricePerSms = pkg.price_cents / pkg.sms_count;
      const { error } = await supabase.from("sms_packages").insert({
        name: pkg.name,
        sms_count: pkg.sms_count,
        price_cents: pkg.price_cents,
        price_per_sms_cents: pricePerSms,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pacote criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["sms-packages-admin"] });
      setShowPackageDialog(false);
      setPackageForm({ name: "", sms_count: 100, price_cents: 1500 });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar pacote", description: err.message, variant: "destructive" });
    },
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, ...pkg }: { id: string } & typeof packageForm) => {
      const pricePerSms = pkg.price_cents / pkg.sms_count;
      const { error } = await supabase.from("sms_packages").update({
        name: pkg.name,
        sms_count: pkg.sms_count,
        price_cents: pkg.price_cents,
        price_per_sms_cents: pricePerSms,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pacote atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["sms-packages-admin"] });
      setEditingPackage(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar pacote", description: err.message, variant: "destructive" });
    },
  });

  const togglePackageActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("sms_packages").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-packages-admin"] });
    },
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sms_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pacote excluído!" });
      queryClient.invalidateQueries({ queryKey: ["sms-packages-admin"] });
    },
  });

  // Mutation for adjusting balance
  const adjustBalance = useMutation({
    mutationFn: async ({ orgId, newBalance }: { orgId: string; newBalance: number }) => {
      // First check if balance record exists
      const { data: existing } = await supabase
        .from("sms_credits_balance")
        .select("id, current_credits, total_purchased")
        .eq("organization_id", orgId)
        .single();

      if (existing) {
        // Update existing balance - calculate the difference to add to total_purchased if increasing
        const difference = newBalance - existing.current_credits;
        const newTotalPurchased = difference > 0 
          ? existing.total_purchased + difference 
          : existing.total_purchased;
        
        const { error } = await supabase
          .from("sms_credits_balance")
          .update({ 
            current_credits: newBalance,
            total_purchased: newTotalPurchased,
            updated_at: new Date().toISOString()
          })
          .eq("organization_id", orgId);
        if (error) throw error;
      } else {
        // Create new balance record
        const { error } = await supabase
          .from("sms_credits_balance")
          .insert({
            organization_id: orgId,
            current_credits: newBalance,
            total_purchased: newBalance,
            total_used: 0,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Saldo atualizado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["sms-balances-admin"] });
      setAdjustBalanceOrg(null);
      setAdjustBalanceValue(0);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao ajustar saldo", description: err.message, variant: "destructive" });
    },
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Total SMS</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/20 rounded-lg">
                <MessageSquare className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Créditos Vendidos</p>
                <p className="text-2xl font-bold text-foreground">{totalSmsSold.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/20 rounded-lg">
                <Building2 className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Orgs com Saldo</p>
                <p className="text-2xl font-bold text-foreground">{activeBalances.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pacotes Ativos</p>
                <p className="text-2xl font-bold text-foreground">{packages.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="vendas" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Vendas
          </TabsTrigger>
          <TabsTrigger value="saldos" className="gap-2">
            <Building2 className="h-4 w-4" /> Saldos por Org
          </TabsTrigger>
          <TabsTrigger value="pacotes" className="gap-2">
            <Package className="h-4 w-4" /> Pacotes
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" /> Config. FacilitaMóvel
          </TabsTrigger>
        </TabsList>

        {/* Vendas Tab */}
        <TabsContent value="vendas">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Compras de Créditos SMS</CardTitle>
              <CardDescription>Todas as compras realizadas pelos clientes</CardDescription>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : sales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma venda de SMS registrada ainda.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Organização</TableHead>
                      <TableHead>Pacote</TableHead>
                      <TableHead className="text-right">Créditos</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">{sale.organization_name}</TableCell>
                        <TableCell>{sale.package_name}</TableCell>
                        <TableCell className="text-right">{sale.credits_amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(sale.price_cents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saldos Tab */}
        <TabsContent value="saldos">
          <Card>
            <CardHeader>
              <CardTitle>Saldo de Créditos por Organização</CardTitle>
              <CardDescription>Todas as organizações e seus créditos disponíveis para envio de SMS</CardDescription>
            </CardHeader>
            <CardContent>
              {balancesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : balances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma organização cadastrada.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organização</TableHead>
                      <TableHead className="text-right">Saldo Atual</TableHead>
                      <TableHead className="text-right">Total Comprado</TableHead>
                      <TableHead className="text-right">Total Usado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((balance: any) => (
                      <TableRow key={balance.organization_id}>
                        <TableCell className="font-medium">{balance.organization_name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={balance.current_credits > 0 ? "default" : "secondary"}>
                            {balance.current_credits?.toLocaleString()} créditos
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{balance.total_purchased?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{balance.total_used?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setAdjustBalanceOrg({
                                id: balance.organization_id,
                                name: balance.organization_name,
                                current: balance.current_credits,
                              });
                              setAdjustBalanceValue(balance.current_credits);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            Ajustar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Dialog for adjusting balance */}
          <Dialog open={!!adjustBalanceOrg} onOpenChange={(open) => !open && setAdjustBalanceOrg(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajustar Saldo de SMS</DialogTitle>
                <DialogDescription>
                  Defina o novo saldo de créditos para {adjustBalanceOrg?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Organização</Label>
                  <Input value={adjustBalanceOrg?.name || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Saldo Atual</Label>
                  <Input value={adjustBalanceOrg?.current?.toLocaleString() || "0"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Novo Saldo (créditos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={adjustBalanceValue}
                    onChange={(e) => setAdjustBalanceValue(parseInt(e.target.value) || 0)}
                    placeholder="Ex: 500"
                  />
                </div>
                {adjustBalanceValue !== adjustBalanceOrg?.current && (
                  <p className="text-sm text-muted-foreground">
                    Diferença: {adjustBalanceValue - (adjustBalanceOrg?.current || 0) > 0 ? "+" : ""}
                    {(adjustBalanceValue - (adjustBalanceOrg?.current || 0)).toLocaleString()} créditos
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdjustBalanceOrg(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (adjustBalanceOrg) {
                      adjustBalance.mutate({ orgId: adjustBalanceOrg.id, newBalance: adjustBalanceValue });
                    }
                  }}
                  disabled={adjustBalance.isPending}
                >
                  {adjustBalance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Pacotes Tab */}
        <TabsContent value="pacotes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pacotes de SMS</CardTitle>
                <CardDescription>Gerencie os pacotes disponíveis para compra</CardDescription>
              </div>
              <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Novo Pacote
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Pacote SMS</DialogTitle>
                    <DialogDescription>Crie um novo pacote de créditos SMS</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome do Pacote</Label>
                      <Input
                        value={packageForm.name}
                        onChange={(e) => setPackageForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: Pacote Básico"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de Créditos</Label>
                      <Input
                        type="number"
                        value={packageForm.sms_count}
                        onChange={(e) => setPackageForm(f => ({ ...f, sms_count: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(packageForm.price_cents / 100).toFixed(2)}
                        onChange={(e) => setPackageForm(f => ({ ...f, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 }))}
                      />
                    </div>
                    {packageForm.sms_count > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Preço por crédito: {formatCurrency(packageForm.price_cents / packageForm.sms_count)}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPackageDialog(false)}>Cancelar</Button>
                    <Button onClick={() => createPackage.mutate(packageForm)} disabled={createPackage.isPending}>
                      {createPackage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar Pacote
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {packagesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Créditos</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Preço/Crédito</TableHead>
                      <TableHead className="text-center">Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.map((pkg) => (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-medium">{pkg.name}</TableCell>
                        <TableCell className="text-right">{pkg.sms_count.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(pkg.price_cents)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(pkg.price_per_sms_cents)}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={pkg.is_active}
                            onCheckedChange={(checked) => togglePackageActive.mutate({ id: pkg.id, is_active: checked })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingPackage(pkg);
                                setPackageForm({
                                  name: pkg.name,
                                  sms_count: pkg.sms_count,
                                  price_cents: pkg.price_cents,
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Excluir este pacote?")) {
                                  deletePackage.mutate(pkg.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config">
          <FacilitaMovelConfig />
        </TabsContent>
      </Tabs>

      {/* Edit Package Dialog */}
      <Dialog open={!!editingPackage} onOpenChange={(open) => !open && setEditingPackage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pacote SMS</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Pacote</Label>
              <Input
                value={packageForm.name}
                onChange={(e) => setPackageForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de Créditos</Label>
              <Input
                type="number"
                value={packageForm.sms_count}
                onChange={(e) => setPackageForm(f => ({ ...f, sms_count: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={(packageForm.price_cents / 100).toFixed(2)}
                onChange={(e) => setPackageForm(f => ({ ...f, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPackage(null)}>Cancelar</Button>
            <Button
              onClick={() => editingPackage && updatePackage.mutate({ id: editingPackage.id, ...packageForm })}
              disabled={updatePackage.isPending}
            >
              {updatePackage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// FacilitaMóvel Configuration Component
function FacilitaMovelConfig() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    user: "",
    password: "",
    webhook_status_url: "",
    webhook_response_url: "",
  });

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["facilita-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["facilita_user", "facilita_password", "facilita_webhook_status", "facilita_webhook_response"]);
      
      if (error) throw error;
      
      const configMap: Record<string, string> = {};
      (data || []).forEach((item: any) => {
        configMap[item.setting_key] = item.setting_value || "";
      });
      
      return {
        user: configMap.facilita_user || "",
        password: configMap.facilita_password || "",
        webhook_status_url: configMap.facilita_webhook_status || "",
        webhook_response_url: configMap.facilita_webhook_response || "",
      };
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (existingConfig) {
      setConfig(existingConfig);
    }
  }, [existingConfig]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const settings = [
        { setting_key: "facilita_user", setting_value: config.user },
        { setting_key: "facilita_password", setting_value: config.password },
        { setting_key: "facilita_webhook_status", setting_value: config.webhook_status_url },
        { setting_key: "facilita_webhook_response", setting_value: config.webhook_response_url },
      ];

      for (const setting of settings) {
        const { error } = await supabase
          .from("platform_settings")
          .upsert({ setting_key: setting.setting_key, setting_value: setting.setting_value }, { onConflict: "setting_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Configuração salva com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["facilita-config"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuração FacilitaMóvel
        </CardTitle>
        <CardDescription>
          Configure as credenciais de acesso à API FacilitaMóvel para envio de SMS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Usuário API</Label>
            <Input
              value={config.user}
              onChange={(e) => setConfig(c => ({ ...c, user: e.target.value }))}
              placeholder="Usuário FacilitaMóvel"
            />
          </div>
          <div className="space-y-2">
            <Label>Senha API</Label>
            <Input
              type="password"
              value={config.password}
              onChange={(e) => setConfig(c => ({ ...c, password: e.target.value }))}
              placeholder="Senha FacilitaMóvel"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook de Status (DLR)</Label>
            <div className="flex gap-2">
              <Input
                value={`https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/facilita-sms-webhook?type=status&fone=#phone&idSMS=#smsId&statusEntregue=#status&chaveCliente=#externalkey&dataPostagem=#dataPostagem`}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/facilita-sms-webhook?type=status&fone=#phone&idSMS=#smsId&statusEntregue=#status&chaveCliente=#externalkey&dataPostagem=#dataPostagem`);
                  toast({ title: "URL copiada!" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure esta URL no painel FacilitaMóvel → Webhooks → URL de Status
            </p>
          </div>

          <div className="space-y-2">
            <Label>Webhook de Resposta (MO)</Label>
            <div className="flex gap-2">
              <Input
                value={`https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/facilita-sms-webhook?type=response&fone=#phone&datahora=#datahora&mensagem=#msg&smsId=#smsId&externalKey=#externalKey`}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/facilita-sms-webhook?type=response&fone=#phone&datahora=#datahora&mensagem=#msg&smsId=#smsId&externalKey=#externalKey`);
                  toast({ title: "URL copiada!" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure esta URL no painel FacilitaMóvel → Webhooks → URL de Respostas (MO)
            </p>
          </div>
        </div>

        <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} className="w-full">
          {saveConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
