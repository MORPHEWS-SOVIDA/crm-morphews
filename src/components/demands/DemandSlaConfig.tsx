import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDemandSlaConfig, useUpdateSlaConfig } from '@/hooks/useDemandDetails';
import { URGENCY_CONFIG } from '@/types/demand';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const URGENCY_ICONS = {
  low: Info,
  medium: AlertCircle,
  high: AlertTriangle,
};

const DEFAULT_SLA = {
  low: 72,
  medium: 48,
  high: 24,
};

export function DemandSlaConfig() {
  const { data: slaConfigs, isLoading } = useDemandSlaConfig();
  const updateSla = useUpdateSlaConfig();

  const [formValues, setFormValues] = useState<Record<string, number>>({
    low: DEFAULT_SLA.low,
    medium: DEFAULT_SLA.medium,
    high: DEFAULT_SLA.high,
  });

  useEffect(() => {
    if (slaConfigs) {
      const values: Record<string, number> = { ...DEFAULT_SLA };
      slaConfigs.forEach(config => {
        values[config.urgency] = config.hours;
      });
      setFormValues(values);
    }
  }, [slaConfigs]);

  const handleSave = async (urgency: string) => {
    await updateSla.mutateAsync({
      urgency,
      hours: formValues[urgency],
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Configuração de SLA</h2>
        <p className="text-sm text-muted-foreground">
          Defina o prazo máximo (em horas) para cada nível de urgência. O SLA começa a contar a partir da criação da demanda.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(URGENCY_CONFIG) as Array<keyof typeof URGENCY_CONFIG>).map((urgency) => {
          const config = URGENCY_CONFIG[urgency];
          const Icon = URGENCY_ICONS[urgency];
          const currentConfig = slaConfigs?.find(c => c.urgency === urgency);
          const hasChanges = formValues[urgency] !== (currentConfig?.hours ?? DEFAULT_SLA[urgency]);

          return (
            <Card key={urgency}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Urgência {config.label}</CardTitle>
                    <CardDescription>
                      {urgency === 'high' && 'Prazo mais curto'}
                      {urgency === 'medium' && 'Prazo intermediário'}
                      {urgency === 'low' && 'Prazo mais longo'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Prazo em horas
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={formValues[urgency]}
                      onChange={(e) => setFormValues(prev => ({
                        ...prev,
                        [urgency]: parseInt(e.target.value) || 1
                      }))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">horas</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ≈ {Math.round(formValues[urgency] / 24 * 10) / 10} dias
                  </p>
                </div>

                <Button 
                  onClick={() => handleSave(urgency)}
                  disabled={!hasChanges || updateSla.isPending}
                  size="sm"
                  className="w-full"
                >
                  Salvar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Como funciona o SLA?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>O prazo começa a contar automaticamente quando a demanda é criada</li>
                <li>Demandas que ultrapassam o SLA ficam marcadas como atrasadas</li>
                <li>O SLA é incluído nas notificações de WhatsApp</li>
                <li>Alterações aqui afetam apenas novas demandas</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
