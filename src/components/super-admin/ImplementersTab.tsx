import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { 
  Users, 
  Loader2, 
  Power, 
  PowerOff, 
  DollarSign, 
  Copy,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Implementer {
  id: string;
  user_id: string;
  organization_id: string;
  referral_code: string;
  is_active: boolean;
  total_clients: number;
  total_earnings_cents: number;
  created_at: string;
  updated_at: string;
  organization?: {
    name: string;
  } | null;
  profile?: {
    first_name: string;
    last_name: string;
    user_id: string;
  } | null;
}

interface ImplementerSale {
  id: string;
  implementer_id: string;
  client_organization_id: string;
  client_subscription_id: string | null;
  plan_id: string;
  implementation_fee_cents: number;
  first_payment_cents: number;
  status: string;
  created_at: string;
  cancelled_at: string | null;
  client_org?: {
    name: string;
    slug: string;
  } | null;
}

interface ImplementerCommission {
  id: string;
  implementer_id: string;
  implementer_sale_id: string;
  commission_type: string;
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  period_month: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export function ImplementersTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImplementer, setSelectedImplementer] = useState<Implementer | null>(null);

  // Fetch all implementers with their organization and profile
  const { data: implementers, isLoading } = useQuery({
    queryKey: ["super-admin-implementers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementers")
        .select(`
          *,
          organization:organizations!implementers_organization_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately to get implementer names
      const userIds = data?.map(i => i.user_id).filter(Boolean) || [];
      let profiles: Record<string, { first_name: string; last_name: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", userIds);
        
        if (profilesData) {
          profiles = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      return data?.map(i => ({
        ...i,
        profile: profiles[i.user_id] || null
      })) as Implementer[];
    },
  });

  // Fetch sales for selected implementer
  const { data: implementerSales } = useQuery({
    queryKey: ["implementer-sales", selectedImplementer?.id],
    queryFn: async () => {
      if (!selectedImplementer) return [];
      
      const { data, error } = await supabase
        .from("implementer_sales")
        .select("*")
        .eq("implementer_id", selectedImplementer.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch client organization names
      const orgIds = data?.map(s => s.client_organization_id).filter(Boolean) || [];
      let orgs: Record<string, { name: string; slug: string }> = {};
      
      if (orgIds.length > 0) {
        const { data: orgsData } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .in("id", orgIds);
        
        if (orgsData) {
          orgs = orgsData.reduce((acc, o) => {
            acc[o.id] = { name: o.name, slug: o.slug };
            return acc;
          }, {} as Record<string, { name: string; slug: string }>);
        }
      }

      return data?.map(s => ({
        ...s,
        client_org: orgs[s.client_organization_id] || null
      })) as ImplementerSale[];
    },
    enabled: !!selectedImplementer,
  });

  // Fetch commissions for selected implementer
  const { data: implementerCommissions } = useQuery({
    queryKey: ["implementer-commissions", selectedImplementer?.id],
    queryFn: async () => {
      if (!selectedImplementer) return [];
      
      const { data, error } = await supabase
        .from("implementer_commissions")
        .select("*")
        .eq("implementer_id", selectedImplementer.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ImplementerCommission[];
    },
    enabled: !!selectedImplementer,
  });

  // Toggle implementer status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      const { error } = await supabase
        .from("implementers")
        .update({ is_active: newStatus })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-implementers"] });
      toast({ title: "Status atualizado com sucesso" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao atualizar status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Mark commission as paid
  const markAsPaidMutation = useMutation({
    mutationFn: async (commissionId: string) => {
      const { error } = await supabase
        .from("implementer_commissions")
        .update({ 
          status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", commissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["implementer-commissions"] });
      toast({ title: "Comissão marcada como paga" });
    },
    onError: (error) => {
      toast({ 
        title: "Erro ao marcar como paga", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const getImplementerName = (imp: Implementer) => {
    if (imp.profile) {
      return `${imp.profile.first_name} ${imp.profile.last_name}`;
    }
    return imp.organization?.name || "Sem nome";
  };

  const filteredImplementers = implementers?.filter(imp => {
    const name = getImplementerName(imp).toLowerCase();
    const orgName = imp.organization?.name?.toLowerCase() || "";
    const code = imp.referral_code.toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return name.includes(search) || orgName.includes(search) || code.includes(search);
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive 
      ? <Badge variant="default">Ativo</Badge>
      : <Badge variant="secondary">Inativo</Badge>;
  };

  const getCommissionStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Pago</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCommissionTypeLabel = (type: string) => {
    switch (type) {
      case "implementation":
        return "Taxa de Implementação (88%)";
      case "first_month":
        return "1ª Mensalidade (40%)";
      case "recurring":
        return "Recorrente (10%)";
      default:
        return type;
    }
  };

  // Calculate totals
  const totalImplementers = implementers?.length || 0;
  const activeImplementers = implementers?.filter(i => i.is_active).length || 0;
  const totalEarnings = implementers?.reduce((sum, i) => sum + (i.total_earnings_cents || 0), 0) || 0;
  const totalClients = implementers?.reduce((sum, i) => sum + (i.total_clients || 0), 0) || 0;

  const pendingCommissions = implementerCommissions?.filter(c => c.status === "pending") || [];
  const pendingTotal = pendingCommissions.reduce((sum, c) => sum + c.net_amount_cents, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalImplementers}</p>
                <p className="text-sm text-muted-foreground">Implementadores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Power className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeImplementers}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalClients}</p>
                <p className="text-sm text-muted-foreground">Clientes Indicados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalEarnings)}</p>
                <p className="text-sm text-muted-foreground">Comissões Pagas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Implementers List */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Implementadores</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, organização ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredImplementers?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum implementador encontrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Implementador</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Clientes</TableHead>
                    <TableHead>Ganhos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredImplementers?.map((imp) => (
                    <TableRow 
                      key={imp.id}
                      className={cn(
                        "cursor-pointer",
                        selectedImplementer?.id === imp.id && "bg-muted"
                      )}
                      onClick={() => setSelectedImplementer(imp)}
                    >
                      <TableCell>
                        <div className="font-medium">{getImplementerName(imp)}</div>
                        <div className="text-xs text-muted-foreground">{imp.organization?.name}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{imp.referral_code}</code>
                      </TableCell>
                      <TableCell>{imp.total_clients || 0}</TableCell>
                      <TableCell>{formatCurrency(imp.total_earnings_cents || 0)}</TableCell>
                      <TableCell>{getStatusBadge(imp.is_active)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatusMutation.mutate({
                                id: imp.id,
                                newStatus: !imp.is_active
                              });
                            }}
                          >
                            {imp.is_active ? (
                              <PowerOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Power className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(imp.referral_code);
                              toast({ title: "Código copiado!" });
                            }}
                          >
                            <Copy className="h-4 w-4" />
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

        {/* Details Panel */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedImplementer ? getImplementerName(selectedImplementer) : "Detalhes"}
            </CardTitle>
            {selectedImplementer && (
              <CardDescription>
                Desde {format(new Date(selectedImplementer.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedImplementer ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um implementador para ver detalhes</p>
              </div>
            ) : (
              <Tabs defaultValue="clients" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="clients">Clientes</TabsTrigger>
                  <TabsTrigger value="commissions">Comissões</TabsTrigger>
                </TabsList>
                
                <TabsContent value="clients" className="space-y-4">
                  {implementerSales?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum cliente ainda
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {implementerSales?.map((sale) => (
                        <div 
                          key={sale.id} 
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{sale.client_org?.name || "Organização"}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatCurrency(sale.implementation_fee_cents)}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {sale.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="commissions" className="space-y-4">
                  {pendingCommissions.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium text-amber-800">
                        {pendingCommissions.length} comissões pendentes
                      </p>
                      <p className="text-lg font-bold text-amber-900">
                        {formatCurrency(pendingTotal)}
                      </p>
                    </div>
                  )}
                  
                  {implementerCommissions?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma comissão ainda
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {implementerCommissions?.map((commission) => (
                        <div 
                          key={commission.id} 
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {getCommissionTypeLabel(commission.commission_type)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-sm font-medium">
                              {formatCurrency(commission.net_amount_cents)}
                            </p>
                            <div className="flex items-center gap-2">
                              {getCommissionStatusBadge(commission.status)}
                              {commission.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => markAsPaidMutation.mutate(commission.id)}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
