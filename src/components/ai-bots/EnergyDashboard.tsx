import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Battery, BatteryCharging, Zap, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrganizationEnergy } from "@/hooks/useAIBots";

interface EnergyDashboardProps {
  energy: OrganizationEnergy;
}

export function EnergyDashboard({ energy }: EnergyDashboardProps) {
  const totalEnergy = energy.included_energy + energy.bonus_energy;
  const usedPercentage = totalEnergy > 0 ? (energy.used_energy / totalEnergy) * 100 : 0;
  const availablePercentage = 100 - usedPercentage;
  
  // Determinar cor baseado no nível de energia
  const getEnergyColor = () => {
    if (availablePercentage > 50) return "text-green-500";
    if (availablePercentage > 20) return "text-yellow-500";
    return "text-red-500";
  };
  
  const getProgressColor = () => {
    if (availablePercentage > 50) return "bg-green-500";
    if (availablePercentage > 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Energia Principal */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full bg-background ${getEnergyColor()}`}>
              {availablePercentage > 20 ? (
                <BatteryCharging className="h-8 w-8" />
              ) : (
                <Battery className="h-8 w-8" />
              )}
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground">Energia Disponível</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${getEnergyColor()}`}>
                  {energy.available_energy.toLocaleString('pt-BR')}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {totalEnergy.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          </div>
          
          {/* Barra de Progresso */}
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Utilizado: {energy.used_energy.toLocaleString('pt-BR')}</span>
              <span>{availablePercentage.toFixed(1)}% restante</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${getProgressColor()}`}
                style={{ width: `${availablePercentage}%` }}
              />
            </div>
          </div>
          
          {/* Info Adicional */}
          <div className="flex items-center gap-6 text-sm">
            {energy.bonus_energy > 0 && (
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-muted-foreground">Bônus</p>
                  <p className="font-medium">{energy.bonus_energy.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Renova em</p>
                <p className="font-medium">
                  {format(new Date(energy.reset_at), "dd/MM", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
