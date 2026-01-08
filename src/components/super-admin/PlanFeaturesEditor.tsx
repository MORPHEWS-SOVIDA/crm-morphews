import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Package } from "lucide-react";
import { 
  AVAILABLE_FEATURES, 
  FeatureKey, 
  usePlanFeatures, 
  useBulkUpdatePlanFeatures 
} from "@/hooks/usePlanFeatures";
import { useSubscriptionPlans } from "@/hooks/useSubscription";

export function PlanFeaturesEditor() {
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const { data: planFeatures, isLoading: featuresLoading } = usePlanFeatures(selectedPlanId);
  const bulkUpdate = useBulkUpdatePlanFeatures();
  
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local features when plan features load
  useEffect(() => {
    if (!planFeatures) return;
    
    const featureMap: Record<string, boolean> = {};
    // Start with all features enabled by default
    Object.keys(AVAILABLE_FEATURES).forEach((key) => {
      featureMap[key] = true;
    });
    // Override with saved values
    planFeatures.forEach((pf) => {
      featureMap[pf.feature_key] = pf.is_enabled;
    });
    setLocalFeatures(featureMap);
    setHasChanges(false);
  }, [planFeatures]);

  const handleToggle = (featureKey: string, enabled: boolean) => {
    setLocalFeatures((prev) => ({ ...prev, [featureKey]: enabled }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedPlanId) return;
    
    const features = Object.entries(localFeatures).map(([key, enabled]) => ({
      feature_key: key,
      is_enabled: enabled,
    }));
    
    bulkUpdate.mutate({ planId: selectedPlanId, features });
    setHasChanges(false);
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

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  if (plansLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Features por Plano
        </CardTitle>
        <CardDescription>
          Configure quais módulos e funcionalidades estão incluídos em cada plano de assinatura
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Selector */}
        <div className="space-y-2">
          <Label>Selecione o Plano</Label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Escolha um plano para configurar" />
            </SelectTrigger>
            <SelectContent>
              {plans?.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  <span className="flex items-center gap-2">
                    {plan.name}
                    <span className="text-muted-foreground">
                      ({formatPrice(plan.price_cents)}/mês)
                    </span>
                    {!plan.is_active && (
                      <Badge variant="outline" className="text-xs">Oculto</Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Features List */}
        {selectedPlanId && (
          <>
            {featuresLoading ? (
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
                      {features.map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <Label htmlFor={`feature-${key}`} className="cursor-pointer">
                            {label}
                          </Label>
                          <Switch
                            id={`feature-${key}`}
                            checked={localFeatures[key] ?? true}
                            onCheckedChange={(checked) => handleToggle(key, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Save Button */}
                {hasChanges && (
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={handleSave}
                      disabled={bulkUpdate.isPending}
                      className="gap-2"
                    >
                      {bulkUpdate.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar Features do Plano
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!selectedPlanId && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione um plano para configurar suas features</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
