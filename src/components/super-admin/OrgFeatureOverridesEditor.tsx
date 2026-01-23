import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, RotateCcw, ShieldCheck, ShieldX, MinusCircle } from "lucide-react";
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

type OverrideState = "plan" | "force_on" | "force_off";

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
  const overridesMap: Record<string, { isEnabled: boolean; id: string }> = {};
  overrides?.forEach((o) => {
    overridesMap[o.feature_key] = { isEnabled: o.is_enabled, id: o.id };
  });

  const getFeatureState = (featureKey: string): { 
    overrideState: OverrideState; 
    planDefault: boolean;
    finalEnabled: boolean;
  } => {
    const planDefault = planFeaturesMap[featureKey] ?? false; // Default to FALSE if not in plan
    
    if (overridesMap[featureKey] !== undefined) {
      const overrideEnabled = overridesMap[featureKey].isEnabled;
      return { 
        overrideState: overrideEnabled ? "force_on" : "force_off",
        planDefault,
        finalEnabled: overrideEnabled
      };
    }
    
    return { 
      overrideState: "plan", 
      planDefault,
      finalEnabled: planDefault
    };
  };

  const handleSetOverrideState = (featureKey: string, newState: OverrideState) => {
    if (!selectedOrgId) return;
    
    if (newState === "plan") {
      // Remove override - use plan default
      deleteOverride.mutate({
        organizationId: selectedOrgId,
        featureKey,
      });
    } else {
      // Create/update override
      updateOverride.mutate({
        organizationId: selectedOrgId,
        featureKey,
        isEnabled: newState === "force_on",
      });
    }
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
  const isMutating = updateOverride.isPending || deleteOverride.isPending;

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

        {/* Legend */}
        {selectedOrgId && (
          <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-muted/50 text-xs">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-muted-foreground" />
              <span>Usar Plano (default)</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Forçar Ativado</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-500" />
              <span>Forçar Desativado</span>
            </div>
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
                        const state = getFeatureState(key);
                        const hasOverride = state.overrideState !== "plan";
                        
                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border ${
                              hasOverride 
                                ? state.overrideState === "force_on"
                                  ? "border-green-500/50 bg-green-500/5" 
                                  : "border-red-500/50 bg-red-500/5"
                                : "bg-card"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{label}</span>
                                {hasOverride && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      state.overrideState === "force_on" 
                                        ? "border-green-500 text-green-600" 
                                        : "border-red-500 text-red-600"
                                    }`}
                                  >
                                    Override
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={state.overrideState === "plan" ? "default" : "outline"}
                                className="h-7 text-xs flex-1"
                                onClick={() => handleSetOverrideState(key, "plan")}
                                disabled={isMutating}
                              >
                                <MinusCircle className="h-3 w-3 mr-1" />
                                Plano
                                {state.overrideState === "plan" && (
                                  <span className="ml-1 opacity-70">
                                    ({state.planDefault ? "ON" : "OFF"})
                                  </span>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={state.overrideState === "force_on" ? "default" : "outline"}
                                className={`h-7 text-xs flex-1 ${
                                  state.overrideState === "force_on" 
                                    ? "bg-green-600 hover:bg-green-700" 
                                    : ""
                                }`}
                                onClick={() => handleSetOverrideState(key, "force_on")}
                                disabled={isMutating}
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Forçar ON
                              </Button>
                              <Button
                                size="sm"
                                variant={state.overrideState === "force_off" ? "default" : "outline"}
                                className={`h-7 text-xs flex-1 ${
                                  state.overrideState === "force_off" 
                                    ? "bg-red-600 hover:bg-red-700" 
                                    : ""
                                }`}
                                onClick={() => handleSetOverrideState(key, "force_off")}
                                disabled={isMutating}
                              >
                                <ShieldX className="h-3 w-3 mr-1" />
                                Forçar OFF
                              </Button>
                            </div>
                            
                            {/* Show plan default info when using plan */}
                            {state.overrideState === "plan" && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Padrão do plano: {state.planDefault ? "Ativado" : "Desativado"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
