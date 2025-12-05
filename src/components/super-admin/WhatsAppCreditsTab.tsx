import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Plus, Minus, Building2, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Organization {
  id: string;
  name: string;
  owner_email: string | null;
}

interface WhatsAppCredit {
  id: string;
  organization_id: string;
  free_instances_count: number;
  created_at: string;
  updated_at: string;
}

interface WhatsAppInstance {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  payment_source: string;
  is_connected: boolean;
  phone_number: string | null;
}

export function WhatsAppCreditsTab() {
  const queryClient = useQueryClient();
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [creditsToAdd, setCreditsToAdd] = useState(1);

  // Fetch organizations
  const { data: organizations = [], isLoading: loadingOrgs, isError: orgError } = useQuery({
    queryKey: ["super-admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, owner_email")
        .order("name");
      if (error) {
        console.error("Error fetching organizations:", error);
        throw error;
      }
      return (data || []) as Organization[];
    },
  });

  // Fetch all credits
  const { data: credits = [], isLoading: loadingCredits, isError: creditsError } = useQuery({
    queryKey: ["super-admin-whatsapp-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_whatsapp_credits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching credits:", error);
        throw error;
      }
      return (data || []) as WhatsAppCredit[];
    },
  });

  // Fetch all instances
  const { data: instances = [], isLoading: loadingInstances, isError: instancesError } = useQuery({
    queryKey: ["super-admin-whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching instances:", error);
        throw error;
      }
      return (data || []) as WhatsAppInstance[];
    },
  });

  // Handle errors
  if (orgError || creditsError || instancesError) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <p className="text-destructive mb-2">Erro ao carregar dados</p>
        <p className="text-muted-foreground text-sm mb-4">
          Verifique se você tem permissão de master admin.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  // Loading state
  const isLoading = loadingOrgs || loadingCredits || loadingInstances;
  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p>Carregando dados...</p>
      </div>
    );
  }

  // Add credits mutation
  const addCreditsMutation = useMutation({
    mutationFn: async ({ orgId, count }: { orgId: string; count: number }) => {
      // Check if credits record exists
      const existingCredit = credits?.find((c) => c.organization_id === orgId);

      if (existingCredit) {
        const { error } = await supabase
          .from("organization_whatsapp_credits")
          .update({
            free_instances_count: existingCredit.free_instances_count + count,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_whatsapp_credits")
          .insert({
            organization_id: orgId,
            free_instances_count: count,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Créditos adicionados com sucesso!" });
      setShowAddCredits(false);
      setSelectedOrgId("");
      setCreditsToAdd(1);
      queryClient.invalidateQueries({ queryKey: ["super-admin-whatsapp-credits"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar créditos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove credit mutation
  const removeCreditMutation = useMutation({
    mutationFn: async ({ orgId, currentCount }: { orgId: string; currentCount: number }) => {
      if (currentCount <= 0) throw new Error("Sem créditos para remover");

      const { error } = await supabase
        .from("organization_whatsapp_credits")
        .update({
          free_instances_count: Math.max(0, currentCount - 1),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Crédito removido!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-whatsapp-credits"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover crédito",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getOrgName = (orgId: string) => {
    return organizations.find((o) => o.id === orgId)?.name || "Organização";
  };

  const getOrgInstances = (orgId: string) => {
    return instances.filter((i) => i.organization_id === orgId);
  };

  const getUsedCredits = (orgId: string) => {
    return instances.filter(
      (i) => i.organization_id === orgId && i.payment_source === "admin_grant"
    ).length;
  };

  // Stats
  const totalCreditsGiven = credits.reduce((sum, c) => sum + c.free_instances_count, 0);
  const totalFreeInstances = instances.filter((i) => i.payment_source === "admin_grant").length;
  const totalPaidInstances = instances.filter((i) => i.payment_source === "stripe").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Créditos Liberados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalCreditsGiven}</div>
            <p className="text-xs text-muted-foreground">instâncias gratuitas no total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Instâncias Cortesia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalFreeInstances}</div>
            <p className="text-xs text-muted-foreground">ativas via créditos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Instâncias Pagas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalPaidInstances}</div>
            <p className="text-xs text-muted-foreground">via Stripe</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Credits */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Créditos por Organização</h3>
        <Dialog open={showAddCredits} onOpenChange={setShowAddCredits}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Gift className="h-4 w-4" />
              Liberar Créditos
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Liberar Instâncias Gratuitas</DialogTitle>
              <DialogDescription>
                Adicione créditos para uma organização usar instâncias sem pagar
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Organização</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma organização" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.owner_email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade de Instâncias</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCreditsToAdd(Math.max(1, creditsToAdd - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={creditsToAdd}
                    onChange={(e) => setCreditsToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCreditsToAdd(creditsToAdd + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAddCredits(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => addCreditsMutation.mutate({ orgId: selectedOrgId, count: creditsToAdd })}
                disabled={!selectedOrgId || addCreditsMutation.isPending}
              >
                {addCreditsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Liberar {creditsToAdd} Instância(s)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credits Table */}
      {credits.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Gift className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum crédito liberado ainda</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead className="text-center">Créditos Liberados</TableHead>
                <TableHead className="text-center">Usados</TableHead>
                <TableHead className="text-center">Disponíveis</TableHead>
                <TableHead className="text-center">Instâncias</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credits.map((credit) => {
                const orgInstances = getOrgInstances(credit.organization_id);
                const usedCredits = getUsedCredits(credit.organization_id);
                const available = credit.free_instances_count - usedCredits;

                return (
                  <TableRow key={credit.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {getOrgName(credit.organization_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {credit.free_instances_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{usedCredits}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={available > 0 ? "bg-blue-500" : "bg-gray-400"}>
                        {available}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MessageSquare className="h-4 w-4 text-green-500" />
                        <span>{orgInstances.length}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(credit.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            addCreditsMutation.mutate({
                              orgId: credit.organization_id,
                              count: 1,
                            })
                          }
                        >
                          <Plus className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            removeCreditMutation.mutate({
                              orgId: credit.organization_id,
                              currentCount: credit.free_instances_count,
                            })
                          }
                          disabled={credit.free_instances_count <= 0}
                        >
                          <Minus className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
