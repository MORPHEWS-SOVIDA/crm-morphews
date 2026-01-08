import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  AVAILABLE_FEATURES, 
  FeatureKey, 
  useOrgFeatureOverrides,
  usePlanFeatures,
  useUpdateOrgFeatureOverride,
  useDeleteOrgFeatureOverride
} from "@/hooks/usePlanFeatures";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Subscription {
  plan_id: string;
  subscription_plans: {
    name: string;
  } | null;
}

export function OrgFeatureOverridesEditor() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  
  // Fetch all organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["super-admin-orgs-for-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .order("name");
      
      if (error) throw error;
      return data as Organization[];
    },
  });

  // Get selected org's subscription
  const { data: orgSubscription } = useQuery({
    queryKey: ["org-subscription-for-features", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(name)")
        .eq("organization_id", selectedOrgId)
        .eq("status", "active")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data as Subscription | null;
    },
    enabled: !!selectedOrgId,
  });

  const { data: planFeatures, isLoading: planFeaturesLoading } = usePlanFeatures(
    orgSubscription?.plan_id
  );
  const { data: overrides, isLoading: overridesLoading } = useOrgFeatureOverrides(selectedOrgId);
  const updateOverride = useUpdateOrgFeatureOverride();
  const deleteOverride = useDeleteOrgFeatureOverride();

  // Build a map of plan features
  const planFeaturesMap: Record<string, boolean> = {};
  planFeatures?.forEach((pf) => {
    planFeaturesMap[pf.feature_key] = pf.is_enabled;
  });

  // Build a map of overrides
  const overridesMap: Record<string, boolean> = {};
  overrides?.forEach((o) => {
    overridesMap[o.feature_key] = o.is_enabled;
  });

  const getFeatureStatus = (featureKey: string): { enabled: boolean; source: "plan" | "override" } => {
    if (overridesMap[featureKey] !== undefined) {
      return { enabled: overridesMap[featureKey], source: "override" };
    }
    // Default to true if not defined in plan
    return { enabled: planFeaturesMap[featureKey] ?? true, source: "plan" };
  };

  const handleToggleOverride = (featureKey: string) => {
    if (!selectedOrgId) return;
    
    const currentStatus = getFeatureStatus(featureKey);
    
    // If it's currently from plan, create an override with opposite value
    // If it's currently an override, toggle the override value
    updateOverride.mutate({
      organizationId: selectedOrgId,
      featureKey,
      isEnabled: !currentStatus.enabled,
    });
  };

  const handleRemoveOverride = (featureKey: string) => {
    if (!selectedOrgId) return;
    
    deleteOverride.mutate({
      organizationId: selectedOrgId,
      featureKey,
    });
  };

  // Group features by category
  const getFeaturesByGroup = () => {
    const groups: Record<string, { key: FeatureKey; label: string }[]> = {};
    
    Object.entries(AVAILABLE_FEATURES).forEach(([key, value]) => {
      if (!groups[value.group]) {
        groups[value.group] = [];
      }
      groups[value.group].push({ key: key as FeatureKey, label: value.label });
    });
    
    return groups;
  };

  const isLoading = orgsLoading || planFeaturesLoading || overridesLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Override de Features por Organização
        </CardTitle>
        <CardDescription>
          Libere ou bloqueie funcionalidades específicas para organizações individuais, 
          independente do plano contratado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Selector */}
        <div className="space-y-2">
          <Label>Selecione a Organização</Label>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Escolha uma organização" />
            </SelectTrigger>
            <SelectContent>
              {organizations?.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                  <span className="text-muted-foreground ml-2">({org.slug})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Org Info */}
        {selectedOrgId && orgSubscription && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Plano atual:</span>
            <Badge variant="outline">
              {orgSubscription.subscription_plans?.name || "Sem plano"}
            </Badge>
          </div>
        )}

        {/* Features List */}
        {selectedOrgId && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(getFeaturesByGroup()).map(([groupName, features]) => (
                  <div key={groupName} className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {groupName}
                    </h4>
                    <div className="grid md:grid-cols-2 gap-3">
                      {features.map(({ key, label }) => {
                        const status = getFeatureStatus(key);
                        const hasOverride = overridesMap[key] !== undefined;
                        
                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              hasOverride 
                                ? status.enabled 
                                  ? "border-green-500/50 bg-green-500/5" 
                                  : "border-red-500/50 bg-red-500/5"
                                : "bg-card"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {hasOverride && (
                                status.enabled ? (
                                  <ShieldCheck className="h-4 w-4 text-green-500" />
                                ) : (
                                  <ShieldX className="h-4 w-4 text-red-500" />
                                )
                              )}
                              <Label htmlFor={`override-${key}`} className="cursor-pointer">
                                {label}
                              </Label>
                              {hasOverride && (
                                <Badge variant="outline" className="text-xs">
                                  Override
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {hasOverride && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveOverride(key)}
                                  title="Usar padrão do plano"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              <Switch
                                id={`override-${key}`}
                                checked={status.enabled}
                                onCheckedChange={() => handleToggleOverride(key)}
                                disabled={updateOverride.isPending || deleteOverride.isPending}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="text-xs text-muted-foreground pt-4 border-t">
                  <p className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    Feature liberada manualmente (override)
                  </p>
                  <p className="flex items-center gap-2 mt-1">
                    <ShieldX className="h-4 w-4 text-red-500" />
                    Feature bloqueada manualmente (override)
                  </p>
                  <p className="mt-1">
                    Clique em <RotateCcw className="h-3 w-3 inline" /> para remover o override 
                    e usar o padrão do plano
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {!selectedOrgId && (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma organização para gerenciar suas features</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
