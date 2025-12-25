import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Search } from "lucide-react";
import { useToggleOrganizationProvider, useAllOrganizationProviders, PROVIDER_PRICES, type WhatsAppProvider } from "@/hooks/useWhatsAppProviders";

interface Organization {
  id: string;
  name: string;
  owner_name: string | null;
  owner_email: string | null;
}

export function WhatsAppProvidersTab() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["super-admin-organizations-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, owner_name, owner_email")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Organization[];
    },
  });

  const toggleProvider = useToggleOrganizationProvider();

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const filteredOrgs = organizations?.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.owner_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Gerenciar WhatsApp por Organização
        </CardTitle>
        <CardDescription>
          Habilite ou desabilite o WhatsApp disponível para cada organização.
          <br />
          <span className="font-medium">API WhatsApp:</span> {formatPrice(PROVIDER_PRICES.wasenderapi)}/mês
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {orgsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOrgs?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma organização encontrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Globe className="h-4 w-4" />
                    API WhatsApp
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs?.map((org) => (
                <OrganizationProviderRow 
                  key={org.id} 
                  organization={org}
                  onToggle={toggleProvider.mutate}
                  isToggling={toggleProvider.isPending}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OrganizationProviderRow({ 
  organization, 
  onToggle,
  isToggling,
}: { 
  organization: Organization;
  onToggle: (params: { organizationId: string; provider: WhatsAppProvider; isEnabled: boolean }) => void;
  isToggling: boolean;
}) {
  const { data: providers, isLoading } = useAllOrganizationProviders(organization.id);

  const isProviderEnabled = () => {
    return providers?.find(p => p.provider === "wasenderapi")?.is_enabled ?? false;
  };

  const handleToggle = (enabled: boolean) => {
    onToggle({
      organizationId: organization.id,
      provider: "wasenderapi",
      isEnabled: enabled,
    });
  };

  return (
    <TableRow>
      <TableCell>
        <div>
          <span className="font-medium">{organization.name}</span>
          {organization.owner_email && (
            <span className="text-sm text-muted-foreground block">{organization.owner_email}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Switch
              checked={isProviderEnabled()}
              onCheckedChange={(checked) => handleToggle(checked)}
              disabled={isToggling}
            />
            {isProviderEnabled() && (
              <Badge variant="secondary" className="text-xs">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(PROVIDER_PRICES.wasenderapi / 100)}
              </Badge>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
