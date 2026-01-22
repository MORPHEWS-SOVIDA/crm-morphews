import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useEnabledServices, useToggleService, CORREIOS_SERVICES } from '@/hooks/useShippingQuote';

export function ShippingServicesConfig() {
  const { data: enabledServices = [], isLoading } = useEnabledServices();
  const toggleService = useToggleService();

  const isServiceEnabled = (code: string) => {
    const service = enabledServices.find(s => s.service_code === code);
    // Default to true for PAC and SEDEX if not configured
    if (!service) {
      return code === '03220' || code === '03298';
    }
    return service.is_enabled;
  };

  const handleToggle = (code: string, name: string) => {
    const currentlyEnabled = isServiceEnabled(code);
    toggleService.mutate({
      serviceCode: code,
      serviceName: name,
      isEnabled: !currentlyEnabled,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-1">Serviços de Frete</h4>
        <p className="text-xs text-muted-foreground">
          Selecione quais serviços serão cotados e exibidos para os vendedores
        </p>
      </div>
      
      <div className="space-y-3">
        {CORREIOS_SERVICES.map((service) => {
          const enabled = isServiceEnabled(service.code);
          const isPending = toggleService.isPending;
          
          return (
            <div
              key={service.code}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <Label 
                  htmlFor={`service-${service.code}`}
                  className="font-medium cursor-pointer"
                >
                  {service.name}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {service.description}
                </p>
              </div>
              <Switch
                id={`service-${service.code}`}
                checked={enabled}
                onCheckedChange={() => handleToggle(service.code, service.name)}
                disabled={isPending}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
