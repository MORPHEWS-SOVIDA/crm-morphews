import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Plus, 
  Pencil, 
  Save, 
  Loader2, 
  Package, 
  Users, 
  CreditCard, 
  Zap, 
  Eye, 
  EyeOff,
  Copy,
  Trash2,
  ChevronRight
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AVAILABLE_FEATURES, FeatureKey, usePlanFeatures, useBulkUpdatePlanFeatures } from "@/hooks/usePlanFeatures";

interface SubscriptionPlan {
  id: string;
  name: string;
  price_cents: number;
  max_users: number;
  max_leads: number | null;
  extra_user_price_cents: number;
  monthly_energy: number | null;
  is_active: boolean;
  stripe_price_id: string | null;
  created_at: string;
}

interface PlanFormData {
  name: string;
  price_cents: number;
  max_users: number;
  max_leads: number | null;
  extra_user_price_cents: number;
  monthly_energy: number;
  is_active: boolean;
  stripe_price_id: string;
}

const defaultFormData: PlanFormData = {
  name: "",
  price_cents: 0,
  max_users: 1,
  max_leads: null,
  extra_user_price_cents: 9700,
  monthly_energy: 1000,
  is_active: true,
  stripe_price_id: "",
};

export function PlanEditor() {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>(defaultFormData);
  const [featureChanges, setFeatureChanges] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all plans
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["subscription-plans-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_cents", { ascending: true });
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch features for selected plan
  const { data: planFeatures, isLoading: featuresLoading } = usePlanFeatures(selectedPlanId || undefined);
  const bulkUpdateFeatures = useBulkUpdatePlanFeatures();

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      const { data: newPlan, error } = await supabase
        .from("subscription_plans")
        .insert({
          name: data.name,
          price_cents: data.price_cents,
          max_users: data.max_users,
          max_leads: data.max_leads,
          extra_user_price_cents: data.extra_user_price_cents,
          monthly_energy: data.monthly_energy,
          is_active: data.is_active,
          stripe_price_id: data.stripe_price_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return newPlan;
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans-admin"] });
      toast({ title: "Plano criado", description: `${newPlan.name} foi criado com sucesso.` });
      setShowCreateDialog(false);
      setFormData(defaultFormData);
      setSelectedPlanId(newPlan.id);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar plano", description: error.message, variant: "destructive" });
    },
  });

  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PlanFormData> }) => {
      const { error } = await supabase
        .from("subscription_plans")
        .update({
          name: data.name,
          price_cents: data.price_cents,
          max_users: data.max_users,
          max_leads: data.max_leads,
          extra_user_price_cents: data.extra_user_price_cents,
          monthly_energy: data.monthly_energy,
          is_active: data.is_active,
          stripe_price_id: data.stripe_price_id || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans-admin"] });
      toast({ title: "Plano atualizado", description: "As alterações foram salvas." });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  // Load plan data when selected
  useEffect(() => {
    if (selectedPlanId && plans) {
      const plan = plans.find((p) => p.id === selectedPlanId);
      if (plan) {
        setFormData({
          name: plan.name,
          price_cents: plan.price_cents,
          max_users: plan.max_users,
          max_leads: plan.max_leads,
          extra_user_price_cents: plan.extra_user_price_cents,
          monthly_energy: plan.monthly_energy || 1000,
          is_active: plan.is_active,
          stripe_price_id: plan.stripe_price_id || "",
        });
        setHasChanges(false);
      }
    }
  }, [selectedPlanId, plans]);

  // Load features when plan changes
  useEffect(() => {
    if (!planFeatures) return;
    const featureMap: Record<string, boolean> = {};
    Object.keys(AVAILABLE_FEATURES).forEach((key) => {
      featureMap[key] = true; // Default all to enabled
    });
    planFeatures.forEach((pf) => {
      featureMap[pf.feature_key] = pf.is_enabled;
    });
    setFeatureChanges(featureMap);
  }, [planFeatures]);

  const handleFormChange = (field: keyof PlanFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleFeatureToggle = (featureKey: string, enabled: boolean) => {
    setFeatureChanges((prev) => ({ ...prev, [featureKey]: enabled }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedPlanId) return;

    // Save plan data
    await updatePlanMutation.mutateAsync({ id: selectedPlanId, data: formData });

    // Save features
    const features = Object.entries(featureChanges).map(([key, enabled]) => ({
      feature_key: key,
      is_enabled: enabled,
    }));
    await bulkUpdateFeatures.mutateAsync({ planId: selectedPlanId, features });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getFeaturesByGroup = () => {
    const groups: Record<string, { key: FeatureKey; label: string }[]> = {};
    Object.entries(AVAILABLE_FEATURES).forEach(([key, value]) => {
      if (!groups[value.group]) groups[value.group] = [];
      groups[value.group].push({ key: key as FeatureKey, label: value.label });
    });
    return groups;
  };

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);

  if (plansLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Editor de Planos</h2>
          <p className="text-muted-foreground">
            Crie e edite planos de assinatura, defina preços, limites e módulos disponíveis
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Plano</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Plano *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Enterprise"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço (centavos)</Label>
                  <Input
                    type="number"
                    value={formData.price_cents}
                    onChange={(e) => setFormData({ ...formData, price_cents: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(formData.price_cents)}/mês
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Energia IA/mês</Label>
                  <Input
                    type="number"
                    value={formData.monthly_energy}
                    onChange={(e) => setFormData({ ...formData, monthly_energy: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máx. Usuários</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Máx. Leads</Label>
                  <Input
                    type="number"
                    placeholder="Ilimitado"
                    value={formData.max_leads ?? ""}
                    onChange={(e) => setFormData({ ...formData, max_leads: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Visível no site</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => createPlanMutation.mutate(formData)}
                disabled={!formData.name || createPlanMutation.isPending}
                className="flex-1"
              >
                {createPlanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Plano
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-12 gap-6">
        {/* Plans List - Left Side */}
        <div className="md:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Planos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {plans?.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left p-4 hover:bg-accent/50 transition-colors flex items-center justify-between ${
                      selectedPlanId === plan.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{plan.name}</span>
                        {!plan.is_active && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Oculto
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatPrice(plan.price_cents)}/mês
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {plan.max_users}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {(plan.monthly_energy || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Editor - Right Side */}
        <div className="md:col-span-8">
          {selectedPlan ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />
                      Editando: {selectedPlan.name}
                    </CardTitle>
                    <CardDescription>
                      Configure todos os aspectos deste plano
                    </CardDescription>
                  </div>
                  {hasChanges && (
                    <Button
                      onClick={handleSave}
                      disabled={updatePlanMutation.isPending || bulkUpdateFeatures.isPending}
                      className="gap-2"
                    >
                      {(updatePlanMutation.isPending || bulkUpdateFeatures.isPending) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar Alterações
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-350px)] pr-4">
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                        Informações Básicas
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome do Plano</Label>
                          <Input
                            value={formData.name}
                            onChange={(e) => handleFormChange("name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Stripe Price ID</Label>
                          <Input
                            value={formData.stripe_price_id}
                            onChange={(e) => handleFormChange("stripe_price_id", e.target.value)}
                            placeholder="price_..."
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Pricing & Limits */}
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                        Preços e Limites
                      </h3>
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Preço Mensal
                          </Label>
                          <Input
                            type="number"
                            value={formData.price_cents}
                            onChange={(e) => handleFormChange("price_cents", parseInt(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">
                            = {formatPrice(formData.price_cents)}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Máx. Usuários
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={formData.max_users}
                            onChange={(e) => handleFormChange("max_users", parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Máx. Leads</Label>
                          <Input
                            type="number"
                            placeholder="Ilimitado"
                            value={formData.max_leads ?? ""}
                            onChange={(e) => handleFormChange("max_leads", e.target.value ? parseInt(e.target.value) : null)}
                          />
                          <p className="text-xs text-muted-foreground">
                            {formData.max_leads === null ? "Ilimitado" : `${formData.max_leads} leads`}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Energia IA/mês
                          </Label>
                          <Input
                            type="number"
                            value={formData.monthly_energy}
                            onChange={(e) => handleFormChange("monthly_energy", parseInt(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">
                            {formData.monthly_energy.toLocaleString()} créditos
                          </p>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label>Preço por Usuário Extra (centavos)</Label>
                          <Input
                            type="number"
                            value={formData.extra_user_price_cents}
                            onChange={(e) => handleFormChange("extra_user_price_cents", parseInt(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">
                            = {formatPrice(formData.extra_user_price_cents)}/usuário extra
                          </p>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                          <div>
                            <Label className="flex items-center gap-2">
                              {formData.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              Visível no Site
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formData.is_active 
                                ? "Clientes podem ver e contratar este plano" 
                                : "Plano oculto, apenas para uso interno"}
                            </p>
                          </div>
                          <Switch
                            checked={formData.is_active}
                            onCheckedChange={(checked) => handleFormChange("is_active", checked)}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Features */}
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                        Módulos e Funcionalidades
                      </h3>
                      {featuresLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <Accordion type="multiple" defaultValue={Object.keys(getFeaturesByGroup())} className="w-full">
                          {Object.entries(getFeaturesByGroup()).map(([groupName, features]) => (
                            <AccordionItem key={groupName} value={groupName}>
                              <AccordionTrigger className="text-sm font-medium">
                                {groupName}
                                <Badge variant="secondary" className="ml-2">
                                  {features.filter((f) => featureChanges[f.key] !== false).length}/{features.length}
                                </Badge>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="grid md:grid-cols-2 gap-3 pt-2">
                                  {features.map(({ key, label }) => (
                                    <div
                                      key={key}
                                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                    >
                                      <Label htmlFor={`feature-${key}`} className="cursor-pointer text-sm">
                                        {label}
                                      </Label>
                                      <Switch
                                        id={`feature-${key}`}
                                        checked={featureChanges[key] ?? true}
                                        onCheckedChange={(checked) => handleFeatureToggle(key, checked)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Selecione um Plano</h3>
                <p className="text-muted-foreground max-w-sm">
                  Clique em um plano na lista à esquerda para editar seus detalhes, preços e módulos disponíveis
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
