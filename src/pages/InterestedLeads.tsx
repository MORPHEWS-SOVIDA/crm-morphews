import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, ShoppingCart, CheckCircle, Loader2 } from "lucide-react";

interface InterestedLead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  plan_name: string | null;
  status: string;
  created_at: string;
  converted_at: string | null;
}

export default function InterestedLeads() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["interested-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interested_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InterestedLead[];
    },
  });

  const stats = {
    total: leads?.length || 0,
    interested: leads?.filter((l) => l.status === "interested").length || 0,
    checkoutStarted: leads?.filter((l) => l.status === "checkout_started").length || 0,
    converted: leads?.filter((l) => l.status === "converted").length || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "interested":
        return <Badge variant="secondary">Interessado</Badge>;
      case "checkout_started":
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Checkout Iniciado</Badge>;
      case "converted":
        return <Badge className="bg-green-500">Convertido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Leads Interessados</h1>
          <p className="text-muted-foreground">
            Pessoas que demonstraram interesse em contratar o sistema
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {stats.total}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Interessados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                {stats.interested}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Carrinho Abandonado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
                {stats.checkoutStarted}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Convertidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                {stats.converted}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Interessados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : leads?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum lead interessado ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads?.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <WhatsAppButton phone={lead.whatsapp} variant="icon" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.plan_name || "-"}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
