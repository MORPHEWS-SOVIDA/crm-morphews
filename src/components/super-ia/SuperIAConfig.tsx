import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFollowupConfig, useUpdateFollowupConfig } from "@/hooks/useSuperIA";
import { useFunnelStages } from "@/hooks/useFunnelStages";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

interface Props {
  organizationId: string;
}

export function SuperIAConfig({ organizationId }: Props) {
  const { data: config, isLoading } = useFollowupConfig(organizationId);
  const updateConfig = useUpdateFollowupConfig();
  const { profile } = useAuth();
  const { data: stages } = useFunnelStages();
  const [localConfig, setLocalConfig] = useState<any>(null);

  useEffect(() => {
    if (config) setLocalConfig({ ...config });
  }, [config]);

  if (isLoading || !localConfig) return null;

  const handleSave = () => {
    updateConfig.mutate(
      { organizationId, config: localConfig },
      {
        onSuccess: () => toast.success("Configuração salva!"),
        onError: (e) => toast.error("Erro: " + e.message),
      }
    );
  };

  const updateField = (key: string, value: any) => {
    setLocalConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const updateTrigger = (key: string, value: boolean) => {
    setLocalConfig((prev: any) => ({
      ...prev,
      triggers: { ...prev.triggers, [key]: value },
    }));
  };

  const excludedStages: string[] = localConfig.excluded_stage_ids || [];
  
  const toggleStageExclusion = (stageId: string) => {
    setLocalConfig((prev: any) => {
      const current: string[] = prev.excluded_stage_ids || [];
      const updated = current.includes(stageId)
        ? current.filter((id: string) => id !== stageId)
        : [...current, stageId];
      return { ...prev, excluded_stage_ids: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Master Switch */}
      <Card>
        <CardHeader>
          <CardTitle>Super IA — Follow-up Automático</CardTitle>
          <CardDescription>
            Quando ativado, a IA analisa leads inativos e gera follow-ups contextuais automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled" className="text-base font-medium">
              Ativar Super IA
            </Label>
            <Switch
              id="enabled"
              checked={localConfig.enabled}
              onCheckedChange={(v) => updateField("enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timing */}
      <Card>
        <CardHeader>
          <CardTitle>Temporização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horas de inatividade para follow-up</Label>
              <Input
                type="number"
                min={1}
                max={72}
                value={localConfig.inactive_hours || 4}
                onChange={(e) => updateField("inactive_hours", parseInt(e.target.value) || 4)}
              />
              <p className="text-xs text-muted-foreground">
                Após X horas sem resposta, a IA envia follow-up
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cooldown entre follow-ups (horas)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={localConfig.cooldown_hours || 24}
                onChange={(e) => updateField("cooldown_hours", parseInt(e.target.value) || 24)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo de tempo entre dois follow-ups para o mesmo lead
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Máximo de follow-ups por lead</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={localConfig.max_followups_per_lead || 3}
                onChange={(e) => updateField("max_followups_per_lead", parseInt(e.target.value) || 3)}
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Input
                value={localConfig.ai_model || "claude-sonnet"}
                onChange={(e) => updateField("ai_model", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                claude-sonnet | gemini-flash | groq-llama
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horário */}
      <Card>
        <CardHeader>
          <CardTitle>Horário de Funcionamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enviar apenas em horário comercial</Label>
            <Switch
              checked={localConfig.working_hours_only}
              onCheckedChange={(v) => updateField("working_hours_only", v)}
            />
          </div>
          {localConfig.working_hours_only && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="time"
                  value={localConfig.working_hours_start || "08:00"}
                  onChange={(e) => updateField("working_hours_start", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="time"
                  value={localConfig.working_hours_end || "20:00"}
                  onChange={(e) => updateField("working_hours_end", e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gatilhos */}
      <Card>
        <CardHeader>
          <CardTitle>Gatilhos de Follow-up</CardTitle>
          <CardDescription>
            Eventos que geram follow-ups automáticos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "cron_inactive", label: "⏰ Lead inativo", desc: "Quando o cliente para de responder" },
            { key: "event_stage_change", label: "📊 Mudança de etapa", desc: "Quando o lead muda de etapa no funil" },
            { key: "event_cart_abandon", label: "🛒 Carrinho abandonado", desc: "Quando o cliente abandona o checkout" },
            { key: "event_post_sale", label: "🎉 Pós-venda", desc: "Após uma compra ser concluída" },
            { key: "event_payment_declined", label: "❌ Pagamento recusado", desc: "Quando o pagamento é recusado" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={localConfig.triggers?.[key] ?? false}
                onCheckedChange={(v) => updateTrigger(key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Etapas excluídas */}
      <Card>
        <CardHeader>
          <CardTitle>Etapas Excluídas do Follow-up</CardTitle>
          <CardDescription>
            Leads nestas etapas do funil NÃO receberão follow-up automático
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stages && stages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
              {stages.map((stage: any) => (
                <label
                  key={stage.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={excludedStages.includes(stage.id)}
                    onCheckedChange={() => toggleStageExclusion(stage.id)}
                  />
                  <span className="text-sm">{stage.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma etapa do funil configurada</p>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={updateConfig.isPending} className="w-full gap-2">
        {updateConfig.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar Configuração
      </Button>
    </div>
  );
}
